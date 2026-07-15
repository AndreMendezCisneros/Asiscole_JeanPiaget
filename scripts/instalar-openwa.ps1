# Instala OpenWA en ./OpenWA (Windows)
# Uso: .\scripts\instalar-openwa.ps1

$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root "OpenWA"

Set-Location $root

if (-not (Test-Path $dest)) {
    git clone https://github.com/rmyndharis/OpenWA.git $dest
}

Set-Location $dest

Write-Host "npm install (sin postinstall bash)..." -ForegroundColor Cyan
npm install --ignore-scripts

if (-not (Test-Path ".env")) {
    Copy-Item ".env.minimal" ".env"
    Write-Host "Creado .env"
}

Write-Host "Dashboard..." -ForegroundColor Cyan
Set-Location (Join-Path $dest "dashboard")
npm install

Write-Host ""
Write-Host "Listo. Arranque con: npm run openwa" -ForegroundColor Green
Write-Host "  o: .\scripts\iniciar-openwa.ps1"
