#!/usr/bin/env bash
# 24 números → 4 chips × 6 (cada chip solo escribe a sus 6).
# Uso:
#   bash scripts/jeanpiaget/set-chip-phones-jp.sh \
#     n1 n2 n3 n4 n5 n6 \
#     n7 n8 n9 n10 n11 n12 \
#     n13 n14 n15 n16 n17 n18 \
#     n19 n20 n21 n22 n23 n24
set -euo pipefail

if [[ $# -ne 24 ]]; then
  echo "ERROR: exactamente 24 números (6 por chip). Recibidos: $#"
  exit 1
fi

export JP_PHONES="$*"
python3 <<'PY'
import os
from pathlib import Path

raw = os.environ["JP_PHONES"].split()
assert len(raw) == 24

def norm(p: str) -> str:
    d = "".join(c for c in p if c.isdigit())
    if len(d) == 9 and d.startswith("9"):
        d = "51" + d
    return d

chips = ["sie-chip-01", "sie-chip-02", "sie-chip-03", "sie-chip-04"]
blocks = []
for i, chip in enumerate(chips):
    phones = [norm(x) for x in raw[i * 6 : (i + 1) * 6]]
    blocks.append(f"{chip}:{','.join(phones)}")
    print(f"{chip}: {', '.join(phones)}")

mapping = "|".join(blocks)
sessions = ",".join(chips)

env_path = Path("/opt/sie-jp/.env.wppconnect")
lines = env_path.read_text(encoding="utf-8", errors="ignore").splitlines()
out = []
seen_s = seen_m = seen_a = False
for line in lines:
    if line.startswith("WPPCONNECT_SESSIONS="):
        out.append(f"WPPCONNECT_SESSIONS={sessions}")
        seen_s = True
    elif line.startswith("WPPCONNECT_CHIP_PHONES="):
        out.append(f"WPPCONNECT_CHIP_PHONES={mapping}")
        seen_m = True
    elif line.startswith("WPPCONNECT_ALLOWLIST_PHONES="):
        out.append("WPPCONNECT_ALLOWLIST_PHONES=")
        seen_a = True
    else:
        out.append(line)
if not seen_s:
    out.append(f"WPPCONNECT_SESSIONS={sessions}")
if not seen_m:
    out.append(f"WPPCONNECT_CHIP_PHONES={mapping}")
if not seen_a:
    out.append("WPPCONNECT_ALLOWLIST_PHONES=")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Guardado en", env_path)
PY

systemctl restart sie-jp-wpp-notify-queue
sleep 1
curl -s http://127.0.0.1:3102/status
echo
