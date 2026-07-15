# Muestra QR WPPConnect para vincular un chip (sie-chip-01 … sie-chip-07).
param(
    [string]$SshKey = "E:\ssh-keys\hetzner-sie",
    [string]$SshHost = "root@178.104.115.2",
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^sie-chip-0[1-7]$')]
    [string]$Chip = "sie-chip-02",
    [string]$Salida = "",
    [switch]$SinLimpiar
)

if (-not $Salida) {
    $Salida = Join-Path $env:TEMP "$Chip-qr.png"
}

$limpiar = if ($SinLimpiar) { "0" } else { "1" }

Write-Host "Chip: $Chip" -ForegroundColor Cyan
Write-Host "Comprobando estado..." -ForegroundColor Cyan

$estado = ssh -i $SshKey -o StrictHostKeyChecking=no $SshHost "bash /opt/sie/app/scripts/wppconnect/estado-chips.sh 2>/dev/null | grep $Chip"
Write-Host $estado

if ($estado -match 'Connected.*CONNECTED') {
    Write-Host ""
    Write-Host "Ya CONECTADO. No hace falta QR." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Generando QR (limpia perfil unpaired si hace falta)..." -ForegroundColor Cyan
$envFlag = "LIMPIAR_PERFIL=$limpiar"
ssh -i $SshKey -o StrictHostKeyChecking=no $SshHost "$envFlag bash /opt/sie/app/scripts/wppconnect/generar-qr-chip.sh $Chip"

$remotePng = "/tmp/sie-wpp-qr/${Chip}-qr.png"
scp -i $SshKey -o StrictHostKeyChecking=no "${SshHost}:${remotePng}" $Salida 2>$null

if (-not (Test-Path $Salida)) {
    Write-Host "No se pudo descargar el PNG. Prueba en el VPS:" -ForegroundColor Red
    Write-Host "  ssh $SshHost `"cat $remotePng`" > $Salida"
    exit 1
}

Write-Host ""
Write-Host "QR listo (~60 segundos para escanear):" -ForegroundColor Green
Write-Host "  $Salida" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pasos:" -ForegroundColor Cyan
Write-Host "  1. En el CELULAR del chip $Chip → WhatsApp → Dispositivos vinculados"
Write-Host "  2. Vincular dispositivo → escanear el QR"
Write-Host "  3. NO cierres WhatsApp hasta ver 'Conectado'"
Write-Host "  4. Repite para cada chip: .\scripts\mostrar-qr-wpp-chip.ps1 -Chip sie-chip-03"
Write-Host ""
Start-Process $Salida
