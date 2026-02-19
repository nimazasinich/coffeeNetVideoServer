@echo off
REM SmartCopy Pro - Complete Startup Script (Windows)
REM Builds React frontend and starts FastAPI backend

echo ========================================
echo SmartCopy Pro - Starting Application
echo ========================================
echo.

REM Check if Node.js is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found. Please install Python 3.8+ first.
    pause
    exit /b 1
)

echo [1/4] Installing frontend dependencies...
cd frontend_react
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed
        cd ..
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed, skipping...
)

echo.
echo [2/4] Building React frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend build failed
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [3/4] Installing Python dependencies...
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pip install failed
    pause
    exit /b 1
)

echo.
echo [4/4] Starting SmartCopy Pro server...
echo.
echo ========================================
echo Server starting on http://localhost:8080
echo.
echo Customer UI:  http://localhost:8080
echo Admin Panel:  http://localhost:8080/admin
echo API Docs:     http://localhost:8080/api/docs
echo.
echo Default admin credentials:
echo   Username: admin
echo   Password: admin1234
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
