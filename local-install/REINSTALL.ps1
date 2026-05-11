#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Island Tacos — Complete clean reinstall on Windows local server.
    Downloads everything fresh from the cloud. Only asks for 2 things:
      1. Your Admin PIN
      2. Your PostgreSQL password (data1234 unless you changed it)

.USAGE
    Option A — Run directly from the cloud (no download needed):
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        irm https://orders.islandtacosbvi.com/api/download/REINSTALL.ps1 | iex

    Option B — Download first, then run:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        Invoke-WebRequest https://orders.islandtacosbvi.com/api/download/REINSTALL.ps1 -OutFile REINSTALL.ps1
        .\REINSTALL.ps1
#>

$ErrorActionPreference = "Stop"
$CLOUD       = "https://orders.islandtacosbvi.com"
$INSTALL_DIR = "C:\IslandTacos"

function Write-Step  { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "`n[FAILED] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "   Island Tacos — Fresh Install / Reinstall" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host " This script will:" -ForegroundColor White
Write-Host "   1. Stop any running instance" -ForegroundColor Gray
Write-Host "   2. Set up the PostgreSQL database" -ForegroundColor Gray
Write-Host "   3. Apply/update the database schema" -ForegroundColor Gray
Write-Host "   4. Download all app files from the cloud" -ForegroundColor Gray
Write-Host "   5. Start the server with PM2" -ForegroundColor Gray
Write-Host ""

# ── Collect credentials ───────────────────────────────────────────────────────

$AdminPin = Read-Host "Enter your Admin PIN"
if (-not $AdminPin) { Write-Fail "Admin PIN is required." }

# Verify PIN against cloud server before doing anything.
# PIN is sent in the JSON POST body (NOT in the URL) so it never appears
# in proxy logs, browser history, or referer headers.
Write-Step "Verifying Admin PIN with cloud server..."
$envUrl  = "$CLOUD/api/download/env"
$envBody = @{ pin = $AdminPin } | ConvertTo-Json -Compress
try {
    $null = Invoke-WebRequest $envUrl `
        -Method Post `
        -Body $envBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    Write-OK "Admin PIN accepted."
} catch {
    Write-Fail "Admin PIN rejected. Check your PIN and try again."
}

$DbPassword = Read-Host "Enter your PostgreSQL password for 'ituser' (press Enter for: data1234)"
if (-not $DbPassword) { $DbPassword = "data1234" }

$PgSuperPass = Read-Host "Enter your PostgreSQL superuser (postgres) password (press Enter for: postgres)"
if (-not $PgSuperPass) { $PgSuperPass = "postgres" }

# ── Stop running PM2 process ──────────────────────────────────────────────────

Write-Step "Stopping existing PM2 process (if any)..."
try {
    pm2 stop island-tacos 2>$null | Out-Null
    pm2 delete island-tacos 2>$null | Out-Null
    Write-OK "PM2 process stopped."
} catch {
    Write-OK "No running PM2 process found (that's fine)."
}

# ── Create directory structure ────────────────────────────────────────────────

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

# ── PostgreSQL: create user and database ──────────────────────────────────────

Write-Step "Setting up PostgreSQL database..."

# Find psql executable
$pgCmd = $null
$pgCmdObj = Get-Command psql -ErrorAction SilentlyContinue
if ($pgCmdObj) {
    $pgCmd = $pgCmdObj.Source
} else {
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($p in $pgPaths) { if (Test-Path $p) { $pgCmd = $p; break } }
}

if ($pgCmd) {
    # Temporarily allow stderr from psql (NOTICE messages) without aborting the script
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    $env:PGPASSWORD = $PgSuperPass

    # Create ituser (or update password if already exists)
    $createUser = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ituser') THEN CREATE USER ituser WITH PASSWORD '$DbPassword'; ELSE ALTER USER ituser WITH PASSWORD '$DbPassword'; END IF; END `$`$;"
    & $pgCmd -U postgres -h localhost -q -c $createUser 2>$null

    # Create database only if it doesn't exist
    $dbExists = & $pgCmd -U postgres -h localhost -tAq -c "SELECT COUNT(*) FROM pg_database WHERE datname = 'islandtacos';" 2>$null
    if (($dbExists -replace '\s','') -eq "0") {
        & $pgCmd -U postgres -h localhost -q -c "CREATE DATABASE islandtacos OWNER ituser;" 2>$null
        Write-OK "Database 'islandtacos' created."
    } else {
        Write-OK "Database 'islandtacos' already exists."
    }
    & $pgCmd -U postgres -h localhost -q -c "GRANT ALL PRIVILEGES ON DATABASE islandtacos TO ituser;" 2>$null

    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    Write-OK "PostgreSQL user and database ready."

} else {
    Write-Warn "psql not found. Skipping database creation."
    Write-Warn "If the database does not exist, the server will fail to start."
    Write-Warn "Create it manually: database='islandtacos', user='ituser', password='$DbPassword'"
}

# ── Download pre-filled .env ──────────────────────────────────────────────────

Write-Step "Downloading configuration (.env from cloud)..."
$envContent = (Invoke-WebRequest $envUrl `
    -Method Post `
    -Body $envBody `
    -ContentType "application/json" `
    -UseBasicParsing).Content

# Patch in the actual DB password
$envContent = $envContent -replace "YOUR_DB_PASSWORD", $DbPassword

$envPath = "$INSTALL_DIR\.env"
[System.IO.File]::WriteAllText($envPath, $envContent, (New-Object System.Text.UTF8Encoding $false))
Write-OK ".env written (all secrets pre-filled)."

# Read LOCAL_SERVER_IP from the .env for use in the success message later
$localIp = "192.168.132.100"
foreach ($line in $envContent -split "`n") {
    $line = $line.Trim()
    if ($line -match "^LOCAL_SERVER_IP=(.+)$") {
        $localIp = $Matches[1].Trim()
        break
    }
}

# ── Apply database schema ─────────────────────────────────────────────────────

Write-Step "Applying database schema..."
if ($pgCmd) {
    $schemaTmp = "$env:TEMP\island-tacos-schema.sql"
    Invoke-WebRequest "$CLOUD/api/download/schema.sql" -OutFile $schemaTmp -UseBasicParsing
    $env:PGPASSWORD = $DbPassword
    # Run psql with $ErrorActionPreference = Continue so that PostgreSQL NOTICE messages
    # on stderr (e.g. "relation already exists, skipping") do NOT abort the script.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $pgCmd -U ituser -h localhost -d islandtacos -f $schemaTmp -q 2>$null
    $ErrorActionPreference = $prev
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item $schemaTmp -Force -ErrorAction SilentlyContinue
    Write-OK "Database schema applied (all tables created/updated)."

    # Grant table + sequence access to ituser (in case tables were created by postgres)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $env:PGPASSWORD = $PgSuperPass
    & $pgCmd -U postgres -h localhost -d islandtacos -q -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ituser; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ituser; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ituser; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ituser;" 2>$null
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev
    Write-OK "Table and sequence permissions granted to ituser."
} else {
    Write-Warn "Skipping schema migration (psql not found)."
}

# ── Download ecosystem.config.cjs ─────────────────────────────────────────────

Write-Step "Downloading PM2 config..."
Invoke-WebRequest "$CLOUD/api/download/ecosystem.config.cjs" -OutFile "$INSTALL_DIR\local-install\ecosystem.config.cjs" -UseBasicParsing
Write-OK "PM2 ecosystem config downloaded."

# ── Download server binary ────────────────────────────────────────────────────

Write-Step "Downloading server binary..."
Invoke-WebRequest "$CLOUD/api/download/server" -OutFile "$INSTALL_DIR\artifacts\api-server\dist\index.mjs" -UseBasicParsing
Write-OK "Server binary downloaded."

# ── Download and extract frontend ─────────────────────────────────────────────

Write-Step "Downloading frontend bundle (may take a moment)..."
$frontendJson = (Invoke-WebRequest "$CLOUD/api/download/frontend" -UseBasicParsing).Content | ConvertFrom-Json
$frontendUrl  = $frontendJson.url
if (-not $frontendUrl) { Write-Fail "Could not get frontend download URL. Wait a minute and try again." }

$frontendTar  = "$env:TEMP\island-tacos-frontend.tar.gz"
Invoke-WebRequest $frontendUrl -OutFile $frontendTar -UseBasicParsing
Write-OK "Frontend archive downloaded."

Write-Step "Extracting frontend..."
$frontendDest = "$INSTALL_DIR\artifacts\island-tacos\dist\public"
Get-ChildItem $frontendDest -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar -xzf $frontendTar -C $frontendDest
    Write-OK "Frontend extracted."
} else {
    Write-Fail "tar not found. Install Windows 10 build 17063+ or extract manually."
}
Remove-Item $frontendTar -Force -ErrorAction SilentlyContinue

