# SIE Asiscole — Colegio Jean Piaget

Sistema de Incidencias y Asistencia Escolar (SIE) para el **Colegio Jean Piaget**. Frontend React + Vite; backend **Supabase** (Postgres, Storage, RPC) y canal móvil vía `/canal-api` en el VPS.

**Producción:** [jeanpiaget.asiscole.com](https://jeanpiaget.asiscole.com/)

## Stack

- Vite 5, React 18, TypeScript
- Tailwind CSS, shadcn/ui, Radix
- TanStack Query, React Router
- Supabase JS client
- Vitest (tests unitarios)

## Estructura del repositorio

```
Asiscole_JeanPiaget/
├── src/                 # Código de la aplicación (páginas, componentes, servicios)
├── public/              # Assets estáticos y favicons
├── database/sql/        # Scripts SQL por categoría (crear, actualizar, funciones, …)
├── docs/                # Documentación (manual, configuración, integraciones)
├── scripts/             # Herramientas Node/PowerShell (import, mantenimiento)
├── canal/               # Backend canal móvil (referencia)
├── worker/              # Worker Cloudflare (si aplica)
├── .github/workflows/   # CI/CD (deploy VPS Jean Piaget)
├── AGENTS.md            # Guía para agentes de Cursor
└── .agents/skills/      # Skills del proyecto
```

## Desarrollo local

### Requisitos

- Node.js 20+ (ver `.node-version`)
- npm

### Instalación

```bash
git clone https://github.com/AndreMendezCisneros/Asiscole_JeanPiaget.git
cd Asiscole_JeanPiaget
npm install
```

### Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores. En Jean Piaget el VPS guarda el build en `/opt/sie-jp/.env.build`.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_APP_URL=http://localhost:8080
VITE_SCHOOL_NAME=Colegio Jean Piaget
VITE_TALLERES_ENABLED=true
VITE_PENSIONES_ENABLED=true
VITE_MOBILE_INGEST_ENABLED=true
VITE_MOBILE_INGEST_URL=/canal-api
VITE_MOBILE_INGEST_KEY=tu_clave_ingesta
VITE_MOBILE_INGEST_TENANT=jean_piaget
```

Para notificaciones al aplicativo en local, Vite proxifica `/canal-api` al VPS (ver `vite.config.ts`).

### Arrancar

```bash
npm run dev
```

Abre [http://localhost:8080](http://localhost:8080). En consola del navegador verás el host Supabase activo (`[SIE] Supabase: …`).

## Scripts npm útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 8080) |
| `npm run build` | Build de producción → `dist/` |
| `npm run preview` | Previsualizar `dist/` |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run import:nomina` | Importar nómina de estudiantes |
| `npm run upload:fotos` | Subir fotos de estudiantes a Storage |

## Base de datos

Los scripts SQL están en `database/sql/` (ver `database/README.md`). Las funciones RPC del frontend suelen requerir `database/sql/funciones/FUNCIONES_SQL_REQUERIDAS.sql` en Supabase.

Documentación de configuración: `docs/configuracion/CONFIGURACION_BD.md`.

## Despliegue (VPS Hetzner)

Rama `main` → workflow `.github/workflows/deploy-jeanpiaget.yml` sincroniza a `/opt/sie-jp/app` y publica en `/opt/sie-jp/dist`. Variables en `/opt/sie-jp/.env.build`. Caddy sirve `jeanpiaget.asiscole.com`.

Despliegue alternativo en Cloudflare Workers: ver `AGENTS.md` y `wrangler.toml`.

## Documentación

- Índice general: [docs/README.md](docs/README.md)
- Manual de usuario: [docs/manual/MANUAL_DE_USUARIO.md](docs/manual/MANUAL_DE_USUARIO.md)
- Agentes Cursor: [AGENTS.md](AGENTS.md)

## Licencia

Proyecto privado — Colegio Jean Piaget / Asiscole.
