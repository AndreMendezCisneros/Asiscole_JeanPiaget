#!/usr/bin/env bash
# Calienta chips: mensajes variados + "escribiendo" mínimo 10 s (ver calentar-chips.mjs).
# Uso: bash scripts/wppconnect/calentar-chips.sh
#      WPPCONNECT_WARMUP_ROUNDS=5 bash scripts/wppconnect/calentar-chips.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
ENV_FILE="${ENV_FILE:-/opt/sie/.env.wppconnect}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export WPPCONNECT_ENV_FILE="$ENV_FILE"
exec node "${APP_DIR}/scripts/wppconnect/calentar-chips.mjs"
