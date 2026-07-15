#!/usr/bin/env bash
# Activa cola multi-chip sin reinstalar WPPConnect completo.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
ENV_FILE="/opt/sie/.env.wppconnect"
BUILD_ENV="/opt/sie/.env.build"

cp "${APP_DIR}/scripts/wppconnect/sie-wpp-notify-queue.service" /etc/systemd/system/
sed -i 's/\r$//' /etc/systemd/system/sie-wpp-notify-queue.service
systemctl daemon-reload
systemctl enable sie-wpp-notify-queue

if ! grep -q '^WPPCONNECT_SESSIONS=' "$ENV_FILE" 2>/dev/null; then
  NOTIFY_SECRET="$(openssl rand -hex 16)"
  cat >> "$ENV_FILE" <<EOF
WPPCONNECT_SESSIONS=sie-chip-01,sie-chip-02,sie-chip-03,sie-chip-05,sie-chip-06,sie-chip-07,sie-chip-04
WPPCONNECT_NOTIFY_PORT=3100
WPPCONNECT_NOTIFY_SECRET=${NOTIFY_SECRET}
WPPCONNECT_TYPING_MIN_MS=10000
WPPCONNECT_TYPING_MAX_MS=12000
WPPCONNECT_JITTER_MIN_MS=8000
WPPCONNECT_JITTER_MAX_MS=15000
WPPCONNECT_MAX_PER_HOUR_PER_CHIP=250
WPPCONNECT_CHIP_HOURLY_LIMITS=sie-chip-04=2
EOF
fi

# Actualizar límites si ya existía el archivo (instalación previa)
for kv in \
  'WPPCONNECT_SESSIONS=sie-chip-01,sie-chip-02,sie-chip-03,sie-chip-05,sie-chip-06,sie-chip-07,sie-chip-04' \
  'WPPCONNECT_TYPING_MIN_MS=10000' \
  'WPPCONNECT_TYPING_MAX_MS=12000' \
  'WPPCONNECT_JITTER_MIN_MS=8000' \
  'WPPCONNECT_JITTER_MAX_MS=15000' \
  'WPPCONNECT_MAX_PER_HOUR_PER_CHIP=250' \
  'WPPCONNECT_CHIP_HOURLY_LIMITS=sie-chip-04=2'
do
  key="${kv%%=*}"
  val="${kv#*=}"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
done

NOTIFY_SECRET=$(grep '^WPPCONNECT_NOTIFY_SECRET=' "$ENV_FILE" | cut -d= -f2)

CADDY_SRC="${APP_DIR}/scripts/asiscole-caddy.caddy"
if [[ -f "$CADDY_SRC" ]]; then
  cp "$CADDY_SRC" /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
fi

{
  grep -v '^VITE_WPPCONNECT_ROTATION=' "$BUILD_ENV" 2>/dev/null || true
  grep -v '^VITE_WPPCONNECT_NOTIFY_' "$BUILD_ENV" 2>/dev/null || true
  echo "VITE_WPPCONNECT_ROTATION=true"
  echo "VITE_WPPCONNECT_NOTIFY_URL=/wpp-notify"
  echo "VITE_WPPCONNECT_NOTIFY_KEY=${NOTIFY_SECRET}"
} > "${BUILD_ENV}.tmp"
mv "${BUILD_ENV}.tmp" "$BUILD_ENV"

systemctl restart sie-wpp-notify-queue

echo "OK — cola activa. Ejecute: /opt/sie/deploy.sh"
echo "Estado: curl -s http://127.0.0.1:3100/status"
