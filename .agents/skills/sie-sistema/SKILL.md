---
name: sie-sistema
description: >-
  SIE — Sistema de Incidencias Escolares (React 18, Vite, TypeScript, Tailwind,
  shadcn/ui, Supabase). Usar en tareas del proyecto mock-flow-designer: portal
  padres, escáner tutor, staff, auditoría, OpenWA/WhatsApp, reincidencia y RLS.
---

# SIE — convenciones del proyecto

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Storage)
- **Integraciones:** OpenWA (WhatsApp tutor), proxy Vite `/sc-proxy` → `:2785`

## Rutas clave

| Ruta | Rol |
|------|-----|
| `/tutor-scanner` | Tutor — escaneo rápido + WhatsApp |
| `/parent-portal` | Padres — `ParentLayout` (sin sidebar staff) |
| Staff | `Layout` + `Sidebar` con submenús |

## Patrones obligatorios

1. **Servicios** en `src/lib/services/` — no llamar Supabase directo desde páginas.
2. **Zona horaria Lima** — usar `getLimaNow()` / `getLimaTodayDate()` de `@/lib/utils/limaDateTime`.
3. **Escáner tutor** — índice en memoria (`studentsService.prefetchBarcodeIndex`), UI optimista, guardado en background.
4. **Supabase queries** — seleccionar solo columnas necesarias; evitar N+1; respetar RLS.
5. **UI staff** — componentes `StaffToolbar`, `StaffKpiStat`, `StaffDataPanel`, tokens en `index.css`.
6. **Tokens de color** — fuente única `:root` en `index.css`; login/tutor derivan de `--primary` y `--login-*`.
7. **Accesibilidad** — `lang="es"`, skip link, regiones `aria-live` en flujos críticos (escaneo).
8. **WhatsApp** — `whatsappService.notifyParentArrival` en background; variables en `.env.local`.

## Variables de entorno (`.env.local`)

```env
VITE_OPENWA_ENABLED=true
VITE_OPENWA_API_URL=/sc-proxy
VITE_OPENWA_SESSION_ID=<uuid del dashboard :2886>
VITE_OPENWA_API_KEY=dev-admin-key
```

## Skills relacionadas instaladas

`react-dev`, `supabase`, `supabase-postgres-best-practices`, `vite`, `vitest`, `tailwind-design-system`, `accessibility`, `eslint-prettier-config`

## Comandos

```bash
npm run dev          # SIE :8080
npm run openwa       # OpenWA API :2785 + dashboard :2886
npm run test         # Vitest
npm run build
npx skills list -a cursor
```
