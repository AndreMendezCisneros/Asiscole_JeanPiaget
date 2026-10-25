#!/usr/bin/env python3
import json, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = 'http://127.0.0.1:21465/api/sie-chip-01'
PORT = 3199

def token():
    return (ROOT / 'token.txt').read_text().strip()

def api(path):
    req = urllib.request.Request(f'{API}/{path}', headers={'Authorization': f'Bearer {token()}'})
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.loads(r.read().decode())

HTML = '''<!doctype html><html lang=es><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>QR WhatsApp (WPPConnect)</title>
<style>
body{margin:0;font-family:system-ui;background:#0b1b33;color:#e8eef7;min-height:100vh;display:grid;place-items:center}
.card{max-width:420px;text-align:center;padding:24px}
h1{font-size:1.25rem;margin:0 0 8px}
#st{font-weight:700;margin:8px 0 16px}
img{width:280px;height:280px;background:#ddd;border-radius:8px}
ol{text-align:left;line-height:1.5}
.ok{color:#3ddc84}.wait{color:#ffd166}
</style>
<div class=card>
<h1>QR WhatsApp (WPPConnect)</h1>
<div id=st class=wait>Cargando…</div>
<img id=qr alt=QR>
<ol>
<li>Celular del chip: WhatsApp → Dispositivos vinculados → Vincular un dispositivo</li>
<li>Apunta al QR de esta pantalla (se renueva solo cada 2 s)</li>
<li>Cuando diga CONECTADO, avisa al admin</li>
</ol>
</div>
<script>
async function tick(){
  try{
    const s=await fetch('/status.json?t='+Date.now()).then(r=>r.json());
    const el=document.getElementById('st');
    if(s.connected||s.status==='CONNECTED'||s.status==='inChat'){
      el.textContent='CONECTADO — ya puedes cerrar esta página';
      el.className='ok';
    }else if(s.status==='QRCODE'||s.qr){
      el.textContent='Escanea el QR';
      el.className='wait';
      if(s.qr) document.getElementById('qr').src=s.qr.startsWith('data:')?s.qr:('data:image/png;base64,'+s.qr);
      else document.getElementById('qr').src='/qr.png?t='+Date.now();
    }else{
      el.textContent='Estado: '+(s.status||'…');
    }
  }catch(e){document.getElementById('st').textContent='Esperando API…'}
}
setInterval(tick,2000);tick();
</script>'''

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        if self.path.startswith('/status.json'):
            try:
                st = api('status-session')
                conn = api('check-connection-session')
                body = {
                    'status': st.get('status'),
                    'connected': bool(conn.get('status') is True or conn.get('message') == 'Connected'),
                    'qr': st.get('qrcode'),
                }
            except Exception as e:
                body = {'status': 'ERROR', 'error': str(e)}
            raw = json.dumps(body).encode()
            self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
            return
        if self.path.startswith('/qr.png'):
            try:
                st = api('status-session')
                q = str(st.get('qrcode') or '')
                import re, base64
                m = re.search(r'base64,([A-Za-z0-9+/=]+)', q)
                b64 = m.group(1) if m else q
                raw = base64.b64decode(b64)
                self.send_response(200); self.send_header('Content-Type','image/png'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
            except Exception:
                self.send_response(404); self.end_headers()
            return
        raw = HTML.encode()
        self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)

ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()
