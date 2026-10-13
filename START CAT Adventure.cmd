@echo off
setlocal
cd /d "%~dp0"
title CAT Insurance Journey Launcher
set "PORT=4174"

REM Reuse the journey if this folder is already being served.
powershell -NoProfile -Command "$r=try{Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/' -TimeoutSec 2}catch{$null};if($r -and $r.Content.Contains('Insurance Journey')){exit 0}else{exit 1}" >nul 2>nul
if not errorlevel 1 goto :open

REM Find a currently-free local port so another app is never interrupted.
for /f %%P in ('powershell -NoProfile -Command "$t=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$t.Start();$p=$t.LocalEndpoint.Port;$t.Stop();$p"') do set "PORT=%%P"
if not defined PORT (
  echo Could not choose a free local port.
  pause
  exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
  start "CAT Journey server - close this window when finished" cmd /k "cd /d ""%~dp0"" && py -3 -m http.server %PORT% --bind 127.0.0.1"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3, then double-click this file again.
    pause
    exit /b 1
  )
  start "CAT Journey server - close this window when finished" cmd /k "cd /d ""%~dp0"" && python -m http.server %PORT% --bind 127.0.0.1"
)

for /l %%I in (1,1,20) do (
  powershell -NoProfile -Command "$r=try{Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/' -TimeoutSec 1}catch{$null};if($r -and $r.Content.Contains('Insurance Journey')){exit 0}else{exit 1}" >nul 2>nul
  if not errorlevel 1 goto :open
  timeout /t 1 /nobreak >nul
)

echo The local server did not start. Check the CAT Journey server window for details.
pause
exit /b 1

:open
echo Opening CAT's Insurance Journey at http://127.0.0.1:%PORT%/
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
