#!/bin/bash
# SmartCopy Pro - Complete Startup Script (Linux/Mac)
# Builds React frontend and starts FastAPI backend

set -e

echo "========================================"
echo "SmartCopy Pro - Starting Application"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found. Please install Python 3.8+ first."
    exit 1
fi

echo "[1/4] Installing frontend dependencies..."
cd frontend_react
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "Dependencies already installed, skipping..."
fi

echo ""
echo "[2/4] Building React frontend..."
npm run build

cd ..

echo ""
echo "[3/4] Installing Python dependencies..."
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "[4/4] Starting SmartCopy Pro server..."
echo ""
echo "========================================"
echo "Server starting on http://localhost:8080"
echo ""
echo "Customer UI:  http://localhost:8080"
echo "Admin Panel:  http://localhost:8080/admin"
echo "API Docs:     http://localhost:8080/api/docs"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin1234"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
