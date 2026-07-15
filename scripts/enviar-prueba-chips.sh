#!/usr/bin/env bash
# Prueba de envío con mensajes variados (banco de frases).
# Uso: bash scripts/enviar-prueba-chips.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
ENV_FILE="/opt/sie/.env.wppconnect"
API="http://127.0.0.1:21465/api"
TARGET="${TARGET:-51949261503}"
CHIPS="${CHIPS:-sie-chip-01,sie-chip-02,sie-chip-03}"

source "$ENV_FILE"
SECRET="$WPPCONNECT_SECRET_KEY"

pick_msg() {
  node "${APP_DIR}/scripts/wppconnect/lib/pickWarmupCli.mjs"
}

token_for() {
  curl -sf -X POST "$API/$1/$SECRET/generate-token" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

phone_of() {
  local session="$1" token
  token=$(token_for "$session")
  curl -sf -H "Authorization: Bearer $token" "$API/$session/get-phone-number" | tr -dc '0-9'
}

send_msg() {
  local session="$1" phone="$2" text="$3" token resp
  token=$(token_for "$session")
  resp=$(curl -sf -X POST "$API/$session/send-message" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({phone:process.argv[1],isGroup:false,message:process.argv[2]}))" "$phone" "$text")")
  echo "[$session] -> $phone"
  echo "  $(echo "$text" | head -c 100)"
  if ! echo "$resp" | grep -q '"status":"success"'; then
    echo "  RESP: ${resp:0:200}"
  fi
  sleep "$(node -e "console.log(5+Math.floor(Math.random()*15))")"
}

declare -A PHONES
IFS=',' read -ra CHIP_LIST <<< "$CHIPS"
for CHIP in "${CHIP_LIST[@]}"; do
  CHIP=$(echo "$CHIP" | xargs)
  PHONES[$CHIP]=$(phone_of "$CHIP" || true)
  echo "$CHIP: ${PHONES[$CHIP]:-(desconectado)}"
done
echo "destino externo: $TARGET"
echo ""

echo "=== Mensajes variados al destino ==="
for CHIP in "${CHIP_LIST[@]}"; do
  CHIP=$(echo "$CHIP" | xargs)
  send_msg "$CHIP" "$TARGET" "$(pick_msg)"
done

echo ""
echo "=== Entre chips (calentamiento) ==="
for i in "${!CHIP_LIST[@]}"; do
  FROM=$(echo "${CHIP_LIST[$i]}" | xargs)
  TO_IDX=$(( (i + 1) % ${#CHIP_LIST[@]} ))
  TO=$(echo "${CHIP_LIST[$TO_IDX]}" | xargs)
  FP="${PHONES[$FROM]:-}"
  TP="${PHONES[$TO]:-}"
  if [[ -n "$FP" && -n "$TP" ]]; then
    send_msg "$FROM" "$TP" "$(pick_msg)"
  fi
done

echo "=== Listo ==="
node "${APP_DIR}/scripts/wppconnect/lib/pickWarmupCli.mjs" --stats
