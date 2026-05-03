# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Windows Local Server Updater
# Launched automatically by UPDATE.bat
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Island Tacos Updater"

function Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor DarkYellow
    Write-Host "  ║                                              ║" -ForegroundColor DarkYellow
    Write-Host "  ║   🌮  ISLAND TACOS — Update Server          ║" -ForegroundColor Yellow
    Write-Host "  ║                                              ║" -ForegroundColor DarkYellow
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor DarkYellow
    Write-Host ""
}

function Step  { param($n,$msg) Write-Host "  [$n] $msg" -ForegroundColor Cyan }
function OK    { Write-Host "      ✔  $args" -ForegroundColor Green }
function Warn  { Write-Host "      ⚠  $args" -ForegroundColor Yellow }
function Fatal { Write-Host "`n  ✖  $args" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Load or ask for the source URL ───────────────────────────────────────────
$SourceFile = Join-Path $Root ".update-source"
if (Test-Path $SourceFile) {
    $DownloadUrl = (Get-Content $SourceFile).Trim()
    Write-Host ""
    Write-Host "  Pulling updates from: $DownloadUrl" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "  Where is your online store hosted?" -ForegroundColor Gray
    Write-Host "  Example: https://orders.islandtacosbvi.com" -ForegroundColor DarkGray
    $BaseUrl = (Read-Host "  Online store URL").Trim().TrimEnd("/")
    $DownloadUrl = "$BaseUrl/api/download/project"
    Set-Content -Path $SourceFile -Value $DownloadUrl
}

Header
Write-Host "  This will download the latest code, rebuild, and restart the server."
Write-Host "  Your settings (.env file) will NOT be changed." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to begin"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Backup .env
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 1 "Backing up your configuration..."
Write-Host ""

$EnvFile    = Join-Path $Root ".env"
$EnvBackup  = Join-Path $env:TEMP "islandtacos-env-backup.env"

if (Test-Path $EnvFile) {
    Copy-Item $EnvFile $EnvBackup -Force
    OK ".env backed up"
} else {
    Warn "No .env file found — continuing anyway"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Download latest package
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 2 "Downloading latest version..."
Write-Host ""

$TmpZip = Join-Path $env:TEMP "island-tacos-update.tar.gz"
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpZip -UseBasicParsing
    OK "Downloaded successfully"
} catch {
    Fatal "Download failed. Make sure your online store is reachable: $DownloadUrl"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Extract
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 3 "Extracting new files..."
Write-Host ""

Set-Location $Root
tar -xzf $TmpZip -C $Root --overwrite 2>&1 | Out-Null
OK "Files updated"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Restore .env
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 4 "Restoring your configuration..."
Write-Host ""

if (Test-Path $EnvBackup) {
    Copy-Item $EnvBackup $EnvFile -Force
    OK ".env restored — your settings are unchanged"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 5 "Installing dependencies..."
Write-Host ""

Set-Location $Root
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fatal "pnpm install failed." }
OK "Dependencies ready"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Rebuild
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 6 "Rebuilding (this takes about a minute)..."
Write-Host ""

# Read values from .env
function Get-EnvValue { param($Key)
    if (Test-Path $EnvFile) {
        $line = Get-Content $EnvFile | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
        if ($line) { return $line.Substring($Key.Length + 1) }
    }
    return ""
}

$ClerkPub   = Get-EnvValue "VITE_CLERK_PUBLISHABLE_KEY"
$ClerkProxy = Get-EnvValue "VITE_CLERK_PROXY_URL"
$PortVal    = Get-EnvValue "PORT"
if (-not $PortVal) { $PortVal = "3001" }

Write-Host "      Building API server..." -ForegroundColor DarkGray
& pnpm --filter "@workspace/api-server" run build
if ($LASTEXITCODE -ne 0) { Fatal "API server build failed." }
OK "API server built"

Write-Host "      Building frontend..." -ForegroundColor DarkGray
$env:PORT                       = $PortVal
$env:BASE_PATH                  = "/"
$env:VITE_CLERK_PUBLISHABLE_KEY = $ClerkPub
$env:VITE_CLERK_PROXY_URL       = $ClerkProxy
$env:VITE_ADMIN_PATH            = "/it-admin"
& pnpm --filter "@workspace/island-tacos" run build
if ($LASTEXITCODE -ne 0) { Fatal "Frontend build failed." }
OK "Frontend built"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Apply any database changes
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 7 "Applying any database updates..."
Write-Host ""

$DbUrl = Get-EnvValue "DATABASE_URL"
if ($DbUrl) {
    $env:DATABASE_URL = $DbUrl
    & pnpm --filter "@workspace/db" run push
    if ($LASTEXITCODE -ne 0) { Warn "DB push had warnings — check manually if needed." }
    else { OK "Database up to date" }
} else {
    Warn "DATABASE_URL not found in .env — skipping DB update"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — Restart server
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 8 "Restarting the server..."
Write-Host ""

& pm2 restart island-tacos
if ($LASTEXITCODE -ne 0) {
    & pm2 start (Join-Path $Root "local-install\ecosystem.config.cjs")
}
& pm2 save
OK "Server restarted"

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
Header
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║                                              ║" -ForegroundColor Green
Write-Host "  ║   ✅  Island Tacos updated successfully!    ║" -ForegroundColor Green
Write-Host "  ║                                              ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor DarkGray
Write-Host "    pm2 logs island-tacos      — view live logs" -ForegroundColor DarkGray
Write-Host "    pm2 restart island-tacos   — restart the server" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close"
