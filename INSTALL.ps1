# ─────────────────────────────────────────────────────────────────────────────
# Island Tacos — Windows Local Server Installer
# Launched automatically by INSTALL.bat
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Island Tacos Installer"

# Ensure working directory is the folder containing this script
Set-Location $PSScriptRoot

function Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor DarkYellow
    Write-Host "  ║                                              ║" -ForegroundColor DarkYellow
    Write-Host "  ║   🌮  ISLAND TACOS — Local Server Setup     ║" -ForegroundColor Yellow
    Write-Host "  ║                                              ║" -ForegroundColor DarkYellow
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor DarkYellow
    Write-Host ""
}

function Step  { param($n, $msg) Write-Host "  [$n] $msg" -ForegroundColor Cyan }
function OK    { Write-Host "      ✔  $args" -ForegroundColor Green }
function Warn  { Write-Host "      ⚠  $args" -ForegroundColor Yellow }
function Fatal { Write-Host "`n  ✖  $args" -ForegroundColor Red; Write-Host ""; Read-Host "Press Enter to close"; exit 1 }
function Ask   { param($prompt, $default = "") 
    if ($default) { Write-Host "      $prompt [$default]: " -NoNewline -ForegroundColor White }
    else          { Write-Host "      $prompt : " -NoNewline -ForegroundColor White }
    $val = Read-Host
    if (-not $val -and $default) { return $default }
    return $val
}
function AskSecret { param($prompt)
    Write-Host "      $prompt : " -NoNewline -ForegroundColor White
    $ss = Read-Host -AsSecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))
}

# ── Must run as Administrator ─────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Fatal "Please right-click INSTALL.bat and choose 'Run as administrator'."
}

# ── Must run from project root ────────────────────────────────────────────────
if (-not (Test-Path "pnpm-workspace.yaml")) {
    Fatal "Run the installer from inside the Island Tacos project folder."
}

$ROOT = (Get-Location).Path

Header
Write-Host "  This installer will:" -ForegroundColor White
Write-Host "    • Install Node.js, pnpm, PM2, and PostgreSQL (if not present)" -ForegroundColor Gray
Write-Host "    • Set up the database" -ForegroundColor Gray
Write-Host "    • Ask you a few questions about your setup" -ForegroundColor Gray
Write-Host "    • Build and start the Island Tacos server" -ForegroundColor Gray
Write-Host "    • Open the app in your browser" -ForegroundColor Gray
Write-Host ""
Write-Host "  Total time: about 5 minutes on first run." -ForegroundColor Gray
Write-Host ""
Read-Host "  Press Enter to begin"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Node.js
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 1 "Installing prerequisites..."
Write-Host ""

$needNode = $false
try {
    $nv = node --version 2>$null
    $major = [int]($nv -replace "v(\d+)\..*", '$1')
    if ($major -ge 20) { OK "Node.js $nv already installed" }
    else                { $needNode = $true }
} catch { $needNode = $true }

if ($needNode) {
    Warn "Node.js not found — installing via winget..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements -e
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    OK "Node.js installed"
}

# pnpm
try { $pv = pnpm --version 2>$null; OK "pnpm $pv already installed" }
catch {
    Warn "Installing pnpm..."
    npm install -g pnpm
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    OK "pnpm installed"
}

# PM2
try { $pm = pm2 --version 2>$null; OK "PM2 $pm already installed" }
catch {
    Warn "Installing PM2..."
    npm install -g pm2 pm2-windows-startup
    OK "PM2 installed"
}

# PostgreSQL
$pgRunning = $false
try {
    $svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") { $pgRunning = $true; OK "PostgreSQL already running" }
} catch {}

if (-not $pgRunning) {
    Warn "PostgreSQL not found — installing via winget..."
    $pgInstalled = $false
    foreach ($pgId in @("PostgreSQL.PostgreSQL.16", "PostgreSQL.PostgreSQL.15", "PostgreSQL.PostgreSQL.17")) {
        winget install $pgId --accept-package-agreements --accept-source-agreements -e 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $pgInstalled = $true; break }
    }
    if (-not $pgInstalled) {
        Fatal "PostgreSQL could not be installed automatically.`n`n  Please install it manually:`n  1. Go to https://www.postgresql.org/download/windows/`n  2. Download and run the installer`n  3. Use 'postgres' as the superuser password when asked`n  4. Then run this installer again."
    }
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Start-Sleep -Seconds 5
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgSvc) {
        Start-Service -Name $pgSvc.Name -ErrorAction SilentlyContinue
    }
    OK "PostgreSQL installed and started"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Configuration questions
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 2 "Setting up your configuration..."
Write-Host ""
Write-Host "  Answer the questions below. Press Enter to use the default shown in [brackets]." -ForegroundColor Gray
Write-Host ""

