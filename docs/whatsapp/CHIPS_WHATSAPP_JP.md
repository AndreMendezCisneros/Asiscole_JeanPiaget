# WhatsApp chips — Colegio Jean Piaget (solo)

**Ámbito:** únicamente `jeanpiaget.asiscole.com`. San Ramón sigue con sus propios chips.

## Anti-baneo (igual criterio que siempre)

| Medida | Valor JP |
|--------|----------|
| Typing “escribiendo…” | 10–12 s antes de cada mensaje |
| Jitter entre mensajes | 8–15 s por cola de chip |
| Rotación | round-robin `sie-chip-01` → `02` → `03` |
| Failover | si un chip falla, prueba el siguiente |
| Tope horario | **120**/hora por chip (chip-03: máx. **2**/h) |
| Variación de texto | banco de frases + marca “Colegio Jean Piaget” |

Capacidad orientativa con 3 chips: ~242 msg/h. Subir chips o el tope solo si hace falta.

## Setup VPS

```bash
bash /opt/sie-jp/app/scripts/jeanpiaget/activar-chips-wpp-jp.sh
# Vincular cada celular:
bash /opt/sie-jp/app/scripts/jeanpiaget/mostrar-qr-chip-jp.sh sie-chip-01
bash /opt/sie-jp/app/scripts/jeanpiaget/mostrar-qr-chip-jp.sh sie-chip-02
bash /opt/sie-jp/app/scripts/jeanpiaget/mostrar-qr-chip-jp.sh sie-chip-03
```

Descargar QR:

```powershell
scp -i E:\ssh-keys\hetzner-sie root@178.104.115.2:/tmp/wpp-qr-sie-chip-01.png .
```

Rebuild frontend JP (con `VITE_WPPCONNECT_*=true`, Meta off).

## Puertos

| Servicio | Puerto |
|----------|--------|
| WPPConnect Docker (compartido) | 21465 |
| Cola San Ramón | 3100 |
| Cola **Jean Piaget** | **3102** |
| Meta (opcional, apagado en JP) | 3101 |
