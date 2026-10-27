"""Avisos del personal del colegio (no estudiantes) en la app, como si fueran hijos.

Los eventos llegan por `asis_outbox` con tipo `personal_entrada`,
`personal_salida` o `personal_incidencia` (triggers de
`scripts/jeanpiaget/PATCH_PERSONAL_AVISOS.sql`; `id_estudiante` del outbox =
id_personal). Cada empleado existe en el directorio como estudiante virtual
(`ID_PERSONAL_OFFSET + id_personal`, vista `asis_v_directorio_personal`)
vinculado al celular de la Promotoría; el aviso llega a quien esté vinculado,
igual que con los estudiantes.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import IntegrityError, transaction

from apps.mensajeria.models import Mensaje

logger = logging.getLogger("asiscole.ingesta")

#: Id del empleado en el canal = offset + id_personal (no choca con id_estudiante).
ID_PERSONAL_OFFSET = 1_000_000
TIPOS_PERSONAL = frozenset({"personal_entrada", "personal_salida", "personal_incidencia"})
#: Tipo de mensaje de la app para cada evento del personal.
TIPO_MENSAJE = {
    "personal_entrada": "entrada",
    "personal_salida": "salida",
    "personal_incidencia": "incidencia",
}


def es_evento_personal(tipo: str) -> bool:
    return (tipo or "").strip().lower() in TIPOS_PERSONAL


def id_virtual(id_personal: int) -> int:
    return ID_PERSONAL_OFFSET + int(id_personal)


def es_id_personal(id_estudiante: int) -> bool:
    return int(id_estudiante) >= ID_PERSONAL_OFFSET


def _hhmm(valor: Any) -> str:
    return str(valor or "").strip()[:5]


def _fecha(valor: Any) -> str:
    texto = str(valor or "").strip()[:10]
    if len(texto) == 10 and texto[4] == "-":
        return f"{texto[8:10]}/{texto[5:7]}/{texto[0:4]}"
    return texto


def redactar(tipo: str, p: dict[str, Any]) -> str:
    """Texto del aviso. Una o dos frases, sin emojis."""
    nombre = str(p.get("nombre_completo") or "").strip() or "Un trabajador"
    categoria = str(p.get("categoria") or "").strip()
    quien = f"{nombre} ({categoria})" if categoria else nombre
    hora = _hhmm(p.get("hora"))
    fecha = _fecha(p.get("fecha"))

    if tipo == "personal_entrada":
        estado = str(p.get("estado") or "").strip()
        esperada = _hhmm(p.get("hora_esperada"))
        if estado == "Falta":
            if hora and hora != "00:00":
                salida = _hhmm(p.get("hora_salida_esperada"))
                limite = f" ({salida})" if salida else ""
                return (
                    f"Personal: {quien} llegó a las {hora}, después de su hora de salida{limite}. "
                    "Quedó como inasistencia."
                )
            return f"Personal: {quien} no registró ingreso el {fecha}; quedó como inasistencia."
        if estado == "Tarde":
            return (
                f"Personal: {quien} ingresó a las {hora}, después de su hora de entrada "
                f"({esperada}). Quedó como tardanza."
            )
        if estado == "Fuera de horario":
            return f"Personal: {quien} ingresó a las {hora}, en un día que no le toca asistir."
        sufijo = f" (entrada {esperada})." if esperada else "."
        return f"Personal: {quien} ingresó a las {hora}{sufijo}"

    if tipo == "personal_salida":
        tipo_salida = str(p.get("tipo_salida") or "").strip()
        esperada = _hhmm(p.get("hora_salida_esperada"))
        if tipo_salida == "Anticipada":
            return f"Personal: {quien} salió a las {hora}, antes de su hora de salida ({esperada}), sin autorización."
        if tipo_salida == "Autorizada":
            return f"Personal: {quien} salió a las {hora}, antes de su hora de salida, con permiso."
        return f"Personal: {quien} salió a las {hora}."

    falta = str(p.get("nombre_falta") or "").strip() or "falta"
    grave = " grave" if p.get("es_grave") else ""
    frases = [f"Personal: se registró una incidencia{grave} de {quien}: {falta}."]
    if p.get("nombre_usuario_registro"):
        frases.append(f"Reportada por {p['nombre_usuario_registro']}.")
    observaciones = str(p.get("observaciones") or "").strip()
    if observaciones:
        frases.append(f"Observaciones: {observaciones}")
    return " ".join(frases)


def crear_mensajes_personal(
    *,
    tenant_id: str,
    tipo: str,
    id_personal: int,
    id_registro: int,
    payload: dict[str, Any],
) -> list[Mensaje]:
    """Crea un mensaje por cuenta vinculada al empleado (idempotente por origen)."""
    from apps.ingesta.services import _apoderados_destino

    tipo = (tipo or "").strip().lower()
    texto = redactar(tipo, payload)
    virtual = id_virtual(id_personal)
    # Estado y hora van en el origen: una "Falta" automática corregida luego con
    # la llegada real genera un segundo aviso, no se descarta como duplicado.
    estado = str(payload.get("estado") or payload.get("tipo_salida") or "").strip()
    origen = f"{tipo}:{int(id_registro)}:{estado}:{_hhmm(payload.get('hora'))}"
    # Para incidencias el id que la app pide en el detalle también es virtual.
    id_registro_app = id_virtual(id_registro) if tipo == "personal_incidencia" else int(id_registro)
    metadata = {
        "tipo": TIPO_MENSAJE.get(tipo, tipo),
        "tenant_id": tenant_id,
        "contexto": "personal",
        "evento": tipo,
        "id_estudiante": virtual,
        "estudiante_nombre": payload.get("nombre_completo"),
        "grado": "Personal",
        "seccion": payload.get("categoria"),
        "id_registro": id_registro_app,
        "fecha": payload.get("fecha"),
        "hora": _hhmm(payload.get("hora")) or None,
        "estado": payload.get("estado"),
        "tipo_salida": payload.get("tipo_salida"),
        "es_grave": bool(payload.get("es_grave")) if tipo == "personal_incidencia" else None,
    }
    metadata = {k: v for k, v in metadata.items() if v not in (None, "")}

    creados: list[Mensaje] = []
    for cuenta in _apoderados_destino(tenant_id, virtual):
        try:
            with transaction.atomic():
                creados.append(
                    Mensaje.objects.create(
                        apoderado=cuenta,
                        tenant_id=tenant_id,
                        id_estudiante=virtual,
                        tipo=TIPO_MENSAJE.get(tipo, tipo),
                        texto=texto,
                        metadata=metadata,
                        origen_evento=origen,
                    )
                )
        except IntegrityError:
            logger.info(
                "mensaje_personal_duplicado_omitido",
                extra={"tenant": tenant_id, "tipo": tipo, "id_registro": id_registro},
            )
    return creados
