@echo off
if not exist "%TEMP%\opencode" mkdir "%TEMP%\opencode"
:loop
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:3001 >> "%TEMP%\opencode\cf-tunnel.out.log" 2>> "%TEMP%\opencode\cf-tunnel.log"
timeout /t 5 /nobreak >nul
goto loop
