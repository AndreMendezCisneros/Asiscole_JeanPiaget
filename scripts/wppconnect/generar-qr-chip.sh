#!/usr/bin/env bash
# Reinicia sesión desconectada/unpaired y genera QR (un chip).
# Uso: bash generar-qr-chip.sh sie-chip-02
set -euo pipefail

SESSION="${1:-}"
TOKENS_FILE="/opt/sie/chips-tokens.txt"
API="http://127.0.0.1:21465/api"
OUT_DIR="/tmp/sie-wpp-qr"
MAX_WAIT="${WPPCONNECT_QR_WAIT_SEC:-120}"
LIMPIAR="${LIMPIAR_PERFIL:-1}"

if [[ -z "$SESSION" ]]; then
  echo "Uso: $0 sie-chip-02"
  exit 1
fi

if [[ ! -f "$TOKENS_FILE" ]]; then
  echo "ERROR: falta $TOKENS_FILE"
  exit 1
fi

TOKEN=$(awk -v s="$SESSION" '
  $0 ~ "^=== " s " ===$" { found=1; next }
  found && /^TOKEN=/ { sub(/^TOKEN=/, ""); print; exit }
' "$TOKENS_FILE")

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: no hay TOKEN para $SESSION"
  exit 1
fi

mkdir -p "$OUT_DIR"
PNG="${OUT_DIR}/${SESSION}-qr.png"

echo "=== $SESSION — reinicio + QR ==="

# Cerrar sesión activa en memoria
curl -sf -X POST "${API}/${SESSION}/close-session" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' >/dev/null 2>&1 || true

sleep 2

if [[ "$LIMPIAR" == "1" ]]; then
  echo "Limpiando perfil corrupto/unpaired en Docker..."
  docker exec sie-wppconnect rm -rf "/usr/src/wpp-server/userDataDir/${SESSION}" 2>/dev/null || true
  docker exec sie-wppconnect rm -f "/usr/src/wpp-server/tokens/${SESSION}.data.json" 2>/dev/null || true
  sleep 1
fi

echo "Iniciando sesión (waitQrCode)..."
curl -sf -X POST "${API}/${SESSION}/start-session" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"waitQrCode":true}' >/dev/null || true

echo "Esperando QR (máx ${MAX_WAIT}s)..."
for ((i = 1; i <= MAX_WAIT / 5; i++)); do
  sleep 5
  RESP=$(curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/${SESSION}/status-session" || echo '{}')
  STATUS=$(echo "$RESP" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')

  if [[ "$STATUS" == "CONNECTED" ]]; then
    PHONE=$(curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/${SESSION}/get-phone-number" | tr -dc '0-9' || true)
    echo "OK: ya conectado. Tel: ${PHONE:-?}"
    exit 0
  fi

  if [[ "$STATUS" == "QRCODE" ]] || echo "$RESP" | grep -q 'data:image/png;base64'; then
    curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/${SESSION}/qrcode-session" -o "$PNG" || true
    if [[ -s "$PNG" ]]; then
      echo "OK: QR guardado en $PNG"
      file "$PNG" 2>/dev/null || true
      exit 0
    fi
  fi

  echo "  ${i}x5s → status=${STATUS:-?}"
done

echo "ERROR: no hubo QR. Logs:"
docker logs sie-wppconnect 2>&1 | grep "$SESSION" | tail -8
exit 1
