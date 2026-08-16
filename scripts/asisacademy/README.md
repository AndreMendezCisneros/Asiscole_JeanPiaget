# Asis Academy — nueva BD Supabase (demo)

## Orden en SQL Editor (proyecto NUEVO)

**Obligatorio en este orden.** Si saltas el `01`, el `02` falla con `relation "public.estudiantes" does not exist`.

1. `01_SIE_CORE_RPC.sql` — crea `estudiantes`, `usuarios`, RPCs, etc.  
   → Debe terminar **sin errores** (verás `Success`).
2. `02_TALLERES_PENSIONES_TABLES.sql` — talleres, pensiones, outbox  
3. `03_SEED_ASIS_ACADEMY_DEMO.sql` — config, faltas, 4 usuarios, **30 alumnos**, taller demo
4. `04_PENSIONES_RPC.sql` — funciones `sie_pensiones_*` (sin esto, `/pensiones` da PGRST202)  
5. `05_NOTAS_AREAS.sql` — áreas/carreras, semanas, declaraciones, notas y RPCs `sie_notas_*`  
   *(opcional: `scripts/TALLERES_JP.sql` si faltan políticas/índices de talleres)*
6. `08_NOTAS_POR_ESTUDIANTE.sql` — RPC `sie_notas_por_estudiante` (historial para padre/app)

No ejecutar esto sobre Jean Piaget en producción.

## Notas por área (paso 05)

- Flag frontend: `VITE_NOTAS_ENABLED=true` (Academy). JP deja el flag apagado/ausente.
- Menú: **Estudiantes → Notas** (`/notas`). Semanas se crean en **Administración → Configuración**.
- Fixture Excel demo: `fixtures/notas_SEMANA_DEMO.xlsx` (DNI, Nombre, Nota).
- Flujo: crear semana abierta → declarar área → importar Excel → ranking/export.
- Historial para padre/app: paso 6 `08_NOTAS_POR_ESTUDIANTE.sql` (`sie_notas_por_estudiante`).
- Avisos a la app: `VITE_MOBILE_INGEST_ENABLED=true` + `/canal-api` + tenant `asis_academy`.

## Usuarios demo (password `123456`)

| Usuario | Rol |
|---------|-----|
| `AdminAcademy` | Admin |
| `DirectorDemo` | Director |
| `TutorDemo` | Tutor |
| `Rudeus` | Admin |

## Alumnos (30)

- **6 reales** de JP Secundaria **≠ 1ro** (5to A + 1 de 6to B), con sus contactos JP
- **24 inventados** en 5to A/B, teléfonos `95120xxxx` (no se usan números de 1ro JP)

## VPS Asis Academy

Hoy `/opt/sie-academy` apunta al mismo Supabase que JP. Tras crear el proyecto nuevo:

1. Actualizar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.build`
2. Rebuild / redeploy del frontend

## Regenerar seed

```bash
python scripts/asisacademy/gen_seed_only.py
```

## Archivo legacy

`BOOTSTRAP_ASIS_ACADEMY_DEMO.sql` = tablas mínimas + seed (sin todas las RPCs). Preferir el orden 01→02→03.
