# Island Tacos — Windows Local Server Setup
# Run ONCE as Administrator:
#   cd C:\IslandTacos\artifacts\island-tacos
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-windows.ps1

Write-Host ""
Write-Host "=== Island Tacos Local Server Setup ===" -ForegroundColor Cyan

$installDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot    = Split-Path -Parent (Split-Path -Parent $installDir)
$taskName    = "IslandTacosLocalServer"
$port        = "3001"
$apiUrl      = "https://orders.islandtacosbvi.com"
$adminPath   = "admin"

Write-Host "Dir : $installDir"
Write-Host "Port: $port"
Write-Host "API : $apiUrl"
Write-Host ""

# 1. Permanent user environment variables
[System.Environment]::SetEnvironmentVariable("PORT",            $port,      "User")
[System.Environment]::SetEnvironmentVariable("VITE_ADMIN_PATH", $adminPath, "User")
[System.Environment]::SetEnvironmentVariable("API_SERVER_URL",  $apiUrl,    "User")
Write-Host "[1/4] Environment variables set permanently." -ForegroundColor Green

# 2. Open Windows Firewall for inbound port
$existing = Get-NetFirewallRule -DisplayName "Island Tacos $port" -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule -DisplayName "Island Tacos $port" -Direction Inbound `
        -Protocol TCP -LocalPort $port -Action Allow -Profile Any | Out-Null
    Write-Host "[2/4] Firewall rule created for TCP port $port." -ForegroundColor Green
} else {
    Write-Host "[2/4] Firewall rule already exists." -ForegroundColor Yellow
}

# 3. Build the frontend with correct settings
Write-Host "[3/4] Building frontend..." -ForegroundColor Cyan
Push-Location $repoRoot
$env:VITE_ADMIN_PATH = $adminPath
$env:BASE_PATH       = "/"
$buildResult = & pnpm --filter "@workspace/island-tacos" run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[3/4] Build complete." -ForegroundColor Green
} else {
    Write-Host "[3/4] Build failed — check pnpm output above." -ForegroundColor Red
    $buildResult | Write-Host
}
Pop-Location

# 4. Register/update scheduled task
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$node    = (Get-Command node).Source
$action  = New-ScheduledTaskAction -Execute $node -Argument "server.mjs" `
               -WorkingDirectory $installDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
               -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) `
               -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal `
               -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
               -RunLevel Highest -LogonType Interactive

# Embed env vars directly in the task so they survive reboots
$envPairs = @(
    "PORT=$port",
    "API_SERVER_URL=$apiUrl",
    "VITE_ADMIN_PATH=$adminPath"
)
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Island Tacos local POS server on port $port</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled></BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)</UserId>
      <RunLevel>HighestAvailable</RunLevel>
      <LogonType>InteractiveToken</LogonType>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>5</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$node</Command>
      <Arguments>server.mjs</Arguments>
      <WorkingDirectory>$installDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

Register-ScheduledTask -TaskName $taskName -Xml $taskXml -Force | Out-Null
Write-Host "[4/4] Scheduled task registered — starts automatically at boot." -ForegroundColor Green

# Start it immediately
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$env:PORT          = $port
$env:API_SERVER_URL = $apiUrl
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "POS   : http://<tailscale-ip>:$port/admin/pos"
Write-Host "Admin : http://<tailscale-ip>:$port/admin"
Write-Host ""
Write-Host "Starts automatically every time Windows boots. No manual steps needed."
