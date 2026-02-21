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

BUG-20  safe_path_under_root used str.startswith() which is a prefix match, not
        a path-component match. Given root=/media/root, a path of
        /media/rootbad/evil would pass: "/media/rootbad".startswith("/media/root")
        is True. Fixed to use Path.is_relative_to() (Python 3.9+) with a
        fallback that appends os.sep to the root before prefix-checking.
"""
import os
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
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.config import (
    SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES, JWT_REFRESH_EXPIRY_DAYS,
    RATE_LIMIT_JOBS_PER_MINUTE, RATE_LIMIT_MEDIA_PER_MINUTE,
    RATE_LIMIT_LOGIN_PER_15MIN,
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
        "type": "access",
        "exp":  int((datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)).timestamp()),
        "iat":  int(datetime.now(timezone.utc).timestamp()),
    }
    if HAS_JWT:
        return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
    body   = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig    = hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"{header}.{body}.{sig}"


def create_refresh_token(username: str, role: str) -> str:
    """Issue a long-lived refresh token. Stored in the DB so it can be revoked."""
    payload = {
        "sub":  username,
        "role": role,
        "type": "refresh",
        "exp":  int((datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_EXPIRY_DAYS)).timestamp()),
        "iat":  int(datetime.now(timezone.utc).timestamp()),
    }
    if HAS_JWT:
        token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    else:
        header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip("=")
        body   = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        sig    = hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).hexdigest()
        token  = f"{header}.{body}.{sig}"

    # Persist so we can revoke on password change / logout
    exp_ts = payload["exp"]
    with db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token_hash  TEXT PRIMARY KEY,
                username    TEXT NOT NULL,
                expires_at  REAL NOT NULL,
                revoked     INTEGER NOT NULL DEFAULT 0,
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now'))
            )
        """)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        cur.execute(
            "INSERT OR REPLACE INTO refresh_tokens (token_hash, username, expires_at) VALUES (?,?,?)",
            (token_hash, username, float(exp_ts)),
        )
    return token


def decode_token(token: str) -> Optional[dict]:
    try:
        if HAS_JWT:
            return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        parts = token.split(".")
        if len(parts) != 3:
            return None
        padded  = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload.get("exp", 0) < time.time():
            return None
        expected = hmac.new(
            SECRET_KEY.encode(),
            f"{parts[0]}.{parts[1]}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, parts[2]):
            return None
        return payload
    except Exception:
        return None


def verify_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a refresh token, checking DB revocation status."""
    payload = decode_token(token)
    if not payload:
        return None
    if payload.get("type") != "refresh":
        return None

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        with db_cursor() as cur:
            cur.execute(
                "SELECT revoked FROM refresh_tokens WHERE token_hash=?",
                (token_hash,),
            )
            row = cur.fetchone()
    except Exception:
        # refresh_tokens table may not exist on old DB — treat as invalid
        return None

    if not row or row["revoked"]:
        return None
    return payload


def revoke_refresh_tokens_for_user(username: str):
    """Revoke all refresh tokens for a user (e.g. on password change)."""
    try:
        with db_cursor() as cur:
            cur.execute(
                "UPDATE refresh_tokens SET revoked=1 WHERE username=?",
                (username,),
            )
    except Exception:
        pass


# ─── Dependencies ─────────────────────────────────────────────────────────────

async def get_current_admin(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("type") not in (None, "access"):
        # Refresh tokens must not be used as access tokens
        raise HTTPException(status_code=401, detail="Invalid token type")
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
        now   = time.time()
        calls = self._windows[endpoint][ip]
        self._windows[endpoint][ip] = [t for t in calls if now - t < window_seconds]
        if len(self._windows[endpoint][ip]) >= max_calls:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down.",
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
    """
    Return True only when resolved path is strictly inside root.

    FIX BUG-20: The previous implementation used str.startswith() which is a
    plain prefix match, not a path-component match.  Example:

        root  = /media/root
        path  = /media/rootbad/evil

        "/media/rootbad/evil".startswith("/media/root")  →  True  ← WRONG

    Fix: use Path.is_relative_to() (Python 3.9+) which performs component-
    aware comparison.  For Python <3.9 we fall back to comparing strings after
    appending os.sep to the root, which avoids the prefix collision.
    """
    from pathlib import Path
    try:
        resolved = Path(path_str).resolve()
        root     = Path(root_str).resolve()

        # Primary path: Path.is_relative_to() — available Python 3.9+
        try:
            return resolved.is_relative_to(root)
        except AttributeError:
            pass

        # Fallback for Python 3.8: append separator so /media/root/ is not a
        # prefix of /media/rootbad/
        root_with_sep = str(root) + os.sep
        return str(resolved) == str(root) or str(resolved).startswith(root_with_sep)

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
                ("admin", hash_password("admin1234"), "admin"),
            )
            logger.warning({
                "event": "default_admin_created",
                "note":  "Change password immediately via /api/admin/change-password",
            })
