@echo off
setlocal
cd /d "%~dp0\..\.."
set "NODE_EXE=C:\Users\fachr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "tools\kopken-menu-sync\vsphone-sync.mjs" %*
echo.
pause
