@echo off
setlocal
cd /d "%~dp0"
title Synchub - Instalacao e Inicializacao
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\oneclick.ps1"
if errorlevel 1 (
  echo.
  echo O Synchub nao conseguiu concluir a operacao. Veja a mensagem acima.
  pause
  exit /b 1
)
