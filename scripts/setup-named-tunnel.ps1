param(
  [Parameter(Mandatory = $true)]
  [string]$Hostname,

  [string]$TunnelName = 'alzain-academy'
)

$ErrorActionPreference = 'Stop'

$root = 'D:\Projects\alzain-academy'
$tmp = Join-Path $env:TEMP 'opencode'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$cloudflaredDir = Join-Path $env:USERPROFILE '.cloudflared'
$cert = Join-Path $cloudflaredDir 'cert.pem'
$config = Join-Path $cloudflaredDir 'config.yml'
$urlFile = Join-Path $root 'public-url.txt'

New-Item -ItemType Directory -Force -Path $tmp | Out-Null
New-Item -ItemType Directory -Force -Path $cloudflaredDir | Out-Null

if (-not (Test-Path $cert)) {
  throw "cloudflared غير مفعل على هذا الحساب. شغّل: cloudflared tunnel login ثم اختر النطاق في المتصفح."
}

$existing = & $cloudflared tunnel list 2>$null | Select-String -Pattern $TunnelName
if (-not $existing) {
  & $cloudflared tunnel create $TunnelName 2>&1 | Write-Output
}

$credential = Get-ChildItem -Path $cloudflaredDir -Filter "$TunnelName*.json" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $credential) {
  throw "لم أجد ملف credentials للنفق $TunnelName."
}

$configLines = @(
  "tunnel: $TunnelName",
  "credentials-file: $($credential.FullName.Replace('\', '/'))",
  '',
  'ingress:',
  "  - hostname: $Hostname",
  '    service: http://localhost:3001',
  '  - service: http_status:404'
)
Set-Content -Path $config -Value $configLines -Encoding UTF8

& $cloudflared tunnel route dns $TunnelName $Hostname 2>&1 | Write-Output

$startTunnel = @"
@echo off
if not exist "%TEMP%\opencode" mkdir "%TEMP%\opencode"
:loop
tasklist /FI "IMAGENAME eq cloudflared.exe" | findstr /I "cloudflared.exe" >nul
if errorlevel 1 (
  "$cloudflared" tunnel run $TunnelName --protocol http2 >> "%TEMP%\opencode\cf-tunnel.out.log" 2>> "%TEMP%\opencode\cf-tunnel.log"
)
ping -n 6 127.0.0.1 >nul
goto loop
"@
Set-Content -Path (Join-Path $root 'scripts\start-tunnel.bat') -Value $startTunnel -Encoding ASCII

Set-Content -Path $urlFile -Value "https://$Hostname/" -Encoding UTF8

$oldTunnel = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'"
$oldTunnel | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Start-Process -FilePath cmd.exe -ArgumentList '/c D:\Projects\alzain-academy\scripts\start-tunnel.bat' `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $tmp 'cf-loop.out.log') `
  -RedirectStandardError (Join-Path $tmp 'cf-loop.err.log')

Start-Sleep -Seconds 10
curl.exe -s -o NUL -w "stable %{http_code}\n" "https://$Hostname/"
Write-Output "تم تجهيز الرابط الثابت: https://$Hostname/"
