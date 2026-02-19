@echo off
REM SmartCopy Pro - Quick Development Start (Windows)
REM Assumes dependencies are already installed

echo ========================================
echo SmartCopy Pro - Quick Start (Dev Mode)
echo ========================================
echo.

REM Activate virtual environment
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found. Run start_smartcopy.bat first.
    pause
    exit /b 1
)

echo Starting server on http://localhost:8080
echo.
echo Admin Panel: http://localhost:8080/admin
echo API Docs:    http://localhost:8080/api/docs
echo.
echo Press Ctrl+C to stop
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
