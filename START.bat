@echo off
echo === SmartCopy Pro v5 ===
echo.
echo [1/3] Installing Python dependencies...
pip install -r requirements.txt -q
echo [2/3] Building frontend...
if not exist frontend_react\dist (
    cd frontend_react
    call npm install -q
    call npm run build
    cd ..
) else (
    echo Frontend build found, skipping...
)
echo [3/3] Starting server on http://localhost:8080
echo.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080
