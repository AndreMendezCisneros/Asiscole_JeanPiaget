# Vincular un chip WhatsApp en el VPS (WPPConnect)
# Uso desde PowerShell:
#   cd C:\Users\raios\OneDrive\Desktop\asiscole\repo
#   .\scripts\vincular-chip-wpp.ps1 -Chip 02
#   .\scripts\vincular-chip-wpp.ps1 -Chip 03

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('02', '03')]
    [string]$Chip
)

$ErrorActionPreference = 'Stop'

$Key = 'C:\Users\raios\Downloads\ssh-keys\ssh-keys\hetzner-sie'
$Server = 'root@178.104.115.2'
$Session = "sie-chip-$Chip"
$RemoteQr = "/tmp/wpp-qr-chip-$Chip.png"
$LocalQr = Join-Path $env:USERPROFILE "Desktop\qr-chip-$Chip.png"

if (-not (Test-Path $Key)) {
    Write-Error "No se encuentra la clave SSH: $Key"
}

Write-Host ""
Write-Host "=== Vincular $Session ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Iniciando sesion en el servidor..." -ForegroundColor Yellow
$remoteScript = @"
export WPPCONNECT_SESSION=$Session
bash /opt/sie/app/scripts/wppconnect-mostrar-qr.sh
sleep 12
source /opt/sie/.env.wppconnect
T=`$(echo "`$WPPCONNECT_BEARER_TOKEN" | tr -d "'\"")
curl -sf -H "Authorization: Bearer `$T" "http://127.0.0.1:21465/api/$Session/qrcode-session" -o $RemoteQr
if [ ! -s $RemoteQr ]; then echo QR_ERROR; exit 1; fi
ls -la $RemoteQr
"@

ssh -i $Key -o StrictHostKeyChecking=accept-new $Server $remoteScript
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo al generar el QR en el servidor. Vuelve a ejecutar el script."
}

Write-Host ""
Write-Host "[2/4] Descargando QR a tu Escritorio..." -ForegroundColor Yellow
scp -i $Key "${Server}:${RemoteQr}" $LocalQr

Write-Host ""
Write-Host "[3/4] Abriendo imagen del QR..." -ForegroundColor Yellow
Start-Process $LocalQr

Write-Host ""
Write-Host "[4/4] Escanea AHORA con el telefono del chip $Chip:" -ForegroundColor Green
Write-Host "      WhatsApp -> Configuracion -> Dispositivos vinculados -> Vincular dispositivo"
Write-Host ""
Write-Host "El QR caduca en ~1 minuto. Si expira, vuelve a ejecutar:" -ForegroundColor DarkYellow
Write-Host "  .\scripts\vincular-chip-wpp.ps1 -Chip $Chip"
Write-Host ""

Write-Host "Cuando hayas escaneado, comprueba la conexion:" -ForegroundColor Cyan
Write-Host "  .\scripts\verificar-chip-wpp.ps1 -Chip $Chip"
Write-Host ""
