@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === GROSSISTAGENT: SETUP (gors en gang) ===
where node >nul 2>nul
if errorlevel 1 goto nonode
if exist node_modules\playwright-core goto run
echo Installerar det som behovs (kan ta nagra minuter, kraver internet) ...
call npm install --no-audit --no-fund
if errorlevel 1 goto fail
:run
node src\launcher.mjs setup
goto end
:fail
echo.
echo Installationen misslyckades. Kontrollera internetanslutningen och kor den har filen igen.
goto end
:nonode
echo.
echo Node.js saknas pa den har datorn.
echo Installera det fran https://nodejs.org (valj LTS), starta om datorn och dubbelklicka igen.
goto end
:end
echo.
pause
