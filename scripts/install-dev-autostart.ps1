param(
  [string]$TaskName = 'RemNote Queue Movitor Dev',
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$startScript = Join-Path $PSScriptRoot 'start-dev-hidden.ps1'

if (-not (Test-Path -LiteralPath $startScript)) {
  throw "Start script not found: $startScript"
}

$userId = if ($env:USERDOMAIN) {
  "$env:USERDOMAIN\$env:USERNAME"
} else {
  $env:USERNAME
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Start the RemNote plugin dev server and clipboard bridge at Windows logon.' `
  -Force | Out-Null

Write-Output "Installed scheduled task: $TaskName"

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Output "Started scheduled task: $TaskName"
}
