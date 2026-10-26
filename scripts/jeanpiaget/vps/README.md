# Scripts que viven solo en el VPS (Jean Piaget)

Copia de referencia de lo que corre en `138.201.203.50` fuera de `/opt/sie-jp/app`.
El deploy (`vps-deploy-jeanpiaget.sh`) **no** instala estos archivos: si cambias uno aquí,
cópialo a mano a su ruta en el VPS. Ninguno lleva secretos; los tokens se leen de
`/opt/sie-jp/.env.build` o `wpp-qr-live/token.txt` en el servidor.

| Archivo | Ruta en el VPS | Cómo corre |
|---------|----------------|------------|
| `wpp_ensure_connected.py` | `/opt/sie-jp/` | cron `*/2 * * * *` → `/var/log/wpp-ensure.log`. Reabre la sesión `sie-chip-01` de WPPConnect si se cae. |
| `jp-marcar-faltas-cierre.sh` | `/opt/sie-jp/` | cron `15 1 * * 1-5` → `/var/log/jp-marcar-faltas.log`. **Comentado en el crontab** ("vacaciones JP"). Llama a `sie_jp_marcar_faltas_dia` vía `asiscole_canal_backend`. |
| `wpp_patch_autoclose.js` | `/opt/sie-jp/` | Manual, dentro del contenedor `sie-wppconnect` (desactiva `autoClose`/`deviceSyncTimeout`). Repetir si se recrea el contenedor. |
| `wpp-qr-live/server.py` | `/opt/sie-jp/wpp-qr-live/` | servicio systemd `wpp-qr-live` (puerto 3199). Página para escanear el QR del chip. |
| `wpp-qr-live/wpp-qr-live.service` | `/etc/systemd/system/` | unidad systemd del anterior. |
| `jp-marcar-faltas-personal-cierre.sh` | `/opt/sie-jp/` | cron `*/30 * * * *` → `/var/log/jp-marcar-faltas-personal.log`. Desde las 20:30 (Lima) marca Falta al **personal** que tenía horario y no marcó (`sie_jp_marcar_faltas_personal_dia`). Idempotente. |

Crontab actual (`crontab -l` como root):

```cron
# vacaciones JP: 15 1 * * 1-5 /opt/sie-jp/jp-marcar-faltas-cierre.sh >> /var/log/jp-marcar-faltas.log 2>&1
*/2 * * * * python3 /opt/sie-jp/wpp_ensure_connected.py >> /var/log/wpp-ensure.log 2>&1 # wpp-ensure-sie-chip-01
*/30 * * * * /opt/sie-jp/jp-marcar-faltas-personal-cierre.sh >> /var/log/jp-marcar-faltas-personal.log 2>&1 # jp-personal-cierre
```

## Canal (avisos del personal a la Promotoría)

`canal/backend/apps/ingesta/personal.py` y `services.py` (rama `personal_*` del poller) se copian a
`/opt/asiscole-canal/backend/apps/ingesta/` y con `docker cp` a los contenedores
`asiscole_canal_backend`, `asiscole_canal_worker` y `asiscole_canal_beat`; luego `docker restart` de los tres.
Los destinatarios se eligen en Configuración → Promotoría (`configuracion_sistema.promotoria_usuarios`).
