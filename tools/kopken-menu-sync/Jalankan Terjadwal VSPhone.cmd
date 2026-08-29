@echo off
setlocal
cd /d "%~dp0\..\.."
set "LOG=tools\kopken-menu-sync\logs\jadwal-vsphone.log"
set "NODE_EXE=C:\Users\fachr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.>> "%LOG%"
echo [%date% %time%] Memulai sinkron ulang semua menu.>> "%LOG%"
"%NODE_EXE%" "tools\kopken-menu-sync\vsphone-sync.mjs" --ulang >> "%LOG%" 2>&1
echo [%date% %time%] Selesai dengan kode %errorlevel%.>> "%LOG%"
