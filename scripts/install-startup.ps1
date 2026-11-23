$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$startup = [Environment]::GetFolderPath('Startup')
$target = Join-Path $startup 'alzain-academy.vbs'

$content = @"
Set ws = CreateObject("WScript.Shell")
ws.Run """C:\Windows\System32\cmd.exe"" /c $root\scripts\start-server.bat", 0, False
ws.Run """C:\Windows\System32\cmd.exe"" /c $root\scripts\start-tunnel.bat", 0, False
"@

Set-Content -Path $target -Value $content -Encoding ASCII
Write-Output "installed: $target"