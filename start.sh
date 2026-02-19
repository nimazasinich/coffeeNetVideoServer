#!/usr/bin/env bash
set -e

echo ""
echo "============================================"
echo "     SmartCopy — LAN Movie Distribution"
echo "============================================"
echo ""

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    echo "[SETUP] Creating virtual environment..."
    python3 -m venv .venv
    echo "[SETUP] Installing dependencies..."
    .venv/bin/pip install -r requirements.txt -q
    echo "[SETUP] Done!"
fi

# Get LAN IP
if [[ "$OSTYPE" == "darwin"* ]]; then
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
else
    LAN_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
fi

echo ""
echo " [INFO] Customer URL  : http://$LAN_IP:8080"
echo " [INFO] Admin Panel   : http://$LAN_IP:8080/#admin"
echo " [INFO] Default Login : admin / admin1234"
echo " [WARN] Change default password immediately!"
echo ""
echo " Press Ctrl+C to stop the server."
echo ""

export SMARTCOPY_MEDIA_ROOT="${SMARTCOPY_MEDIA_ROOT:-/opt/smartcopy-media}"
export SMARTCOPY_HOST="0.0.0.0"
export SMARTCOPY_PORT="8080"
export SMARTCOPY_LOG_LEVEL="INFO"

.venv/bin/python -m uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port 8080 \
    --workers 1 \
    --log-level warning
