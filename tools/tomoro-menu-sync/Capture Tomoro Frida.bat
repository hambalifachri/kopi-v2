@echo off
cd /d "%~dp0\..\.."
node tools\tomoro-menu-sync\capture-frida.mjs --seconds=90 --keyword=bogor
pause
