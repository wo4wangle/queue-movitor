param(
  [string]$TaskName = 'RemNote Queue Movitor Dev'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($null -eq $task) {
  Write-Output "Scheduled task not found: $TaskName"
  return
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Output "Removed scheduled task: $TaskName"
