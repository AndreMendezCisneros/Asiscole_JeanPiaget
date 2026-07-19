#!/usr/bin/env bash
# Activa chips WPPConnect SOLO para Jean Piaget (cola propia + anti-baneo).
# Reutiliza el Docker WPPConnect de San Ramón (:21465) con sesiones jp-chip-*.
# Uso: bash scripts/jeanpiaget/activar-chips-wpp-jp.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sie-jp/app}"
# Si el repo JP no tiene scripts aún, usar el de San Ramón
if [[ ! -f "${APP_DIR}/scripts/wppconnect/notify-queue.mjs" ]]; then
  APP_DIR="/opt/sie/app"
fi
JP_ROOT="/opt/sie-jp"
ENV_FILE="${JP_ROOT}/.env.wppconnect"
BUILD_ENV="${JP_ROOT}/.env.build"
SR_ENV="/opt/sie/.env.wppconnect"
UNIT_SRC="${APP_DIR}/scripts/wppconnect/sie-jp-wpp-notify-queue.service"
# Copiar unit desde el path que subamos
if [[ ! -f "$UNIT_SRC" ]] && [[ -f /tmp/jp-wpp/sie-jp-wpp-notify-queue.service ]]; then
  UNIT_SRC=/tmp/jp-wpp/sie-jp-wpp-notify-queue.service
fi

echo "=== Chips WPPConnect — solo Jean Piaget ==="

if [[ ! -f "$SR_ENV" ]]; then
  echo "ERROR: falta $SR_ENV (WPPConnect base de San Ramón). Instale WPPConnect primero."
  exit 1
fi

# shellcheck disable=SC1090
set +u
source "$SR_ENV"
set -u

SECRET="${WPPCONNECT_SECRET_KEY:-}"
API_INTERNAL="${WPPCONNECT_INTERNAL_API:-http://127.0.0.1:21465/api}"
if [[ -z "$SECRET" ]]; then
  echo "ERROR: WPPCONNECT_SECRET_KEY vacío en $SR_ENV"
  exit 1
fi

NOTIFY_SECRET="$(openssl rand -hex 16)"
SESSIONS="jp-chip-01,jp-chip-02,jp-chip-03"

umask 077
cat > "$ENV_FILE" <<EOF
# Jean Piaget — chips propios (anti-baneo igual que San Ramón)
WPPCONNECT_SECRET_KEY=${SECRET}
WPPCONNECT_INTERNAL_API=${API_INTERNAL}
WPPCONNECT_SESSION=jp-chip-01
WPPCONNECT_SESSIONS=${SESSIONS}
WPPCONNECT_NOTIFY_PORT=3102
WPPCONNECT_NOTIFY_SECRET=${NOTIFY_SECRET}
WPPCONNECT_ROUND_ROBIN_STATE=${JP_ROOT}/.wpp-round-robin-state.json
WPPCONNECT_SCHOOL_NAME="Colegio Jean Piaget"
VITE_APP_URL=https://jeanpiaget.asiscole.com

# Anti-baneo (humano)
WPPCONNECT_TYPING_MIN_MS=10000
WPPCONNECT_TYPING_MAX_MS=12000
WPPCONNECT_JITTER_MIN_MS=8000
WPPCONNECT_JITTER_MAX_MS=15000
WPPCONNECT_MAX_PER_HOUR_PER_CHIP=120
WPPCONNECT_CHIP_HOURLY_LIMITS=jp-chip-03=2
WPPCONNECT_RATE_TIMEZONE=America/Lima
EOF
chmod 600 "$ENV_FILE"

