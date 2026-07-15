#!/usr/bin/env bash
# Instala WPPConnect Server en el VPS (junto a OpenWA, puerto 21465).
# Uso: bash /opt/sie/app/scripts/instalar-wppconnect-vps.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
WPPCONNECT_ROOT="/opt/sie/wppconnect"
REPO_DIR="${WPPCONNECT_ROOT}/wppconnect-server"
ENV_FILE="/opt/sie/.env.wppconnect"
LOG="/var/log/sie-wppconnect-install.log"
SESSION_NAME="${WPPCONNECT_SESSION:-sie-chip-01}"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

log "=== Instalación WPPConnect Server ==="

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: Docker no instalado"
  exit 1
fi

mkdir -p "$WPPCONNECT_ROOT"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "Clonando wppconnect-server..."
  git clone --depth 1 https://github.com/wppconnect-team/wppconnect-server.git "$REPO_DIR"
else
  log "Actualizando wppconnect-server..."
  git -C "$REPO_DIR" fetch --depth 1 origin main
  git -C "$REPO_DIR" reset --hard origin/main
fi

# Secret key persistente
if [[ -f "$ENV_FILE" ]] && grep -q '^WPPCONNECT_SECRET_KEY=' "$ENV_FILE"; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  WPPCONNECT_SECRET_KEY="$(openssl rand -hex 24)"
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cp "${APP_DIR}/scripts/wppconnect/config.ts" "${WPPCONNECT_ROOT}/config.ts"
sed -i "s/WPPCONNECT_SECRET_PLACEHOLDER/${WPPCONNECT_SECRET_KEY}/g" "${WPPCONNECT_ROOT}/config.ts"
sed -i 's/\r$//' "${WPPCONNECT_ROOT}/config.ts"

# La config vive en src/config.ts y se compila en dist/ durante el build
cp "${WPPCONNECT_ROOT}/config.ts" "${REPO_DIR}/src/config.ts"

cp "${APP_DIR}/scripts/wppconnect/docker-compose.yml" "${WPPCONNECT_ROOT}/docker-compose.yml"
sed -i 's/\r$//' "${WPPCONNECT_ROOT}/docker-compose.yml"

log "Construyendo e iniciando contenedor (puede tardar varios minutos)..."
cd "$WPPCONNECT_ROOT"
# Verificar que la config personalizada llegó al repo antes del build
if ! grep -qF "${WPPCONNECT_SECRET_KEY}" "${REPO_DIR}/src/config.ts"; then
  log "ERROR: src/config.ts no tiene el secretKey esperado; abortando build"
  exit 1
fi
docker compose build --pull
docker compose up -d

log "Esperando API en :21465..."
for i in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:21465/api-docs" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

log "Generando token de sesión..."
SECRET_FROM_CONFIG=$(grep -E "^\s*secretKey:" "${WPPCONNECT_ROOT}/config.ts" | sed "s/.*'\([^']*\)'.*/\1/")
TOKEN_JSON=$(curl -sf -X POST "http://127.0.0.1:21465/api/${SESSION_NAME}/${SECRET_FROM_CONFIG}/generate-token" || true)
BEARER=$(echo "$TOKEN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [[ -z "$BEARER" ]]; then
  log "WARN: no se pudo generar token automáticamente. Ejecute scripts/wppconnect-mostrar-qr.sh"
else
  cat > "$ENV_FILE" <<EOF
WPPCONNECT_SECRET_KEY=${WPPCONNECT_SECRET_KEY}
WPPCONNECT_SESSION=${SESSION_NAME}
WPPCONNECT_BEARER_TOKEN='${BEARER}'
WPPCONNECT_INTERNAL_API=http://127.0.0.1:21465/api
WPPCONNECT_WEBHOOK_PORT=3099
EOF
  chmod 600 "$ENV_FILE"
  log "Token guardado en $ENV_FILE"
fi

# Webhook sendSeen (systemd en host)
UNIT_DST="/etc/systemd/system/sie-wpp-webhook.service"
cp "${APP_DIR}/scripts/wppconnect/sie-wpp-webhook.service" "$UNIT_DST"
sed -i 's/\r$//' "$UNIT_DST"
systemctl daemon-reload
systemctl enable sie-wpp-webhook
systemctl restart sie-wpp-webhook
log "Webhook systemd: sie-wpp-webhook"

# Cola multi-chip (rotación + anti-baneo)
NOTIFY_UNIT="/etc/systemd/system/sie-wpp-notify-queue.service"
cp "${APP_DIR}/scripts/wppconnect/sie-wpp-notify-queue.service" "$NOTIFY_UNIT"
sed -i 's/\r$//' "$NOTIFY_UNIT"
systemctl daemon-reload
systemctl enable sie-wpp-notify-queue
systemctl restart sie-wpp-notify-queue
log "Cola notify systemd: sie-wpp-notify-queue (puerto 3100)"

# Ampliar .env.wppconnect para rotación
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
  log "Añadidas variables de rotación a $ENV_FILE"
fi

# Caddy: copiar asiscole-caddy si cambió
CADDY_SRC="${APP_DIR}/scripts/asiscole-caddy.caddy"
CADDY_FILE="/etc/caddy/Caddyfile"
if [[ -f "$CADDY_SRC" ]] && [[ -f "$CADDY_FILE" ]]; then
  if ! cmp -s "$CADDY_SRC" "$CADDY_FILE"; then
    cp "$CADDY_FILE" "${CADDY_FILE}.bak.$(date +%s)"
    cp "$CADDY_SRC" "$CADDY_FILE"
    sed -i 's/\r$//' "$CADDY_FILE"
    caddy validate --config "$CADDY_FILE" && systemctl reload caddy
    log "Caddy recargado (/wpp-api)"
  fi
fi

# Actualizar build env del frontend
BUILD_ENV="/opt/sie/.env.build"
if [[ -f "$BUILD_ENV" ]]; then
  {
    grep -v '^VITE_WPPCONNECT_' "$BUILD_ENV" || true
    grep -v '^VITE_OPENWA_ENABLED=' "$BUILD_ENV" || true
    echo "VITE_WPPCONNECT_ENABLED=true"
    echo "VITE_WPPCONNECT_API_URL=/wpp-api"
    echo "VITE_WPPCONNECT_SESSION=${SESSION_NAME}"
    echo "VITE_WPPCONNECT_ROTATION=true"
    echo "VITE_WPPCONNECT_NOTIFY_URL=/wpp-notify"
    if grep -q '^WPPCONNECT_NOTIFY_SECRET=' "$ENV_FILE"; then
      NS=$(grep '^WPPCONNECT_NOTIFY_SECRET=' "$ENV_FILE" | cut -d= -f2)
      echo "VITE_WPPCONNECT_NOTIFY_KEY=${NS}"
    fi
    if [[ -n "$BEARER" ]]; then
      echo "VITE_WPPCONNECT_TOKEN='${BEARER}'"
    fi
    echo "VITE_OPENWA_ENABLED=false"
  } > "${BUILD_ENV}.tmp"
  mv "${BUILD_ENV}.tmp" "$BUILD_ENV"
  log "Actualizado $BUILD_ENV (WPPConnect activo, OpenWA desactivado en frontend)"
  log "Ejecute /opt/sie/deploy.sh para rebuild del frontend"
fi

log "=== WPPConnect instalado ==="
log "Siguiente paso: bash ${APP_DIR}/scripts/wppconnect-mostrar-qr.sh"
log "API interna: http://127.0.0.1:21465/api"
log "API pública: https://asiscole.com/wpp-api/{session}/..."
