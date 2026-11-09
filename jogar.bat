@echo off
rem Abre o MeuMMO: liga o servidor e o jogo e abre o navegador.
rem Para desligar, feche esta janela.
title MeuMMO
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Rode o instalador de novo ou instale em https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules\ (
  echo Instalando as dependencias, so na primeira vez...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo.
echo Abrindo o MeuMMO no navegador: http://localhost:5173
echo Se o Windows perguntar sobre o firewall, pode permitir: e o servidor do jogo.
echo Para desligar o jogo, feche esta janela.
echo.
set ABRIR_NAVEGADOR=1
call npm run dev
pause
