# Island Tacos — Windows Local Server Setup
# Run this ONCE as Administrator in PowerShell:
#   cd C:\IslandTacos\artifacts\island-tacos
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-windows.ps1

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$nodeExe    = (Get-Command node -ErrorAction Stop).Source
$serverScript = Join-Path $installDir "server.mjs"
$taskName   = "IslandTacosLocalServer"
$port       = "3001"

Write-Host ""
Write-Host "=== Island Tacos Local Server Setup ===" -ForegroundColor Cyan
Write-Host "Install dir : $installDir"
Write-Host "Node        : $nodeExe"
Write-Host "Script      : $serverScript"
Write-Host "Port        : $port"
Write-Host ""

# 1. Set PORT permanently for the current user
[System.Environment]::SetEnvironmentVariable("PORT", $port, "User")
Write-Host "[1/4] PORT=$port set permanently in user environment." -ForegroundColor Green

# 2. Open port in Windows Firewall (inbound TCP)
$existingRule = Get-NetFirewallRule -DisplayName "Island Tacos $port" -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "[2/4] Firewall rule already exists — skipping." -ForegroundColor Yellow
} else {
    New-NetFirewallRule `
        -DisplayName "Island Tacos $port" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Profile Any | Out-Null
    Write-Host "[2/4] Firewall rule created: TCP port $port allowed (inbound)." -ForegroundColor Green
}

# 3. Remove old scheduled task if it exists
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[3/4] Removed old scheduled task." -ForegroundColor Yellow
}

# 4. Create a scheduled task to run on Windows startup
$envBlock = "PORT=$port"
$action = New-ScheduledTaskAction `
    -Execute $nodeExe `
    -Argument $serverScript `
    -WorkingDirectory $installDir

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -RunLevel Highest `
    -LogonType Interactive

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Island Tacos local POS/admin server on port $port" | Out-Null

Write-Host "[4/4] Scheduled task '$taskName' created — runs automatically at startup." -ForegroundColor Green

# 5. Start it right now
Write-Host ""
Write-Host "Starting server now..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $taskName

Start-Sleep -Seconds 2
$status = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "Task state: $status" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host "Server runs on port $port every time Windows starts."
Write-Host "Access via Tailscale: http://<tailscale-ip>:$port/admin/pos"
Write-Host ""
Write-Host "To stop the server:  Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "To start the server: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "To uninstall:        Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
