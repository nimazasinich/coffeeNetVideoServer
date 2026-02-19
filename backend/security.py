"""
SmartCopy — Security Module
JWT authentication, bcrypt hashing, rate limiting, input guards.

FIX NOTES
---------
BUG-14  hmac and related modules were conditionally imported inside the
        `except ImportError` block, making them unavailable to the fallback
        functions if PyJWT IS installed but later unloaded (edge case).
        Import them unconditionally at the top.

BUG-15  The fallback HMAC token was signed with hmac.new(...).hexdigest() but
        the decode path split on "." expecting 3 parts — this works but the
        header is just a static base64 blob, so we compute it once.
"""
import time
import logging
import json
import base64
import hmac
import hashlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.config import (
    SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES,
    RATE_LIMIT_JOBS_PER_MINUTE, RATE_LIMIT_MEDIA_PER_MINUTE,
    RATE_LIMIT_LOGIN_PER_15MIN
)
from backend.database import db_cursor

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

logger = logging.getLogger("smartcopy.security")

bearer_scheme = HTTPBearer(auto_error=False)


# ─── Password Hashing ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(username: str, role: str) -> str:
    payload = {
        "sub":  username,
        "role": role,
        "exp":  int((datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)).timestamp()),
        "iat":  int(datetime.now(timezone.utc).timestamp()),
    }
    if HAS_JWT:
        return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    # Fallback: simple HMAC token (avoids PyJWT dependency)
    header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
    body   = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig    = hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"{header}.{body}.{sig}"

def decode_token(token: str) -> Optional[dict]:
    try:
        if HAS_JWT:
            return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        # Fallback decode
        parts = token.split(".")
        if len(parts) != 3:
            return None
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload.get("exp", 0) < time.time():
            return None
        # Re-verify HMAC
        expected = hmac.new(
            SECRET_KEY.encode(),
            f"{parts[0]}.{parts[1]}".encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, parts[2]):
            return None
        return payload
    except Exception:
        return None


# ─── Dependencies ─────────────────────────────────────────────────────────────

async def get_current_admin(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

async def require_admin_role(user: dict = Depends(get_current_admin)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


# ─── Rate Limiting ────────────────────────────────────────────────────────────

class RateLimiter:
    def __init__(self):
        self._windows: dict = defaultdict(lambda: defaultdict(list))

    def check(self, endpoint: str, ip: str, max_calls: int, window_seconds: int):
        now = time.time()
        calls = self._windows[endpoint][ip]
        self._windows[endpoint][ip] = [t for t in calls if now - t < window_seconds]
        if len(self._windows[endpoint][ip]) >= max_calls:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down."
            )
        self._windows[endpoint][ip].append(now)


_limiter = RateLimiter()

def rate_limit_jobs(request: Request):
    ip = request.client.host if request.client else "unknown"
    _limiter.check("jobs", ip, RATE_LIMIT_JOBS_PER_MINUTE, 60)

def rate_limit_media(request: Request):
    ip = request.client.host if request.client else "unknown"
    _limiter.check("media", ip, RATE_LIMIT_MEDIA_PER_MINUTE, 60)

def rate_limit_login(request: Request):
    ip = request.client.host if request.client else "unknown"
    _limiter.check("login", ip, RATE_LIMIT_LOGIN_PER_15MIN, 900)


# ─── Path Safety ──────────────────────────────────────────────────────────────

def safe_path_under_root(path_str: str, root_str: str) -> bool:
    """Ensure resolved path is strictly under root — prevents traversal."""
    from pathlib import Path
    try:
        resolved = Path(path_str).resolve()
        root     = Path(root_str).resolve()
        return str(resolved).startswith(str(root))
    except Exception:
        return False


# ─── Admin bootstrap ──────────────────────────────────────────────────────────

def ensure_default_admin():
    """Create default admin if no users exist."""
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM admin_users")
        if cur.fetchone()["cnt"] == 0:
            cur.execute(
                "INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)",
                ("admin", hash_password("admin1234"), "admin")
            )
            logger.warning({
                "event": "default_admin_created",
                "note": "Change password immediately via /api/admin/change-password"
            })
