# Comprueba si la sesion WhatsApp esta conectada en el VPS.
param(
    [string]$SshKey = "E:\ssh-keys\hetzner-sie",
    [string]$SshHost = "root@178.104.115.2",
    [string]$SessionId = "df5eb0f1-cd98-48c9-b6fb-f82859f06e81",
    [string]$ApiKey = "sie-openwa-334c2b5685ce6c829d4136c68b5388a8a922e9b111326949"
)

$cmd = "curl -s http://localhost:2785/api/sessions/$SessionId -H 'X-API-Key: $ApiKey' | python3 -m json.tool"
$out = ssh -i $SshKey -o StrictHostKeyChecking=no $SshHost $cmd
Write-Host $out

if ($out -match '"status": "ready"' -or $out -match '"status": "connected"') {
    Write-Host "`nWhatsApp CONECTADO. No hace falta volver a vincular." -ForegroundColor Green
} elseif ($out -match '"status": "authenticating"') {
    Write-Host "`nAun autenticando... espera 1-2 min y vuelve a ejecutar este script." -ForegroundColor Yellow
} elseif ($out -match '"status": "qr_ready"') {
    Write-Host "`nEsperando vinculacion. Ejecuta .\scripts\solicitar-codigo-whatsapp.ps1" -ForegroundColor Yellow
} else {
    Write-Host "`nSesion no conectada." -ForegroundColor Red
}
