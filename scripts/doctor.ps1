. "$PSScriptRoot/common.ps1"
Set-SynchubRoot | Out-Null
Write-Host "Synchub environment doctor" -ForegroundColor Cyan
Assert-Command "node" "Execute SYNCHUB.bat para instalar o Node.js automaticamente."
Assert-Command "npm" "Reinstale o Node.js LTS."
Write-Host "Node.js: $((node --version).Trim())" -ForegroundColor Green
Write-Host "npm:     $((npm --version).Trim())" -ForegroundColor Green
Write-Host "Banco:   SQLite local (nenhum Docker necessario)" -ForegroundColor Green
if (Test-Path ".env") { Write-Host ".env:    configurado" -ForegroundColor Green }
else { Write-Warning ".env sera criado pelo SYNCHUB.bat." }
