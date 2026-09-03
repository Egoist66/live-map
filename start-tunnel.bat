@echo off
chcp 65001 >nul
echo === TUNNEL MODE (prod build + cloudflare) ===
powershell -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1"
pause