# Auto-detect local IP
$detectedIP = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169" } |
    Select-Object -First 1
).IPAddress

Write-Host "  ── Network ──────────────────────────────────────────────────" -ForegroundColor DarkGray
$localIP = Ask "This computer's local IP address" $detectedIP
$port    = Ask "Port number for the server" "3001"
Write-Host ""

Write-Host "  ── Database ─────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      Choose a password for the local database (you make this up):" -ForegroundColor Gray
$dbPass  = AskSecret "Database password"
Write-Host ""

Write-Host "  ── POS PIN Codes ────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      These must match what your staff already know." -ForegroundColor Gray
$adminPin = AskSecret "Admin PIN"
$staffPin = AskSecret "Staff PIN"
Write-Host ""

Write-Host "  ── ATH Movil ────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      Copy these from the Replit secrets panel." -ForegroundColor Gray
$athPublic  = Ask "ATH Movil Public Token"
$athPrivate = AskSecret "ATH Movil Private Token"
Write-Host ""

Write-Host "  ── Clerk Authentication ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      Copy these from your Clerk dashboard at clerk.com." -ForegroundColor Gray
Write-Host "      Publishable key starts with pk_live_ or pk_test_" -ForegroundColor Gray
Write-Host "      Secret key starts with sk_live_ or sk_test_" -ForegroundColor Gray
$clerkPub    = Ask "Clerk Publishable Key"
$clerkSecret = AskSecret "Clerk Secret Key"
Write-Host ""

Write-Host "  ── Receipt Printer (optional) ───────────────────────────────" -ForegroundColor DarkGray
Write-Host "      Leave blank if you're not sure — you can set this in the POS later." -ForegroundColor Gray
$printerIp = Ask "Printer IP address (e.g. 192.168.8.195)" ""
Write-Host ""

Write-Host "  ── Cloud Menu Sync ──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      This lets the admin panel push menu changes to orders.islandtacosbvi.com." -ForegroundColor Gray
Write-Host "      Make up any password — then add it as SYNC_SECRET in Replit secrets too." -ForegroundColor Gray
$syncSecret = AskSecret "Sync Secret (make up a password)"
Write-Host ""

Write-Host "  ── Email (optional) ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "      For order confirmation emails. Press Enter to skip." -ForegroundColor Gray
$smtpPass = AskSecret "SMTP Email Password (Enter to skip)"
Write-Host ""

# Auto-generate session secret
$sessionSecret = [Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Max 256) }))

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Database setup
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 3 "Setting up the database..."
Write-Host ""

$pgCmdObj = Get-Command psql -ErrorAction SilentlyContinue
$pgCmd = if ($pgCmdObj) { $pgCmdObj.Source } else { $null }
if (-not $pgCmd) {
    # Try common install paths
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($p in $pgPaths) { if (Test-Path $p) { $pgCmd = $p; break } }
}

