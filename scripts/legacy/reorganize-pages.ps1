# Script para reorganizar los archivos de páginas

# Crear estructura de directorios
$directories = @(
    "src\pages\auth\login",
    "src\pages\attendance\control",
    "src\pages\attendance\scan",
    "src\pages\incidents\new",
    "src\pages\incidents\[id]",
    "src\pages\catalog\faults",
    "src\pages\admin\audit",
    "src\pages\admin\settings",
    "src\pages\_error"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Directorio creado: $dir"
    }
}

# Mover archivos a sus nuevas ubicaciones
$fileMoves = @{
    "src\pages\Login.tsx" = "src\pages\auth\login\index.tsx"
    "src\pages\ArrivalControl.tsx" = "src\pages\attendance\control\index.tsx"
    "src\pages\TutorScanner.tsx" = "src\pages\attendance\scan\index.tsx"
    "src\pages\RegisterIncident.tsx" = "src\pages\incidents\new\index.tsx"
    "src\pages\IncidentsList.tsx" = "src\pages\incidents\index.tsx"
    "src\pages\StudentsList.tsx" = "src\pages\students\index.tsx"
    "src\pages\FaultsCatalog.tsx" = "src\pages\catalog\faults\index.tsx"
    "src\pages\Reports.tsx" = "src\pages\reports\index.tsx"
    "src\pages\AuditLogs.tsx" = "src\pages\admin\audit\index.tsx"
    "src\pages\SystemConfig.tsx" = "src\pages\admin\settings\index.tsx"
    "src\pages\NotFound.tsx" = "src\pages\_error\404.tsx"
}

foreach ($file in $fileMoves.GetEnumerator()) {
    if (Test-Path $file.Key) {
        Move-Item -Path $file.Key -Destination $file.Value -Force
        Write-Host "Movido: $($file.Key) -> $($file.Value)"
    } else {
        Write-Host "No se encontró: $($file.Key)"
    }
}

Write-Host "\nReorganización completada. Por favor, verifica que todos los archivos estén en su lugar."
