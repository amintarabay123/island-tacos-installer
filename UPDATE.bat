@echo off
:: Island Tacos - Update Script
:: Double-click this file to update to the latest version.
:: Must run as Administrator.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPDATE.ps1"
pause
