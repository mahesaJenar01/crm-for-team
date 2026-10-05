@echo off
setlocal
pushd "%~dp0web"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer before starting the website.
  popd
  exit /b 1
)
if not exist "node_modules\vite" (
  call npm.cmd ci
  if errorlevel 1 (
    popd
    exit /b 1
  )
)
echo Open http://127.0.0.1:5173 in your browser. Press Ctrl+C to stop.
call npm.cmd run dev
set "crmWebResult=%errorlevel%"
popd
exit /b %crmWebResult%
