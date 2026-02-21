#!/usr/bin/env bash
# SmartCopy Pro — Start Script
set -e

echo "=== SmartCopy Pro v5 ==="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is required"
    exit 1
fi

# Install Python deps
echo "[1/3] Installing Python dependencies..."
pip install -r requirements.txt -q

# Build frontend if dist doesn't exist
if [ ! -d "frontend_react/dist" ]; then
    echo "[2/3] Building frontend..."
    if ! command -v npm &>/dev/null; then
        echo "WARNING: npm not found, skipping frontend build"
    else
        cd frontend_react
        npm install -q
        npm run build
        cd ..
    fi
else
    echo "[2/3] Frontend build found, skipping..."
fi

# Start server
echo "[3/3] Starting server on http://localhost:8080"
echo ""
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8080
