"""
SmartCopy Pro — Configuration Module
Merged from smartcopy_v2 (env-based config) and files_proj (pydantic-settings).
All settings can be overridden via environment variables.
"""
import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent.parent
DATA_DIR    = BASE_DIR / "data"
LOG_DIR     = BASE_DIR / "logs"
FRONTEND_DIR = BASE_DIR / "frontend_react" / "dist"

# Where movies are stored (admin configures this)
MEDIA_ROOT = Path(os.environ.get("SMARTCOPY_MEDIA_ROOT", r"C:\SmartCopyMedia"))

# SQLite database
DB_PATH = DATA_DIR / "smartcopy.db"

# ─── Server ───────────────────────────────────────────────────────────────────
SERVER_HOST     = os.environ.get("SMARTCOPY_HOST", "0.0.0.0")
SERVER_PORT     = int(os.environ.get("SMARTCOPY_PORT", "8080"))
SERVER_BASE_URL = os.environ.get("SMARTCOPY_BASE_URL", "http://localhost:8080")
SERVER_WS_URL   = os.environ.get("SMARTCOPY_WS_URL",   "ws://localhost:8080")

# ─── Security ─────────────────────────────────────────────────────────────────
SECRET_KEY           = os.environ.get("SMARTCOPY_SECRET", "CHANGE_THIS_IN_PRODUCTION_SUPER_SECRET_KEY_32CHARS")
JWT_ALGORITHM        = "HS256"
JWT_EXPIRY_MINUTES   = 15
JWT_REFRESH_EXPIRY_DAYS = 7
BCRYPT_ROUNDS        = 12
ALLOWED_SUBNET       = os.environ.get("SMARTCOPY_SUBNET", "")

# ─── Rate Limiting ────────────────────────────────────────────────────────────
RATE_LIMIT_JOBS_PER_MINUTE   = 5
RATE_LIMIT_MEDIA_PER_MINUTE  = 60
RATE_LIMIT_LOGIN_PER_15MIN   = 5

# ─── Copy Queue ───────────────────────────────────────────────────────────────
MAX_CONCURRENT_COPIES  = int(os.environ.get("SMARTCOPY_MAX_COPIES", "4"))
MAX_QUEUE_DEPTH        = 100
MAX_RETRIES_PER_JOB    = 3

# ─── Copy Engine ──────────────────────────────────────────────────────────────
CHUNK_SIZE_BYTES              = 524_288        # 512 KB
PROGRESS_REPORT_INTERVAL_MS   = 500
COPY_TEMP_EXTENSION           = ".smartcopy_tmp"

# ─── Media Library ────────────────────────────────────────────────────────────
SUPPORTED_EXTENSIONS  = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".ts", ".flv"}
SCAN_INTERVAL_SECONDS = 60

# ─── Mobile Delivery ──────────────────────────────────────────────────────────
MAX_CONCURRENT_MOBILE_DOWNLOADS = int(os.environ.get("SMARTCOPY_MAX_MOBILE", "5"))
MOBILE_THROTTLE_KBPS            = int(os.environ.get("SMARTCOPY_THROTTLE_KBPS", "0"))   # 0 = unlimited
MAX_DAILY_DOWNLOADS_PER_IP      = int(os.environ.get("SMARTCOPY_DAILY_DL_LIMIT", "5"))
DOWNLOAD_TOKEN_TTL              = int(os.environ.get("SMARTCOPY_TOKEN_TTL", "900"))       # 15 minutes

# ─── Stripe Payments ──────────────────────────────────────────────────────────
STRIPE_API_KEY        = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SUCCESS_URL    = os.environ.get("STRIPE_SUCCESS_URL", f"{SERVER_BASE_URL}/payment-success")
STRIPE_CANCEL_URL     = os.environ.get("STRIPE_CANCEL_URL",  f"{SERVER_BASE_URL}/payment-cancel")

# ─── Agent ────────────────────────────────────────────────────────────────────
AGENT_HEARTBEAT_INTERVAL = 30   # seconds

# ─── Pricing (default tiers) ──────────────────────────────────────────────────
DEFAULT_PRICING = [
    {"name": "SD Movie",  "maxSizeGB": 2,    "priceUSD": 1.00},
    {"name": "HD Movie",  "maxSizeGB": 8,    "priceUSD": 2.00},
    {"name": "4K Movie",  "maxSizeGB": 50,   "priceUSD": 3.50},
    {"name": "TV Series", "maxSizeGB": 9999, "priceUSD": 5.00},
]

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL       = os.environ.get("SMARTCOPY_LOG_LEVEL", "INFO")
LOG_MAX_BYTES   = 50 * 1024 * 1024   # 50 MB
LOG_BACKUP_COUNT = 5

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS = os.environ.get("SMARTCOPY_CORS_ORIGINS", "*").split(",")

# === QR UPGRADE START ===
# ─── Branding & Identity ──────────────────────────────────────────────────────
SHOP_NAME       = os.environ.get("SMARTCOPY_SHOP_NAME", "VideoNet Shop")
SHOP_LOGO_PATH  = os.environ.get("SMARTCOPY_SHOP_LOGO", None)
INSTALL_ID      = None # Will be loaded at runtime from backend/license.py if needed

# ─── QR System ────────────────────────────────────────────────────────────────
QR_AUTO_REFRESH = True
ENABLE_PRICING  = True
DEFAULT_CURRENCY = "USD"
# === QR UPGRADE END ===
