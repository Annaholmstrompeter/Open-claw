@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
if not exist node_modules\playwright-core goto nosetup
node src\launcher.mjs delete-key
goto end
:nosetup
echo.
echo Det finns inget att radera: 1-SETUP har inte korts har.
goto end
:nonode
echo.
echo Node.js saknas pa den har datorn.
echo Installera det fran https://nodejs.org (valj LTS), starta om datorn och dubbelklicka igen.
goto end
:end
echo.
pause
