@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\doctor.ps1"
pause
