# Island Tacos — Update Script
# Downloads the latest pre-built server and frontend from the cloud.
# No local rebuild needed.
#
# Usage: double-click UPDATE.bat (or run this directly as Administrator)

$ErrorActionPreference = "Stop"
$CLOUD = "https://orders.islandtacosbvi.com"
$Root  = "C:\IslandTacos"

function Write-Step { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n[FAILED] $msg" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   Island Tacos — Update" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# ── Step 1: Stop PM2 first — releases the file lock on index.mjs ─────────────
Write-Step "Stopping server (releases file lock)..."
try { pm2 delete island-tacos 2>$null | Out-Null } catch {}
Start-Sleep 1
Write-OK "Server stopped."

# ── Step 2: Download updated PM2 config ──────────────────────────────────────
Write-Step "Downloading PM2 config..."
try {
    Invoke-WebRequest "$CLOUD/api/download/ecosystem.config.cjs" `
        -OutFile "$Root\local-install\ecosystem.config.cjs" -UseBasicParsing -ErrorAction Stop
    Write-OK "PM2 config updated."
} catch { Write-Warn "PM2 config download failed: $_ (using existing)" }

# ── Step 3: Download server binary (lock released in step 1) ─────────────────
Write-Step "Downloading server binary..."
Invoke-WebRequest "$CLOUD/api/download/server" `
    -OutFile "$Root\artifacts\api-server\dist\index.mjs" -UseBasicParsing -ErrorAction Stop
$sz = (Get-Item "$Root\artifacts\api-server\dist\index.mjs").Length
Write-OK "Server binary updated ($([math]::Round($sz/1MB, 1)) MB)."

# ── Step 4: Download updated frontend bundle ──────────────────────────────────
Write-Step "Downloading frontend bundle (may take ~30s)..."
try {
    $json = (Invoke-WebRequest "$CLOUD/api/download/frontend" -UseBasicParsing -TimeoutSec 120).Content | ConvertFrom-Json
    $url  = $json.url
    if (-not $url) { throw "No GCS URL returned from server" }

    $tar  = "$env:TEMP\island-tacos-frontend.tar.gz"
    Invoke-WebRequest $url -OutFile $tar -UseBasicParsing
    Write-OK "Frontend archive downloaded."

    $dest = "$Root\artifacts\island-tacos\dist\public"
    if (Test-Path $dest) { Get-ChildItem $dest | Remove-Item -Recurse -Force }
    else { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    tar -xzf $tar -C $dest
    Remove-Item $tar -Force -ErrorAction SilentlyContinue
    Write-OK "Frontend extracted."
} catch {
    Write-Warn "Frontend update skipped: $_"
    Write-Warn "Server binary was still updated. The existing frontend will be used."
}

# ── Step 5: Ensure firewall rule exists for iPhone/Tailscale access ───────────
Write-Step "Checking firewall rule for port 3001..."
$rule = Get-NetFirewallRule -DisplayName "Island Tacos Port 3001" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "Island Tacos Port 3001" `
        -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any | Out-Null
    Write-OK "Firewall rule created."
} else {
    Write-OK "Firewall rule already exists."
}

# ── Step 6: Start server ──────────────────────────────────────────────────────
Write-Step "Starting server..."
Set-Location $Root
pm2 start "local-install\ecosystem.config.cjs"
pm2 save
Write-OK "Server started and saved."

# ── Step 7: Health check ──────────────────────────────────────────────────────
Write-Step "Waiting for server to respond..."
$online = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep 2
    try {
        $r = Invoke-WebRequest "http://localhost:3001/api/healthz" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $online = $true; break }
    } catch {}
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
if ($online) {
    Write-Host "   Update complete! Server is running." -ForegroundColor Green
    Write-Host ""
    Write-Host "   POS:     http://localhost:3001/it-dav7dwn8/admin/pos" -ForegroundColor White
    Write-Host "   Kitchen: http://localhost:3001/it-dav7dwn8/kitchen" -ForegroundColor White
    Write-Host "   Admin:   http://localhost:3001/it-dav7dwn8/admin" -ForegroundColor White
} else {
    Write-Host "   Files updated but server health check failed." -ForegroundColor Red
    Write-Host "   Run: pm2 logs island-tacos --lines 30" -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
