# Canal Asiscole — Revisado / confirmación de incidencias

Dos señales de la app hacia el SIE (`incidencias.revisado_app` / `confirmada_app`):

- Check azul en la bandeja → `POST /mensajes/leidos` → **Visto**
- Botón «Confirmar que recibí esta incidencia» → `POST /incidencias/{id}/confirmar`
  → **Confirmada** (también marca revisado)

## Archivos

- `backend/apps/mensajeria/revisado_colegio.py`
- Llamada desde `marcar_leidos` en `apps/mensajeria/services.py`
- Llamada desde `confirmar_incidencia` en `apps/academico/services.py`

En `marcar_leidos`, después de actualizar `leido=True`:

```python
filas = list(qs.values("tipo", "origen_evento", "tenant_id", "metadata"))
actualizados = qs.update(leido=True, leido_en=ahora)
from apps.mensajeria.revisado_colegio import propagar_revisado_incidencias
propagar_revisado_incidencias(filas)
```

En `confirmar_incidencia`, después de `ConfirmacionIncidencia.get_or_create`:

```python
from apps.mensajeria.revisado_colegio import marcar_confirmada_colegio
marcar_confirmada_colegio(vinculo.tenant_id, incidencia_id)
```

SQL del colegio: `scripts/INCIDENCIAS_REVISADO_APP.sql`.

El contenedor **no** monta el código (solo `/secrets`). Copiar al host y al contenedor.

```bash
cp canal/backend/apps/mensajeria/revisado_colegio.py /opt/asiscole-canal/backend/apps/mensajeria/
docker cp canal/backend/apps/mensajeria/revisado_colegio.py \
  asiscole_canal_backend:/app/apps/mensajeria/revisado_colegio.py
docker restart asiscole_canal_backend
```
