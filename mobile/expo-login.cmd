@echo off
REM Signs this PC's Expo CLI in to your Expo account (same account as Expo Go).
REM Works even if Node.js isn't on PATH. Type your username and password when asked.

setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

call npx expo login
echo.
echo Signed in as:
call npx expo whoami
echo.
echo Now restart the app server: close its window, then run start-mobile.cmd again.
pause
endlocal
