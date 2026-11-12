"""
PARCHE LOCAL (no aplicado al VPS) — canal asiscole.

Problema:
  La app marca confirmación en BD central (`asis_confirmacion_incidencia`)
  y muestra "Confirmada por el apoderado", pero `confirmar_incidencia`
  NO propaga a la BD del colegio → el SIE sigue con confirmada_app=false
  y la columna Revisado muestra "No".

Archivo en VPS:
  /opt/asiscole-canal/backend/apps/academico/services.py
  función `confirmar_incidencia`

Cambio: tras el get_or_create, llamar a marcar_confirmada_colegio.
Luego reiniciar el backend del canal y (opcional) backfill con
propagar_confirmaciones_existentes para las ya confirmadas.

Cuando autorices tocar el VPS, aplicar este bloque.
"""

# --- reemplazar el cuerpo de confirmar_incidencia por: ---

CONFIRMAR_INCIDENCIA_FIXED = '''
def confirmar_incidencia(
    apoderado: Apoderado, *, incidencia_id: int, estudiante_id: int
) -> None:
    """Marca confirmada en BD central y propaga al colegio (SIE)."""
    from apps.mensajeria.revisado_colegio import marcar_confirmada_colegio

    vinculo = vinculo_estudiante(apoderado, estudiante_id)
    if not circuit_breaker.permite_intentar(vinculo.tenant_id):
        raise UpstreamSchoolDbUnavailable()
    alias = tenant_alias(vinculo.tenant_id)
    try:
        existe = (
            Incidencia.objects.using(alias)
            .filter(pk=incidencia_id, estudiante_id=estudiante_id)
            .exclude(estado="Anulada")
            .exists()
        )
    except Exception as exc:  # noqa: BLE001
        circuit_breaker.registrar_fallo(vinculo.tenant_id)
        raise UpstreamSchoolDbUnavailable() from exc
    circuit_breaker.registrar_exito(vinculo.tenant_id)

    if not existe:
        raise StudentLinkNotFound()

    ConfirmacionIncidencia.objects.get_or_create(
        apoderado=apoderado,
        tenant_id=vinculo.tenant_id,
        id_incidencia_colegio=incidencia_id,
        defaults={"confirmada_en": timezone.now()},
    )
    # Propaga a incidencias.confirmada_app / revisado_app del colegio
    marcar_confirmada_colegio(vinculo.tenant_id, incidencia_id)
'''
