#!/usr/bin/env bash
# Cron: marcar faltas JP tras hora_cierre_colegio (America/Lima)
set -euo pipefail
export TZ=America/Lima
TODAY=$(date +%F)
HOUR=$(date +%H%M)
# Solo después de 20:05 (cierre config 20:00) y antes de 23:50
if [[ "$HOUR" < "2005" || "$HOUR" > "2350" ]]; then
  echo "skip hour=$HOUR"
  exit 0
fi
# No fines de semana
DOW=$(date +%u) # 1=lun .. 7=dom
if [[ "$DOW" -ge 6 ]]; then
  echo "skip weekend"
  exit 0
fi

docker exec -i asiscole_canal_backend python <<PY
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.db import connections
from config.db_router import tenant_alias
from datetime import date
alias = tenant_alias('jean_piaget')
d = date.fromisoformat('${TODAY}')
with connections[alias].cursor() as cur:
    cur.execute('SELECT * FROM sie_jp_marcar_faltas_dia(%s)', [d])
    row = cur.fetchone()
    print('fecha', d, 'marcados', row[0], 'incidencias', row[1])
connections[alias].commit()
PY
