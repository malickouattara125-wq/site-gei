@echo off
chcp 65001 >nul
title GEI Gestion - mot de passe du DG
cd /d "%~dp0"
echo.
echo   Le mot de passe du compte principal (admin) va redevenir : gei-local-2026
echo   Les chantiers, ventes, depenses et autres comptes sont conserves.
echo.
pause
if exist "data\admin.json" del /q "data\admin.json"
if exist "data\premier-acces.txt" del /q "data\premier-acces.txt"
echo.
echo   C'est fait. Lancez maintenant DEMARRER et connectez-vous avec :
echo   Identifiant : admin      Mot de passe : gei-local-2026
echo.
pause
