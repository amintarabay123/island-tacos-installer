# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Local Server Setup (Windows)
# Open PowerShell as Administrator, navigate to the project root, then run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\local-install\setup-windows.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function Info  { Write-Host "  [OK]  $args" -ForegroundColor Green }
function Warn  { Write-Host "  [!!]  $args" -ForegroundColor Yellow }
function Step  { Write-Host "`n  >>>  $args" -ForegroundColor Cyan }
function Fatal { Write-Host "  [ERR] $args" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor White
Write-Host "  ║   🌮  Island Tacos — Local Server Setup  ║" -ForegroundColor White
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

# ── Must run from project root ────────────────────────────────────────────────
if (-not (Test-Path "pnpm-workspace.yaml")) {
    Fatal "Run this script from the project root directory."
}

# ── Step 1: .env ─────────────────────────────────────────────────────────────
Step "Checking .env configuration..."
if (-not (Test-Path ".env")) {
    Copy-Item "local-install\.env.template" ".env"
    Warn ".env file created from template."
    Write-Host ""
    Write-Host "  Open .env in Notepad and fill in every value:" -ForegroundColor Yellow
    Write-Host "    notepad .env" -ForegroundColor White
    Write-Host ""
    Write-Host "  Then run this script again." -ForegroundColor Yellow
    exit 0
}

$envContent = Get-Content ".env" -Raw
if ($envContent -match "CHANGE_ME|SAME_AS_REPLIT|SAME_AS_CLERK") {
    Warn ".env still contains placeholder values. Edit .env and replace all CHANGE_ME / SAME_AS_* values, then re-run."
    exit 1
}
Info ".env looks good"

# Load .env into current process environment
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

# ── Step 2: Node.js ───────────────────────────────────────────────────────────
Step "Checking Node.js..."
try {
    $nodeVer = node --version 2>$null
    $major = [int]($nodeVer -replace "v(\d+)\..*", '$1')
    if ($major -ge 20) {
        Info "Node.js $nodeVer already installed"
    } else {
        Warn "Node.js $nodeVer is too old. Please install Node.js 20 LTS from https://nodejs.org and re-run."
        exit 1
    }
} catch {
    Warn "Node.js not found. Please install Node.js 20 LTS from https://nodejs.org and re-run."
    exit 1
}

# ── Step 3: pnpm ─────────────────────────────────────────────────────────────
Step "Checking pnpm..."
try {
    $pnpmVer = pnpm --version 2>$null
    Info "pnpm $pnpmVer already installed"
} catch {
    Info "Installing pnpm..."
    npm install -g pnpm
}

# ── Step 4: PM2 ──────────────────────────────────────────────────────────────
Step "Checking PM2..."
try {
    $pm2Ver = pm2 --version 2>$null
    Info "PM2 $pm2Ver already installed"
} catch {
    Info "Installing PM2..."
    npm install -g pm2
}

# ── Step 5: Install project dependencies ─────────────────────────────────────
Step "Installing project dependencies..."
pnpm install --frozen-lockfile
Info "Dependencies installed"

# ── Step 6: Build the API server ─────────────────────────────────────────────
Step "Building API server..."
pnpm --filter @workspace/api-server run build
Info "API server built"

# ── Step 7: Build the frontend ───────────────────────────────────────────────
Step "Building frontend..."
$env:PORT           = if ($env:PORT) { $env:PORT } else { "3001" }
$env:BASE_PATH      = "/"
pnpm --filter @workspace/island-tacos run build
Info "Frontend built"

# ── Step 8: Push database schema ─────────────────────────────────────────────
Step "Setting up database schema..."
pnpm --filter @workspace/db run push
Info "Database schema ready"

# ── Step 9: Start with PM2 ───────────────────────────────────────────────────
Step "Starting Island Tacos with PM2..."
pm2 delete island-tacos 2>$null
pm2 start local-install/ecosystem.config.cjs
pm2 save
Info "Server started"

# ── Step 10: Auto-start on Windows boot ──────────────────────────────────────
Step "Configuring auto-start on boot..."
pm2-startup install
pm2 save
Info "Auto-start configured"

# ── Done ──────────────────────────────────────────────────────────────────────
$port = if ($env:PORT) { $env:PORT } else { "3001" }
$ip = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169" } |
    Select-Object -First 1
).IPAddress

Write-Host ""
Write-Host "  ✅  Island Tacos is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Open on any device on this WiFi network:" -ForegroundColor White
Write-Host "    http://${ip}:${port}" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor White
Write-Host "    pm2 logs island-tacos      view live logs"
Write-Host "    pm2 restart island-tacos   restart after updates"
Write-Host "    pm2 stop island-tacos      stop the server"
Write-Host ""
