@echo off
REM FabriLink mobile dev server launcher (works even if Node.js isn't on PATH).
REM Usage:  start-mobile.cmd            -> LAN mode (phone on same Wi-Fi)
REM         start-mobile.cmd tunnel     -> tunnel mode (phone on any network)

setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

REM Find this PC's LAN IPv4 address so the phone can reach the backend.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  if not defined LANIP set "LANIP=%%a"
)
set "LANIP=%LANIP: =%"
if not defined LANIP set "LANIP=localhost"

if not defined EXPO_PUBLIC_API_BASE_URL set "EXPO_PUBLIC_API_BASE_URL=http://%LANIP%:8000/api/v1"
echo.
echo   Backend URL for the app: %EXPO_PUBLIC_API_BASE_URL%
echo   (start the backend with: runserver 0.0.0.0:8000, and add %LANIP% to ALLOWED_HOSTS)
echo.

if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund || exit /b 1
)

if /i "%~1"=="tunnel" (
  call npx expo start --tunnel --clear
) else (
  call npx expo start --lan --clear
)
endlocal
