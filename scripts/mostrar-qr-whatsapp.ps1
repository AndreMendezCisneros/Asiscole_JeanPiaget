# Muestra el QR de WhatsApp en tu PC (sin panel OpenWA).
param(
    [string]$SshKey = "E:\ssh-keys\hetzner-sie",
    [string]$SshHost = "root@178.104.115.2",
    [string]$SessionId = "df5eb0f1-cd98-48c9-b6fb-f82859f06e81",
    [string]$ApiKey = "sie-openwa-334c2b5685ce6c829d4136c68b5388a8a922e9b111326949",
    [string]$Salida = "$env:TEMP\whatsapp-qr-asiscole.png",
    [switch]$ForzarReset
)

function Invoke-RemoteBash([string]$Script) {
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    ssh -i $SshKey -o StrictHostKeyChecking=no $SshHost "echo $b64 | base64 -d | bash"
}

$statusScript = @(
    "SID=$SessionId"
    "KEY=$ApiKey"
    'curl -s "http://localhost:2785/api/sessions/$SID" -H "X-API-Key: $KEY"'
) -join "`n"

Write-Host "Comprobando sesion..." -ForegroundColor Cyan
$statusJson = Invoke-RemoteBash $statusScript
$status = ($statusJson | ConvertFrom-Json).status
Write-Host "Estado actual: $status"

if ($status -eq 'ready' -or $status -eq 'connected') {
    Write-Host ""
    Write-Host "WhatsApp CONECTADO ($status). No ejecutes mostrar-qr-whatsapp.ps1." -ForegroundColor Green
    Write-Host "La sesion se mantiene sola en el servidor (auto-start + vigilancia cada 3 min)."
    exit 0
}

if ($status -eq 'authenticating' -and -not $ForzarReset) {
    Write-Host ""
    Write-Host "La sesion esta sincronizando. NO ejecutes este script otra vez." -ForegroundColor Yellow
    Write-Host "Espera 3-5 minutos y ejecuta: .\scripts\estado-whatsapp.ps1"
    Write-Host "Si sigue igual, espera 5 min y usa: .\scripts\mostrar-qr-whatsapp.ps1 -ForzarReset"
    exit 0
}

if ($ForzarReset -or $status -in @('disconnected', 'created', 'failed')) {
    Write-Host "Preparando sesion limpia..." -ForegroundColor Cyan
    $resetScript = @(
        "SID=$SessionId"
        "KEY=$ApiKey"
        'curl -s -X POST "http://localhost:2785/api/sessions/$SID/stop" -H "X-API-Key: $KEY" > /dev/null 2>&1 || true'
        'rm -rf /opt/openwa/data/sessions/session-asiscole'
        'curl -s -X POST "http://localhost:2785/api/sessions/$SID/start" -H "X-API-Key: $KEY" > /dev/null'
        'sleep 14'
    ) -join "`n"
    Invoke-RemoteBash $resetScript | Out-Null
} elseif ($status -ne 'qr_ready') {
    Write-Host "Iniciando sesion..." -ForegroundColor Cyan
    $startScript = @(
        "SID=$SessionId"
        "KEY=$ApiKey"
        'curl -s -X POST "http://localhost:2785/api/sessions/$SID/start" -H "X-API-Key: $KEY" > /dev/null 2>&1 || true'
        'sleep 10'
    ) -join "`n"
    Invoke-RemoteBash $startScript | Out-Null
}

$qrScript = @(
    "SID=$SessionId"
    "KEY=$ApiKey"
    'curl -s "http://localhost:2785/api/sessions/$SID/qr" -H "X-API-Key: $KEY"'
) -join "`n"

Write-Host "Obteniendo QR..." -ForegroundColor Cyan
$json = Invoke-RemoteBash $qrScript

try {
    $data = $json | ConvertFrom-Json
    if (-not $data.qrCode) {
        Write-Host "No hay QR: $($data.message)" -ForegroundColor Red
        exit 1
    }
    $b64img = $data.qrCode -replace '^data:image/png;base64,', ''
    [IO.File]::WriteAllBytes($Salida, [Convert]::FromBase64String($b64img))
    Write-Host ""
    Write-Host "QR listo (~60 segundos):" -ForegroundColor Green
    Write-Host "  $Salida" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "IMPORTANTE - un solo intento:" -ForegroundColor Red
    Write-Host "  1. WhatsApp -> cierra TODOS los dispositivos vinculados"
    Write-Host "  2. Escanea el QR de inmediato"
    Write-Host "  3. NO cierres WhatsApp hasta que diga conectado"
    Write-Host "  4. NO ejecutes este script otra vez durante 5 minutos"
    Write-Host "  5. Luego: .\scripts\estado-whatsapp.ps1"
    Write-Host ""
    Start-Process $Salida
} catch {
    Write-Host "Error: $json" -ForegroundColor Red
}
