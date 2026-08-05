param(
  [string]$OutputPath,
  [switch]$SkipValidation
)

. "$PSScriptRoot/common.ps1"
$root = Set-SynchubRoot
$version = (Get-Content VERSION -Raw).Trim()
if (-not $OutputPath) {
  New-Item -ItemType Directory -Force "releases" | Out-Null
  $OutputPath = Join-Path $root "releases/Synchub-v$version-source.zip"
} elseif (-not [IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $root $OutputPath
}

if (-not $SkipValidation) {
  node scripts/quality-check.mjs
  node scripts/verify-snapshot.mjs
}

$temp = Join-Path ([IO.Path]::GetTempPath()) "synchub-release-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $temp | Out-Null
$excludedTopLevel = @('.git', '.next', '.synchub', 'backups', 'releases', 'node_modules', 'dist', 'coverage', 'data')

try {
  Get-ChildItem $root -Force | Where-Object {
    $excludedTopLevel -notcontains $_.Name -and $_.Name -ne '.env'
  } | ForEach-Object {
    Copy-Item $_.FullName $temp -Recurse -Force
  }

  Get-ChildItem $temp -Recurse -Directory -Force | Where-Object {
    $_.Name -in @('node_modules', '.next', 'dist', 'coverage', '__pycache__')
  } | Remove-Item -Recurse -Force

  $parent = Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Force $parent | Out-Null
  if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
  Compress-Archive -Path "$temp/*" -DestinationPath $OutputPath -CompressionLevel Optimal
  $hash = (Get-FileHash $OutputPath -Algorithm SHA256).Hash
  Set-Content "$OutputPath.sha256" "$hash  $([IO.Path]::GetFileName($OutputPath))" -Encoding ASCII
  Write-Host "Source snapshot created: $OutputPath" -ForegroundColor Green
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
