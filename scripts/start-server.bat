@echo off
cd /d "D:\Projects\alzain-academy"
if not exist "%TEMP%\opencode" mkdir "%TEMP%\opencode"
:loop
node server.js >> "%TEMP%\opencode\az-server.out.log" 2>> "%TEMP%\opencode\az-server.err.log"
timeout /t 3 /nobreak >nul
goto loop
