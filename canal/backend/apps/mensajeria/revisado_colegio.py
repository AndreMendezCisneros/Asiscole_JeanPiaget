"""Propaga la lectura del mensaje de incidencia al colegio (SIE web).

Cuando el apoderado abre el aviso en la app (`POST /mensajes/leidos`, check azul),
el canal marca `asis_mensaje.leido` y, si el mensaje es una incidencia, actualiza
`public.incidencias.revisado_app` en la BD del colegio para que el listado web
muestre la columna Revisado.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger("asiscole.mensajeria.revisado")

_SQL_MARCAR = """
    UPDATE public.incidencias
       SET revisado_app = TRUE,
           revisado_app_en = COALESCE(revisado_app_en, now())
     WHERE id_incidencia = ANY(%s)
       AND COALESCE(revisado_app, FALSE) = FALSE
"""


def id_incidencia_desde_mensaje(
    *,
    tipo: str | None,
    origen_evento: str | None,
    metadata: dict[str, Any] | None = None,
) -> int | None:
    """Extrae el id de incidencia del colegio a partir del mensaje del canal."""
    if (tipo or "").strip().lower() != "incidencia":
        return None

    origen = (origen_evento or "").strip()
    if origen.lower().startswith("incidencia:"):
        sufijo = origen.split(":", 1)[1].strip()
        if sufijo.isdigit():
            return int(sufijo)

    extra = metadata or {}
    crudo = extra.get("id_registro", extra.get("id_incidencia"))
    if crudo is None:
        return None
    try:
        valor = int(crudo)
    except (TypeError, ValueError):
        return None
    return valor if valor > 0 else None


def ids_incidencia_por_tenant(filas: list[dict[str, Any]]) -> dict[str, list[int]]:
    """Agrupa ids de incidencia por tenant, sin duplicados y en orden estable."""
    agrupados: dict[str, list[int]] = defaultdict(list)
    vistos: dict[str, set[int]] = defaultdict(set)
    for fila in filas:
        tenant_id = str(fila.get("tenant_id") or "").strip()
        if not tenant_id:
            continue
        incidencia_id = id_incidencia_desde_mensaje(
            tipo=str(fila.get("tipo") or ""),
            origen_evento=fila.get("origen_evento"),
            metadata=fila.get("metadata") if isinstance(fila.get("metadata"), dict) else None,
        )
        if incidencia_id is None or incidencia_id in vistos[tenant_id]:
            continue
        vistos[tenant_id].add(incidencia_id)
        agrupados[tenant_id].append(incidencia_id)
    return dict(agrupados)


def propagar_revisado_incidencias(filas: list[dict[str, Any]]) -> dict[str, int]:
    """Marca incidencias como revisadas en cada BD de colegio.

    Nunca relanza: un fallo del colegio no debe impedir marcar el mensaje leído.
    """
    from django.db import connections

    from config.db_router import tenant_alias

    resumen: dict[str, int] = {}
    for tenant_id, ids in ids_incidencia_por_tenant(filas).items():
        try:
            alias = tenant_alias(tenant_id)
            with connections[alias].cursor() as cursor:
                cursor.execute(_SQL_MARCAR, [ids])
                resumen[tenant_id] = cursor.rowcount or 0
        except Exception:  # noqa: BLE001
            logger.warning(
                "revisado_colegio_fallo",
                extra={"tenant": tenant_id, "ids": len(ids)},
            )
            resumen[tenant_id] = 0
    if resumen:
        logger.info("revisado_colegio_ok", extra={"detalle": resumen})
    return resumen
