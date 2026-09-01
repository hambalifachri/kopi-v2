@echo off
cd /d "%~dp0\..\.."
node tools\tomoro-menu-sync\capture-frida.mjs --seconds=180 --city-sweep
pause
