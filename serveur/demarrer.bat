@echo off
chcp 65001 >nul
title Site GEI - serveur local
cd /d "%~dp0"
set "NODE=%~dp0..\outils\node\node.exe"
if not exist "%NODE%" set "NODE=node"
echo.
echo   Site GEI          : http://localhost:8765
echo   Tableau de bord   : http://localhost:8765/admin
echo.
echo   Laissez cette fenetre ouverte. Fermez-la pour arreter le site.
echo.
start "" http://localhost:8765/admin
"%NODE%" server.js
pause
