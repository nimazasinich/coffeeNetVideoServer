@echo off
title SmartCopy Server
color 0A
echo.
echo  ============================================
echo       SmartCopy — LAN Movie Distribution
echo  ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist ".venv" (
    echo [SETUP] Creating virtual environment...
    python -m venv .venv
    echo [SETUP] Installing dependencies...
    .venv\Scripts\pip install -r requirements.txt --quiet
    echo [SETUP] Done!
)

:: Get LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LAN_IP=%%a
    goto :found
)
:found
set LAN_IP=%LAN_IP: =%

echo.
echo  [INFO] Starting SmartCopy server...
echo  [INFO] Customer URL  : http://%LAN_IP%:8080
echo  [INFO] Admin Panel   : http://%LAN_IP%:8080/#admin
echo  [INFO] Default Login : admin / admin1234
echo  [WARN] Change default password immediately!
echo.
echo  Press Ctrl+C to stop the server.
echo.

set SMARTCOPY_MEDIA_ROOT=C:\SmartCopyMedia
set SMARTCOPY_HOST=0.0.0.0
set SMARTCOPY_PORT=8080
set SMARTCOPY_LOG_LEVEL=INFO

.venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --workers 1

pause
