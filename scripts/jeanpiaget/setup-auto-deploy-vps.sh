#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f /root/.ssh/id_ed25519_jp ]]; then
  ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519_jp -N "" -C "sie-jp-vps-deploy"
fi
mkdir -p /root/.ssh
chmod 700 /root/.ssh

if ! grep -q "Host github.com-jp" /root/.ssh/config 2>/dev/null; then
  cat >> /root/.ssh/config <<'EOF'

Host github.com-jp
  HostName github.com
  User git
  IdentityFile /root/.ssh/id_ed25519_jp
  IdentitiesOnly yes
EOF
fi
chmod 600 /root/.ssh/config

# Apuntar remote a SSH alias (tras agregar deploy key en GitHub)
if [[ -d /opt/sie-jp/app/.git ]]; then
  cd /opt/sie-jp/app
  git remote set-url origin git@github.com-jp:AndreMendezCisneros/Asiscole_JeanPiaget.git || true
fi

# Cron cada 3 min (minuto 1,4,7...) para no chocar con Asiscole
tmpdir="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'sie-jp-deploy' >"$tmpdir" || true
echo '1-59/3 * * * * /opt/sie-jp/deploy.sh >> /var/log/sie-jp-deploy.log 2>&1' >>"$tmpdir"
crontab "$tmpdir"
rm -f "$tmpdir"

echo "CRON:"
crontab -l
echo ""
echo "==== PUBLIC KEY — GitHub → Asiscole_JeanPiaget → Settings → Deploy keys → Add (read-only) ===="
cat /root/.ssh/id_ed25519_jp.pub
