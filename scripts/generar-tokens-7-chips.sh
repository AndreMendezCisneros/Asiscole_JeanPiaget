#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/opt/sie/.env.wppconnect"
set +u
# shellcheck disable=SC1090
source "$ENV_FILE"
set -u

SECRET=$(grep -E '^\s*secretKey:' /opt/sie/wppconnect/config.ts | sed "s/.*'\([^']*\)'.*/\1/")
API="http://127.0.0.1:21465/api"
OUT="/opt/sie/chips-tokens.txt"

{
  echo "# Tokens WPPConnect — $(date -Iseconds)"
  echo "# Base URL pública: https://asiscole.com/wpp-api"
  echo "# SECRET_KEY (solo admin, no compartir): ${SECRET}"
  echo ""
} > "$OUT"

for i in 01 02 03 04 05 06 07; do
  SESSION="sie-chip-${i}"
  JSON=$(curl -sf -X POST "${API}/${SESSION}/${SECRET}/generate-token")
  TOKEN=$(echo "$JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  echo "=== ${SESSION} ===" >> "$OUT"
  echo "SESSION=${SESSION}" >> "$OUT"
  echo "TOKEN=${TOKEN}" >> "$OUT"
  echo "" >> "$OUT"
  echo "${SESSION} OK"
done

echo "Guardado en ${OUT}"
