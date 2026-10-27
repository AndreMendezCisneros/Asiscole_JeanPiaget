"""Asistencias e incidencias del PERSONAL del colegio para la app.

Un empleado aparece en la app como estudiante virtual
(`ID_PERSONAL_OFFSET + id_personal`, ver `apps.ingesta.personal`). Estas
funciones responden con la misma forma que las de estudiantes, leyendo las
tablas `registros_llegada_personal`, `personal_horario` e `incidencias_personal`.
Los ids de incidencia que ve la app también son virtuales (offset + id), así las
confirmaciones en la BD central nunca chocan con las de estudiantes.
"""

from __future__ import annotations

import calendar
from datetime import date

from django.db import connections
from django.utils import timezone

from apps.common.errors import StudentLinkNotFound
from apps.cuentas.models import Apoderado, ConfirmacionIncidencia
from apps.ingesta.personal import ID_PERSONAL_OFFSET

_ESTADO_APP = {
    "a tiempo": "a_tiempo",
    "fuera de horario": "a_tiempo",
    "tarde": "tarde",
    "tarde justificada": "tarde",
    "falta": "falta",
}


def id_personal_de(id_virtual: int) -> int:
    return int(id_virtual) - ID_PERSONAL_OFFSET


def agenda_mensual(alias: str, *, id_virtual: int, anio: int, mes: int) -> dict:
    """Mes del empleado: día sin horario = sin registro; día con horario pasado sin fila = falta."""
    pid = id_personal_de(id_virtual)
    with connections[alias].cursor() as c:
        c.execute(
            """SELECT fecha, estado, hora_llegada, hora_salida, tipo_salida
                 FROM public.registros_llegada_personal
                WHERE id_personal = %s AND EXTRACT(YEAR FROM fecha) = %s AND EXTRACT(MONTH FROM fecha) = %s""",
            [pid, anio, mes],
        )
        registros = {f[0]: f for f in c.fetchall()}
        c.execute("SELECT dia_semana FROM public.personal_horario WHERE id_personal = %s", [pid])
        dias_horario = {int(f[0]) for f in c.fetchall()}
        c.execute(
            "SELECT (timezone('America/Lima', fecha_creacion))::date FROM public.personal WHERE id_personal = %s",
            [pid],
        )
        fila = c.fetchone()
        alta = fila[0] if fila else None
        c.execute(
            """SELECT fecha FROM public.calendario_no_lectivo
                WHERE activo IS TRUE AND EXTRACT(YEAR FROM fecha) = %s AND EXTRACT(MONTH FROM fecha) = %s""",
            [anio, mes],
        )
        feriados = {f[0] for f in c.fetchall()}

    hoy = timezone.localdate()
    items = []
    for dia in range(1, calendar.monthrange(anio, mes)[1] + 1):
        fecha = date(anio, mes, dia)
        reg = registros.get(fecha)
        if reg is not None:
            _, estado, llegada, salida, tipo_salida = reg
            sin_llegada = llegada is not None and llegada.strftime("%H:%M") == "00:00"
            items.append(
                {
                    "fecha": fecha.isoformat(),
                    # Falta/Tarde justificada se muestran como sin registro (igual que estudiantes).
                    "estado": _ESTADO_APP.get((estado or "").strip().lower(), "sin_registro"),
                    "hora_entrada": None if sin_llegada or llegada is None else llegada.strftime("%H:%M"),
                    "hora_salida": salida.strftime("%H:%M") if salida else None,
                    "tipo_salida": tipo_salida,
                }
            )
            continue
        le_toca = fecha.isoweekday() in dias_horario and fecha not in feriados and (alta is None or fecha >= alta)
        items.append(
            {
                "fecha": fecha.isoformat(),
                "estado": "falta" if le_toca and fecha < hoy else "sin_registro",
                "hora_entrada": None,
                "hora_salida": None,
                "tipo_salida": None,
            }
        )
    return {"items": items}


