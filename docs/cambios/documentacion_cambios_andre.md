# Documentación de cambios — WhatsApp multi-chip (Andre)

**Proyecto:** SIE Asiscole — I.E. San Ramón  
**Repositorio:** https://github.com/Caley123/mock-flow-designer-06014  
**VPS:** `178.104.115.2` (Hetzner) — `https://asiscole.com`  
**Commit principal:** `246a693` — `feat(whatsapp): cola multi-chip con rotación, 250/h Lima y 7 chips`  
**Fecha de referencia:** junio 2026  

---

## 1. Contexto y problema original

### Qué hace el sistema

Cuando un alumno escanea su carnet al llegar al colegio, el **SIE** registra la llegada y envía un **WhatsApp al apoderado** con el aviso de asistencia.

### Infraestructura WhatsApp

- **Motor:** [WPPConnect Server](https://github.com/wppconnect-team/wppconnect-server) en Docker en el VPS.
- **API interna:** `http://127.0.0.1:21465`
- **Proxy público:** `https://asiscole.com/wpp-api/`
- **Swagger:** `https://asiscole.com/wpp-api-docs/`

### Problema detectado

Con varios chips físicos vinculados (`sie-chip-01`, `02`, `03`…), **todos los mensajes salían por `sie-chip-01`**.

**Causa:** el frontend usaba una sola sesión fija:

```env
VITE_WPPCONNECT_SESSION=sie-chip-01
```

Cada escaneo llamaba directamente a WPPConnect con esa sesión. La documentación anterior describía la rotación entre chips como algo “futuro”.

### Riesgo operativo

| Dato | Valor |
|------|-------|
| Alumnos aprox. | ~2.257 (primaria + secundaria) |
| Hora pico secundaria | 7:15 – 7:40 |
| Hora pico primaria | hasta 8:10 |
| Meta | Todos los avisos enviados antes de las 9:00 |

Un solo chip recibiendo miles de mensajes en una hora aumenta el riesgo de **bloqueo o ban** por WhatsApp.

---

## 2. Solución implementada

### Arquitectura nueva (con rotación activa)

```
┌─────────────────────────────────────────────────────────────────┐
│  Navegador SIE (TutorScanner / escaneo carnet)                  │
│  whatsappService.ts → notifyParentArrival()                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /wpp-notify/enqueue  (rápido, 202)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Caddy (asiscole.com) → reverse_proxy 127.0.0.1:3100            │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  sie-wpp-notify-queue (systemd)                                 │
│  notify-queue.mjs — cola, round-robin, límites, jitter          │
└────────────────────────────┬────────────────────────────────────┘
                             │ por chip elegido
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  WPPConnect API :21465 → chip físico (sie-chip-01 … 07)       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
                        WhatsApp al apoderado
```

### Principio clave

El **escaneo no espera** el envío del mensaje. Solo **encola** el trabajo y continúa. La cola en el servidor reparte la carga entre chips.

### Modo legacy (sin rotación)

Si `VITE_WPPCONNECT_ROTATION=false`, el comportamiento anterior se mantiene: envío directo a una sola sesión (`VITE_WPPCONNECT_SESSION`).

---

## 3. Políticas de la cola (`notify-queue.mjs`)

| Política | Descripción |
|----------|-------------|
| **Round-robin** | Escaneo 1 → chip-01, 2 → chip-02, … 8 → chip-01. Estado persistido en `/opt/sie/.wpp-round-robin-state.json`. |
| **Failover** | Si un chip está desconectado o falla el envío, prueba el siguiente disponible. |
| **Cola por chip** | Cada sesión tiene su propia cola; el procesamiento es secuencial por chip. |
| **Jitter** | Pausa aleatoria de **4–9 s** entre mensajes en cada cola de chip. |
| **Spintax** | Saludo y cierre aleatorios; hora con **segundos** para variar el texto. |
| **Typing** | Simula “escribiendo…” 2–4 s antes de cada mensaje (en el servidor). |
| **Tope horario** | Máx. **250 mensajes/hora por chip**. |
| **Ventana de conteo** | **Hora calendario en Perú/Lima** (`America/Lima`). El contador se reinicia cada `:00` hora Lima. |
| **Autenticación** | Header `X-SIE-Notify-Key` debe coincidir con `WPPCONNECT_NOTIFY_SECRET`. |

### Capacidad teórica actual

| Chips conectados | Máximo por hora calendario Lima |
|------------------|----------------------------------|
| 3 | ~750 msg |
| 7 | **~1.750 msg** (7 × 250) |

### Endpoints de la cola (puerto 3100, solo localhost)

| Método | Ruta | Uso |
|--------|------|-----|
| `POST` | `/enqueue` | Encolar aviso desde el SIE |
| `GET` | `/status` | Estado por chip, colas, contadores |
| `GET` | `/health` | Ping simple |

Ejemplo de estado:

```bash
curl -s http://127.0.0.1:3100/status | jq
```

Respuesta esperada (campos relevantes):

```json
{
  "config": {
    "maxPerChipPerHour": 250,
    "rateWindow": "calendar-hour",
    "rateTimezone": "America/Lima",
    "limaHourKey": "2026-06-28T07",
    "sessions": 7
  },
  "sie-chip-01": { "queueLength": 0, "sentThisHour": 0, "maxPerHour": 250 }
}
```

---

## 4. Archivos creados o modificados

### Commit `246a693` — 14 archivos

#### Frontend

| Archivo | Cambio |
|---------|--------|
| `src/lib/services/whatsappService.ts` | Si `VITE_WPPCONNECT_ROTATION=true`, encola en `/wpp-notify/enqueue` en lugar de enviar directo. Spintax en mensajes. Deduplicación 2 min por alumno/día. |
| `src/vite-env.d.ts` | Tipos para `VITE_WPPCONNECT_ROTATION`, `NOTIFY_URL`, `NOTIFY_KEY`. |
| `.env.example` | Documenta las 3 variables nuevas (valores vacíos, sin secretos). |

#### Cola y cliente WPPConnect (VPS)

| Archivo | Cambio |
|---------|--------|
| `scripts/wppconnect/notify-queue.mjs` | Servicio HTTP de cola: round-robin, límites Lima, jitter, failover. |
| `scripts/wppconnect/lib/arrivalMessage.mjs` | Plantilla de llegada con variación de texto. |
| `scripts/wppconnect/lib/wppClient.mjs` | Cliente interno a WPPConnect (tokens, conexión, envío). |
| `scripts/wppconnect/sie-wpp-notify-queue.service` | Unit systemd para la cola. |

#### Infraestructura y despliegue

| Archivo | Cambio |
|---------|--------|
| `scripts/asiscole-caddy.caddy` | Proxy `/wpp-notify` → `127.0.0.1:3100`; excluye ruta del CSP. |
| `scripts/instalar-wppconnect-vps.sh` | Instala cola + variables de rotación en instalación nueva. |
| `scripts/activar-rotacion-wpp-vps.sh` | Activa o actualiza rotación sin reinstalar WPPConnect completo. |

#### Scripts de operación (Windows / VPS)

| Archivo | Cambio |
|---------|--------|
| `scripts/vincular-chip-wpp.ps1` | Desde Windows: inicia sesión, descarga QR, abre imagen. Chips 02 y 03. |
| `scripts/verificar-chip-wpp.ps1` | Comprueba si un chip está conectado vía SSH. |
| `scripts/enviar-prueba-chips.sh` | Prueba manual de envío entre chips (solo VPS). |

#### Documentación

| Archivo | Cambio |
|---------|--------|
| `docs/whatsapp/WPPCONNECT_WHATSAPP.md` | Arquitectura multi-chip, variables, comandos de activación. |

### No incluido en el commit

| Archivo | Motivo |
|---------|--------|
| `package-lock.json` | Cambios accidentales de npm (sin cambio en `package.json`). Se descartó con `git restore`. |

---

## 5. Variables de entorno

### Frontend — `/opt/sie/.env.build` (build de producción)

```env
VITE_WPPCONNECT_ENABLED=true
VITE_WPPCONNECT_API_URL=/wpp-api
VITE_WPPCONNECT_SESSION=sie-chip-01          # legacy; no se usa si ROTATION=true
VITE_WPPCONNECT_TOKEN=...                    # legacy; no se usa si ROTATION=true

# Rotación (nuevo)
VITE_WPPCONNECT_ROTATION=true
VITE_WPPCONNECT_NOTIFY_URL=/wpp-notify
VITE_WPPCONNECT_NOTIFY_KEY=<mismo valor que WPPCONNECT_NOTIFY_SECRET>
```

### Servidor — `/opt/sie/.env.wppconnect`

```env
WPPCONNECT_SESSIONS=sie-chip-01,sie-chip-02,sie-chip-03,sie-chip-04,sie-chip-05,sie-chip-06,sie-chip-07
WPPCONNECT_NOTIFY_PORT=3100
WPPCONNECT_NOTIFY_SECRET=<generado con openssl rand -hex 16>
WPPCONNECT_JITTER_MIN_MS=4000
WPPCONNECT_JITTER_MAX_MS=9000
WPPCONNECT_MAX_PER_HOUR_PER_CHIP=250
WPPCONNECT_RATE_TIMEZONE=America/Lima        # opcional; default America/Lima
```

### Qué nunca debe subirse a GitHub

- `.env`, `.env.local`, `.env.production`
- `/opt/sie/.env.wppconnect` (tokens reales)
- `/opt/sie/.env.build` (claves reales)
- Claves SSH privadas

---

## 6. Despliegue realizado

### En GitHub (PC local)

```powershell
cd c:\Users\raios\OneDrive\Desktop\asiscole\repo
git add ...   # 14 archivos
git commit -m "feat(whatsapp): cola multi-chip con rotación, 250/h Lima y 7 chips"
git push origin main
```

### En el VPS

```bash
cd /opt/sie/app && git pull
bash /opt/sie/app/scripts/activar-rotacion-wpp-vps.sh
systemctl restart sie-wpp-notify-queue

# Rebuild manual del frontend (necesario porque deploy.sh solo builda si hay commit nuevo)
cd /opt/sie/app
set -a && source /opt/sie/.env.build && set +a
npm ci && npm run build
rsync -a --delete /opt/sie/app/dist/ /opt/sie/dist/
```

**Nota sobre `deploy.sh`:** el script en `/opt/sie/deploy.sh` solo ejecuta `npm run build` cuando `HEAD` ≠ `origin/main`. Si el `git pull` ya actualizó el código antes de cambiar `.env.build`, hay que **forzar el rebuild** manualmente (como arriba) o hacer un commit vacío / tocar el repo para que `deploy.sh` detecte cambio.

### Estado verificado en producción

- Servicio `sie-wpp-notify-queue`: **active**
- 7 sesiones configuradas
- `maxPerChipPerHour`: 250
- `rateTimezone`: America/Lima
- Frontend reconstruido con `VITE_WPPCONNECT_ROTATION=true`

---

## 7. Vinculación de chips (operación)

### Chips planificados

`sie-chip-01` … `sie-chip-07` (7 SIMs / dispositivos).

### Desde Windows (PowerShell)

```powershell
cd c:\Users\raios\OneDrive\Desktop\asiscole\repo
.\scripts\vincular-chip-wpp.ps1 -Chip 02
.\scripts\verificar-chip-wpp.ps1 -Chip 02
```

### Desde VPS / Swagger

```bash
bash /opt/sie/app/scripts/wppconnect-mostrar-qr.sh
# o vía https://asiscole.com/wpp-api-docs/
```

### Errores frecuentes al vincular

| Síntoma | Causa habitual | Solución |
|---------|----------------|----------|
| 401 Unauthorized | Token de un chip usado en otro | Generar token por sesión (`generate-token`) |
| QR expirado | QR caduca ~1 min | Volver a ejecutar script de QR |
| `INITIALIZING` eterno | Navegador Chromium bloqueado (`SingletonLock`, Code 21) | `docker compose restart` + borrar SingletonLock en volúmenes |
| `Disconnected` tras reinicio Docker | Sesión no restaurada | `start-session` de nuevo por chip |

### SSH al VPS

```bash
ssh -i "C:\Users\raios\Downloads\ssh-keys\ssh-keys\hetzner-sie" root@178.104.115.2
```

---

## 8. Evolución de decisiones (historial de la conversación)

| Etapa | Decisión |
|-------|----------|
| Inicio | Confirmado: todos los mensajes salían por chip-01 |
| Diseño | Cola en VPS con round-robin + failover |
| Límite inicial | 80 msg/hora/chip — insuficiente para ~2.100 llegadas/hora |
| Ajuste capacidad | Subir a **200** msg/h, ventana móvil 60 min, 8 chips |
| Ajuste final (Andre) | **7 chips activos**, **250 msg/h**, **hora calendario** (no ventana móvil) |
| Zona horaria | Contador en **America/Lima** (no UTC del servidor) |
| Despliegue | Commit `246a693` + activación en VPS + rebuild frontend |

---

## 9. Comandos útiles de monitoreo

```bash
# Estado de la cola
curl -s http://127.0.0.1:3100/status | jq

# Logs de la cola
journalctl -u sie-wpp-notify-queue -f

# WPPConnect Docker
docker logs -f sie-wppconnect
docker compose -f /opt/sie/wppconnect/docker-compose.yml restart

# Conexión de un chip
source /opt/sie/.env.wppconnect
curl -s -H "Authorization: Bearer $WPPCONNECT_BEARER_TOKEN" \
  http://127.0.0.1:21465/api/sie-chip-01/check-connection-session

# Prueba manual entre chips (en VPS)
bash /opt/sie/app/scripts/enviar-prueba-chips.sh
```

---

## 10. Pendientes y notas

### Pendientes operativos

- [ ] Tener los **7 chips** vinculados y en estado `Connected` antes del día de uso masivo.
- [ ] Probar escaneos reales y confirmar rotación (no solo chip-01) vía `/status` (`sentThisHour` por chip).
- [ ] Monitorear si WhatsApp limita algún chip; ajustar `WPPCONNECT_MAX_PER_HOUR_PER_CHIP` si hace falta.

### Cambios locales en el VPS (no en GitHub)

Al momento del despliegue, el VPS tenía modificaciones locales sin commitear (no parte de este cambio):

- `scripts/wppconnect/webhook-server.mjs`
- `src/lib/services/arrivalService.ts`
- `src/components/parent/ParentAttendanceDashboard.tsx`
- `src/lib/utils/parentAttendanceCalendar.ts`
- `scripts/wppconnect-iniciar-chip.sh` (sin trackear)

Conviene revisar si deben integrarse al repo o descartarse.

### Mejoras futuras posibles

- Parametrizar ruta SSH en scripts PowerShell (hoy es ruta fija de una máquina).
- Hacer que `deploy.sh` detecte cambios en `.env.build` y rebuild automático.
- Ampliar `vincular-chip-wpp.ps1` para chips 01, 04–07 (hoy solo 02 y 03).
- Dashboard o alerta si un chip queda desconectado en hora pico.

---

## 11. Referencias rápidas

| Recurso | URL / ruta |
|---------|------------|
| Sitio producción | https://asiscole.com |
| API WPPConnect (proxy) | https://asiscole.com/wpp-api/ |
| Swagger | https://asiscole.com/wpp-api-docs/ |
| Repo | https://github.com/Caley123/mock-flow-designer-06014 |
| Doc técnica WhatsApp | `docs/whatsapp/WPPCONNECT_WHATSAPP.md` |
| Cola notify | `scripts/wppconnect/notify-queue.mjs` |
| Activar rotación | `scripts/activar-rotacion-wpp-vps.sh` |

---

*Documento generado para Andre — resumen de cambios WhatsApp multi-chip, SIE Asiscole.*
