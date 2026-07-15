#!/usr/bin/env bash
# Deploy Colegio Jean Piaget (mismo VPS que Asiscole; NO toca /opt/sie).
# Uso: /opt/sie-jp/deploy.sh
# Cron: */3 * * * * /opt/sie-jp/deploy.sh >> /var/log/sie-jp-deploy.log 2>&1
# SKIP_GIT=1 → no hace git pull (útil si Actions ya sincronizó el código)
set -euo pipefail

APP_DIR="/opt/sie-jp/app"
DIST_DIR="/opt/sie-jp/dist"
ENV_FILE="/opt/sie-jp/.env.build"
LOG="/var/log/sie-jp-deploy.log"
BRANCH="main"
CADDY_SITES="/etc/caddy/sites.d"
CADDY_ROOT="/etc/caddy/Caddyfile"
CADDY_SRC_DEFAULT="${APP_DIR}/scripts/jeanpiaget/jeanpiaget-caddy.caddy"
SKIP_GIT="${SKIP_GIT:-0}"
FORCE="${FORCE:-0}"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ensure_caddy_sites() {
  mkdir -p "$CADDY_SITES"
  if [[ ! -f "$CADDY_ROOT" ]] || ! grep -q 'sites.d' "$CADDY_ROOT" 2>/dev/null; then
    if [[ -f "$CADDY_ROOT" ]]; then
      cp "$CADDY_ROOT" "${CADDY_ROOT}.bak.asiscole.$(date +%s)"
      if grep -q 'asiscole.com' "$CADDY_ROOT"; then
        cp "$CADDY_ROOT" "${CADDY_SITES}/00-asiscole.caddy"
        log "Migrado Caddyfile Asiscole -> ${CADDY_SITES}/00-asiscole.caddy"
      fi
    fi
    printf '%s\n' 'import /etc/caddy/sites.d/*.caddy' >"$CADDY_ROOT"
    log "Caddyfile raíz: import sites.d"
  fi
}

install_jp_caddy() {
  local src="$CADDY_SRC_DEFAULT"
  [[ -f "$src" ]] || src="/opt/sie-jp/jeanpiaget-caddy.caddy"
  [[ -f "$src" ]] || { log "WARN: no hay plantilla Caddy Jean Piaget"; return 0; }

  local host=""
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$ENV_FILE" && set +a
    host="$(echo "${VITE_SUPABASE_URL:-}" | sed -E 's|https?://||; s|/.*||')"
  fi
  [[ -n "$host" ]] || host="__SUPABASE_HOST__"

  local dest="${CADDY_SITES}/10-jeanpiaget.caddy"
  sed "s/__SUPABASE_HOST__/${host}/g" "$src" >"$dest"
  sed -i 's/\r$//' "$dest"
  log "Caddy JP actualizado ($host) -> $dest"
}

if [[ ! -d "$APP_DIR" ]]; then
  log "ERROR: no existe $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

NEED_BUILD=0
if [[ "$SKIP_GIT" != "1" && -d .git ]]; then
  # Preferir SSH (deploy key) si está configurado
  git fetch origin "$BRANCH" --quiet 2>/dev/null || true
  LOCAL="$(git rev-parse HEAD 2>/dev/null || echo local)"
  REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo)"
  if [[ "$FORCE" == "1" ]]; then
    NEED_BUILD=1
    if [[ -n "$REMOTE" && "$REMOTE" != "local" ]]; then
      log "FORCE: reset a origin/$BRANCH"
      git reset --hard "origin/$BRANCH"
      git clean -fd
    fi
  elif [[ -n "$REMOTE" && "$LOCAL" != "$REMOTE" ]]; then
    log "Actualizando $LOCAL -> $REMOTE"
    git reset --hard "origin/$BRANCH"
    git clean -fd
    NEED_BUILD=1
  else
    log "Sin cambios en origin/$BRANCH"
  fi
else
  if [[ "$FORCE" == "1" || "$SKIP_GIT" == "1" ]]; then
    NEED_BUILD=1
  fi
fi

if [[ "$NEED_BUILD" != "1" ]]; then
  ensure_caddy_sites
  install_jp_caddy
  if caddy validate --config "$CADDY_ROOT" 2>/dev/null; then
    systemctl reload caddy 2>/dev/null || true
  fi
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: falta $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

npm ci --no-audit --no-fund
export VITE_BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
npm run build

mkdir -p "$DIST_DIR"
rsync -a --delete "${APP_DIR}/dist/" "$DIST_DIR/"

if [[ -f "${APP_DIR}/scripts/jeanpiaget/vps-deploy-jeanpiaget.sh" ]]; then
  cp "${APP_DIR}/scripts/jeanpiaget/vps-deploy-jeanpiaget.sh" /opt/sie-jp/deploy.sh
  sed -i 's/\r$//' /opt/sie-jp/deploy.sh
  chmod +x /opt/sie-jp/deploy.sh
fi

ensure_caddy_sites
install_jp_caddy

if caddy validate --config "$CADDY_ROOT"; then
  systemctl reload caddy
  log "Caddy recargado"
else
  log "ERROR: Caddyfile inválido"
  exit 1
fi

log "Deploy JP OK -> $DIST_DIR ($(git rev-parse --short HEAD 2>/dev/null || echo n/a))"
