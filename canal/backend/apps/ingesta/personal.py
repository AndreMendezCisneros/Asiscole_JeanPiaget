"""Avisos del personal del colegio (no estudiantes) hacia la Promotoría.

Los eventos llegan por `asis_outbox` con tipo `personal_entrada`,
`personal_salida` o `personal_incidencia` (triggers de
`scripts/jeanpiaget/PATCH_PERSONAL_AVISOS.sql`). Los reciben, como mensaje de
bandeja, las cuentas de administración de la app cuyos `usuarios.id_usuario`
estén en `configuracion_sistema.promotoria_usuarios` (lista separada por comas).
Nunca se avisa a apoderados: el personal no está en el directorio de familias.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import IntegrityError, connections, transaction

from apps.cuentas.models import CUENTA_ACTIVA, Apoderado, identidad_administrador
from apps.mensajeria.models import TIPO_AVISO, Mensaje
from config.db_router import tenant_alias

logger = logging.getLogger("asiscole.ingesta")

CLAVE_PROMOTORIA = "promotoria_usuarios"
TIPOS_PERSONAL = frozenset({"personal_entrada", "personal_salida", "personal_incidencia"})


def es_evento_personal(tipo: str) -> bool:
    return (tipo or "").strip().lower() in TIPOS_PERSONAL


def ids_promotoria(tenant_id: str) -> list[int]:
    """`usuarios.id_usuario` configurados como Promotoría en el colegio."""
    with connections[tenant_alias(tenant_id)].cursor() as cursor:
        cursor.execute(
            "SELECT valor FROM public.configuracion_sistema WHERE clave = %s",
            [CLAVE_PROMOTORIA],
        )
        fila = cursor.fetchone()
    crudo = str((fila[0] if fila else "") or "")
    return sorted({int(x) for x in crudo.replace(";", ",").split(",") if x.strip().isdigit()})


def destinatarios_promotoria(tenant_id: str) -> list[Apoderado]:
    """Cuentas activas de la app (modo administración) de la Promotoría."""
    ids = ids_promotoria(tenant_id)
    if not ids:
        return []
    identidades = [identidad_administrador(tenant_id, i) for i in ids]
    return list(Apoderado.objects.filter(telefono__in=identidades, estado=CUENTA_ACTIVA))


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
    id_registro: int,
    payload: dict[str, Any],
) -> list[Mensaje]:
    """Crea un mensaje por cuenta de Promotoría (idempotente por origen)."""
    tipo = (tipo or "").strip().lower()
    texto = redactar(tipo, payload)
    # Estado y hora van en el origen: una "Falta" automática corregida luego con
    # la llegada real genera un segundo aviso, no se descarta como duplicado.
    estado = str(payload.get("estado") or payload.get("tipo_salida") or "").strip()
    origen = f"{tipo}:{int(id_registro)}:{estado}:{_hhmm(payload.get('hora'))}"
    metadata = {
        "tipo": TIPO_AVISO,
        "tenant_id": tenant_id,
        "contexto": "personal",
        "evento": tipo,
        "id_registro": int(id_registro),
        "id_personal": payload.get("id_personal"),
        "fecha": payload.get("fecha"),
        "hora": _hhmm(payload.get("hora")) or None,
        "estado": payload.get("estado"),
    }
    metadata = {k: v for k, v in metadata.items() if v not in (None, "")}

    creados: list[Mensaje] = []
    for cuenta in destinatarios_promotoria(tenant_id):
        try:
            with transaction.atomic():
                creados.append(
                    Mensaje.objects.create(
                        apoderado=cuenta,
                        tenant_id=tenant_id,
                        id_estudiante=None,
                        tipo=TIPO_AVISO,
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
