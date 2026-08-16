# Canal Asiscole

El Django de ingesta vive en el VPS (`POST /canal-api/v0.1/ingesta/eventos`). Este repo emite el contrato desde el SIE (`src/lib/services/mobileIngest.ts`). El APK/backend deben aceptar los tipos de abajo.

Academy necesita `VITE_MOBILE_INGEST_ENABLED=true`, `VITE_MOBILE_INGEST_URL=/canal-api` y `VITE_MOBILE_INGEST_TENANT=asis_academy` (rebuild en `/opt/sie-academy`). Sin eso, citas/pensiones/notas se guardan en el SIE y no llegan a la app.

## Contrato de ingesta

Hay **dos canales** hacia la app. Hay que usar el correcto.

| `tipo` | Destino en la app | `contexto` |
|--------|-------------------|------------|
| `aviso` | Bandeja de avisos | `pension` o `cita` |
| `entrada` / `salida` | Sección Asistencias | opcional `taller` |
| `incidencia` | Incidencias | — |
| `nota` | Sección Notas (registro estructurado) | — |

`id_registro` identifica la fila origen (llegada, incidencia, `citas_padres.id_cita`, `notas_semana.id`, o seed si el lote no devolvió id).

### Aviso — pensión

```json
{
  "tenant_id": "asis_academy",
  "tipo": "aviso",
  "id_estudiante": 10,
  "id_registro": 501,
  "payload": {
    "nombre_completo": "Ana Pérez",
    "grado": "2003",
    "seccion": "5",
    "nivel_educativo": "Pre-universitario",
    "periodo": "2026-03",
    "contexto": "pension",
    "texto_libre": "La pensión del periodo 03/2026 de Ana Pérez figura sin pago. …"
  }
}
```

### Aviso — citación

Al **crear** la cita (individual o masiva). No se reenvía al reprogramar ni al cambiar estado.

```json
{
  "tenant_id": "asis_academy",
  "tipo": "aviso",
  "id_estudiante": 10,
  "id_registro": 44,
  "payload": {
    "nombre_completo": "Ana Pérez",
    "grado": "2003",
    "seccion": "5",
    "nivel_educativo": "Pre-universitario",
    "contexto": "cita",
    "fecha": "2026-08-20",
    "hora": "09:30",
    "motivo": "Revisión de incidencias",
    "alcance": "individual",
    "texto_libre": "Se citó a los padres de Ana Pérez el 20/08/2026 a las 09:30. Motivo: Revisión de incidencias."
  }
}
```

`alcance`: `individual` | `apafa` | `piso` | `salon`. Campos extra (`fecha`, `hora`, `motivo`, `alcance`) para tarjeta; `texto_libre` para la bandeja.

### Asistencia — entrada / salida

Registro estructurado (no es aviso de texto). Payload típico: `fecha`, `hora_llegada` o `hora_salida`, `estado`, `tipo_salida`. Taller añade `contexto: "taller"`.

### Incidencia

`tipo: "incidencia"` con `nombre_falta`, `categoria`, `fecha`, `hora`, `observaciones`.

### Nota — sección Notas (como asistencia)

No usar `tipo: "aviso"` + `contexto: "nota"`: eso solo llena la bandeja. El SIE emite `tipo: "nota"` con campos de semana/nota/área. `texto_libre` queda de respaldo por si la app aún no tiene la sección.

```json
{
  "tenant_id": "asis_academy",
  "tipo": "nota",
  "id_estudiante": 10,
  "id_registro": 991,
  "payload": {
    "nombre_completo": "Ana Pérez",
    "grado": "2003",
    "seccion": "5",
    "nivel_educativo": "Pre-universitario",
    "semana_codigo": "2026-02",
    "semana_etiqueta": "Semana 2",
    "fecha_inicio": "2026-02-03",
    "fecha_fin": "2026-02-09",
    "nota": "18.5",
    "nota_maxima": "20",
    "area_codigo": "salud",
    "area_nombre": "Ciencias de la Salud",
    "carrera": "Medicina Humana",
    "registrado_en": "2026-08-15T15:00:00-05:00",
    "texto_libre": "Se registró la nota semanal de Ana Pérez: 18.5/20 (Semana 2)."
  }
}
```

Lectura del historial en el colegio: RPC `sie_notas_por_estudiante(p_id_estudiante, p_limit)` (`scripts/asisacademy/08_NOTAS_POR_ESTUDIANTE.sql`). Padre vía `sie_padre_puede_ver_estudiante`; staff con sesión. El canal puede persistir el ingest o consultar ese RPC.

---

# Revisado / confirmación de incidencias

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
