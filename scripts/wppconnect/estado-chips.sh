#!/usr/bin/env bash
# Estado de conexión de todos los chips WPPConnect.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/sie/.env.wppconnect}"
API="${WPPCONNECT_INTERNAL_API:-http://127.0.0.1:21465/api}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

SECRET="${WPPCONNECT_SECRET_KEY:-}"

echo "=== Estado chips WPPConnect ==="
for i in 01 02 03 04 05 06 07; do
  S="sie-chip-$i"
  TOKEN=$(curl -sf -X POST "$API/$S/$SECRET/generate-token" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' || true)
  if [[ -z "$TOKEN" ]]; then
    echo "$S | ERROR token"
    continue
  fi
  CONN=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/$S/check-connection-session" 2>/dev/null || echo '{}')
  STAT=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/$S/status-session" 2>/dev/null || echo '{}')
  PHONE=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API/$S/get-phone-number" 2>/dev/null | tr -dc '0-9' || true)
  MSG=$(echo "$CONN" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
  ST=$(echo "$STAT" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  echo "$S | $MSG | status=$ST | phone=${PHONE:-—}"
done

echo ""
echo "=== Logs desconexión (últimos) ==="
docker logs sie-wppconnect 2>&1 | grep -iE 'unpaired|logout|disconnected|not connected|Session' | tail -20 || true
