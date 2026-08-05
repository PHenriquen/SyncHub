param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [switch]$RestoreEnvironment
)

. "$PSScriptRoot/common.ps1"
$root = Set-SynchubRoot
$BackupPath = $BackupPath.Trim('"')
$resolved = Resolve-Path $BackupPath
$temp = Join-Path ([IO.Path]::GetTempPath()) "synchub-restore-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $temp | Out-Null

try {
  Expand-Archive -Path $resolved -DestinationPath $temp -Force
  $manifestPath = Join-Path $temp "manifest.json"
  $databasePath = Join-Path $temp "database/synchub.db"
  $checksumsPath = Join-Path $temp "SHA256SUMS.txt"
  if (-not (Test-Path $manifestPath) -or -not (Test-Path $databasePath) -or -not (Test-Path $checksumsPath)) {
    throw "Este arquivo nao e um backup valido do Synchub."
  }

  foreach ($line in Get-Content $checksumsPath) {
    if ($line -notmatch '^([A-Fa-f0-9]{64})  (.+)$') { throw "Entrada invalida no manifesto de integridade." }
    $expectedHash = $Matches[1].ToUpperInvariant()
    $target = Join-Path $temp $Matches[2]
    if (-not (Test-Path $target)) { throw "Arquivo ausente no backup: $($Matches[2])" }
    $actualHash = (Get-FileHash $target -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) { throw "Falha de integridade no arquivo: $($Matches[2])" }
  }

  New-Item -ItemType Directory -Force "data" | Out-Null
  Copy-Item $databasePath (Join-Path $root "data/synchub.db") -Force
  $journal = Join-Path $temp "database/synchub.db-journal"
  if (Test-Path $journal) { Copy-Item $journal (Join-Path $root "data/synchub.db-journal") -Force }

  if ($RestoreEnvironment) {
    Copy-Item (Join-Path $temp "config/.env") (Join-Path $root ".env") -Force
    Write-Warning "Os segredos locais do backup foram restaurados."
  }

  Write-Host "Banco local do Synchub restaurado com sucesso." -ForegroundColor Green
  Write-Host "Execute SYNCHUB.bat para validar e iniciar." -ForegroundColor Cyan
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
