Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-SynchubRoot {
  $root = Split-Path -Parent $PSScriptRoot
  Set-Location $root
  return $root
}

function Assert-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found. $InstallHint"
  }
}

function New-RandomSecret([int]$Bytes = 48) {
  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($buffer)
}

function Import-DotEnv([string]$Path = ".env") {
  if (-not (Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    $name = $name.Trim()
    # NODE_ENV belongs to the command being executed. Importing a stale value
    # here makes Next.js mix its development and production React runtimes.
    if ($name -eq 'NODE_ENV') { continue }
    [Environment]::SetEnvironmentVariable($name, $value.Trim(), 'Process')
  }
}

function Refresh-ProcessPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Get-FileHashOrEmpty([string]$Path) {
  if (-not (Test-Path $Path)) { return "" }
  return (Get-FileHash $Path -Algorithm SHA256).Hash
}
