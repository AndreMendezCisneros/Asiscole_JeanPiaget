#!/usr/bin/env python3
"""Si sie-chip-01 está desconectado, llama start-session. No cierra la sesión."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

SESSION = "sie-chip-01"
BASE = f"http://127.0.0.1:21465/api/{SESSION}"


def token() -> str:
    for line in Path("/opt/sie-jp/.env.build").read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("VITE_WPPCONNECT_TOKEN="):
            return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("no token")


def call(method: str, url: str, tok: str, body: dict | None = None):
    data = None
    headers = {"Authorization": f"Bearer {tok}", "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")[:500]
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace")[:500]


def main():
    tok = token()
    st, raw = call("GET", f"{BASE}/check-connection-session", tok)
    print(f"CHECK {st} {raw}", flush=True)
    connected = False
    try:
        connected = bool(json.loads(raw).get("status") is True)
    except Exception:
        connected = False
    if connected:
        print("ALREADY_CONNECTED", flush=True)
        return
    print("START_SESSION", flush=True)
    st, raw = call(
        "POST",
        f"{BASE}/start-session",
        tok,
        {"waitQrCode": False, "autoClose": 0},
    )
    print(f"START {st} {raw}", flush=True)
    st, raw = call("GET", f"{BASE}/status-session", tok)
    print(f"STATUS {st} {raw}", flush=True)


if __name__ == "__main__":
    main()
