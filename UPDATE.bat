@echo off
:: Island Tacos — Update
:: Downloads and runs the latest update script directly from the cloud.
:: Run as Administrator.

setlocal
set CLOUD=https://orders.islandtacosbvi.com

echo.
echo ============================================
echo    Island Tacos - Update
echo ============================================
echo.
echo Downloading and running update from cloud...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "& ([scriptblock]::Create((Invoke-WebRequest '%CLOUD%/api/download/UPDATE.ps1' -UseBasicParsing).Content))"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Update did not complete successfully.
    echo Run as Administrator and check your internet connection.
)
pause
