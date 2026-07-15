# Arranca OpenWA sin Docker (Node.js + SQLite)
# Uso: .\scripts\iniciar-openwa.ps1

param(
    [string]$Destino = (Join-Path (Split-Path $PSScriptRoot -Parent) "OpenWA")
)

$ErrorActionPreference = "Stop"

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "=== OpenWA (sin Docker) ===" -ForegroundColor Cyan

if (-not (Test-Command node)) {
    Write-Host "ERROR: Node.js no esta instalado. https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "Node: $(node -v)"

if (-not (Test-Command git)) {
    Write-Host "ERROR: Git no esta en el PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Destino)) {
    Write-Host "Clonando OpenWA en: $Destino"
    git clone https://github.com/rmyndharis/OpenWA.git $Destino
}

Set-Location $Destino

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..."
    npm install --ignore-scripts
    if (Test-Path "dashboard") {
        Push-Location dashboard
        npm install
        Pop-Location
    }
}

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.minimal") {
        Copy-Item ".env.minimal" ".env"
        Write-Host "Creado .env desde .env.minimal"
    } else {
        Write-Host "AVISO: copie .env.minimal a .env manualmente." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Iniciando API (:2785) y dashboard (:2886)..." -ForegroundColor Green
Write-Host "Dashboard: http://localhost:2886"
Write-Host "API:       http://localhost:2785/api"
Write-Host "Deje esta ventana abierta. Ctrl+C para detener."
Write-Host ""

npm run dev
