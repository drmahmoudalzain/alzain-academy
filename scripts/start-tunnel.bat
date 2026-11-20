@echo off
if not exist "%TEMP%\opencode" mkdir "%TEMP%\opencode"
:loop
tasklist /FI "IMAGENAME eq cloudflared.exe" | findstr /I "cloudflared.exe" >nul
if errorlevel 1 (
  "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:3001 --protocol http2 >> "%TEMP%\opencode\cf-tunnel.out.log" 2>> "%TEMP%\opencode\cf-tunnel.log"
)
ping -n 6 127.0.0.1 >nul
goto loop
