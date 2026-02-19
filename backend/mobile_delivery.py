"""
SmartCopy Pro — Mobile Delivery Service
Secure, throttled, range-aware file delivery to phones/browsers.

Features
--------
* Single-use HMAC-SHA256 signed tokens
* HTTP Range header support for resume-on-reconnect
* Per-download bandwidth throttle (configurable KB/s)
* Global concurrency semaphore
* Per-IP daily quota enforcement
* SHA-256 integrity in X-Checksum header
* Full audit trail in download_audit table

FIX NOTES
---------
BUG-09  `range: Optional[str] = Header(None)` — `range` is a Python built-in.
        Shadowing it causes linting errors and confusing stack traces.
        Renamed to `range_header`.

BUG-10  asyncio.get_event_loop() is deprecated since Python 3.10 and raises a
        DeprecationWarning (3.10) / RuntimeError (3.12) when called from a
        coroutine.  Replaced with asyncio.get_running_loop().

BUG-11  Mobile jobs were never marked 'completed'. The download stream finishes
        but complete_mobile_job() was never called. Added the call at the end of
        the _stream() generator so the job transitions properly.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from backend.config import (
    SECRET_KEY, MEDIA_ROOT,
    MAX_CONCURRENT_MOBILE_DOWNLOADS,
    MOBILE_THROTTLE_KBPS,
    MAX_DAILY_DOWNLOADS_PER_IP,
    DOWNLOAD_TOKEN_TTL,
    SERVER_BASE_URL,
)
from backend.database import db_cursor, get_setting
from backend.media_library import get_media_by_id

logger = logging.getLogger("smartcopy.mobile")

router = APIRouter(prefix="/api", tags=["mobile"])

# ─── Global semaphore management ──────────────────────────────────────────────
_sem_state = {"sem": None, "limit": 0}

def _get_semaphore() -> asyncio.Semaphore:
    limit = int(get_setting("max_concurrent_mobile_downloads", str(MAX_CONCURRENT_MOBILE_DOWNLOADS)))
    if _sem_state["sem"] is None or _sem_state["limit"] != limit:
        _sem_state["sem"]   = asyncio.Semaphore(limit)
        _sem_state["limit"] = limit
    return _sem_state["sem"]


# ─── Token helpers ────────────────────────────────────────────────────────────

class TokenError(Exception):
    pass


def _sign(payload: dict) -> str:
    body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()
    sig = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def _verify(token: str) -> dict:
    try:
        body, sig = token.rsplit(".", 1)
    except ValueError:
        raise TokenError("malformed token")

    expected = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise TokenError("invalid signature")

    padded = body + "=" * (-len(body) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        raise TokenError("corrupt payload")

    if payload.get("exp", 0) < time.time():
        raise TokenError("token expired")

    return payload


def issue_download_token(
    job_id: str,
    media_id: str,
    ttl_seconds: int = DOWNLOAD_TOKEN_TTL,
) -> tuple[str, str]:
    """Create a single-use signed download token. Returns (token_str, nonce)."""
    nonce = uuid.uuid4().hex
    payload = {
        "job_id":   job_id,
        "media_id": media_id,
        "nonce":    nonce,
        "iat":      int(time.time()),
        "exp":      int(time.time()) + ttl_seconds,
    }
    return _sign(payload), nonce


def persist_token(nonce: str, job_id: str, media_id: str, expires_at: float):
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO download_tokens (id, nonce, job_id, media_id, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), nonce, job_id, media_id, expires_at))


# ─── Throttled async generator ────────────────────────────────────────────────

async def _throttled_chunks(
    file_path: Path,
    start: int,
    end: int,
    chunk_size: int = 65536,
    throttle_kbps: int = 0,
) -> AsyncGenerator[bytes, None]:
    bps = throttle_kbps * 1024 if throttle_kbps else 0
    # FIX BUG-10: get_event_loop() deprecated in 3.10+; use get_running_loop()
    loop = asyncio.get_running_loop()

    with open(file_path, "rb") as f:
        f.seek(start)
        remaining = end - start
        window_start = time.monotonic()
        window_sent = 0

        while remaining > 0:
            to_read = min(chunk_size, remaining)
            chunk = await loop.run_in_executor(None, f.read, to_read)
            if not chunk:
                break
            yield chunk
            remaining -= len(chunk)

            if bps:
                window_sent += len(chunk)
                elapsed  = time.monotonic() - window_start
                expected = window_sent / bps
                if expected > elapsed:
                    await asyncio.sleep(expected - elapsed)
                if time.monotonic() - window_start >= 1.0:
                    window_start = time.monotonic()
                    window_sent  = 0


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/download/{job_id}")
async def download_file(
    job_id:  str,
    token:   str,
    request: Request,
    # FIX BUG-09: was `range` which shadows Python's built-in range(). Renamed.
    range_header: Optional[str] = Header(None, alias="range"),
):
    client_ip = request.client.host if request.client else "unknown"

    # 1. Verify token
    try:
        payload = _verify(token)
    except TokenError as e:
        raise HTTPException(401, str(e))

    if payload["job_id"] != job_id:
        raise HTTPException(401, "token/job mismatch")

    nonce = payload["nonce"]

    # 2. Check single-use nonce
    with db_cursor() as cur:
        cur.execute("SELECT id, used FROM download_tokens WHERE nonce=?", (nonce,))
        tok = cur.fetchone()
    if not tok:
        raise HTTPException(401, "token not issued by server")
    if tok["used"]:
        logger.warning({"event": "token_replay", "nonce": nonce[:8], "ip": client_ip})
        raise HTTPException(401, "token already used")

    # 3. Per-IP daily quota
    since = time.time() - 86400
    with db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as cnt FROM download_audit
            WHERE ip=? AND started_at>=? AND status='completed'
        """, (client_ip, since))
        daily_count = cur.fetchone()["cnt"]
    if daily_count >= MAX_DAILY_DOWNLOADS_PER_IP:
        raise HTTPException(429, "daily download quota exceeded")

    # 4. Load media
    media = get_media_by_id(payload["media_id"])
    if not media:
        raise HTTPException(404, "media not found")

    file_path = Path(media["path"])
    
    # SECURITY: Validate path is under MEDIA_ROOT to prevent traversal
    from backend.security import safe_path_under_root
    if not safe_path_under_root(str(file_path), str(MEDIA_ROOT)):
        logger.error({"event": "path_traversal_attempt", "path": str(file_path), "ip": client_ip})
        raise HTTPException(403, "Invalid file path")
    
    if not file_path.exists():
        raise HTTPException(500, "media file not available on disk")

    file_size = file_path.stat().st_size

    # 5. Mark token used (atomic)
    with db_cursor() as cur:
        cur.execute("""
            UPDATE download_tokens SET used=1, used_at=?, used_by_ip=? WHERE nonce=?
        """, (time.time(), client_ip, nonce))

    # 6. Parse Range header
    start, end, status_code = 0, file_size, 200
    if range_header:    # FIX BUG-09: was `range`
        try:
            unit, rng = range_header.split("=")
            r_start, r_end = rng.strip().split("-")
            start       = int(r_start) if r_start else 0
            end         = int(r_end) + 1 if r_end else file_size
            end         = min(end, file_size)
            status_code = 206
        except Exception:
            raise HTTPException(416, "invalid Range header")

    content_length = end - start

    # 7. Compute checksum
    sha256 = await _file_sha256(file_path)

    # 8. Audit record
    audit_id = uuid.uuid4().hex
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO download_audit
                (id, job_id, media_id, ip, nonce, file_size, byte_start, byte_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (audit_id, job_id, media["id"], client_ip, nonce,
              file_size, start, end))

    sem = _get_semaphore()

    async def _stream():
        async with sem:
            t0, sent = time.monotonic(), 0
            try:
                throttle = int(get_setting("mobile_throttle_kbps", str(MOBILE_THROTTLE_KBPS)))
                async for chunk in _throttled_chunks(
                    file_path, start, end, throttle_kbps=throttle
                ):
                    sent += len(chunk)
                    yield chunk
            except Exception as exc:
                with db_cursor() as cur:
                    cur.execute("""
                        UPDATE download_audit
                        SET status='failed', error=?, finished_at=? WHERE id=?
                    """, (str(exc), time.time(), audit_id))
                # FIX BUG-11: mark the job as failed when stream errors
                from backend.queue_engine import queue_engine
                await queue_engine.complete_mobile_job(job_id, False, str(exc))
                return

            elapsed = time.monotonic() - t0
            with db_cursor() as cur:
                cur.execute("""
                    UPDATE download_audit
                    SET status='completed', bytes_sent=?, elapsed=?, finished_at=? WHERE id=?
                """, (sent, elapsed, time.time(), audit_id))
            logger.info({"event": "download_complete",
                         "job_id": job_id, "bytes": sent, "elapsed": round(elapsed, 2)})

            # FIX BUG-11: mark the job completed now that the stream has finished
            from backend.queue_engine import queue_engine
            await queue_engine.complete_mobile_job(job_id, True)

    ext  = Path(media["path"]).suffix
    name = media.get("name", "media")
    headers = {
        "Content-Length":    str(content_length),
        "Accept-Ranges":     "bytes",
        "X-Checksum-SHA256": sha256,
        "Content-Disposition": f'attachment; filename="{name}{ext}"',
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end - 1}/{file_size}"

    return StreamingResponse(
        _stream(),
        status_code=status_code,
        media_type="application/octet-stream",
        headers=headers,
    )