# ── Add firewall rule for Tailscale / LAN access on port 3001 ────────────────

Write-Step "Checking firewall rule for port 3001..."
$rule = Get-NetFirewallRule -DisplayName "Island Tacos Port 3001" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "Island Tacos Port 3001" `
        -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any | Out-Null
    Write-OK "Firewall rule created (port 3001 open for iPhone/Tailscale access)."
} else {
    Write-OK "Firewall rule already exists."
}

# ── Verify Node.js and PM2 ────────────────────────────────────────────────────

Write-Step "Checking Node.js..."
try {
    $nodeVer = node --version 2>&1
    Write-OK "Node.js $nodeVer found."
} catch {
    Write-Fail "Node.js not found. Install from https://nodejs.org (LTS) and re-run this script."
}

Write-Step "Checking PM2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Step "Installing PM2 globally..."
    npm install -g pm2
    Write-OK "PM2 installed."
} else {
    $pm2Ver = pm2 --version 2>&1
    Write-OK "PM2 $pm2Ver found."
}

# ── Start server ──────────────────────────────────────────────────────────────

Write-Step "Starting Island Tacos server with PM2..."
Set-Location $INSTALL_DIR
pm2 start "local-install\ecosystem.config.cjs"
pm2 save
Write-OK "PM2 started and saved."

# ── Health check ──────────────────────────────────────────────────────────────

Write-Step "Waiting for server to come online..."
$online = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest "http://localhost:3001/api/healthz" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $online = $true; break }
    } catch {}
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
if ($online) {
    Write-Host "   Install complete and server is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   POS:      http://${localIp}:3001/it-dav7dwn8/pos" -ForegroundColor White
    Write-Host "   Kitchen:  http://${localIp}:3001/it-dav7dwn8/kitchen" -ForegroundColor White
    Write-Host "   Display:  http://${localIp}:3001/display" -ForegroundColor White
    Write-Host "   Online:   https://orders.islandtacosbvi.com" -ForegroundColor White
    Write-Host ""
    Write-Host "   Logs:     pm2 logs island-tacos" -ForegroundColor Gray
    Write-Host "   Status:   pm2 status" -ForegroundColor Gray
} else {
    Write-Host "   Files installed but server did not respond." -ForegroundColor Red
    Write-Host "   Check logs:  pm2 logs island-tacos --lines 30" -ForegroundColor Yellow
    Write-Host "   Common fix:  make sure PostgreSQL is running" -ForegroundColor Yellow
}
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
