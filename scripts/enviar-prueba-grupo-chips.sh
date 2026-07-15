#!/usr/bin/env bash
# Prueba: chips 04 y 05 envían mensaje al grupo WhatsApp "Grupo mensajes"
# Uso en VPS: bash /opt/sie/app/scripts/enviar-prueba-grupo-chips.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/sie/.env.wppconnect}"
API="${WPPCONNECT_INTERNAL_API:-http://127.0.0.1:21465/api}"
GROUP_NAME="${GROUP_NAME:-Grupo mensajes}"
CHIPS="${CHIPS:-sie-chip-04,sie-chip-05}"

source "$ENV_FILE"
SECRET="$WPPCONNECT_SECRET_KEY"

token_for() {
  curl -s -X POST "$API/$1/$SECRET/generate-token" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

find_group_id() {
  local session="$1" token="$2"
  curl -s -H "Authorization: Bearer $token" "$API/$session/all-groups" | node -e "
    let d='';
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => {
      const want = process.argv[1];
      let groups = [];
      try {
        const j = JSON.parse(d);
        groups = j.response || j.groups || j || [];
        if (!Array.isArray(groups)) groups = [];
      } catch {
        console.error('No se pudo parsear all-groups:', d.slice(0, 300));
        process.exit(2);
      }
      const norm = (s) => String(s || '').trim().toLowerCase();
      const groupName = (x) =>
        x.name || x.subject || x.contact?.name || x.groupMetadata?.subject || '';
      const g =
        groups.find((x) => norm(groupName(x)) === norm(want)) ||
        groups.find((x) => norm(groupName(x)).includes(norm(want)));
      if (!g) {
        console.log('NOT_FOUND');
        console.error('Grupos visibles para', process.argv[2] + ':');
        groups.slice(0, 15).forEach((x) => console.error(' -', groupName(x)));
        process.exit(3);
      }
      const id =
        g.id?._serialized ||
        g.id ||
        g.groupMetadata?.id?._serialized ||
        (typeof g.id === 'string' ? g.id : '');
      console.log(id);
    });
  " "$GROUP_NAME" "$session"
}

send_group() {
  local session="$1" gid="$2" text="$3" token
  token=$(token_for "$session")
  curl -s -X POST "$API/$session/send-message" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({phone:process.argv[1],isGroup:true,message:process.argv[2]}))" "$gid" "$text")"
}

IFS=',' read -ra CHIP_LIST <<< "$CHIPS"
for CHIP in "${CHIP_LIST[@]}"; do
  CHIP=$(echo "$CHIP" | xargs)
  echo "======== $CHIP ========"
  TOKEN=$(token_for "$CHIP")
  if [ -z "$TOKEN" ]; then
    echo "ERROR: no se pudo generar token para $CHIP"
    continue
  fi
  CONN=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/$CHIP/check-connection-session")
  echo "connection: $CONN"

  GID=$(find_group_id "$CHIP" "$TOKEN" || true)
  if [ -z "$GID" ] || [ "$GID" = "NOT_FOUND" ]; then
    echo "Grupo '$GROUP_NAME' no encontrado en $CHIP (¿el chip está en el grupo?)"
    continue
  fi
  echo "group_id: $GID"

  MSG="Prueba $CHIP → $GROUP_NAME ($(date -Iseconds))"
  RESP=$(send_group "$CHIP" "$GID" "$MSG")
  if echo "$RESP" | grep -q '"status":"success"'; then
    echo "OK: mensaje enviado"
  else
    echo "RESP: ${RESP:0:400}"
  fi
  sleep 4
done
echo "=== FIN ==="
