# Solicita codigo de vinculacion (alternativa al QR). Puede fallar en el servidor; usa mostrar-qr-whatsapp.ps1
param(
    [string]$Telefono = "51900116737",
    [string]$SshKey = "E:\ssh-keys\hetzner-sie",
    [string]$SshHost = "root@178.104.115.2",
    [string]$SessionId = "df5eb0f1-cd98-48c9-b6fb-f82859f06e81",
    [string]$ApiKey = "sie-openwa-334c2b5685ce6c829d4136c68b5388a8a922e9b111326949"
)

$lines = @(
    "SID=$SessionId"
    "KEY=$ApiKey"
    "PHONE=$Telefono"
    'curl -s -X POST "http://localhost:2785/api/sessions/$SID/stop" -H "X-API-Key: $KEY" > /dev/null 2>&1 || true'
    'rm -rf /opt/openwa/data/sessions/session-asiscole'
    'curl -s -X POST "http://localhost:2785/api/sessions/$SID/start" -H "X-API-Key: $KEY" > /dev/null'
    'sleep 14'
    'curl -s -X POST "http://localhost:2785/api/sessions/$SID/pairing-code" -H "Content-Type: application/json" -H "X-API-Key: $KEY" -d "{\"phoneNumber\":\"$PHONE\"}"'
)
$remoteScript = ($lines -join "`n")
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))

Write-Host "Generando codigo para +$Telefono ..." -ForegroundColor Cyan
$result = ssh -i $SshKey -o StrictHostKeyChecking=no $SshHost "echo $b64 | base64 -d | bash"
Write-Host $result

try {
    $json = $result | ConvertFrom-Json
    if ($json.pairingCode) {
        Write-Host ""
        Write-Host "CODIGO (2 min):" -ForegroundColor Green
        Write-Host "  $($json.pairingCode)" -ForegroundColor Black -BackgroundColor Yellow
        Write-Host ""
        Write-Host "WhatsApp -> Dispositivos vinculados -> Vincular con numero -> pegar codigo"
        Write-Host "Luego: .\scripts\estado-whatsapp.ps1"
    } elseif ($json.message) {
        Write-Host "Error: $($json.message). Prueba: .\scripts\mostrar-qr-whatsapp.ps1" -ForegroundColor Red
    }
} catch {
    Write-Host "Respuesta: $result" -ForegroundColor Red
}
