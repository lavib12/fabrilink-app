@echo off
REM FabriLink backend launcher, reachable from phones on the same Wi-Fi.
setlocal
cd /d "%~dp0"

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  if not defined LANIP set "LANIP=%%a"
)
set "LANIP=%LANIP: =%"

REM Allow requests addressed to this PC's LAN IP and the Android emulator alias.
set "ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,web,10.0.2.2,%LANIP%"

echo.
echo   Backend: http://%LANIP%:8000   (health check: http://%LANIP%:8000/health/)
echo.

".venv\Scripts\python.exe" backend\manage.py migrate --noinput
".venv\Scripts\python.exe" backend\manage.py runserver 0.0.0.0:8000
endlocal
