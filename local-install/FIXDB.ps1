# Island Tacos — Fix Database Connection
# Run this if you see "password authentication failed for ituser"
# or if the menu is empty and sync fails.
#
# What it does:
#   1. Reads your current DATABASE_URL from C:\IslandTacos\.env
#   2. Asks for the correct database password (or resets to a new one)
#   3. Updates ituser's password in PostgreSQL
#   4. Updates the .env file with the correct password
#   5. Re-applies the database schema
#   6. Restarts the server

$ErrorActionPreference = "Stop"
$CLOUD = "https://orders.islandtacosbvi.com"
$Root  = "C:\IslandTacos"
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

# Step 1: Read current DATABASE_URL
Write-Step "Reading current configuration..."
if (-not (Test-Path $EnvFile)) {
    Write-Fail ".env file not found at $EnvFile — please reinstall."
}

$dbUrl = (Get-Content $EnvFile | Select-String '^DATABASE_URL=(.+)').Matches.Groups[1].Value.Trim()
if (-not $dbUrl) {
    Write-Fail "DATABASE_URL not found in $EnvFile"
}

$currentPassIsBroken = $dbUrl -match 'YOUR_DB_PASSWORD'
if ($currentPassIsBroken) {
    Write-Warn "DATABASE_URL still has placeholder 'YOUR_DB_PASSWORD' — needs your real password."
} else {
    Write-Warn "Testing current connection..."
    $uri     = [Uri]$dbUrl
    $dbUser  = $uri.UserInfo.Split(':')[0]
    $dbPass  = $uri.UserInfo.Split(':')[1]
    $dbHost  = $uri.Host
    $dbPort  = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $dbName  = $uri.AbsolutePath.TrimStart('/')

    $env:PGPASSWORD = $dbPass
    $testResult = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT 1" 2>&1
    $env:PGPASSWORD = ""
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Connection works! Running schema fix anyway..."
    }
}

# Step 2: Ask for the password to use
Write-Host ""
Write-Host "    Enter the database password for the 'ituser' account." -ForegroundColor White
Write-Host "    (This is the password you chose when you first installed Island Tacos.)" -ForegroundColor Gray
Write-Host "    If you don't remember it, just type a new password — this script will reset it." -ForegroundColor Gray
Write-Host ""
$newPass = Read-Host "    Database password" -AsSecureString
$newPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPass))

if (-not $newPass) {
    Write-Fail "No password entered — aborting."
}

# Step 3: Reset ituser's password using postgres superuser
Write-Step "Resetting ituser password in PostgreSQL..."
$env:PGPASSWORD = "postgres"
$result = & psql -h localhost -p 5432 -U postgres -c "
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ituser') THEN
    CREATE USER ituser WITH PASSWORD '$newPass';
  ELSE
    ALTER USER ituser WITH PASSWORD '$newPass';
  END IF;
END \$\$;
CREATE DATABASE islandtacos OWNER ituser;
GRANT ALL PRIVILEGES ON DATABASE islandtacos TO ituser;
" 2>&1
$env:PGPASSWORD = ""

# "already exists" for the database is fine
if ($LASTEXITCODE -ne 0 -and ($result -notmatch 'already exists')) {
    Write-Warn "Password reset command returned error (may still have worked): $result"
    Write-Warn "If PostgreSQL superuser password is not 'postgres', you may need to do this manually."
} else {
    Write-OK "ituser password updated in PostgreSQL."
}

# Step 4: Update .env with correct password
Write-Step "Updating .env file..."
$newDbUrl = "postgresql://ituser:${newPass}@localhost:5432/islandtacos"
$envContent = Get-Content $EnvFile -Raw
$envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=$newDbUrl"
Set-Content $EnvFile $envContent -Encoding UTF8 -NoNewline
Write-OK ".env updated with new DATABASE_URL."

# Step 5: Test the new connection
Write-Step "Testing new connection..."
$env:PGPASSWORD = $newPass
$testResult = & psql -h localhost -p 5432 -U ituser -d islandtacos -c "SELECT 1" 2>&1
$env:PGPASSWORD = ""
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Connection test failed: $testResult"
    Write-Warn "The password may still be wrong, or PostgreSQL may need a restart."
    Write-Warn "Try: net stop postgresql-x64-17 && net start postgresql-x64-17"
} else {
    Write-OK "Connection successful!"
}

# Step 6: Re-apply schema
Write-Step "Applying database schema..."
try {
    $schemaTmp = "$env:TEMP\it-schema.sql"
    Invoke-WebRequest "$CLOUD/api/download/schema.sql" -OutFile $schemaTmp -UseBasicParsing -ErrorAction Stop
    $env:PGPASSWORD = $newPass
    $result = & psql -h localhost -p 5432 -U ituser -d islandtacos -f $schemaTmp 2>&1
    Remove-Item $schemaTmp -Force -ErrorAction SilentlyContinue
    $env:PGPASSWORD = ""
    if ($LASTEXITCODE -ne 0) { throw "psql exited $LASTEXITCODE`n$result" }
    Write-OK "Schema applied."
} catch {
    Write-Warn "Schema step failed: $_ (non-fatal)"
}

# Step 7: Restart server
Write-Step "Restarting server..."
try {
    Set-Location $Root
    pm2 delete island-tacos 2>$null | Out-Null
} catch {}
Start-Sleep 1
pm2 start "local-install\ecosystem.config.cjs"
pm2 save
Write-OK "Server restarted."

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
