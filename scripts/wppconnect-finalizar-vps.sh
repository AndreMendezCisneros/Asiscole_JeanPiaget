#!/usr/bin/env bash
# Finaliza WPPConnect en VPS: token, .env.build, deploy
set -euo pipefail

WPPCONNECT_ROOT="/opt/sie/wppconnect"
ENV_FILE="/opt/sie/.env.wppconnect"
BUILD_ENV="/opt/sie/.env.build"
SESSION="sie-chip-01"

SECRET=$(grep -E "^\s*secretKey:" "${WPPCONNECT_ROOT}/config.ts" | sed "s/.*'\([^']*\)'.*/\1/")
TOKEN_JSON=$(curl -sf -X POST "http://127.0.0.1:21465/api/${SESSION}/${SECRET}/generate-token")
BEARER=$(echo "$TOKEN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [[ -z "$BEARER" ]]; then
  echo "ERROR generando token: $TOKEN_JSON"
  exit 1
fi

cat > "$ENV_FILE" <<EOF
WPPCONNECT_SECRET_KEY=${SECRET}
WPPCONNECT_SESSION=${SESSION}
WPPCONNECT_BEARER_TOKEN='${BEARER}'
WPPCONNECT_INTERNAL_API=http://127.0.0.1:21465/api
WPPCONNECT_WEBHOOK_PORT=3099
EOF
chmod 600 "$ENV_FILE"

{
  grep -v '^VITE_WPPCONNECT_' "$BUILD_ENV" 2>/dev/null || true
  grep -v '^VITE_OPENWA_ENABLED=' "$BUILD_ENV" 2>/dev/null || true
  echo "VITE_WPPCONNECT_ENABLED=true"
  echo "VITE_WPPCONNECT_API_URL=/wpp-api"
  echo "VITE_WPPCONNECT_SESSION=${SESSION}"
  echo "VITE_WPPCONNECT_TOKEN='${BEARER}'"
  echo "VITE_OPENWA_ENABLED=false"
} > "${BUILD_ENV}.tmp"
mv "${BUILD_ENV}.tmp" "$BUILD_ENV"

systemctl restart sie-wpp-webhook
/opt/sie/deploy.sh

echo "OK token generado. Escanee QR: bash /opt/sie/app/scripts/wppconnect-mostrar-qr.sh"
