$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot '.ai'
$logPath = Join-Path $logDir 'dev-autostart.log'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-DevLog {
  param([string]$Message)

  $timestamp = Get-Date -Format o
  Add-Content -Path $logPath -Value "[$timestamp] $Message" -Encoding UTF8
}

function Test-PortListening {
  param([int]$Port)

  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    return $null -ne $connection
  } catch {
    $netstatLine = netstat -ano -p tcp | Select-String -Pattern ":$Port\s+.*LISTENING" | Select-Object -First 1
    return $null -ne $netstatLine
  }
}

function Start-NpmScriptHidden {
  param([string]$ScriptName)

  $command = "npm run $ScriptName >> `"$logPath`" 2>&1"
  Write-DevLog "Starting npm script: $ScriptName"
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/d', '/s', '/c', $command) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden
}

$pluginRunning = Test-PortListening -Port 8030
$bridgeRunning = Test-PortListening -Port 8031

Write-DevLog "Autostart check: pluginPort8030=$pluginRunning bridgePort8031=$bridgeRunning"

if (-not $pluginRunning) {
  Start-NpmScriptHidden -ScriptName 'dev:plugin'
}

if (-not $bridgeRunning) {
  Start-NpmScriptHidden -ScriptName 'clipboard-bridge'
}

if ($pluginRunning -and $bridgeRunning) {
  Write-DevLog 'Both dev server and clipboard bridge are already running; nothing to start.'
}
