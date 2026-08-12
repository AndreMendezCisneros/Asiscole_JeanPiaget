# Canal Asiscole — Revisado de incidencias

Al marcar un mensaje de incidencia como leído (check azul), el canal actualiza
`incidencias.revisado_app` en la BD del colegio. El SIE web muestra la columna **Revisado**.

## Archivos

- `backend/apps/mensajeria/revisado_colegio.py`
- Llamada desde `marcar_leidos` en `apps/mensajeria/services.py`

En `marcar_leidos`, después de actualizar `leido=True`:

```python
filas = list(qs.values("tipo", "origen_evento", "tenant_id", "metadata"))
actualizados = qs.update(leido=True, leido_en=ahora)
from apps.mensajeria.revisado_colegio import propagar_revisado_incidencias
propagar_revisado_incidencias(filas)
```

SQL del colegio: `scripts/INCIDENCIAS_REVISADO_APP.sql`.

## Aplicar en VPS

```bash
cp canal/backend/apps/mensajeria/revisado_colegio.py /opt/asiscole-canal/backend/apps/mensajeria/
# parchear marcar_leidos como arriba
docker restart asiscole_canal_backend
```
