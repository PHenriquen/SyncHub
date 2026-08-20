@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\backup.ps1"
if errorlevel 1 pause
