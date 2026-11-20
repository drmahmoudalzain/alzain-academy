$ErrorActionPreference = 'Stop'

$root = 'D:\Projects\alzain-academy'
$tmp = Join-Path $env:TEMP 'opencode'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$serverTask = 'AlZain Academy Server'
$tunnelTask = 'AlZain Academy Tunnel'
$urlFile = Join-Path $root 'public-url.txt'

$serverLoop = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*start-server.bat*' }
$serverListening = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $serverLoop -or -not $serverListening) {
  Start-ScheduledTask -TaskName $serverTask
}

$tunnelLoop = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*start-tunnel.bat*' }
$tunnelRunning = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -like '*127.0.0.1:3001*' }
if (-not $tunnelLoop -or -not $tunnelRunning) {
  Start-ScheduledTask -TaskName $tunnelTask
}

$tunnelError = Join-Path $tmp 'cf-tunnel.log'
if (Test-Path $tunnelError) {
  $log = Get-Content $tunnelError -Raw -ErrorAction SilentlyContinue
  $matches = [regex]::Matches($log, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($matches.Count -gt 0) {
    Set-Content -Path $urlFile -Value $matches[$matches.Count - 1].Value -Encoding UTF8
  }
}
