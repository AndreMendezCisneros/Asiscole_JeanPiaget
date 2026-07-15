#!/usr/bin/env bash
# Genera QR para chips desconectados, uno a la vez (no paralelo).
# Uso: bash reconectar-chips.sh
#      bash reconectar-chips.sh sie-chip-02 sie-chip-03
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie/app}"
CHIPS=("$@")
if [[ ${#CHIPS[@]} -eq 0 ]]; then
  CHIPS=(sie-chip-02 sie-chip-03 sie-chip-05 sie-chip-07)
fi

OUT_DIR="/tmp/sie-wpp-qr"
mkdir -p "$OUT_DIR"

echo "=== Reconexión QR (un chip a la vez) ==="
echo "Chips: ${CHIPS[*]}"
echo ""

for SESSION in "${CHIPS[@]}"; do
  echo "----------------------------------------"
  echo "Chip: $SESSION"
  bash "${APP_DIR}/scripts/wppconnect-iniciar-chip.sh" "$SESSION" || true

  TOKENS_FILE="/opt/sie/chips-tokens.txt"
  TOKEN=$(awk -v s="$SESSION" '
    $0 ~ "^=== " s " ===$" { found=1; next }
    found && /^TOKEN=/ { sub(/^TOKEN=/, ""); print; exit }
  ' "$TOKENS_FILE")

  if [[ -n "$TOKEN" ]]; then
    API="http://127.0.0.1:21465/api"
    curl -sf -H "Authorization: Bearer ${TOKEN}" \
      "${API}/${SESSION}/qrcode-session" \
      -o "${OUT_DIR}/${SESSION}-qr.png" 2>/dev/null || true
    if [[ -s "${OUT_DIR}/${SESSION}-qr.png" ]]; then
      echo "PNG: ${OUT_DIR}/${SESSION}-qr.png"
      file "${OUT_DIR}/${SESSION}-qr.png" || true
    fi
  fi

  echo ""
  echo ">> Escanee el QR de $SESSION con WhatsApp → Dispositivos vinculados"
  echo ">> Cuando diga CONNECTED, pulse Enter para el siguiente chip (o Ctrl+C)"
  read -r _
done

echo "=== Verificación final ==="
bash "${APP_DIR}/scripts/wppconnect/estado-chips.sh"
