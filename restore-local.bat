@echo off
chcp 65001 >nul
echo === LOCAL MODE ===
powershell -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" -Local
pause
