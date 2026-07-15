# SIE — guía para agentes

Este proyecto usa **Cursor Agent Skills** en `.agents/skills/`.

## Skills instaladas

| Skill | Uso |
|-------|-----|
| `sie-sistema` | Convenciones propias del SIE (leer primero) |
| `react-dev` | React + TypeScript |
| `supabase` | Cliente, auth, RLS, migraciones |
| `supabase-postgres-best-practices` | Queries e índices Postgres |
| `vite` | `vite.config.ts`, build, proxy |
| `vitest` | Tests unitarios |
| `tailwind-design-system` | Tokens, layout, componentes |
| `accessibility` | WCAG, teclado, aria-live |
| `eslint-prettier-config` | Lint y formato |
| `gsap-core`, `gsap-react`, `gsap-timeline`, etc. | Animaciones GSAP (login → portal padres) |

Listar: `npx skills list -a cursor`

Buscar más: `npx skills find <tema>`

Restaurar lockfile: `npx skills experimental_install`

## Despliegue Cloudflare (frontend estático)

Configuración en el **dashboard de Cloudflare** → proyecto `sie` → Builds:

| Campo | Valor |
|-------|--------|
| Build command | `npm ci && npm run build:cf:ci` |
| Deploy command | *(vacío o `echo ok`)* |
| Build variable | `SKIP_DEPENDENCY_INSTALL` = `true` |
| Output directory | `dist` |

El build ya incluye `npm ci` vía caché de Cloudflare con `SKIP_DEPENDENCY_INSTALL`; si hace falta instalar a mano: `npm ci && npm run build:cf:ci`.

**Importante:** no dejar `bun.lock` ni `bun.lockb` en el repo. Si el build sigue fallando: **Clear build cache** y redeploy.

**No usar** preset "Framework: Vite" ni `npx wrangler deploy` a pelo.  
**No añadir** `public/_redirects` (choca con SPA de `wrangler.toml`).

Variables de build en Cloudflare (opcional): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_OPENWA_ENABLED=false`.

Archivos clave: `wrangler.toml`, `public/_headers`, `.node-version`.

```bash
npm run build:cf   # Build producción
npm run cf:deploy  # Deploy (tras build)
npm run deploy:cf  # Build + deploy local
```

## Comandos

```bash
npm run dev      # App :8080
npm run openwa   # WhatsApp :2785 / dashboard :2886
npm run test     # Vitest
npm run build
```

## Idioma UI

Interfaz y mensajes en **español** (`lang="es"`).
