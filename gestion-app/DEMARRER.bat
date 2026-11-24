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

if not exist "data\admin.json" set ADMIN_PASSWORD=gei-local-2026

echo.
echo   GEI Gestion : http://localhost:8780
echo.
if exist "data\premier-acces.txt" type "data\premier-acces.txt"
if not exist "data\admin.json" echo   Identifiant : admin      Mot de passe : gei-local-2026
echo.
echo   Mot de passe refuse ? Fermez cette fenetre et lancez REINITIALISER-MOT-DE-PASSE.
echo   Laissez cette fenetre ouverte. Fermez-la pour arreter.
echo.
start "" http://localhost:8780
node server.js
pause
