#!/usr/bin/env bash
# Elimina OpenWA del VPS (contenedores, imágenes, /opt/openwa).
# WhatsApp queda solo en WPPConnect (:21465 /wpp-api).
set -euo pipefail

LOG="/var/log/sie-remover-openwa.log"
OPENWA_DIR="/opt/openwa"
APP_DIR="${APP_DIR:-/opt/sie/app}"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

log "=== Eliminando OpenWA del VPS ==="

if docker ps -a --format '{{.Names}}' | grep -qE '^openwa-(api|dashboard)$'; then
  log "Deteniendo contenedores openwa-api y openwa-dashboard..."
  docker stop openwa-api openwa-dashboard 2>/dev/null || true
  docker rm openwa-api openwa-dashboard 2>/dev/null || true
fi

if [[ -d "$OPENWA_DIR" ]] && [[ -f "${OPENWA_DIR}/docker-compose.yml" ]]; then
  log "docker compose down en ${OPENWA_DIR}..."
  (cd "$OPENWA_DIR" && docker compose down --remove-orphans -v 2>/dev/null) || true
fi

log "Eliminando imágenes Docker de OpenWA..."
docker images --format '{{.Repository}}:{{.Tag}}' | grep -i openwa | while read -r img; do
  docker rmi -f "$img" 2>/dev/null || true
done

if [[ -d "$OPENWA_DIR" ]]; then
  SIZE=$(du -sh "$OPENWA_DIR" 2>/dev/null | cut -f1)
  log "Borrando ${OPENWA_DIR} (${SIZE})..."
  rm -rf "$OPENWA_DIR"
fi

# Caddy sin rutas OpenWA (/api, /openwa-dashboard)
CADDY_SRC="${APP_DIR}/scripts/asiscole-caddy.caddy"
CADDY_FILE="/etc/caddy/Caddyfile"
if [[ -f "$CADDY_SRC" ]] && [[ -f "$CADDY_FILE" ]]; then
  cp "$CADDY_FILE" "${CADDY_FILE}.bak.openwa-removal.$(date +%s)"
  cp "$CADDY_SRC" "$CADDY_FILE"
  sed -i 's/\r$//' "$CADDY_FILE"
  if caddy validate --config "$CADDY_FILE"; then
    systemctl reload caddy
    log "Caddy recargado (sin /api ni /openwa-dashboard)"
  else
    log "ERROR: Caddyfile inválido; restaure el backup"
    exit 1
  fi
fi

# Limpiar variables OpenWA del build (opcional)
BUILD_ENV="/opt/sie/.env.build"
if [[ -f "$BUILD_ENV" ]]; then
  grep -v '^VITE_OPENWA_' "$BUILD_ENV" > "${BUILD_ENV}.tmp" || true
  mv "${BUILD_ENV}.tmp" "$BUILD_ENV"
  log "Variables VITE_OPENWA_* eliminadas de .env.build"
fi

docker image prune -f >/dev/null 2>&1 || true

log "Espacio en disco tras limpieza:"
df -h / | tee -a "$LOG"
log "=== OpenWA eliminado. WhatsApp: WPPConnect en /wpp-api ==="
