# Base de datos (Supabase / Postgres)

Scripts SQL de mantenimiento y configuración del SIE. **No se ejecutan automáticamente** al desplegar la app: hay que aplicarlos manualmente en el SQL Editor de Supabase (o vía `psql`) cuando corresponda.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `sql/crear/` | Tablas, buckets, usuarios de ejemplo |
| `sql/actualizar/` | Actualizaciones de datos o esquema puntual |
| `sql/agregar/` | Nuevas columnas, estados, roles |
| `sql/corregir/` | Correcciones de datos o lógica |
| `sql/solucion/` | Scripts compuestos de solución (reincidencia, etc.) |
| `sql/funciones/` | Funciones RPC requeridas por el frontend |
| `sql/verificar/` | Consultas de diagnóstico |
| `sql/otros/` | Portal padres, horarios, vínculos puntuales |

## Scripts frecuentes

- **Funciones base del sistema:** `sql/funciones/FUNCIONES_SQL_REQUERIDAS.sql`
- **Citaciones con padres:** `sql/crear/CREAR_TABLA_CITAS_PADRES.sql`
- **Portal de padres:** `sql/otros/PUBLIC_PORTAL_PADRES.sql`
- **Storage de fotos:** `sql/crear/CREAR_BUCKETS_STORAGE.sql`

## Configuración

Ver también `docs/configuracion/CONFIGURACION_BD.md` e `INSTRUCCIONES_FUNCION_SQL.md`.
