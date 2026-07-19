#!/usr/bin/env bash
# Fija lista blanca de padres (solo esos números reciben WhatsApp) + un solo chip.
# Uso:
#   bash scripts/jeanpiaget/set-allowlist-jp.sh 900111222 900333444 900555666 900777888 900999000 901112233
set -euo pipefail

ENV_FILE="/opt/sie-jp/.env.wppconnect"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta $ENV_FILE"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Pasa 1–N números (9 dígitos o con 51). Ejemplo:"
  echo "  $0 900111222 900333444 900555666 900777888 900999000 901112233"
  exit 1
fi

NORM=()
for n in "$@"; do
  d=$(echo "$n" | tr -cd '0-9')
  if [[ ${#d} -eq 9 && ${d:0:1} == 9 ]]; then
    d="51${d}"
  fi
  NORM+=("$d")
done

JOIN=$(IFS=,; echo "${NORM[*]}")

python3 - <<PY
from pathlib import Path
p = Path("$ENV_FILE")
lines = []
seen_s = seen_a = False
for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
    if line.startswith("WPPCONNECT_SESSIONS="):
        lines.append("WPPCONNECT_SESSIONS=sie-chip-01")
        seen_s = True
    elif line.startswith("WPPCONNECT_ALLOWLIST_PHONES="):
        lines.append("WPPCONNECT_ALLOWLIST_PHONES=$JOIN")
        seen_a = True
    else:
        lines.append(line)
if not seen_s:
    lines.append("WPPCONNECT_SESSIONS=sie-chip-01")
if not seen_a:
    lines.append("WPPCONNECT_ALLOWLIST_PHONES=$JOIN")
p.write_text("\\n".join(lines) + "\\n", encoding="utf-8")
print("OK allowlist:", "$JOIN")
print("OK sessions: sie-chip-01 (un solo chip)")
PY

systemctl restart sie-jp-wpp-notify-queue
sleep 1
curl -s http://127.0.0.1:3102/status | python3 -c "import sys,json; d=json.load(sys.stdin); c=d.get('config',{}); print('allowlist', c.get('allowlistSize'), 'sessions', c.get('sessionOrder'))"
