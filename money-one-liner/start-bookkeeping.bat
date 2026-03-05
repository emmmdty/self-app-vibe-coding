@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"
set "BASE_PORT=5173"
set "MAX_PORT=5183"
set "PORT="
set "PROXY_PORT=8787"
set "URL="
set "STATIC_MODE="
set "PY_CMD="
set "HAS_PROXY=0"

for /l %%P in (%BASE_PORT%,1,%MAX_PORT%) do (
  netstat -ano | findstr /C:":%%P" | findstr /C:"LISTENING" >nul
  if errorlevel 1 (
    set "PORT=%%P"
    goto :port_done
  )
)
set "PORT=%BASE_PORT%"

:port_done
set "URL=http://127.0.0.1:%PORT%/index.html"

where node >nul 2>nul
if not errorlevel 1 (
  if exist "%PROJECT_DIR%\scripts\static-server.js" (
    set "STATIC_MODE=node"
  )
)

if not defined STATIC_MODE (
  where py >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3 -m http.server %PORT%"
)

if not defined PY_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python -m http.server %PORT%"
)

if not defined PY_CMD (
  for %%P in (
    "%ProgramData%\miniconda3\python.exe"
    "%ProgramData%\Miniconda3\python.exe"
    "%ProgramData%\anaconda3\python.exe"
    "%ProgramData%\Anaconda3\python.exe"
    "%UserProfile%\miniconda3\python.exe"
    "%UserProfile%\Miniconda3\python.exe"
    "%UserProfile%\anaconda3\python.exe"
    "%UserProfile%\Anaconda3\python.exe"
  ) do (
    if exist "%%~fP" (
      set "PY_CMD=""%%~fP"" -m http.server %PORT%"
      goto :python_ready
    )
  )
)

:python_ready
if not defined PY_CMD (
  where conda >nul 2>nul
  if not errorlevel 1 set "PY_CMD=conda run -n base python -m http.server %PORT%"
)

if not defined STATIC_MODE (
  if defined PY_CMD set "STATIC_MODE=python"
)

where node >nul 2>nul
if not errorlevel 1 (
  if exist "%PROJECT_DIR%\server\src\index.js" (
    set "HAS_PROXY=1"
  )
)

if /I "%~1"=="--check" goto :print_check
goto :run_mode

:print_check
echo static_mode: %STATIC_MODE%
echo static_port: %PORT%
if /I "%STATIC_MODE%"=="node" echo static_cmd: node scripts\static-server.js --port %PORT%
if /I "%STATIC_MODE%"=="python" echo static_cmd: %PY_CMD%
if "%HAS_PROXY%"=="1" (
  echo proxy_project_dir: %PROJECT_DIR%\server
  echo proxy_cmd: node src\index.js
) else (
  echo proxy: (not found)
)
exit /b 0

:run_mode
if not defined STATIC_MODE (
  echo Could not resolve local static server runtime.
  echo Expected one of:
  echo   1^) Node.js + scripts\static-server.js
  echo   2^) Python / Conda
  pause
  exit /b 1
)

if "%HAS_PROXY%"=="1" (
  echo Starting local API proxy at http://127.0.0.1:%PROXY_PORT%
  start "money-one-liner-proxy" cmd /k "cd /d ""%PROJECT_DIR%\server"" && node src\index.js"
) else (
  echo API proxy not started. Node.js or proxy files were not found.
)

echo Starting local static server on port %PORT%...
if /I "%STATIC_MODE%"=="node" (
  start "money-one-liner-static" cmd /k "cd /d ""%PROJECT_DIR%"" && node scripts\static-server.js --port %PORT%"
) else (
  start "money-one-liner-static" cmd /k "cd /d ""%PROJECT_DIR%"" && %PY_CMD%"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%URL%'; $ok=$false; for($i=0;$i -lt 30;$i++){ try{ $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ $ok=$true; break } } catch {}; Start-Sleep -Seconds 1 }; if($ok){ exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Failed to start local web server at %URL%
  echo Please check window: money-one-liner-static
  echo Try opening manually:
  echo %URL%
  pause
  exit /b 1
)

echo Opening %URL%
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%URL%'" >nul 2>nul
start "" "%URL%" >nul 2>nul

echo Startup complete.
echo If browser did not open, manually open:
echo %URL%
exit /b 0
