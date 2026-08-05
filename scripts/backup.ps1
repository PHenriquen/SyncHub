param(
  [string]$Destination = "backups"
)

. "$PSScriptRoot/common.ps1"
$root = Set-SynchubRoot
if (-not (Test-Path ".env")) { throw "O Synchub ainda nao foi preparado. Execute SYNCHUB.bat primeiro." }
if (-not (Test-Path "data/synchub.db")) { throw "O banco local nao foi encontrado. Execute SYNCHUB.bat primeiro." }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "Synchub-Backup-$timestamp"
$destinationRoot = Join-Path $root $Destination
$staging = Join-Path $destinationRoot $backupName
$archive = "$staging.zip"

New-Item -ItemType Directory -Force $staging | Out-Null
New-Item -ItemType Directory -Force (Join-Path $staging "config") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $staging "database") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $staging "source") | Out-Null

Copy-Item "data/synchub.db" (Join-Path $staging "database/synchub.db")
if (Test-Path "data/synchub.db-journal") {
  Copy-Item "data/synchub.db-journal" (Join-Path $staging "database/synchub.db-journal")
}
Copy-Item ".env" (Join-Path $staging "config/.env")
Copy-Item ".env.example" (Join-Path $staging "config/.env.example")
Copy-Item "VERSION" (Join-Path $staging "VERSION")

$sourceArchive = Join-Path $staging "source/Synchub-source.zip"
& "$PSScriptRoot/release.ps1" -OutputPath $sourceArchive -SkipValidation

$manifest = @{
  product = "Synchub"
  version = (Get-Content VERSION -Raw).Trim()
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
  includes = @("source", "sqlite-database", "local-environment")
  warning = "config/.env contains local secrets. Store this backup privately."
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $staging "manifest.json") -Encoding UTF8

Get-ChildItem $staging -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($staging.Length + 1)
  "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash)  $relative"
} | Set-Content (Join-Path $staging "SHA256SUMS.txt") -Encoding ASCII

Compress-Archive -Path "$staging/*" -DestinationPath $archive -CompressionLevel Optimal
Remove-Item $staging -Recurse -Force
Write-Host "Backup criado: $archive" -ForegroundColor Green
