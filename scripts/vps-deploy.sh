#!/usr/bin/env bash
# Despliegue en asiscole.com (VPS Hetzner).
# Uso: cron cada 3 min o manual: /opt/sie/deploy.sh
set -euo pipefail

APP_DIR="/opt/sie/app"
DIST_DIR="/opt/sie/dist"
ENV_FILE="/opt/sie/.env.build"
LOG="/var/log/sie-deploy.log"
BRANCH="main"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "ERROR: no existe repo en $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL" == "$REMOTE" ]]; then
  exit 0
fi

log "Actualizando $LOCAL -> $REMOTE"
git reset --hard "origin/$BRANCH"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log "WARN: falta $ENV_FILE; build con defaults de Vite"
fi

npm ci --no-audit --no-fund
export VITE_BUILD_ID="$(git rev-parse --short HEAD)"
npm run build

mkdir -p "$DIST_DIR"
rsync -a --delete "${APP_DIR}/dist/" "$DIST_DIR/"

if [[ -f "${APP_DIR}/scripts/vps-deploy.sh" ]]; then
  cp "${APP_DIR}/scripts/vps-deploy.sh" /opt/sie/deploy.sh
  sed -i 's/\r$//' /opt/sie/deploy.sh
  chmod +x /opt/sie/deploy.sh
fi

# CSP en producción la envía Caddy (no dist/_headers). Parches de compatibilidad.
CADDY_FILE="/etc/caddy/Caddyfile"
CADDY_SRC="${APP_DIR}/scripts/asiscole-caddy.caddy"
CSP_MEDIA="media-src 'self' blob: data:"
CADDY_RELOAD=0
if [[ -f "$CADDY_SRC" ]] && [[ -f "$CADDY_FILE" ]]; then
  if ! cmp -s "$CADDY_SRC" "$CADDY_FILE"; then
    cp "$CADDY_FILE" "${CADDY_FILE}.bak.$(date +%s)"
    cp "$CADDY_SRC" "$CADDY_FILE"
    sed -i 's/\r$//' "$CADDY_FILE"
    if caddy validate --config "$CADDY_FILE"; then
      systemctl reload caddy
      log "Caddyfile actualizado (cache SPA + seguridad)"
    else
      log "ERROR: Caddyfile inválido tras copia; revise ${CADDY_FILE}.bak.*"
    fi
  fi
fi

if [[ -f "$CADDY_FILE" ]] && grep -q "Content-Security-Policy" "$CADDY_FILE"; then
  if ! grep -qF "$CSP_MEDIA" "$CADDY_FILE"; then
    sed -i "s/media-src 'none'/${CSP_MEDIA}/g" "$CADDY_FILE"
    sed -i "s/media-src \"none\"/${CSP_MEDIA}/g" "$CADDY_FILE"
    sed -i "s/\(img-src 'self' data: https: blob:;\)/\1 ${CSP_MEDIA};/g" "$CADDY_FILE"
    CADDY_RELOAD=1
  fi
  if grep -q "require-trusted-types-for" "$CADDY_FILE"; then
    sed -i "s/; require-trusted-types-for 'script'; trusted-types default goog#html//g" "$CADDY_FILE"
    sed -i "s/require-trusted-types-for 'script'; trusted-types default goog#html; //g" "$CADDY_FILE"
    CADDY_RELOAD=1
  fi
  if [[ "$CADDY_RELOAD" -eq 1 ]]; then
    if command -v caddy >/dev/null 2>&1; then
      caddy validate --config "$CADDY_FILE" && systemctl reload caddy
      log "Caddy recargado (CSP actualizado para tablets)"
    else
      log "WARN: caddy no encontrado; actualice CSP en $CADDY_FILE manualmente"
    fi
  fi
fi

log "Deploy OK -> $DIST_DIR ($(git rev-parse --short HEAD))"
