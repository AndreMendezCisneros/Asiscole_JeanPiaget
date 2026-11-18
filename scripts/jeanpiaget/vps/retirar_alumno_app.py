#!/usr/bin/env python3
"""Quita de la app de padres a un alumno RETIRADO (sin borrar nada).

Correr en el VPS DESPUÉS de retirarlo en el SIE (estudiantes.activo = false):
  python3 retirar_alumno_app.py 79478670            # solo muestra qué haría
  python3 retirar_alumno_app.py 79478670 --apply    # inactiva sus vínculos y limpia caché

- Solo toca filas de Directorio con ese id_estudiante (estado_vinculo -> inactivo).
- Los hermanos con el mismo celular conservan sus vínculos (se listan al final).
- Reactivar: reactivar en el SIE y correr resolver_vinculos(telefono) (la reconciliación
  nocturna también lo vuelve a vincular).
"""
from __future__ import annotations

import json
import subprocess
import sys

ENV_PATH = "/opt/asiscole-canal/.env"
TENANT = "jean_piaget"
BACKEND = "asiscole_canal_backend"


def load_db() -> dict:
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith("SCHOOL_DATABASES="):
                dbs = json.loads(line.split("=", 1)[1].strip())
                break
        else:
            raise SystemExit("SCHOOL_DATABASES no encontrado")
    db = dict(next(d for d in dbs if d.get("tenant_id") == TENANT))
    db["password"] = str(db["password"]).replace("$$", "$")
    return db


def psql_row(db: dict, sql: str) -> list[str]:
    cmd = [
        "docker", "run", "--rm",
        "-e", f"PGPASSWORD={db['password']}",
        "-e", "PGCLIENTENCODING=UTF8",
        "postgres:17-alpine", "psql",
        "-h", db["host"], "-p", str(db["port"]), "-U", db["user"], "-d", db["name"],
        "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-F", "\t", "-c", sql,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(r.stderr.strip())
    out = r.stdout.strip()
    return out.split("\t") if out else []


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    if len(args) != 1 or not args[0].isdigit():
        raise SystemExit("Uso: retirar_alumno_app.py <DNI> [--apply]")
    dni = args[0]

    db = load_db()
    row = psql_row(
        db,
        "SELECT id_estudiante, nombre_completo, activo::text FROM public.estudiantes "
        f"WHERE codigo_barras = '{dni}'",
    )
    if not row:
        raise SystemExit(f"No existe alumno con DNI {dni}")
    sid, nombre, activo = int(row[0]), row[1], row[2]
    print(f"Alumno: {nombre} (id {sid}) activo={activo}")
    if activo == "true" and apply:
        raise SystemExit("El alumno sigue ACTIVO en el SIE: primero retírelo desde Alumnos.")

    code = f"""
from apps.directorio import cache as cache_directorio
from apps.directorio import services as dir_services
from apps.directorio.models import Directorio
tenant = {TENANT!r}
sid = {sid}
apply = {apply!r}
filas = list(Directorio.objects.filter(tenant_id=tenant, id_estudiante=sid))
phones = sorted({{f.telefono for f in filas}})
print('vinculos del alumno:', [(f.pk, f.telefono, f.estado_vinculo) for f in filas])
if apply:
    n = Directorio.objects.filter(tenant_id=tenant, id_estudiante=sid).exclude(estado_vinculo='inactivo').update(estado_vinculo='inactivo')
    print('inactivados:', n)
    for phone in phones:
        cache_directorio.invalidar(phone)
        dir_services.resolver_vinculos(phone)
for phone in phones:
    otros = list(Directorio.objects.filter(tenant_id=tenant, telefono=phone, estado_vinculo='activo').exclude(id_estudiante=sid).values_list('id_estudiante', flat=True))
    print('telefono', phone, '-> otros hijos activos (hermanos):', otros)
print('MODO', 'APPLY' if apply else 'SOLO LECTURA')
"""
    r = subprocess.run(
        ["docker", "exec", "-i", BACKEND, "python", "manage.py", "shell"],
        input=code, capture_output=True, text=True,
    )
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
