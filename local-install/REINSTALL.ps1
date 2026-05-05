#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Island Tacos — Complete clean reinstall on Windows local server.
    Downloads everything fresh from the cloud. Only asks for your DB password.

.USAGE
    PowerShell (as Administrator):
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        .\REINSTALL.ps1

    Or run directly from the cloud (no need to download first):
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        irm https://orders.islandtacosbvi.com/api/download/REINSTALL.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$CLOUD = "https://orders.islandtacosbvi.com"
$INSTALL_DIR = "C:\IslandTacos"

function Write-Step { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    ERR $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   Island Tacos — Fresh Install" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# ── 1. Collect credentials ────────────────────────────────────────────────────
$AdminPin = Read-Host "Enter your Admin PIN (to authenticate with cloud server)"
if (-not $AdminPin) { Write-Fail "Admin PIN is required." }

# Verify PIN against cloud server
try {
    $testUrl = "$CLOUD/api/download/env?pin=$([uri]::EscapeDataString($AdminPin))"
    $null = Invoke-WebRequest $testUrl -UseBasicParsing -ErrorAction Stop
    Write-OK "Admin PIN verified."
} catch {
    Write-Fail "Admin PIN rejected by cloud server. Check your PIN and try again."
}

$DbPassword = Read-Host "Enter your PostgreSQL password for the 'ituser' account"
if (-not $DbPassword) { Write-Fail "Database password is required." }

# ── 2. Stop running PM2 process ───────────────────────────────────────────────
Write-Step "Stopping existing PM2 process (if any)..."
try {
    pm2 stop island-tacos 2>$null
    pm2 delete island-tacos 2>$null
    Write-OK "PM2 process stopped and removed."
} catch {
    Write-OK "No running PM2 process found (that's fine)."
}

# ── 3. Create directory structure ─────────────────────────────────────────────
Write-Step "Creating install directory: $INSTALL_DIR"
$dirs = @(
    $INSTALL_DIR,
    "$INSTALL_DIR\artifacts\api-server\dist",
    "$INSTALL_DIR\artifacts\island-tacos\dist\public",
    "$INSTALL_DIR\local-install"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
Write-OK "Directories ready."

# ── 4. Download pre-filled .env ───────────────────────────────────────────────
Write-Step "Downloading configuration (.env)..."
$envUrl = "$CLOUD/api/download/env?pin=$([uri]::EscapeDataString($AdminPin))"
$envContent = (Invoke-WebRequest $envUrl -UseBasicParsing).Content

# Patch in the actual DB password
$envContent = $envContent -replace "YOUR_DB_PASSWORD", $DbPassword

$envPath = "$INSTALL_DIR\.env"
[System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
Write-OK ".env written to $envPath"

# ── 5. Download ecosystem.config.cjs ─────────────────────────────────────────
Write-Step "Downloading PM2 config..."
Invoke-WebRequest "$CLOUD/api/download/ecosystem.config.cjs" -OutFile "$INSTALL_DIR\local-install\ecosystem.config.cjs" -UseBasicParsing
Write-OK "ecosystem.config.cjs downloaded."

# ── 6. Download server binary ─────────────────────────────────────────────────
Write-Step "Downloading server binary (index.mjs)..."
Invoke-WebRequest "$CLOUD/api/download/server" -OutFile "$INSTALL_DIR\artifacts\api-server\dist\index.mjs" -UseBasicParsing
Write-OK "Server binary downloaded."

# ── 7. Download and extract frontend ─────────────────────────────────────────
Write-Step "Downloading frontend bundle (this may take a moment)..."
$frontendJson  = (Invoke-WebRequest "$CLOUD/api/download/frontend" -UseBasicParsing).Content | ConvertFrom-Json
$frontendUrl   = $frontendJson.url
if (-not $frontendUrl) { Write-Fail "Could not get frontend download URL. Try again in a minute." }

$frontendTar = "$env:TEMP\island-tacos-frontend.tar.gz"
Invoke-WebRequest $frontendUrl -OutFile $frontendTar -UseBasicParsing
Write-OK "Frontend archive downloaded."

Write-Step "Extracting frontend..."
$frontendDest = "$INSTALL_DIR\artifacts\island-tacos\dist\public"

# Clear old frontend files
Get-ChildItem $frontendDest -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# Try tar (built into Windows 10+)
try {
    tar -xzf $frontendTar -C $frontendDest
    Write-OK "Frontend extracted."
} catch {
    Write-Fail "Failed to extract frontend. Make sure tar is available (Windows 10+)."
}
Remove-Item $frontendTar -Force -ErrorAction SilentlyContinue

# ── 8. Verify Node.js and PM2 ─────────────────────────────────────────────────
Write-Step "Checking Node.js and PM2..."
try {
    $nodeVer = node --version
    Write-OK "Node.js $nodeVer found."
} catch {
    Write-Fail "Node.js not found. Install from https://nodejs.org (LTS) and re-run this script."
}
try {
    $pm2Ver = pm2 --version
    Write-OK "PM2 $pm2Ver found."
} catch {
    Write-Step "Installing PM2 globally..."
    npm install -g pm2
    Write-OK "PM2 installed."
}

# ── 9. Start server with PM2 ──────────────────────────────────────────────────
Write-Step "Starting Island Tacos server with PM2..."
Set-Location $INSTALL_DIR
pm2 start local-install\ecosystem.config.cjs
pm2 save
Write-OK "PM2 process started and saved."

# ── 10. Verify server is responding ───────────────────────────────────────────
Write-Step "Waiting for server to come online..."
$tries = 0
$online = $false
while ($tries -lt 15) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest "http://localhost:3001/api/healthz" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $online = $true; break }
    } catch {}
    $tries++
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
if ($online) {
    Write-Host "   Install complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   POS:       http://192.168.132.100:3001/it-dav7dwn8/pos" -ForegroundColor White
    Write-Host "   Kitchen:   http://192.168.132.100:3001/it-dav7dwn8/kitchen" -ForegroundColor White
    Write-Host "   Admin:     http://192.168.132.100:3001/it-dav7dwn8/login" -ForegroundColor White
    Write-Host "   Online:    https://orders.islandtacosbvi.com" -ForegroundColor White
} else {
    Write-Host "   Files installed, but server did not respond." -ForegroundColor Red
    Write-Host "   Check logs with:  pm2 logs island-tacos --lines 30" -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
