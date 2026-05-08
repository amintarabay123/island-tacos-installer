# Island Tacos — Windows Local Server Setup
# Run this ONCE as Administrator in PowerShell:
#   cd C:\IslandTacos\artifacts\island-tacos
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup-windows.ps1

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot   = Split-Path -Parent (Split-Path -Parent $installDir)
$nodeExe    = (Get-Command node -ErrorAction Stop).Source
$serverScript = Join-Path $installDir "server.mjs"
$taskName   = "IslandTacosLocalServer"
$port       = "3001"

Write-Host ""
Write-Host "=== Island Tacos Local Server Setup ===" -ForegroundColor Cyan
Write-Host "Repo root   : $repoRoot"
Write-Host "Install dir : $installDir"
Write-Host "Node        : $nodeExe"
Write-Host "Port        : $port"
Write-Host ""

# 1. Set PORT permanently for the current user
[System.Environment]::SetEnvironmentVariable("PORT", $port, "User")
Write-Host "[1/5] PORT=$port set permanently in user environment." -ForegroundColor Green

# 2. Set VITE_ADMIN_PATH permanently so rebuilds always use /admin
[System.Environment]::SetEnvironmentVariable("VITE_ADMIN_PATH", "admin", "User")
Write-Host "[2/5] VITE_ADMIN_PATH=admin set permanently." -ForegroundColor Green

# 3. Open port in Windows Firewall (inbound TCP)
$existingRule = Get-NetFirewallRule -DisplayName "Island Tacos $port" -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "[3/5] Firewall rule already exists — skipping." -ForegroundColor Yellow
} else {
    New-NetFirewallRule `
        -DisplayName "Island Tacos $port" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Profile Any | Out-Null
    Write-Host "[3/5] Firewall rule created: TCP port $port allowed (inbound)." -ForegroundColor Green
}

# 4. Rebuild the app so /admin paths are baked in
Write-Host "[4/5] Rebuilding app with VITE_ADMIN_PATH=admin..." -ForegroundColor Cyan
$env:VITE_ADMIN_PATH = "admin"
$env:BASE_PATH = "/"
Push-Location $repoRoot
try {
    & pnpm --filter "@workspace/island-tacos" run build
    Write-Host "[4/5] Build complete." -ForegroundColor Green
} catch {
    Write-Host "[4/5] Build failed: $_" -ForegroundColor Red
    Write-Host "      Try running: pnpm --filter @workspace/island-tacos run build" -ForegroundColor Yellow
} finally {
    Pop-Location
}

# 5. Remove old scheduled task if it exists
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[5/5] Removed old scheduled task." -ForegroundColor Yellow
}

# Create a scheduled task to run on Windows startup
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

Write-Host "[5/5] Scheduled task '$taskName' created — runs automatically at startup." -ForegroundColor Green

# Start it right now
Write-Host ""
Write-Host "Starting server now..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2
$status = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "Task state: $status" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host "Admin POS  : http://<tailscale-ip>:$port/admin/pos"
Write-Host "Admin panel: http://<tailscale-ip>:$port/admin"
Write-Host "Kitchen    : http://<tailscale-ip>:$port/admin/kitchen"
Write-Host ""
Write-Host "To stop:     Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "To start:    Start-ScheduledTask -TaskName '$taskName'"
Write-Host "To uninstall: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
