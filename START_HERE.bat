@echo off
REM ============================================================
REM SmartCopy Pro - ONE-CLICK STARTUP
REM ============================================================
REM This script builds the frontend and starts the server
REM Access the admin panel at: http://localhost:8080/admin
REM ============================================================

title SmartCopy Pro - Starting...

echo.
echo  ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗ ██████╗ ██████╗ ██████╗ ██╗   ██╗
echo  ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝
echo  ███████╗██╔████╔██║███████║██████╔╝   ██║   ██║     ██║   ██║██████╔╝ ╚████╔╝ 
echo  ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║   ██║     ██║   ██║██╔═══╝   ╚██╔╝  
echo  ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║   ╚██████╗╚██████╔╝██║        ██║   
echo  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝        ╚═╝   
echo.
echo  USB + Mobile Media Distribution System v2.0.0
echo  ============================================================
echo.

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Python not found!
    echo  Please install Python 3.8+ from https://python.org
    echo.
    pause
    exit /b 1
)

REM Check Node.js
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Node.js not found!
    echo  Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [1/5] Checking frontend build...
if exist "frontend_react\dist\index.html" (
    echo  ✓ Frontend already built
) else (
    echo  Building React frontend...
    cd frontend_react
    call npm install --silent
    call npm run build
    cd ..
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo  [ERROR] Frontend build failed
        pause
        exit /b 1
    )
    echo  ✓ Frontend built successfully
)

echo.
echo  [2/5] Setting up Python environment...
if not exist ".venv" (
    echo  Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)
echo  ✓ Python dependencies ready

echo.
echo  [3/5] Initializing database...
python -c "from backend.database import init_db; init_db()" 2>nul
echo  ✓ Database initialized

echo.
echo  [4/5] Starting SmartCopy Pro server...
echo.
color 0A
echo  ============================================================
echo  ✓ SERVER READY
echo  ============================================================
echo.
echo  🌐 Customer UI:  http://localhost:8080
echo  🔐 Admin Panel:  http://localhost:8080/admin
echo  📚 API Docs:     http://localhost:8080/api/docs
echo.
echo  Default Admin Login:
echo    Username: admin
echo    Password: admin1234
echo.
echo  ⚠️  IMPORTANT: Change the default password immediately!
echo.
echo  Press Ctrl+C to stop the server
echo  ============================================================
echo.

title SmartCopy Pro - Running on http://localhost:8080

REM Start browser after 2 seconds
start /B timeout /t 2 /nobreak >nul 2>&1 && start http://localhost:8080/admin

REM Start server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080

REM If server stops
color 0E
echo.
echo  Server stopped.
pause
