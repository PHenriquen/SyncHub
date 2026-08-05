param(
  [switch]$PrepareOnly,
  [switch]$ForcePrepare
)

. "$PSScriptRoot/common.ps1"
$root = Set-SynchubRoot
$stateDirectory = Join-Path $root ".synchub"
$installationMarkerPath = Join-Path $stateDirectory "installation.json"
$dependencyMarkerPath = Join-Path $stateDirectory "dependencies.json"

function Ensure-StateDirectory {
  New-Item -ItemType Directory -Force $stateDirectory, (Join-Path $root "data") | Out-Null
}

function Ensure-Node {
  $mustInstall = -not (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $mustInstall) {
    $installedMajor = [int]((node --version).TrimStart('v').Split('.')[0])
    $mustInstall = $installedMajor -lt 22
  }
  if (-not $mustInstall) { return }

  Write-Host "Instalando ou atualizando o Node.js LTS..." -ForegroundColor Yellow
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "O Windows Package Manager (winget) nao esta disponivel. Instale o Node.js LTS e execute SYNCHUB.bat novamente."
  }

  winget install --id OpenJS.NodeJS.LTS --exact --silent --force `
    --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "A instalacao automatica do Node.js falhou." }

  Refresh-ProcessPath
  $nodeDirectory = Join-Path $env:ProgramFiles "nodejs"
  if (Test-Path $nodeDirectory) { $env:Path = "$nodeDirectory;$env:Path" }
  Assert-Command "node" "Feche esta janela, abra novamente e execute SYNCHUB.bat."
}

function Initialize-Environment {
  Ensure-StateDirectory
  if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
  $content = Get-Content ".env" -Raw
  $content = [regex]::Replace($content, '(?m)^DATABASE_URL=.*$', 'DATABASE_URL=file:../../../data/synchub.db')
  $content = $content.Replace(
    'generated-by-synchub-one-click-minimum-32-characters',
    (New-RandomSecret)
  )
  $content = $content.Replace(
    'generated-by-synchub-one-click-different-minimum-32-characters',
    (New-RandomSecret)
  )
  [IO.File]::WriteAllText(
    (Join-Path $root '.env'),
    $content,
    (New-Object Text.UTF8Encoding($false))
  )
  Import-DotEnv
}

function Get-DependencyFingerprint {
  $files = @(
    "package.json",
    "apps/api/package.json",
    "apps/web/package.json",
    "packages/contracts/package.json",
    "package-lock.json"
  )
  $builder = New-Object Text.StringBuilder
  foreach ($file in $files) {
    [void]$builder.Append($file)
    [void]$builder.Append(':')
    [void]$builder.Append((Get-FileHashOrEmpty $file))
    [void]$builder.Append('|')
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes($builder.ToString())
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') }
  finally { $sha.Dispose() }
}

function Write-DependencyMarker {
  $marker = @{
    fingerprint = Get-DependencyFingerprint
    node = (node --version).Trim()
    npm = (npm --version).Trim()
    installedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $marker | ConvertTo-Json | Set-Content $dependencyMarkerPath -Encoding UTF8
}

function Test-DependenciesReady {
  if (-not (Test-Path "node_modules") -or -not (Test-Path "package-lock.json")) { return $false }

  $requiredCommands = @(
    "node_modules/.bin/tsc.cmd",
    "node_modules/.bin/prisma.cmd",
    "node_modules/.bin/next.cmd",
    "node_modules/.bin/nest.cmd"
  )
  foreach ($command in $requiredCommands) {
    if (-not (Test-Path $command)) { return $false }
  }

  if (Test-Path $dependencyMarkerPath) {
    try {
      $marker = Get-Content $dependencyMarkerPath -Raw | ConvertFrom-Json
      return $marker.fingerprint -eq (Get-DependencyFingerprint)
    } catch { return $false }
  }

  # Supports resuming an installation that stopped after npm install.
  Write-DependencyMarker
  return $true
}

function Install-Dependencies {
  if (-not $ForcePrepare -and (Test-DependenciesReady)) {
    Write-Host "Dependencias ja instaladas; continuando a preparacao..." -ForegroundColor Green
    return
  }

  Write-Host "Instalando dependencias do projeto..." -ForegroundColor Cyan
  if (Test-Path "package-lock.json") {
    npm ci
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "npm ci falhou; atualizando o lockfile com npm install."
      npm install
    }
  } else {
    npm install
  }
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel instalar as dependencias npm." }
  Write-DependencyMarker
}

function Test-PreparationRequired {
  if ($ForcePrepare) { return $true }
  if (-not (Test-Path ".env") -or -not (Test-Path $installationMarkerPath)) { return $true }

  try { $marker = Get-Content $installationMarkerPath -Raw | ConvertFrom-Json }
  catch { return $true }
  $version = (Get-Content VERSION -Raw).Trim()
  return $marker.version -ne $version -or -not (Test-DependenciesReady)
}

function Invoke-Step([string]$Title, [scriptblock]$Action, [string]$FailureMessage) {
  Write-Host $Title -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

function Build-Synchub {
  $previousNodeEnvironment = [Environment]::GetEnvironmentVariable('NODE_ENV', 'Process')
  try {
    # Next.js production builds must not inherit NODE_ENV=development from the
    # user's Windows profile or from an older Synchub .env file.
    $env:NODE_ENV = 'production'
    npm run build
  } finally {
    if ($null -eq $previousNodeEnvironment) {
      [Environment]::SetEnvironmentVariable('NODE_ENV', $null, 'Process')
    } else {
      $env:NODE_ENV = $previousNodeEnvironment
    }
  }
}

function Prepare-Synchub {
  Write-Host ""
  Write-Host "Preparando o Synchub..." -ForegroundColor Cyan
  Write-Host "Nao e necessario Docker, PostgreSQL ou configuracao manual." -ForegroundColor DarkGray

  Initialize-Environment
  Install-Dependencies

  Invoke-Step "Gerando o cliente do banco..." { npm run db:generate } "Falha ao gerar o cliente do banco."
  Invoke-Step "Preparando o banco local..." { npm run db:push } "Falha ao preparar o banco local."
  Invoke-Step "Criando os dados iniciais..." { npm run db:seed } "Falha ao criar os dados iniciais."
  Invoke-Step "Verificando o codigo..." { npm run check } "A verificacao do projeto falhou."
  Invoke-Step "Executando os testes..." { npm run test } "Os testes do projeto falharam."
  Invoke-Step "Compilando o Synchub..." { Build-Synchub } "O build do projeto falhou."

  $marker = @{
    version = (Get-Content VERSION -Raw).Trim()
    preparedAt = (Get-Date).ToUniversalTime().ToString('o')
    node = (node --version).Trim()
    npm = (npm --version).Trim()
    dependencyFingerprint = Get-DependencyFingerprint
    database = "data/synchub.db"
  }
  $marker | ConvertTo-Json | Set-Content $installationMarkerPath -Encoding UTF8
  Write-Host ""
  Write-Host "Synchub instalado e configurado." -ForegroundColor Green
}

Ensure-Node
Assert-Command "npm" "Reinstale o Node.js LTS."
$nodeVersion = (node --version).TrimStart('v')
if ([int]($nodeVersion.Split('.')[0]) -lt 22) {
  throw "Node.js $nodeVersion e antigo. Instale Node.js 22 ou superior."
}

if (Test-PreparationRequired) { Prepare-Synchub }
else {
  Initialize-Environment
  Write-Host "Synchub ja esta preparado. Iniciando..." -ForegroundColor Green
}

if ($PrepareOnly) {
  Write-Host "Preparacao concluida. Use SYNCHUB.bat para iniciar." -ForegroundColor Green
  exit 0
}

Write-Host ""
Write-Host "Synchub em execucao:" -ForegroundColor Green
Write-Host "  Interface: http://localhost:3000"
Write-Host "  API:       http://localhost:3333/api/v1"
Write-Host "  Swagger:   http://localhost:3333/docs"
Write-Host ""
Write-Host "Conta inicial: demo@synchub.local / Synchub123!" -ForegroundColor DarkGray
Write-Host "Para encerrar, pressione Ctrl+C." -ForegroundColor DarkGray
Write-Host "O navegador sera aberto assim que a interface estiver pronta." -ForegroundColor DarkGray

$browserWaitScript = Join-Path $PSScriptRoot 'open-when-ready.ps1'
$browserWaitArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Url "http://localhost:3000" -TimeoutSeconds 180' -f $browserWaitScript
Start-Process powershell -WindowStyle Hidden -ArgumentList $browserWaitArguments
$env:NODE_ENV = 'development'
npm run dev
$exitCode = $LASTEXITCODE
if ($exitCode -notin @(0, 130, -1073741510)) {
  throw "O servidor do Synchub foi encerrado com erro (codigo $exitCode)."
}
