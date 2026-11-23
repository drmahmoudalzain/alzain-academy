@echo off
cd /d "%~dp0.."
if not exist "%TEMP%\opencode" mkdir "%TEMP%\opencode"
:loop
netstat -ano | findstr /C:":3001 " | findstr /C:"LISTENING" >nul
if errorlevel 1 (
  node server.js >> "%TEMP%\opencode\az-server.out.log" 2>> "%TEMP%\opencode\az-server.err.log"
)
ping -n 6 127.0.0.1 >nul
goto loop
