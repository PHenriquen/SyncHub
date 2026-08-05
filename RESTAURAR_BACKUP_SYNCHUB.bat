@echo off
setlocal
cd /d "%~dp0"
set /p BACKUP=Arraste ou informe o caminho do backup .zip: 
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restore.ps1" -BackupPath "%BACKUP%" -RestoreEnvironment
if errorlevel 1 pause
