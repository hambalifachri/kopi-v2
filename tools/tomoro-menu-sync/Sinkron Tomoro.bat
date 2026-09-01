@echo off
cd /d "%~dp0\..\.."
node tools\tomoro-menu-sync\sync.mjs %*
pause
