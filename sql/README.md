# Scripts SQL (organización)

Scripts de esquema, migraciones y datos one-off. Ejecutar en el SQL Editor de Supabase según la guía correspondiente en `docs/`.

| Carpeta | Contenido |
|---------|-----------|
| [schema/](schema/) | Funciones base, buckets, portal público |
| [migraciones/](migraciones/) | `AGREGAR_*`, `ACTUALIZAR_*`, `CREAR_*`, reincidencia, justificada, etc. |
| [datos/](datos/) | Ajustes puntuales de datos (DNI, vínculos padre-hijo) |
| [jeanpiaget/](jeanpiaget/) | SQL específico del colegio Jean Piaget |
| [parches/](parches/) | Reservado; los parches operativos activos están en `scripts/` |

## Parches que no se movieron

Para no romper rutas citadas por el código y por el deploy, estos siguen en la raíz de scripts:

- `scripts/PATCH_*.sql`
- `scripts/RLS_*.sql`
- `scripts/nuevo_supabase.sql`

Ver también [`docs/deploy/DEPLOY_ASISCOLE.md`](../docs/deploy/DEPLOY_ASISCOLE.md).
