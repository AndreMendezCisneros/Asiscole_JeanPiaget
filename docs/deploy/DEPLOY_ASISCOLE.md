# Despliegue asiscole.com (VPS Hetzner)

## Flujo automático (recomendado)

1. Hacés cambios en el código.
2. `git push origin main`
3. En **≤ 3 minutos** el VPS hace `git pull`, `npm run build` y publica en `/opt/sie/dist`.

También podés forzar al instante (con GitHub Actions configurado):

```bash
git push origin main   # dispara workflow deploy-asiscole.yml vía SSH
```

## Secrets de GitHub (solo para deploy instantáneo vía Actions)

| Secret | Valor |
|--------|--------|
| `VPS_HOST` | `178.104.115.2` |
| `VPS_SSH_PRIVATE_KEY` | clave privada `hetzner-sie` |

Variables de build están en el VPS: `/opt/sie/.env.build` (no subir a Git).

## Deploy manual local (emergencia)

```powershell
npm run build
scp -i E:\ssh-keys\hetzner-sie -r dist\* root@178.104.115.2:/opt/sie/dist/
```

## Actualizaciones sin Ctrl+F5

- **Caddy** (`scripts/asiscole-caddy.caddy`): rutas SPA (`/incidents`, `/dashboard`, …) envían `Cache-Control: no-cache` (no solo `/`).
- **Build**: cada deploy genera `dist/build-version.json` con el commit (`VITE_BUILD_ID`).
- **App**: al volver a la pestaña o cada 5 min, compara versión y recarga sola si hubo deploy.

Variables de build están en el VPS: `/opt/sie/.env.build` (no subir a Git).

## SQL en Supabase

Los parches en `scripts/PATCH_*.sql` se ejecutan **a mano** en el SQL Editor de Supabase (no van en el deploy del frontend).