if ($pgCmd) {
    $env:PGPASSWORD = "postgres"
    $sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ituser') THEN
    CREATE USER ituser WITH PASSWORD '$dbPass';
  ELSE
    ALTER USER ituser WITH PASSWORD '$dbPass';
  END IF;
END `$`$;
CREATE DATABASE islandtacos OWNER ituser;
GRANT ALL PRIVILEGES ON DATABASE islandtacos TO ituser;
"@
    $sql | & $pgCmd -U postgres -h localhost --quiet 2>$null
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    OK "Database 'islandtacos' ready"
} else {
    Warn "psql not found in PATH — you may need to create the database manually."
    Warn "Create a database called 'islandtacos' and a user 'ituser' with your chosen password."
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Write .env
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 4 "Writing configuration file..."
Write-Host ""

$clerkProxyUrl = "http://${localIP}:${port}/api/__clerk"
$publicUrl     = "http://${localIP}:${port}"
$staticPath    = "./artifacts/island-tacos/dist/public"
$dbUrl         = "postgresql://ituser:${dbPass}@localhost:5432/islandtacos"

$envContent = @"
# Island Tacos — Local Server Configuration
# Generated by installer on $(Get-Date -Format "yyyy-MM-dd HH:mm")

DATABASE_URL=$dbUrl
PORT=$port
NODE_ENV=production
PUBLIC_URL=$publicUrl
SERVE_STATIC_PATH=$staticPath

SESSION_SECRET=$sessionSecret

ADMIN_PIN=$adminPin
STAFF_PIN=$staffPin

ATHMOVIL_PUBLIC_TOKEN=$athPublic
ATHMOVIL_PRIVATE_TOKEN=$athPrivate

CLERK_SECRET_KEY=$clerkSecret
CLERK_PUBLISHABLE_KEY=$clerkPub

VITE_CLERK_PUBLISHABLE_KEY=$clerkPub
VITE_CLERK_PROXY_URL=$clerkProxyUrl
VITE_ADMIN_PATH=/it-admin

SYNC_TARGET_URL=https://orders.islandtacosbvi.com
SYNC_SECRET=$syncSecret
"@

if ($smtpPass) { $envContent += "`nSMTP_PASSWORD=$smtpPass" }
if ($printerIp) { $envContent += "`nDEFAULT_PRINTER_IP=$printerIp" }

Set-Content -Path ".env" -Value $envContent -Encoding UTF8
OK ".env written"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 5 "Installing project dependencies..."
Write-Host ""
pnpm install --ignore-scripts
OK "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Build
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 6 "Building the server and app (this takes a minute)..."
Write-Host ""

Write-Host "      Building API server..." -ForegroundColor Gray
pnpm --filter "@workspace/api-server" run build
OK "API server built"

Write-Host "      Building frontend..." -ForegroundColor Gray
$env:PORT                       = $port
$env:BASE_PATH                  = "/"
$env:VITE_CLERK_PUBLISHABLE_KEY = $clerkPub
$env:VITE_CLERK_PROXY_URL       = $clerkProxyUrl
$env:VITE_ADMIN_PATH            = "/it-admin"
pnpm --filter "@workspace/island-tacos" run build
OK "Frontend built"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Database schema
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 7 "Setting up database tables..."
Write-Host ""

$env:DATABASE_URL = $dbUrl
pnpm --filter "@workspace/db" run push
OK "Database tables ready"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — Start server
# ─────────────────────────────────────────────────────────────────────────────
Header
Step 8 "Starting the server..."
Write-Host ""

# Refresh PATH so pm2 is found after fresh install
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH", "User")

try { pm2 delete island-tacos 2>$null } catch {}
pm2 start local-install/ecosystem.config.cjs
pm2 save

# Configure auto-start on Windows boot
try {
    pm2-startup install 2>$null
    pm2 save
    OK "Auto-start on boot configured"
} catch {
    Warn "Auto-start setup skipped — you can run 'pm2 start local-install/ecosystem.config.cjs' manually after reboot."
}

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────
Header
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║                                              ║" -ForegroundColor Green
Write-Host "  ║   ✅  Island Tacos is running!              ║" -ForegroundColor Green
Write-Host "  ║                                              ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Your server address:" -ForegroundColor White
Write-Host "    $publicUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Open this address on any tablet or screen connected to this WiFi." -ForegroundColor Gray
Write-Host ""
Write-Host "  For receipt printing: go to POS → Printer Settings → Network mode" -ForegroundColor Gray
if ($printerIp) {
    Write-Host "  and enter your printer IP: $printerIp" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Useful commands (open any terminal):" -ForegroundColor DarkGray
Write-Host "    pm2 logs island-tacos      — view live logs" -ForegroundColor DarkGray
Write-Host "    pm2 restart island-tacos   — restart after updates" -ForegroundColor DarkGray
Write-Host "    pm2 stop island-tacos      — stop the server" -ForegroundColor DarkGray
Write-Host ""

Start-Process "$publicUrl"

Read-Host "  Press Enter to close this window"
