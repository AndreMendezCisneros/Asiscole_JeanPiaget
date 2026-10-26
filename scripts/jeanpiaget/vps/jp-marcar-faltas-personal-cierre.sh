#!/usr/bin/env bash
# Cron: marca inasistencias del PERSONAL al cierre del día (America/Lima).
# Solo a quien tenía horario ese día y no registró llegada; omite feriados
# (calendario_no_lectivo). Idempotente: corre cada 30 min por la noche.
set -euo pipefail
export TZ=America/Lima
TODAY=$(date +%F)
HOUR=$(date +%H%M)
# Después del cierre (20:00) y antes de medianoche
if [[ "$HOUR" < "2030" ]]; then
  echo "skip hour=$HOUR"
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
    cur.execute('SELECT * FROM sie_jp_marcar_faltas_personal_dia(%s)', [d])
    row = cur.fetchone()
    print('fecha', d, 'personal_marcado', row[0], 'incidencias', row[1])
connections[alias].commit()
PY
