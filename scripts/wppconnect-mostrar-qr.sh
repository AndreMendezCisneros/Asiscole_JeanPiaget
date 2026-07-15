#!/usr/bin/env bash
# Inicia sesión WPPConnect y muestra enlace al QR (base64 en JSON o imagen).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
ENV_FILE="/opt/sie/.env.wppconnect"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta $ENV_FILE — ejecute instalar-wppconnect-vps.sh primero"
  exit 1
fi

# shellcheck disable=SC1090
set +u
source "$ENV_FILE"
set -u
TOKEN="${WPPCONNECT_BEARER_TOKEN:-}"
SESSION="${WPPCONNECT_SESSION:-sie-chip-01}"
API="http://127.0.0.1:21465/api"

if [[ -z "$TOKEN" ]]; then
  echo "Generando token..."
  JSON=$(curl -sf -X POST "${API}/${SESSION}/${WPPCONNECT_SECRET_KEY}/generate-token")
  TOKEN=$(echo "$JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  echo "WPPCONNECT_BEARER_TOKEN='${TOKEN}'" >> "$ENV_FILE"
fi

echo "Iniciando sesión ${SESSION}..."
RESP=$(curl -sf -X POST "${API}/${SESSION}/start-session" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"waitQrCode":true}' || echo '{}')

STATUS=$(echo "$RESP" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
echo "Estado: ${STATUS:-desconocido}"

if echo "$RESP" | grep -q 'qrcode'; then
  echo ""
  echo "QR en respuesta JSON (base64). Guarde como imagen:"
  echo "$RESP" | sed -n 's/.*"qrcode":"\([^"]*\)".*/\1/p' | head -c 80
  echo "..."
  echo ""
  echo "O abra en navegador (desde el VPS con túnel SSH):"
  echo "  curl -H \"Authorization: Bearer ${TOKEN}\" ${API}/${SESSION}/qrcode-session -o /tmp/wpp-qr.png"
  echo "  scp root@178.104.115.2:/tmp/wpp-qr.png ."
fi

echo ""
echo "Comprobar conexión:"
echo "  curl -H \"Authorization: Bearer ${TOKEN}\" ${API}/${SESSION}/check-connection-session"
