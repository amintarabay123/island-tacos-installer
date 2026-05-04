Write-Host "Island Tacos — Network Update" -ForegroundColor Cyan

# Find local IP
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\."
} | Select-Object -First 1).IPAddress

if (-not $ip) {
    Write-Host "ERROR: Could not detect your IP address. Are you connected to WiFi?" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Detected IP: $ip" -ForegroundColor Green

# Update .env
$envFile = "$PSScriptRoot\..\\.env"
(Get-Content $envFile) -replace '192\.168\.\d+\.\d+', $ip | Set-Content $envFile
Write-Host ".env updated" -ForegroundColor Green

# Rebuild frontend
Write-Host "Rebuilding frontend (takes about a minute)..." -ForegroundColor Yellow
$env:VITE_ADMIN_PATH = "it-admin"
$env:PORT = "3001"
$env:BASE_PATH = "/"
Set-Location "$PSScriptRoot\.."
pnpm --filter "@workspace/island-tacos" run build | Out-Null

Write-Host "Frontend rebuilt" -ForegroundColor Green

# Restart PM2
pm2 restart island-tacos | Out-Null
Write-Host "Server restarted" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Access your system at:" -ForegroundColor Cyan
Write-Host "  Online store:      http://$($ip):3001" -ForegroundColor White
Write-Host "  POS:               http://$($ip):3001/it-admin/pos" -ForegroundColor White
Write-Host "  Kitchen display:   http://$($ip):3001/it-admin/kitchen" -ForegroundColor White
Write-Host "  Customer display:  http://$($ip):3001/display" -ForegroundColor White
Write-Host "  Admin:             http://$($ip):3001/it-admin" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close"
