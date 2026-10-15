@echo off
REM Trading Academy launcher: installs (first run), builds and opens the app.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install --no-audit --no-fund || (echo Install failed. Check your internet connection. & pause & exit /b 1)
)
echo Building...
call npm run build || (echo Build failed. & pause & exit /b 1)
start "" http://localhost:4173
call npm run preview