@router.post("/admin/issue_download_token")
async def admin_issue_token(body: dict):
    """Admin: issue a single-use download token for a mobile job."""
    job_id   = body.get("job_id")
    media_id = body.get("media_id")
    ttl      = int(body.get("ttl_seconds", DOWNLOAD_TOKEN_TTL))

    if not job_id or not media_id:
        raise HTTPException(400, "job_id and media_id required")

    with db_cursor() as cur:
        cur.execute("SELECT id FROM jobs WHERE id=?", (job_id,))
        if not cur.fetchone():
            raise HTTPException(404, "job not found")

    token_str, nonce = issue_download_token(job_id, media_id, ttl)
    persist_token(nonce, job_id, media_id, time.time() + ttl)

    download_url = f"{SERVER_BASE_URL}/api/download/{job_id}?token={token_str}"
    return {
        "token":        token_str,
        "nonce":        nonce,
        "download_url": download_url,
        "expires_in":   ttl,
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _file_sha256(path: Path) -> str:
    # FIX BUG-10: use get_running_loop() instead of deprecated get_event_loop()
    loop = asyncio.get_running_loop()

    def _compute():
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while chunk := f.read(1 << 20):
                h.update(chunk)
        return h.hexdigest()

    return await loop.run_in_executor(None, _compute)
