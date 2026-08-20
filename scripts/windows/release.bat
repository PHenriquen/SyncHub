@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\release.ps1"
if errorlevel 1 pause
