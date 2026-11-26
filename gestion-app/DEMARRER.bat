@echo off
chcp 65001 >nul
title GEI Gestion (sur cet ordinateur)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js n'est pas installe sur cet ordinateur.
  echo   La page de telechargement va s'ouvrir : bouton vert LTS, installer,
  echo   puis double-cliquer de nouveau sur DEMARRER.
  echo.
  start "" https://nodejs.org
  pause
  exit /b
)

echo.
echo   Recherche de mises a jour...
if exist "MISE-A-JOUR.ps1" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MISE-A-JOUR.ps1"

set GEI_LOCAL=1
rem Les donnees sont rangees dans Documents\GEI-Gestion-Donnees (separees du code)
set "DONNEES=%USERPROFILE%\Documents\GEI-Gestion-Donnees\data"
if not exist "%DONNEES%\admin.json" if not exist "data\admin.json" set ADMIN_PASSWORD=gei-local-2026

echo.
echo   GEI Gestion : http://localhost:8780
echo.
if exist "%DONNEES%\premier-acces.txt" type "%DONNEES%\premier-acces.txt"
if not exist "%DONNEES%\admin.json" if not exist "data\admin.json" echo   Identifiant : admin      Mot de passe : gei-local-2026
echo.
echo   Sur cet ordinateur, l'application s'ouvre sans mot de passe.
echo   Laissez cette fenetre ouverte. Fermez-la pour arreter.
echo.
start "" http://localhost:8780
node server.js
pause
