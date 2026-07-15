#!/usr/bin/env bash
# Inicia UNA sesión WPPConnect y espera el QR (un chip a la vez).
# Uso: bash wppconnect-iniciar-chip.sh sie-chip-02
set -euo pipefail

SESSION="${1:-}"
TOKENS_FILE="/opt/sie/chips-tokens.txt"
API="http://127.0.0.1:21465/api"
MAX_WAIT="${WPPCONNECT_QR_WAIT_SEC:-90}"

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
  echo "ERROR: no hay TOKEN para $SESSION en $TOKENS_FILE"
  exit 1
fi

echo "Sesión: $SESSION"
echo "Iniciando (solo este chip, waitQrCode=true)..."

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
    echo "OK: ya conectado (no hace falta QR)."
    curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/${SESSION}/host-device" || true
    echo
    exit 0
  fi

  if [[ "$STATUS" == "QRCODE" ]] || echo "$RESP" | grep -q 'data:image/png;base64'; then
    echo "OK: QR listo."
    echo ""
    echo "Opción A — Swagger: GET /api/${SESSION}/qrcode-session"
    echo "Opción B — Pegar en el navegador el campo qrcode (data:image/png;base64,...)"
    echo ""
    echo "$RESP" | sed -n 's/.*"qrcode":"\([^"]*\)".*/\1/p' | head -c 120
    echo "..."
    echo ""
    echo "Guardar PNG en VPS:"
    echo "  curl -H \"Authorization: Bearer ${TOKEN}\" ${API}/${SESSION}/qrcode-session -o /tmp/${SESSION}-qr.png"
    exit 0
  fi

  echo "  ${i}x5s → status=${STATUS:-?}"
done

echo "WARN: no hubo QR en ${MAX_WAIT}s. Revise logs: docker logs sie-wppconnect | grep ${SESSION}"
exit 1
