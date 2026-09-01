@echo off
cd /d "%~dp0\..\.."
node tools\tomoro-menu-sync\capture-http-toolkit.mjs --seconds=90
pause
