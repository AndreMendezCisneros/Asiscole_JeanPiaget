# SIE — Institución Educativa Emblemática Mariscal Cáceres

Sistema de Incidencias y Asistencia Escolar (SIE) para **Mariscal Cáceres**. Frontend React + Vite; backend **Supabase** (Postgres, Storage, RPC) y canal móvil vía `/canal-api`.

**Dominio previsto:** [mariscalcaceres.asiscole.com](https://mariscalcaceres.asiscole.com/). Esta rama no despliega al servidor.

## Stack

- Vite 5, React 18, TypeScript
- Tailwind CSS, shadcn/ui, Radix
- TanStack Query, React Router
- Supabase JS client
- Vitest (tests unitarios)

## Estructura del repositorio

```
asiscole_mariscalcaceres/
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
git clone https://github.com/AndreMendezCisneros/asiscole_mariscalcaceres.git
cd asiscole_mariscalcaceres
npm install
```

### Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores cuando exista el proyecto Supabase del colegio. Hasta entonces la URL y la anon key quedan vacías.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_APP_URL=http://localhost:8080
VITE_SCHOOL_NAME=Institución Educativa Emblemática Mariscal Cáceres
VITE_TALLERES_ENABLED=true
VITE_PENSIONES_ENABLED=true
VITE_MOBILE_INGEST_ENABLED=true
VITE_MOBILE_INGEST_URL=/canal-api
VITE_MOBILE_INGEST_KEY=tu_clave_ingesta
VITE_MOBILE_INGEST_TENANT=mariscal_caceres
```

Para notificaciones al aplicativo en local, Vite proxifica `/canal-api` hacia `mariscalcaceres.asiscole.com` (ver `vite.config.ts`). Ese dominio aún no está publicado.

### Arrancar

```bash
npm run dev
```

Abre [http://localhost:8080](http://localhost:8080). Si faltan las variables de Supabase, la consola avisa que la base no está configurada.

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

## Despliegue

Esta rama no se publica. El workflow de Jean Piaget sigue en el repositorio y solo corre en `main`; no se usa desde aquí. El dominio previsto es `mariscalcaceres.asiscole.com`.

## Documentación

- Índice general: [docs/README.md](docs/README.md)
- Manual de usuario: [docs/manual/MANUAL_DE_USUARIO.md](docs/manual/MANUAL_DE_USUARIO.md)
- Agentes Cursor: [AGENTS.md](AGENTS.md)

## Licencia

Proyecto privado — Institución Educativa Emblemática Mariscal Cáceres.
