@echo off
cd /d "%~dp0\..\.."
node tools\tomoro-menu-sync\capture-frida.mjs --seconds=180 --all-outlets --max-scrolls=60
pause
