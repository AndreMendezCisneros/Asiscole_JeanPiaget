#!/usr/bin/env python3
"""Aplica uno o más PATCH_*.sql en la BD Jean Piaget, cada uno en una transacción.

Uso en el VPS:
  python3 apply_patch.py /tmp/PATCH_X.sql [/tmp/PATCH_Y.sql ...]
  python3 apply_patch.py --check /tmp/PATCH_X.sql   # ejecuta y revierte (ROLLBACK)

No imprime la contraseña. Credenciales desde /opt/asiscole-canal/.env (SCHOOL_DATABASES).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

ENV_PATH = "/opt/asiscole-canal/.env"
TENANT = os.environ.get("SIE_TENANT", "jean_piaget")
PG_IMAGE = os.environ.get("SIE_PG_IMAGE", "postgres:17-alpine")


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


def apply(db: dict, path: str, check: bool) -> None:
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        raise SystemExit(f"No existe {path}")
    folder, name = os.path.split(path)
    cmd = [
        "docker", "run", "--rm",
        "-e", f"PGPASSWORD={db['password']}",
        "-e", "PGCLIENTENCODING=UTF8",
        "-v", f"{folder}:/patches:ro",
        PG_IMAGE,
        "psql",
        "-h", db["host"],
        "-p", str(db["port"]),
        "-U", db["user"],
        "-d", db["name"],
        "-v", "ON_ERROR_STOP=1",
        "-X", "-q",
        "-c", "BEGIN",
        "-f", f"/patches/{name}",
        "-c", "ROLLBACK" if check else "COMMIT",
    ]
    print(f"=== {name} ({'check' if check else 'apply'}) ===", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout.strip():
        print(r.stdout.strip())
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit(f"ERROR en {name}; no se aplicó nada de este archivo")
    print(f"OK {name}")


def main() -> None:
    args = sys.argv[1:]
    check = False
    if args and args[0] == "--check":
        check = True
        args = args[1:]
    if not args:
        raise SystemExit(__doc__)
    db = load_db()
    for path in args:
        apply(db, path, check)


if __name__ == "__main__":
    main()
