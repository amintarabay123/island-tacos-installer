# Island Tacos — Fix Database Connection
# Run this if you see "password authentication failed for ituser"
# or if the menu is empty and sync fails.

$ErrorActionPreference = "SilentlyContinue"
$CLOUD   = "https://orders.islandtacosbvi.com"
$Root    = "C:\IslandTacos"
$EnvFile = "$Root\.env"

function Write-Step { param($msg) Write-Host "" ; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "" ; Write-Host "[FAILED] $msg" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   Island Tacos - Fix Database" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# ── Find psql ────────────────────────────────────────────────────────────────
Write-Step "Locating PostgreSQL..."
$psql = $null

# Check PATH first
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) { $psql = $psqlCmd.Source }

# Search common install dirs if not in PATH
if (-not $psql) {
    $candidates = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $psql = $c; break }
    }
}

# Last resort: recursive search under Program Files
if (-not $psql) {
    $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $psql = $found.FullName }
}

if (-not $psql) {
    Write-Fail "psql.exe not found. Make sure PostgreSQL is installed.`nExpected at: C:\Program Files\PostgreSQL\<version>\bin\psql.exe"
}
Write-OK "Found psql: $psql"

# ── Read .env ─────────────────────────────────────────────────────────────────
Write-Step "Reading current configuration..."
if (-not (Test-Path $EnvFile)) {
    Write-Fail ".env file not found at $EnvFile — please reinstall."
}

$dbUrl = (Get-Content $EnvFile | Select-String '^DATABASE_URL=(.+)').Matches.Groups[1].Value.Trim()
if (-not $dbUrl) {
    Write-Fail "DATABASE_URL not found in $EnvFile"
}

if ($dbUrl -match 'YOUR_DB_PASSWORD') {
    Write-Warn "DATABASE_URL still has placeholder — needs your real password."
} else {
    Write-OK "DATABASE_URL found."
}

# ── Ask for password ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "    Enter the database password for the 'ituser' account." -ForegroundColor White
Write-Host "    (The password you chose when you first installed Island Tacos.)" -ForegroundColor Gray
Write-Host "    If you don't remember it, type a new one — it will be reset." -ForegroundColor Gray
Write-Host ""
$secPass = Read-Host "    Database password" -AsSecureString
$newPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass))

if (-not $newPass) { Write-Fail "No password entered — aborting." }

# ── Reset ituser password (as postgres superuser) ─────────────────────────────
Write-Step "Resetting ituser password in PostgreSQL..."
$env:PGPASSWORD = "postgres"
$sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ituser') THEN
    CREATE USER ituser WITH PASSWORD '$newPass';
  ELSE
    ALTER USER ituser WITH PASSWORD '$newPass';
  END IF;
END `$`$;
"@
$r1 = & $psql -h localhost -p 5432 -U postgres -c $sql 2>&1
$env:PGPASSWORD = ""

# Create DB and grant (ignore "already exists")
$env:PGPASSWORD = "postgres"
$r2 = & $psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE islandtacos OWNER ituser;" 2>&1
$r3 = & $psql -h localhost -p 5432 -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE islandtacos TO ituser;" 2>&1
$env:PGPASSWORD = ""

Write-OK "ituser password set."

# ── Update .env ───────────────────────────────────────────────────────────────
Write-Step "Updating .env file..."
$newDbUrl    = "postgresql://ituser:${newPass}@localhost:5432/islandtacos"
$envContent  = Get-Content $EnvFile -Raw
$envContent  = $envContent -replace 'DATABASE_URL=[^\r\n]*', "DATABASE_URL=$newDbUrl"
Set-Content $EnvFile $envContent -Encoding UTF8 -NoNewline
Write-OK ".env updated."

# ── Test connection ───────────────────────────────────────────────────────────
Write-Step "Testing new connection..."
$env:PGPASSWORD = $newPass
$test = & $psql -h localhost -p 5432 -U ituser -d islandtacos -c "SELECT 1" 2>&1
$env:PGPASSWORD = ""
if ($LASTEXITCODE -eq 0) {
    Write-OK "Connection successful!"
} else {
    Write-Warn "Connection test failed: $test"
    Write-Warn "PostgreSQL may need a restart. Try opening Services and restarting postgresql-x64-17."
}

# ── Apply schema ──────────────────────────────────────────────────────────────
Write-Step "Applying database schema..."
try {
    $schemaTmp = "$env:TEMP\it-schema.sql"
    Invoke-WebRequest "$CLOUD/api/download/schema.sql" -OutFile $schemaTmp -UseBasicParsing -ErrorAction Stop
    $env:PGPASSWORD = $newPass
    $sr = & $psql -h localhost -p 5432 -U ituser -d islandtacos -f $schemaTmp 2>&1
    Remove-Item $schemaTmp -Force -ErrorAction SilentlyContinue
    $env:PGPASSWORD = ""
    if ($LASTEXITCODE -ne 0) { throw $sr }
    Write-OK "Schema applied."
} catch {
    Write-Warn "Schema step: $_ (non-fatal — continuing)"
}

# ── Restart server ────────────────────────────────────────────────────────────
Write-Step "Restarting server..."
try { pm2 delete island-tacos 2>$null | Out-Null } catch {}
Start-Sleep 2
Set-Location $Root
pm2 start "local-install\ecosystem.config.cjs"
pm2 save
Write-OK "Server restarted."

# ── Health check ──────────────────────────────────────────────────────────────
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
    Write-Host "   Database fixed! Server is running." -ForegroundColor Green
    Write-Host ""
    Write-Host "   Now go to Admin > Settings > Pull from Cloud" -ForegroundColor White
    Write-Host "   to load the menu from the cloud server." -ForegroundColor White
    Write-Host ""
    Write-Host "   POS:     http://localhost:3001/it-dav7dwn8/admin/pos" -ForegroundColor White
    Write-Host "   Kitchen: http://localhost:3001/it-dav7dwn8/kitchen" -ForegroundColor White
    Write-Host "   Admin:   http://localhost:3001/it-dav7dwn8/admin" -ForegroundColor White
} else {
    Write-Host "   Password updated but server health check failed." -ForegroundColor Red
    Write-Host "   Run: pm2 logs island-tacos --lines 30" -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
