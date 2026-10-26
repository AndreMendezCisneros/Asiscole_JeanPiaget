#!/usr/bin/env bash
# Cron (cada 10 min): inasistencias automáticas del PERSONAL.
#  * Hoy: quien tenía horario y no marcó pasados N min de su entrada
#    (configuracion_sistema.personal_minutos_inasistencia, por defecto 120).
#  * Ayer: cierre completo del día (por si el cron no corrió).
# Omite feriados (calendario_no_lectivo). Idempotente.
set -euo pipefail

docker exec -i asiscole_canal_backend python <<'PY'
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.db import connections
from config.db_router import tenant_alias
alias = tenant_alias('jean_piaget')
with connections[alias].cursor() as cur:
    cur.execute('SELECT * FROM sie_jp_marcar_faltas_personal_pendientes()')
    row = cur.fetchone()
    if row[0] or row[1]:
        print('personal_marcado', row[0], 'incidencias', row[1])
connections[alias].commit()
PY
