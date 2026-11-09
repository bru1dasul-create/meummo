@echo off
rem Baixa a versao mais nova do MeuMMO do GitHub e instala o que mudou.
rem Feche o jogo antes de atualizar.
title Atualizar MeuMMO
cd /d "%~dp0"

echo Baixando a versao mais nova do jogo...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Nao consegui atualizar. Se voce mudou algum arquivo do jogo, como o mapa no Tiled,
  echo me mostre esta mensagem que eu ajudo a juntar as mudancas.
  pause
  exit /b 1
)

echo.
echo Instalando o que mudou...
call npm install
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Pronto! Agora e so abrir o jogo pelo atalho Jogar MeuMMO.
pause
