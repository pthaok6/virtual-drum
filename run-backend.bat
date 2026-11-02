@echo off
setlocal
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.10 or newer and try again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  python -m venv .venv
  if errorlevel 1 goto :failed
)

".venv\Scripts\python.exe" -c "import uvicorn, demucs, librosa" >nul 2>nul
if errorlevel 1 (
  echo Installing audio backend dependencies. This can take a while...
  ".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
  if errorlevel 1 goto :failed
)

start "Virtual Drum Backend" /D "%PROJECT_DIR%" cmd /k ""%PROJECT_DIR%.venv\Scripts\python.exe" -m uvicorn app:app --app-dir backend --reload --host 127.0.0.1 --port 8000"

echo Started backend at http://127.0.0.1:8000
exit /b 0

:failed
echo Startup failed. Check the error above, then run this file again.
pause
exit /b 1
