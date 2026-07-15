# Verificar si un chip WhatsApp esta conectado en el VPS
# Uso: .\scripts\verificar-chip-wpp.ps1 -Chip 02

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('02', '03')]
    [string]$Chip
)

$Key = 'C:\Users\raios\Downloads\ssh-keys\ssh-keys\hetzner-sie'
$Server = 'root@178.104.115.2'
$Session = "sie-chip-$Chip"

$remoteScript = @"
source /opt/sie/.env.wppconnect
T=`$(echo "`$WPPCONNECT_BEARER_TOKEN" | tr -d "'\"")
echo "=== $Session ==="
curl -s -H "Authorization: Bearer `$T" "http://127.0.0.1:21465/api/$Session/check-connection-session"
echo
"@

ssh -i $Key $Server $remoteScript
