# WhatsApp con WPPConnect Server (SIE / asiscole.com)

**WPPConnect** reemplaza a OpenWA en producción cuando necesitas sesiones que **no se caen** al apagar el celular o perder internet temporalmente. Los tokens quedan en disco (`tokens/` + `userDataDir/`) y el servidor los restaura al reiniciar.

OpenWA ya no se usa en el VPS. WhatsApp va solo por **WPPConnect** (`VITE_WPPCONNECT_ENABLED=true`).

## Arquitectura

| Componente | Puerto / ruta |
|------------|----------------|
| WPPConnect API (Docker) | `127.0.0.1:21465` |
| Proxy público (Caddy) | `https://asiscole.com/wpp-api/...` (rutas concretas) |
| Documentación Swagger | `https://asiscole.com/wpp-api-docs/` |
| Webhook sendSeen (host) | `127.0.0.1:3099/wpp-webhook` |

## Instalación en el VPS (una vez)

Tras `git push` al repo:

```bash
ssh root@178.104.115.2
cd /opt/sie/app && git pull
bash scripts/instalar-wppconnect-vps.sh
bash scripts/wppconnect-mostrar-qr.sh
/opt/sie/deploy.sh   # rebuild frontend con variables WPPConnect
```

El script:

1. Clona [wppconnect-server](https://github.com/wppconnect-team/wppconnect-server) en `/opt/sie/wppconnect`
2. Aplica `scripts/wppconnect/config.ts` (`autoClose: 0`, `deviceSyncTimeout: 0`)
3. Levanta Docker (`sie-wppconnect`)
4. Genera token Bearer y guarda `/opt/sie/.env.wppconnect`
5. Actualiza `/opt/sie/.env.build` y recarga Caddy (`/wpp-api`)

## Vincular el chip (QR)

```bash
# En el VPS
bash /opt/sie/app/scripts/wppconnect-mostrar-qr.sh

# Descargar imagen QR a tu PC
ssh root@178.104.115.2 "curl -sf -H \"Authorization: Bearer \$(grep WPPCONNECT_BEARER_TOKEN /opt/sie/.env.wppconnect | cut -d= -f2)\" http://127.0.0.1:21465/api/sie-chip-01/qrcode-session -o /tmp/wpp-qr.png"
scp root@178.104.115.2:/tmp/wpp-qr.png .
```

Escanee con WhatsApp → Dispositivos vinculados → Vincular dispositivo.

Comprobar conexión:

```bash
curl -H "Authorization: Bearer TOKEN" http://127.0.0.1:21465/api/sie-chip-01/check-connection-session
```

## Variables de build (`.env.build` en VPS)

```env
VITE_WPPCONNECT_ENABLED=true
VITE_WPPCONNECT_API_URL=/wpp-api
VITE_WPPCONNECT_SESSION=sie-chip-01
VITE_WPPCONNECT_TOKEN=<bearer del generate-token>
VITE_OPENWA_ENABLED=false
VITE_APP_URL=https://asiscole.com
```

## Comportamiento “humano” en el SIE

`whatsappService.ts` con WPPConnect:

1. Activa **typing** (`/typing` value: true)
2. Espera **2–3 s** aleatorios
3. Envía mensaje (`/send-message`)
4. Desactiva typing

El webhook en el VPS marca **sendSeen** cuando un padre responde.

## Varias sesiones (7 chips) — rotación activa

El SIE encola cada aviso en **`sie-wpp-notify-queue`** (puerto `3100`, ruta pública `/wpp-notify`).

| Política | Comportamiento |
|----------|----------------|
| **Round-robin** | Escaneo 1 → chip-01, 2 → chip-02, … chip-04 al final (solo si los demás están al tope) |
| **Failover** | Si un chip está desconectado o falla el envío, prueba el siguiente |
| **Jitter** | 8–15 s aleatorios entre mensajes **por cola de chip** |
| **Spintax** | Saludo y cierre aleatorios; hora con **segundos** |
| **Typing** | Simula “escribiendo…” **10–12 s** antes de cada mensaje |
| **Tope horario** | Máx. **250** msg/hora por chip (chip-04: **máx. 2**/hora) |
| **Calentamiento diario** | Chip-04 envía como máximo **2** mensajes; si la ronda necesita más, **otros chips** envían en su lugar |

Capacidad teórica con 7 chips conectados: **~1.748 msg/h** (6×250 + 2). El contador se reinicia al inicio de cada hora en **America/Lima** (UTC−5, sin horario de verano).

Variables en `/opt/sie/.env.wppconnect`:

```env
WPPCONNECT_SESSIONS=sie-chip-01,sie-chip-02,sie-chip-03,sie-chip-05,sie-chip-06,sie-chip-07,sie-chip-04
WPPCONNECT_NOTIFY_SECRET=...
WPPCONNECT_TYPING_MIN_MS=10000
WPPCONNECT_TYPING_MAX_MS=12000
WPPCONNECT_JITTER_MIN_MS=8000
WPPCONNECT_JITTER_MAX_MS=15000
WPPCONNECT_MAX_PER_HOUR_PER_CHIP=250
WPPCONNECT_CHIP_HOURLY_LIMITS=sie-chip-04=2
```

### Autoenvío al chip (San Ramón)

Con `WPPCONNECT_NOTIFY_TO_SELF` (activo por defecto), cada aviso **no** va al apoderado: el chip elegido se envía a **sí mismo** (SIM vinculado):

1. Mensaje con el **número del apoderado** (desde BD)
2. Mensaje **personalizado** de llegada, **salida** o **incidencia** (falta + recomendación del catálogo)

El mapa `WPPCONNECT_CHIP_PHONES` (6 números por chip) solo decide **qué chip** atiende. Cargar mapa:

```bash
bash /opt/sie/app/scripts/wppconnect/set-chip-phones-sr.sh
```

Build del frontend (`.env.build`):

```env
VITE_WPPCONNECT_ROTATION=true
VITE_WPPCONNECT_NOTIFY_URL=/wpp-notify
VITE_WPPCONNECT_NOTIFY_KEY=<mismo que WPPCONNECT_NOTIFY_SECRET>
```

Activar en VPS tras `git pull`:

```bash
bash /opt/sie/app/scripts/activar-rotacion-wpp-vps.sh
systemctl status sie-wpp-notify-queue
curl -s http://127.0.0.1:3100/status | jq
/opt/sie/deploy.sh
```

Estado de colas: `GET https://asiscole.com/wpp-notify/status` (solo localhost en producción; usar SSH + curl).

## Varias sesiones (legacy — una sola sesión)

Si `VITE_WPPCONNECT_ROTATION=false`, el SIE usa una sesión (`VITE_WPPCONNECT_SESSION`).

## Comandos útiles

```bash
docker logs -f sie-wppconnect
docker compose -f /opt/sie/wppconnect/docker-compose.yml restart
pm2 logs sie-wpp-webhook
```

## Migración desde OpenWA

| Antes (OpenWA) | Ahora (WPPConnect) |
|----------------|-------------------|
| `VITE_OPENWA_*` | `VITE_WPPCONNECT_*` |
| `/api/sessions/.../send-text` | `/wpp-api/{session}/send-message` |
| Sesión UUID en dashboard | Token en disco + `startAllSession: true` |

Ver también: [OPENWA_WHATSAPP.md](./OPENWA_WHATSAPP.md) (legacy).
