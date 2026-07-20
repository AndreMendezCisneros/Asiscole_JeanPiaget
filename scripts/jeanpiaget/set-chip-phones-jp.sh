#!/usr/bin/env bash
# Jean Piaget — mapa 24 números → 4 chips × 6 (mismo orden operativo que SR).
# Orden: chip-04 (6) | chip-07 (6) | chip-01 tutor (6) | chip-06 (6)
# Al notificar, el chip se AUTOENVÍA (WPPCONNECT_NOTIFY_TO_SELF=true).
#
# Uso en VPS:
#   bash /opt/sie-jp/app/scripts/jeanpiaget/set-chip-phones-jp.sh
#   # o con 24 números en orden:
#   bash scripts/jeanpiaget/set-chip-phones-jp.sh n1 … n24
set -euo pipefail

# Orden: chip-04 (6) | chip-07 (6) | chip-01 tutor (6) | chip-06 (6)
DEFAULT_PHONES=(
  999122088 920745262 958022486 966883611 931050074 999142033
  966606900 964603438 999220022 982950034 966653848 969483649
  983505862 978526244 966048216 951386668 939572780 923823737
  900936300 979298623 917374325 998342755 942066435 996301050
)

if [[ $# -eq 0 ]]; then
  set -- "${DEFAULT_PHONES[@]}"
elif [[ $# -ne 24 ]]; then
  echo "ERROR: exactamente 24 números (6 por chip), o ninguno para usar el mapa por defecto. Recibidos: $#"
  exit 1
fi

export JP_PHONES="$*"
ENV_FILE="${WPPCONNECT_ENV_FILE:-/opt/sie-jp/.env.wppconnect}"
export JP_ENV_FILE="$ENV_FILE"

python3 <<'PY'
import os
from pathlib import Path

raw = os.environ["JP_PHONES"].split()
assert len(raw) == 24, raw

def norm(p: str) -> str:
    d = "".join(c for c in p if c.isdigit())
    if len(d) == 9 and d.startswith("9"):
        d = "51" + d
    return d

# Mismo orden que DEFAULT_PHONES / imagen operativa
chips = ["sie-chip-04", "sie-chip-07", "sie-chip-01", "sie-chip-06"]
labels = ["grupo-04", "grupo-07", "tutor-01", "grupo-06"]
blocks = []
for i, chip in enumerate(chips):
    phones = [norm(x) for x in raw[i * 6 : (i + 1) * 6]]
    blocks.append(f"{chip}:{','.join(phones)}")
    print(f"{chip} ({labels[i]}): {', '.join(phones)}")

mapping = "|".join(blocks)
sessions = ",".join(chips)

env_path = Path(os.environ["JP_ENV_FILE"])
if not env_path.exists():
    raise SystemExit(f"No existe {env_path}. Defina WPPCONNECT_ENV_FILE o cree el archivo.")

lines = env_path.read_text(encoding="utf-8", errors="ignore").splitlines()
out = []
seen_s = seen_m = seen_a = seen_sess = False
for line in lines:
    if line.startswith("WPPCONNECT_SESSIONS="):
        out.append(f"WPPCONNECT_SESSIONS={sessions}")
        seen_s = True
    elif line.startswith("WPPCONNECT_SESSION="):
        out.append("WPPCONNECT_SESSION=sie-chip-01")
        seen_sess = True
    elif line.startswith("WPPCONNECT_CHIP_PHONES="):
        out.append(f"WPPCONNECT_CHIP_PHONES='{mapping}'")
        seen_m = True
    elif line.startswith("WPPCONNECT_ALLOWLIST_PHONES="):
        out.append("WPPCONNECT_ALLOWLIST_PHONES=")
        seen_a = True
    else:
        out.append(line)
if not seen_s:
    out.append(f"WPPCONNECT_SESSIONS={sessions}")
if not seen_sess:
    out.append("WPPCONNECT_SESSION=sie-chip-01")
if not seen_m:
    out.append(f"WPPCONNECT_CHIP_PHONES='{mapping}'")
if not seen_a:
    out.append("WPPCONNECT_ALLOWLIST_PHONES=")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Guardado en", env_path)
print("WPPCONNECT_CHIP_PHONES=", mapping)
PY

if systemctl is-active --quiet sie-jp-wpp-notify-queue 2>/dev/null; then
  systemctl restart sie-jp-wpp-notify-queue
  sleep 1
  curl -s http://127.0.0.1:3102/status || true
  echo
  journalctl -u sie-jp-wpp-notify-queue -n 6 --no-pager
else
  echo "Aviso: sie-jp-wpp-notify-queue no está activo; reinicie la cola cuando despliegue."
fi
