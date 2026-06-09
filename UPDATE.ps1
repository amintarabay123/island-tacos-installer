# Island Tacos - Update Script
# Downloads the latest pre-built server and frontend from the cloud.
# No local rebuild needed.
#
# Usage: double-click UPDATE.bat (or run this directly as Administrator)

$ErrorActionPreference = "Stop"
$CLOUD = "https://orders.islandtacosbvi.com"
$Root  = "C:\IslandTacos"

function Write-Step { param($msg) Write-Host "" ; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "" ; Write-Host "[FAILED] $msg" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   Island Tacos - Update" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Stop PM2 processes first so index.mjs is not locked
Write-Step "Stopping server..."
try { pm2 delete island-tacos         2>$null | Out-Null } catch {}
try { pm2 delete island-tacos-monitor 2>$null | Out-Null } catch {}
Start-Sleep 1
Write-OK "Server stopped."

# Step 2: Download updated PM2 config (hard failure — old config causes silent env var loss)
Write-Step "Downloading PM2 config..."
Invoke-WebRequest "$CLOUD/api/download/ecosystem.config.cjs" `
    -OutFile "$Root\local-install\ecosystem.config.cjs" -UseBasicParsing -ErrorAction Stop
if (-not (Select-String -Path "$Root\local-install\ecosystem.config.cjs" -Pattern "SERVE_STATIC_PATH" -Quiet)) {
    Write-Fail "Downloaded ecosystem.config.cjs is missing SERVE_STATIC_PATH — aborting."
}
Write-OK "PM2 config updated (SERVE_STATIC_PATH verified)."

# Step 3: Download server binary (file lock released in step 1)
Write-Step "Downloading server binary..."
Invoke-WebRequest "$CLOUD/api/download/server" `
    -OutFile "$Root\artifacts\api-server\dist\index.mjs" -UseBasicParsing -ErrorAction Stop
$sz = (Get-Item "$Root\artifacts\api-server\dist\index.mjs").Length
Write-OK "Server binary updated ($([math]::Round($sz/1MB, 1)) MB)."

# Step 4: Download updated frontend bundle
Write-Step "Downloading frontend bundle (may take 30 seconds)..."
try {
    $json = (Invoke-WebRequest "$CLOUD/api/download/frontend" -UseBasicParsing -TimeoutSec 120).Content | ConvertFrom-Json
    $url  = $json.url
    if (-not $url) { throw "No download URL returned from server." }

    $tar  = "$env:TEMP\island-tacos-frontend.tar.gz"
    Invoke-WebRequest $url -OutFile $tar -UseBasicParsing -ErrorAction Stop
    $tarSize = (Get-Item $tar).Length
    if ($tarSize -lt 100000) { throw "Downloaded archive is too small ($tarSize bytes) - likely a failed download." }
    Write-OK "Frontend archive downloaded ($([math]::Round($tarSize/1MB, 1)) MB)."

    # Only clear AFTER successful download - prevents empty directory if download fails
    $dest = "$Root\artifacts\island-tacos\dist\public"
    if (Test-Path $dest) { Get-ChildItem $dest | Remove-Item -Recurse -Force }
    else { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    tar -xzf $tar -C $dest
    if ($LASTEXITCODE -ne 0) { throw "tar extraction failed (exit code $LASTEXITCODE)." }
    Remove-Item $tar -Force -ErrorAction SilentlyContinue
    Write-OK "Frontend extracted."
} catch {
    Write-Warn "Frontend update skipped: $_"
    Write-Warn "Server binary was still updated. Existing frontend will be used."
}

# Step 5: Ensure firewall rules exist for iPhone and Tailscale
Write-Step "Checking firewall rule for port 3001 (API server)..."
$rule = Get-NetFirewallRule -DisplayName "Island Tacos Port 3001" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "Island Tacos Port 3001" `
        -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any | Out-Null
    Write-OK "Firewall rule created."
} else {
    Write-OK "Firewall rule already exists."
}

Write-Step "Checking firewall rule for port 3002 (log viewer)..."
$rule3002 = Get-NetFirewallRule -DisplayName "Island Tacos Port 3002" -ErrorAction SilentlyContinue
if (-not $rule3002) {
    New-NetFirewallRule -DisplayName "Island Tacos Port 3002" `
        -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow -Profile Any | Out-Null
    Write-OK "Firewall rule created."
} else {
    Write-OK "Firewall rule already exists."
}

# Step 6: Apply database schema migrations
# schema.sql uses IF NOT EXISTS throughout — completely safe to run on any DB.
# Uses node + the api-server's bundled `pg` package (no psql required).
Write-Step "Applying database schema updates..."
try {
    $envFile = "$Root\.env"
    $dbUrl   = ""
    if (Test-Path $envFile) {
        $dbUrl = (Get-Content $envFile | Select-String '^DATABASE_URL=(.+)').Matches.Groups[1].Value.Trim()
    }
    if (-not $dbUrl) { throw "DATABASE_URL not found in $envFile" }

    $schemaTmp  = "$env:TEMP\it-schema.sql"
    $migrateDst = "$Root\artifacts\api-server\migrate.mjs"

    Invoke-WebRequest "$CLOUD/api/download/schema.sql"  -OutFile $schemaTmp  -UseBasicParsing -ErrorAction Stop
    Invoke-WebRequest "$CLOUD/api/download/migrate.mjs" -OutFile $migrateDst -UseBasicParsing -ErrorAction Stop

    $env:DATABASE_URL = $dbUrl
    Push-Location "$Root\artifacts\api-server"
    try {
        $result = & node migrate.mjs $schemaTmp 2>&1
        $code   = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    Remove-Item $schemaTmp -Force -ErrorAction SilentlyContinue

    if ($code -ne 0) { throw "node migrate.mjs exited $code`n$result" }
    Write-OK "Database schema is up to date."
} catch {
    Write-Warn "Schema update skipped: $_ (non-fatal — server may still work)"
}

# Step 6b: Download updated server.mjs (local proxy server)
Write-Step "Downloading server.mjs..."
try {
    Invoke-WebRequest "$CLOUD/api/download/server.mjs" `
        -OutFile "$Root\artifacts\island-tacos\server.mjs" -UseBasicParsing -ErrorAction Stop
    Write-OK "server.mjs updated."
} catch {
    Write-Warn "server.mjs update skipped: $_ (non-fatal — existing file will be used)"
}

# Step 6c: Download monitor agent (watchdog daemon that auto-repairs services)
Write-Step "Downloading monitor agent..."
try {
    Invoke-WebRequest "$CLOUD/api/download/monitor.mjs" `
        -OutFile "$Root\local-install\monitor.mjs" -UseBasicParsing -ErrorAction Stop
    Write-OK "monitor.mjs updated."
} catch {
    Write-Warn "monitor.mjs update skipped: $_ (non-fatal — existing file will be used if present)"
}

# Step 7: Self-update — write fresh copies of UPDATE.bat and UPDATE.ps1 to disk.
# Safe because this script runs from %TEMP%, not from C:\IslandTacos.
# After this step, future runs of UPDATE.bat always get current scripts.
Write-Step "Refreshing update scripts on disk..."
try {
    Invoke-WebRequest "$CLOUD/api/download/UPDATE.bat" -OutFile "$Root\UPDATE.bat" -UseBasicParsing -ErrorAction Stop
    Invoke-WebRequest "$CLOUD/api/download/UPDATE.ps1" -OutFile "$Root\UPDATE.ps1" -UseBasicParsing -ErrorAction Stop
    Write-OK "UPDATE.bat and UPDATE.ps1 refreshed."
} catch {
    Write-Warn "Could not refresh update scripts: $_ (non-fatal)"
}

# Step 7: Start server
Write-Step "Starting server..."
Set-Location $Root
pm2 start "local-install\ecosystem.config.cjs"
pm2 save
Write-OK "Server started and saved."

# Step 8: Health check
Write-Step "Waiting for server to respond..."
$online = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep 2
    try {
        $r = Invoke-WebRequest "http://localhost:3001/api/healthz" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $online = $true; break }
    } catch {}
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
if ($online) {
    Write-Host "   Update complete! Server is running." -ForegroundColor Green
    Write-Host ""
    Write-Host "   POS:     http://localhost:3001/admin/pos" -ForegroundColor White
    Write-Host "   Kitchen: http://localhost:3001/admin/kitchen" -ForegroundColor White
    Write-Host "   Admin:   http://localhost:3001/admin" -ForegroundColor White
} else {
    Write-Host "   Files updated but health check failed." -ForegroundColor Red
    Write-Host "   Run: pm2 logs island-tacos --lines 30" -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
