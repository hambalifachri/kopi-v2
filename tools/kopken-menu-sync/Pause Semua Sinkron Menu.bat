@echo off
setlocal
if not exist "%~dp0logs" mkdir "%~dp0logs"
type nul > "%~dp0logs\pause-all"
echo.
echo Sinkronisasi akan berhenti setelah outlet yang sedang diproses selesai.
echo Jendela proses boleh tetap dibiarkan terbuka.
echo.
pause
