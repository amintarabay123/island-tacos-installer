@echo off
:: Island Tacos — Update
:: Always fetches the latest update script from the cloud, then runs it.
:: This means the update logic is always current — no stale local copy.
:: Run as Administrator.

setlocal
set CLOUD=https://orders.islandtacosbvi.com
set TMPSCRIPT=%TEMP%\island-tacos-update.ps1

echo.
echo Fetching latest update script from cloud...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Invoke-WebRequest '%CLOUD%/api/download/UPDATE.ps1' -OutFile '%TMPSCRIPT%' -UseBasicParsing"

if %ERRORLEVEL% neq 0 (
    echo Failed to download update script. Check your internet connection.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TMPSCRIPT%"
