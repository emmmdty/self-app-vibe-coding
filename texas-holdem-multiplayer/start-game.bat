@echo off
setlocal EnableExtensions

cd /d "%~dp0"

if not exist "package.json" (
  echo [ERROR] package.json not found. Put this BAT file in the project root.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js ^(with npm^) first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please check your Node.js installation.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] First launch: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Please check your network and try again.
    pause
    exit /b 1
  )
)

echo [INFO] Starting game server...
start "" http://localhost:3000
call npm run dev

echo.
echo [INFO] Server stopped.
pause