_SQL_INCIDENCIAS = """
    SELECT i.id_incidencia, i.fecha_hora_registro, f.categoria, f.nombre_falta, f.es_grave,
           coalesce(i.registrado_por_nombre, u.nombre_completo), i.observaciones
      FROM public.incidencias_personal i
      JOIN public.catalogo_faltas f ON f.id_falta = i.id_falta
      LEFT JOIN public.usuarios u ON u.id_usuario = i.id_usuario_registro
     WHERE i.id_personal = %s AND i.estado <> 'Anulada'
"""


def _item(fila, confirmacion: ConfirmacionIncidencia | None) -> dict:
    id_inc, fecha, categoria, falta, grave, reporto, obs = fila
    return {
        "id": ID_PERSONAL_OFFSET + int(id_inc),
        "fecha": fecha.isoformat(),
        "categoria": categoria,
        "falta": falta,
        "es_grave": bool(grave),
        "tiene_evidencia": False,
        "reportado_por": reporto,
        "observaciones": obs,
        "confirmada": confirmacion is not None,
        "confirmada_en": confirmacion.confirmada_en.isoformat() if confirmacion else None,
    }


def listar_incidencias(
    alias: str, apoderado: Apoderado, tenant_id: str, *, id_virtual: int, desde: str | None, hasta: str | None
) -> dict:
    sql = _SQL_INCIDENCIAS
    args: list = [id_personal_de(id_virtual)]
    if desde:
        sql += " AND (timezone('America/Lima', i.fecha_hora_registro))::date >= %s"
        args.append(desde)
    if hasta:
        sql += " AND (timezone('America/Lima', i.fecha_hora_registro))::date <= %s"
        args.append(hasta)
    sql += " ORDER BY i.fecha_hora_registro DESC LIMIT 200"
    with connections[alias].cursor() as c:
        c.execute(sql, args)
        filas = c.fetchall()
    ids = [ID_PERSONAL_OFFSET + int(f[0]) for f in filas]
    confirmaciones = {
        x.id_incidencia_colegio: x
        for x in ConfirmacionIncidencia.objects.filter(
            apoderado=apoderado, tenant_id=tenant_id, id_incidencia_colegio__in=ids
        )
    }
    return {"items": [_item(f, confirmaciones.get(ID_PERSONAL_OFFSET + int(f[0]))) for f in filas]}


def _buscar(alias: str, *, id_virtual: int, incidencia_id: int):
    if int(incidencia_id) < ID_PERSONAL_OFFSET:
        return None
    with connections[alias].cursor() as c:
        c.execute(
            _SQL_INCIDENCIAS + " AND i.id_incidencia = %s",
            [id_personal_de(id_virtual), int(incidencia_id) - ID_PERSONAL_OFFSET],
        )
        return c.fetchone()


def detalle_incidencia(
    alias: str, apoderado: Apoderado, tenant_id: str, *, id_virtual: int, incidencia_id: int
) -> dict:
    fila = _buscar(alias, id_virtual=id_virtual, incidencia_id=incidencia_id)
    if fila is None:
        raise StudentLinkNotFound()
    confirmacion = ConfirmacionIncidencia.objects.filter(
        apoderado=apoderado, tenant_id=tenant_id, id_incidencia_colegio=int(incidencia_id)
    ).first()
    return {**_item(fila, confirmacion), "evidencias": []}


def confirmar_incidencia(
    alias: str, apoderado: Apoderado, tenant_id: str, *, id_virtual: int, incidencia_id: int
) -> None:
    """Guarda la confirmación en la BD central; no toca `incidencias` de estudiantes."""
    if _buscar(alias, id_virtual=id_virtual, incidencia_id=incidencia_id) is None:
        raise StudentLinkNotFound()
    ConfirmacionIncidencia.objects.get_or_create(
        apoderado=apoderado,
        tenant_id=tenant_id,
        id_incidencia_colegio=int(incidencia_id),
        defaults={"confirmada_en": timezone.now()},
    )
