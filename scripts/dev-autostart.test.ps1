$ErrorActionPreference = 'Stop'

$scripts = @(
  'start-dev-hidden.ps1',
  'install-dev-autostart.ps1',
  'uninstall-dev-autostart.ps1'
)

foreach ($script in $scripts) {
  $path = Join-Path $PSScriptRoot $script
  [scriptblock]::Create((Get-Content -LiteralPath $path -Raw)) | Out-Null
}

$startScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'start-dev-hidden.ps1') -Raw

if ($startScript -notmatch "dev:plugin") {
  throw 'start-dev-hidden.ps1 must start dev:plugin when port 8030 is not listening'
}

if ($startScript -notmatch "clipboard-bridge") {
  throw 'start-dev-hidden.ps1 must start clipboard-bridge when port 8031 is not listening'
}

Write-Output 'dev autostart script tests passed'