# Generar bearer para el chip principal (frontend) y tokens de sesiones
FIRST_TOKEN=""
for sess in jp-chip-01 jp-chip-02 jp-chip-03; do
  echo "Token sesión ${sess}..."
  JSON=$(curl -sf -X POST "${API_INTERNAL}/${sess}/${SECRET}/generate-token" || true)
  TOK=$(echo "$JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  if [[ -n "$TOK" && -z "$FIRST_TOKEN" ]]; then
    FIRST_TOKEN="$TOK"
  fi
  if [[ -z "$TOK" ]]; then
    echo "WARN: no token para ${sess}"
  else
    echo "  OK ${sess}"
  fi
done

if [[ -n "$FIRST_TOKEN" ]]; then
  echo "WPPCONNECT_BEARER_TOKEN='${FIRST_TOKEN}'" >> "$ENV_FILE"
fi

# Asegurar scripts en /opt/sie-jp/app
mkdir -p /opt/sie-jp/app/scripts/wppconnect
if [[ ! -f /opt/sie-jp/app/scripts/wppconnect/notify-queue.mjs ]]; then
  rsync -a /opt/sie/app/scripts/wppconnect/ /opt/sie-jp/app/scripts/wppconnect/
fi
# Copiar unit y messageVariety actualizado si vienen en /tmp
if [[ -d /tmp/jp-wpp ]]; then
  cp /tmp/jp-wpp/sie-jp-wpp-notify-queue.service /opt/sie-jp/app/scripts/wppconnect/ 2>/dev/null || true
  [[ -f /tmp/jp-wpp/messageVariety.mjs ]] && cp /tmp/jp-wpp/messageVariety.mjs /opt/sie-jp/app/scripts/wppconnect/lib/
  [[ -f /tmp/jp-wpp/notify-queue.mjs ]] && cp /tmp/jp-wpp/notify-queue.mjs /opt/sie-jp/app/scripts/wppconnect/
  rsync -a /opt/sie/app/scripts/wppconnect/lib/ /opt/sie-jp/app/scripts/wppconnect/lib/ 2>/dev/null || true
  rsync -a /opt/sie/app/scripts/wppconnect/data/ /opt/sie-jp/app/scripts/wppconnect/data/ 2>/dev/null || true
fi

cp /opt/sie-jp/app/scripts/wppconnect/sie-jp-wpp-notify-queue.service /etc/systemd/system/ 2>/dev/null \
  || cp "$UNIT_SRC" /etc/systemd/system/sie-jp-wpp-notify-queue.service
sed -i 's/\r$//' /etc/systemd/system/sie-jp-wpp-notify-queue.service
systemctl daemon-reload
systemctl enable sie-jp-wpp-notify-queue
systemctl restart sie-jp-wpp-notify-queue
sleep 1
curl -sf http://127.0.0.1:3102/health || curl -s http://127.0.0.1:3102/health || true
echo

# Frontend JP: chips ON, Meta OFF
touch "$BUILD_ENV"
python3 - <<'PY'
from pathlib import Path
p = Path("/opt/sie-jp/.env.build")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines() if p.exists() else []
kv = {}
order = []
for line in lines:
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        order.append(("raw", line))
        continue
    k, v = line.split("=", 1)
    kv[k] = v
    order.append(("kv", k))

def setk(k, v):
    kv[k] = v

setk("VITE_META_WA_ENABLED", "false")
setk("VITE_WPPCONNECT_ENABLED", "true")
setk("VITE_WPPCONNECT_ROTATION", "true")
setk("VITE_WPPCONNECT_API_URL", "/wpp-api")
setk("VITE_WPPCONNECT_SESSION", "jp-chip-01")
setk("VITE_WPPCONNECT_NOTIFY_URL", "/wpp-notify")
setk("VITE_OPENWA_ENABLED", "false")
# token y notify key desde env file
import re
env = Path("/opt/sie-jp/.env.wppconnect").read_text(encoding="utf-8", errors="ignore")
m = re.search(r"^WPPCONNECT_BEARER_TOKEN='?([^'\n]+)'?", env, re.M)
if m:
    setk("VITE_WPPCONNECT_TOKEN", m.group(1))
m = re.search(r"^WPPCONNECT_NOTIFY_SECRET=(.+)$", env, re.M)
if m:
    setk("VITE_WPPCONNECT_NOTIFY_KEY", m.group(1).strip())

out = []
seen = set()
for kind, val in order:
    if kind == "raw":
        out.append(val)
    else:
        if val in seen:
            continue
        seen.add(val)
        out.append(f"{val}={kv[val]}")
for k, v in kv.items():
    if k not in seen:
        out.append(f"{k}={v}")
p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Updated", p)
PY

echo "OK — cola JP en :3102"
echo "Sesiones: ${SESSIONS}"
echo "Anti-baneo: typing 10–12s, jitter 8–15s, máx 120/h (chip-03=2/h)"
echo ""
echo "Siguiente: vincular QR de cada chip:"
echo "  bash /opt/sie-jp/app/scripts/jeanpiaget/mostrar-qr-chip-jp.sh jp-chip-01"
