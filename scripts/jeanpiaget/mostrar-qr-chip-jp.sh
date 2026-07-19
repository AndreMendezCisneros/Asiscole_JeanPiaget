#!/usr/bin/env bash
# Muestra / guarda QR de un chip Jean Piaget.
# Uso: bash scripts/jeanpiaget/mostrar-qr-chip-jp.sh sie-chip-01
set -euo pipefail

SESSION="${1:-sie-chip-01}"
ENV_FILE="/opt/sie-jp/.env.wppconnect"
OUT="/tmp/wpp-qr-${SESSION}.png"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta $ENV_FILE — ejecute activar-chips-wpp-jp.sh"
  exit 1
fi

set +u
# shellcheck disable=SC1090
source "$ENV_FILE"
set -u

API="${WPPCONNECT_INTERNAL_API:-http://127.0.0.1:21465/api}"
SECRET="${WPPCONNECT_SECRET_KEY:-}"

TOKEN=$(curl -sf -X POST "${API}/${SESSION}/${SECRET}/generate-token" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: no se pudo generar token para ${SESSION}"
  exit 1
fi

echo "Iniciando ${SESSION}..."
curl -sf -X POST "${API}/${SESSION}/start-session" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"waitQrCode":true}' >/tmp/wpp-start-${SESSION}.json || true

curl -sf -H "Authorization: Bearer ${TOKEN}" \
  "${API}/${SESSION}/qrcode-session" -o "$OUT" || true

if [[ -s "$OUT" ]]; then
  echo "QR guardado: $OUT"
  echo "En tu PC:"
  echo "  scp -i E:\\ssh-keys\\hetzner-sie root@178.104.115.2:${OUT} ."
else
  echo "No hay imagen QR aún. Estado:"
  curl -s -H "Authorization: Bearer ${TOKEN}" "${API}/${SESSION}/check-connection-session" || true
  echo
  echo "Si ya está CONNECTED, no hace falta QR."
fi
