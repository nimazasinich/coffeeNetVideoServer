"""
SmartCopy Pro — Main FastAPI Application
Full route set: media, drives, jobs (USB + mobile), admin, auth,
payments (Stripe + manual), agent hub, WebSocket.

FIX NOTES
---------
BUG-01  create_job was `def` (sync) but called asyncio.create_task → RuntimeError
        in thread-executor context. Changed to `async def`.
BUG-02  CORS allow_origins="*" with allow_credentials=True is rejected by all
        browsers (CORS spec §3.2). Changed allow_credentials=False.
BUG-03  admin_cancel_job lacked UUID validation. Added.
"""
import asyncio
import logging
import re
from pathlib import Path
from typing import Optional

from fastapi import (
    FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect,
    Request, Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.logging_config import setup_logging
setup_logging()

from backend.config import CORS_ORIGINS, FRONTEND_DIR, MEDIA_ROOT  # noqa: E402
from backend.database import init_db, recover_stale_jobs, db_cursor  # noqa: E402
from backend.media_library import (  # noqa: E402
    get_media_list, get_media_by_id, start_periodic_scan, scan_library
)
from backend.queue_engine import queue_engine  # noqa: E402
from backend.usb_detector import drive_registry  # noqa: E402
from backend.websocket_hub import hub  # noqa: E402
from backend.security import (  # noqa: E402
    verify_password, create_access_token, create_refresh_token,
    verify_refresh_token, revoke_refresh_tokens_for_user,
    get_current_admin, require_admin_role, ensure_default_admin,
    rate_limit_jobs, rate_limit_media, rate_limit_login,
    hash_password, JWT_EXPIRY_MINUTES,
)
from backend.database import write_audit_log  # noqa: E402
from backend.models import (  # noqa: E402
    CreateJobRequest, LoginRequest, TokenResponse,
    ChangePasswordRequest, UpdatePricingRequest,
    SettingUpdate,
)
# Sub-routers for additional features
from backend.mobile_delivery import router as mobile_router  # noqa: E402
from backend.payments       import router as payment_router  # noqa: E402
from backend.agent_hub      import router as agent_ws_router, agent_router  # noqa: E402
from backend.routers.qr_router       import router as qr_router  # noqa: E402
from backend.routers.featured_router import router as featured_router  # noqa: E402
# PHASE-B.2: Register assets router for poster ingestion
from backend.routers.assets_router import router as assets_router  # noqa: E402

logger = logging.getLogger("smartcopy.main")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "SmartCopy Pro API",
    version     = "2.0.0",
    description = "USB + Mobile media delivery system with Stripe payments and agent support",
    docs_url    = "/api/docs",
    redoc_url   = None,
)

# ─── Middleware ────────────────────────────────────────────────────────────────

# FIX BUG-02: allow_credentials=True with allow_origins=["*"] is invalid per CORS spec.
# Browsers reject such requests. We now use allow_credentials=False for wildcard OR
# keep credentials only when specific origins are configured.
_specific_origins = [o for o in CORS_ORIGINS if o != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins     = CORS_ORIGINS,
    allow_credentials = bool(_specific_origins),   # only True when real origins are listed
    allow_methods     = ["GET", "POST", "DELETE", "PUT", "PATCH"],
    allow_headers     = ["Content-Type", "Authorization", "X-CSRF-Token"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["X-XSS-Protection"]        = "1; mode=block"
    response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' ws: wss:;"
    )
    return response


# ─── Include sub-routers ──────────────────────────────────────────────────────

app.include_router(mobile_router)
app.include_router(qr_router)
app.include_router(featured_router)
# PHASE-B.2: Assets router (poster upload endpoint)
app.include_router(assets_router)

# PHASE-B.2: Mount static poster images at /posters/:size/:filename
from pathlib import Path as _Path
_POSTERS = _Path("public/posters")
_POSTERS.mkdir(parents=True, exist_ok=True)
app.mount("/posters", StaticFiles(directory=str(_POSTERS)), name="posters")
app.include_router(payment_router)
app.include_router(agent_ws_router)
app.include_router(agent_router)


# ─── Startup / Shutdown ───────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    import time
    app.state.startup_time = time.time()
    
    init_db()
    recover_stale_jobs()
    ensure_default_admin()
    scan_library()

    asyncio.create_task(queue_engine.run())
    asyncio.create_task(drive_registry.start_polling())
    asyncio.create_task(start_periodic_scan())
    asyncio.create_task(_periodic_cleanup())

    # Detect IP change on startup
    from backend.qr import detect_ip_change
    detect_ip_change()

    logger.info({"event": "server_started", "media_root": str(MEDIA_ROOT)})


async def _periodic_cleanup():
    """Run cleanup tasks every 6 hours; stale-agent purge every 2 minutes."""
    from backend.cleanup_tokens import cleanup_expired_tokens, cleanup_rate_limiter_memory
    from backend.security import _limiter

    tick = 0
    while True:
        await asyncio.sleep(120)  # every 2 minutes
        tick += 1
        try:
            # Purge agents that haven't pinged in STALE_AGENT_TTL seconds
            from backend.agent_hub import hub as agent_hub
            await agent_hub.purge_stale_agents()
        except Exception as e:
            logger.error({"event": "stale_agent_purge_error", "error": str(e)})

        if tick % 180 == 0:  # every 6 hours (180 × 2 min)
            try:
                cleanup_expired_tokens(days_to_keep=7)
                cleanup_rate_limiter_memory(_limiter)
                logger.info({"event": "periodic_cleanup_complete"})
            except Exception as e:
                logger.error({"event": "periodic_cleanup_error", "error": str(e)})


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    """Health check endpoint with system metrics."""
    import time
    from backend.agent_hub import hub as agent_hub
    
    # Calculate uptime
    uptime_seconds = int(time.time() - app.state.startup_time) if hasattr(app.state, 'startup_time') else 0
    
    # Get queue metrics
    queue_depth = len(queue_engine.get_queue(include_completed=False))
    active_jobs = queue_engine._active_count
    
    # Get database size
    from backend.config import DB_PATH
    db_size_mb = round(DB_PATH.stat().st_size / 1_048_576, 2) if DB_PATH.exists() else 0
    
    # Get disk space
    import shutil
    try:
        usage = shutil.disk_usage(str(MEDIA_ROOT))
        disk_free_gb = round(usage.free / (1024**3), 2)
        disk_total_gb = round(usage.total / (1024**3), 2)
    except Exception as e:
        logger.error({"event": "disk_usage_error", "error": str(e)})
        disk_free_gb = 0
        disk_total_gb = 0
    
    return {
        "status":        "ok",
        "service":       "SmartCopy Pro",
        "version":       "2.0.0",
        "uptime_seconds": uptime_seconds,
        "agents_online": len(agent_hub.list_agents()),
        "ws_clients":    hub.connection_count,
        "queue_depth":   queue_depth,
        "active_jobs":   active_jobs,
        "db_size_mb":    db_size_mb,
        "disk_free_gb":  disk_free_gb,
        "disk_total_gb": disk_total_gb,
    }


# ─── Media ────────────────────────────────────────────────────────────────────

@app.get("/api/media")
def list_media(
    category: Optional[str] = Query(None, pattern="^(movie|series)$"),
    search:   Optional[str] = Query(None, max_length=100),
    _: None = Depends(rate_limit_media),
):
    if search:
        search = re.sub(r'[^\w\s\-\.\(\)]', '', search)[:100]
    items = get_media_list(category=category, search=search)
    return {"items": items, "total": len(items)}


@app.get("/api/media/{media_id}")
def get_media(media_id: str, _: None = Depends(rate_limit_media)):
    import uuid as _uuid
    try:
        _uuid.UUID(media_id)
    except ValueError:
        raise HTTPException(400, "Invalid media ID")
    media = get_media_by_id(media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    media.pop("path", None)
    media.pop("checksum", None)
    return media


# ─── Drives ───────────────────────────────────────────────────────────────────

@app.get("/api/drives")
def list_drives():
    from backend.agent_hub import hub as agent_hub

    # 1. Local drives
    drives = drive_registry.get_drive_list()
    enriched = []
    with db_cursor() as cur:
        for d in drives:
            cur.execute("SELECT locked_by_job FROM drives WHERE id=?", (d["id"],))
            row = cur.fetchone()
            d["is_locked"] = bool(row and row["locked_by_job"]) if row else False
            d["is_agent"] = False
            enriched.append(d)

    # 2. Agent drives
    agent_drives = agent_hub.get_all_agent_drives()
    for ad in agent_drives:
        with db_cursor() as cur:
            cur.execute("SELECT locked_by_job FROM drives WHERE id=?", (ad["id"],))
            row = cur.fetchone()
            ad["is_locked"] = bool(row and row["locked_by_job"]) if row else False
        enriched.append(ad)

    return {"drives": enriched}


# ─── Pricing ──────────────────────────────────────────────────────────────────

@app.get("/api/pricing")
def get_public_pricing():
    """Public endpoint for pricing tiers."""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM pricing ORDER BY max_size_gb")
        tiers = []
        for row in cur.fetchall():
            tier = dict(row)
            tier["id"] = str(tier["id"])  # Convert to string for frontend
            tiers.append(tier)
    return {"tiers": tiers}


# ─── License enforcement ─────────────────────────────────────────────────────

def _check_license_for_job_creation():
    """
    Enforce license restrictions before creating a job.
    - No license file: allow up to 5 concurrent pending/active jobs (free tier).
    - Invalid/expired license: block all new jobs.
    - Valid license: honour tier limits.
    Raises HTTPException(403) when the limit is exceeded.
    """
    from backend.license import read_license
    valid, data, msg = read_license()

    # No license file → free/demo mode with a hard job cap
    if data is None:
        _enforce_job_cap(max_jobs=5, tier="demo")
        return

    # License file exists but invalid/expired
    if not valid:
        raise HTTPException(403, f"License invalid: {msg}. Contact support to renew.")

    # Valid license — check tier limits
    tier = (data.get("tier") or "basic").lower()
    tier_caps = {"basic": 10, "standard": 50, "professional": 200, "enterprise": 9999}
    cap = tier_caps.get(tier, 10)
    _enforce_job_cap(max_jobs=cap, tier=tier)


def _enforce_job_cap(max_jobs: int, tier: str):
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM jobs WHERE status IN ('pending','queued','active','dispatching')"
        )
        current = cur.fetchone()["cnt"]
    if current >= max_jobs:
        raise HTTPException(
            429,
            f"Job limit reached for '{tier}' tier ({max_jobs} concurrent jobs). "
            "Please wait for current jobs to complete or upgrade your license."
        )




# FIX BUG-01: was `def create_job` (sync) calling asyncio.create_task → RuntimeError.
# FastAPI runs sync endpoints in a thread executor, so asyncio.create_task fails there.
# Changed to `async def` so it runs on the event loop directly.
@app.post("/api/jobs", status_code=201)
async def create_job(
    body:    CreateJobRequest,
    request: Request,
    _:       None = Depends(rate_limit_jobs),
):
    try:
        # ── License enforcement ───────────────────────────────────────────
        _check_license_for_job_creation()

        customer_ip = request.client.host if request.client else None
        job = queue_engine.create_job(
            media_id      = body.media_id,
            drive_id      = body.drive_id,
            delivery_type = body.delivery_type.value,
            payment_mode  = body.payment_mode.value,
            customer_ip   = customer_ip,
            priority      = body.priority,
        )
        # Safe to call now because we are on the event loop
        asyncio.create_task(hub.broadcast("job.created", job))
        return job
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(409, str(e))


@app.get("/api/jobs")
def list_jobs(all: bool = Query(False)):
    return {"jobs": queue_engine.get_queue(include_completed=all)}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")
    job = queue_engine.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str):
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")
    cancelled = await queue_engine.cancel_job(job_id)
    if not cancelled:
        raise HTTPException(404, "Job not found or not cancellable")
    return {"status": "cancelled", "job_id": job_id}


# ─── Media streaming (for agent downloads) ────────────────────────────────────

@app.get("/api/media/{media_id}/stream")
async def stream_media(media_id: str, agent_token: str = Query(...)):
    """
    Endpoint for Windows agents to download media files.

    FIX BUG-25: The original endpoint accepted any non-empty agent_token string
    without verification. Any client that knew a media_id UUID could download the
    full file unauthenticated. The token must now correspond to a registered,
    approved, and currently-connected agent — validated against the AgentHub's
    in-memory connection map (populated on WebSocket registration handshake).
    If the agent is not in the connected set, the request is rejected with 403.
    """
    from backend.agent_hub import hub as agent_hub

    # agent_token == agent_id sent by the SmartCopy Agent client
    # Validate it exists in the hub's in-memory connection map
    # (only agents that have completed the WS register handshake are present)
    connected_ids = {a["agent_id"] for a in agent_hub.list_agents()}
    if agent_token not in connected_ids:
        # Also accept tokens that match registered approved agents in DB
        # (edge case: agent reconnecting while streaming)
        with db_cursor() as cur:
            cur.execute(
                "SELECT agent_id FROM agents WHERE agent_id=? AND status='approved'",
                (agent_token,)
            )
            row = cur.fetchone()
        if not row:
            logger.warning({
                "event": "agent_stream_unauthorized",
                "agent_token": agent_token[:8] + "...",
                "media_id": media_id,
            })
            raise HTTPException(403, "Agent not authorized to stream media")

    with db_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key='media_server_url'")
        row = cur.fetchone()
        media_server_url = row["value"] if row else None

    if media_server_url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(
            url=f"{media_server_url.rstrip('/')}/api/media/{media_id}/stream?agent_token={agent_token}"
        )

    media = get_media_by_id(media_id)
    if not media:
        raise HTTPException(404, "Media not found")

    file_path = Path(media["path"])

    from backend.security import safe_path_under_root
    if not safe_path_under_root(str(file_path), str(MEDIA_ROOT)):
        logger.error({"event": "path_traversal_attempt", "media_id": media_id, "path": str(file_path)})
        raise HTTPException(403, "Invalid file path")

    if not file_path.exists():
        raise HTTPException(500, "File not available")

    return FileResponse(
        path=str(file_path),
        filename=f"{media['name']}.{media['extension']}",
        headers={"X-Filename": f"{media['name']}.{media['extension']}"},
    )


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/api/admin/login", response_model=TokenResponse)
def admin_login(body: LoginRequest, _: None = Depends(rate_limit_login)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT password_hash, role FROM admin_users WHERE username=?",
            (body.username,)
        )
        row = cur.fetchone()

    dummy_hash  = "$2b$12$invalidhashforusernotfound000000000000000000000"
    stored_hash = row["password_hash"] if row else dummy_hash
    valid = verify_password(body.password, stored_hash) and row is not None

    if not valid:
        logger.warning({"event": "login_failed", "username": body.username})
        raise HTTPException(401, "Invalid credentials")

    token         = create_access_token(body.username, row["role"])
    refresh_token = create_refresh_token(body.username, row["role"])

    logger.info({"event": "login_success", "username": body.username})
    write_audit_log("admin.login", actor=body.username)
    return {
        "access_token":  token,
        "token_type":    "bearer",
        "expires_in":    JWT_EXPIRY_MINUTES * 60,
        "refresh_token": refresh_token,
    }


# FIX BUG-22: Refresh token endpoint was configured (JWT_REFRESH_EXPIRY_DAYS=7)
# but never implemented.  Admins were forced to re-login every 15 minutes.
@app.post("/api/admin/refresh")
def refresh_access_token(body: dict):
    """
    Exchange a valid refresh token for a new access token.
    Body: { "refresh_token": "..." }
    """
    token_str = body.get("refresh_token", "")
    if not token_str:
        raise HTTPException(400, "refresh_token required")

    payload = verify_refresh_token(token_str)
    if not payload:
        raise HTTPException(401, "Invalid or expired refresh token")

    new_access = create_access_token(payload["sub"], payload["role"])
    return {
        "access_token": new_access,
        "token_type":   "bearer",
        "expires_in":   JWT_EXPIRY_MINUTES * 60,
    }


@app.post("/api/admin/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(get_current_admin)
):
    with db_cursor() as cur:
        cur.execute(
            "SELECT password_hash FROM admin_users WHERE username=?",
            (user["sub"],)
        )
        row = cur.fetchone()
        if not row or not verify_password(body.old_password, row["password_hash"]):
            raise HTTPException(400, "Current password incorrect")
        cur.execute(
            "UPDATE admin_users SET password_hash=? WHERE username=?",
            (hash_password(body.new_password), user["sub"])
        )
    # Revoke all outstanding refresh tokens so old sessions cannot re-authenticate
    revoke_refresh_tokens_for_user(user["sub"])
    write_audit_log("admin.password_changed", actor=user["sub"])
    return {"status": "ok"}


# ─── Admin dashboard / reports ────────────────────────────────────────────────

@app.get("/api/admin/dashboard")
def admin_dashboard(user: dict = Depends(require_admin_role)):
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='completed' AND date(completed_at)=date('now')")
        copies_today = cur.fetchone()["cnt"]

        cur.execute("SELECT COALESCE(SUM(price_charged),0) as rev FROM sales WHERE date(timestamp)=date('now')")
        revenue_today = cur.fetchone()["rev"]

        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status IN ('pending','active','queued')")
        queue_depth = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM media")
        media_count = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='failed' AND date(completed_at)=date('now')")
        failures_today = cur.fetchone()["cnt"]

    from backend.agent_hub import hub as agent_hub
    return {
        "copies_today":   copies_today,
        "revenue_today":  revenue_today,
        "queue_depth":    queue_depth,
        "media_count":    media_count,
        "failures_today": failures_today,
        "active_workers": queue_engine._active_count,
        "ws_connections": hub.connection_count,
        "agents_online":  len(agent_hub.list_agents()),
    }


@app.get("/api/dashboard/overview")
def dashboard_overview(user: dict = Depends(require_admin_role)):
    """Dashboard snapshot for frontend v5 Neo Tactile design."""
    import time
    import psutil
    from backend.agent_hub import hub as agent_hub
    
    # System stats
    cpu_percent = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage(str(MEDIA_ROOT))
    load_avg = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0, 0, 0]
    uptime_seconds = int(time.time() - app.state.startup_time) if hasattr(app.state, 'startup_time') else 0
    
    # Job stats
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='active'")
        active = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='queued'")
        queued = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='pending'")
        pending = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='completed'")
        completed = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='failed'")
        failed = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='cancelled'")
        cancelled = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status='completed' AND date(completed_at)=date('now')")
        today_completed = cur.fetchone()["cnt"]
        
        cur.execute("SELECT COALESCE(SUM(price_charged),0) as rev FROM sales WHERE date(timestamp)=date('now')")
        today_revenue = cur.fetchone()["rev"]
        
        cur.execute("""
            SELECT COALESCE(SUM(j.bytes_written),0) as bytes 
            FROM jobs j 
            WHERE j.status='completed' AND date(j.completed_at)=date('now')
        """)
        today_bytes = cur.fetchone()["bytes"]
        
        # Active users (jobs with progress)
        cur.execute("""
            SELECT 
                j.id, j.media_id, j.status, j.delivery_type, j.progress,
                j.bytes_written, j.total_bytes, j.throughput_mbps,
                j.drive_id, j.created_at, j.started_at,
                m.name as media_name, m.size_bytes as media_size_bytes,
                s.price_charged as price_usd
            FROM jobs j
            LEFT JOIN media m ON m.id = j.media_id
            LEFT JOIN sales s ON s.job_id = j.id
            WHERE j.status IN ('active', 'queued', 'pending')
            ORDER BY j.priority DESC, j.created_at ASC
            LIMIT 20
        """)
        active_users = []
        for row in cur.fetchall():
            job = dict(row)
            job["progress_pct"] = round(job["progress"] * 100, 1) if job["progress"] else 0
            job["speed_mbps"] = round(job["throughput_mbps"], 1) if job["throughput_mbps"] else 0
            job["media_size_gb"] = round(job["media_size_bytes"] / (1024**3), 2) if job["media_size_bytes"] else 0
            
            # Calculate elapsed time
            if job["started_at"]:
                from datetime import datetime
                started = datetime.fromisoformat(job["started_at"])
                elapsed = (datetime.now() - started).total_seconds()
                job["elapsed_s"] = int(elapsed)
            else:
                job["elapsed_s"] = 0
            
            active_users.append(job)
    
    # Agent stats
    agents = agent_hub.list_agents()
    agent_list = []
    with db_cursor() as cur:
        for a in agents:
            cur.execute("SELECT * FROM agents WHERE agent_id=?", (a["agent_id"],))
            db_agent = cur.fetchone()
            if db_agent:
                agent_list.append({
                    "agent_id": a["agent_id"],
                    "hostname": db_agent["hostname"],
                    "status": "online",
                    "last_seen": a.get("last_seen", ""),
                    "drives_count": len(a.get("drives", [])),
                    # FIX: use correct per-agent active job count from hub
                    "jobs_active": a.get("jobs_active", 0),
                    "version": db_agent["version"],
                    "ip": a.get("ip", ""),
                })
    
    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "system": {
            "cpu_percent": round(cpu_percent, 1),
            "ram_percent": round(mem.percent, 1),
            "ram_used_gb": round(mem.used / (1024**3), 2),
            "ram_total_gb": round(mem.total / (1024**3), 2),
            "disk_percent": round(disk.percent, 1),
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "uptime_seconds": uptime_seconds,
            "load_avg": list(load_avg),
            "cpu_count": psutil.cpu_count(),
        },
        "jobs": {
            "active": active,
            "queued": queued,
            "pending": pending,
            "completed": completed,
            "failed": failed,
            "cancelled": cancelled,
            "today_completed": today_completed,
            "today_revenue_usd": round(today_revenue, 2),
            "today_bytes_copied": today_bytes,
        },
        "agents": agent_list,
        "active_users": active_users,
    }


@app.get("/api/dashboard/throughput")
def dashboard_throughput(
    minutes: int = Query(30, le=1440),
    user: dict = Depends(require_admin_role)
):
    """Per-minute bytes copied over the last N minutes."""
    with db_cursor() as cur:
        cur.execute("""
            SELECT
                strftime('%Y-%m-%dT%H:%M', completed_at) as minute,
                COALESCE(SUM(bytes_written), 0) as bytes
            FROM jobs
            WHERE status='completed'
              AND completed_at >= datetime('now', ?)
            GROUP BY minute
            ORDER BY minute ASC
        """, (f"-{minutes} minutes",))
        series = [dict(r) for r in cur.fetchall()]
    return {"series": series, "window_minutes": minutes}



# FIX BUG-23: admin_sales was missing its @app.get decorator, making
# /api/admin/sales return 404 every time.  Added decorator.
@app.get("/api/admin/sales")
def admin_sales(
    date: Optional[str] = None,
    user: dict = Depends(require_admin_role)
):
    with db_cursor() as cur:
        if date:
            cur.execute("""
                SELECT s.*, m.name as media_name
                FROM sales s JOIN media m ON m.id = s.media_id
                WHERE date(s.timestamp) = ?
                ORDER BY s.timestamp DESC
            """, (date,))
        else:
            cur.execute("""
                SELECT s.*, m.name as media_name
                FROM sales s JOIN media m ON m.id = s.media_id
                ORDER BY s.timestamp DESC LIMIT 500
            """)
        rows = [dict(r) for r in cur.fetchall()]
    return {"sales": rows, "total": len(rows)}


@app.get("/api/admin/reports/daily")
def daily_reports(
    days: int = Query(30, le=90),
    user: dict = Depends(require_admin_role)
):
    with db_cursor() as cur:
        cur.execute("""
            SELECT
                date(timestamp) as date,
                COUNT(*) as total_copies,
                COALESCE(SUM(price_charged),0) as total_revenue
            FROM sales
            WHERE timestamp >= datetime('now', ?)
            GROUP BY date(timestamp)
            ORDER BY date DESC
        """, (f"-{days} days",))
        rows = [dict(r) for r in cur.fetchall()]
    return {"reports": rows}


# ─── Admin pricing ────────────────────────────────────────────────────────────

@app.get("/api/admin/pricing")
def get_pricing(user: dict = Depends(require_admin_role)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM pricing ORDER BY max_size_gb")
        return {"tiers": [dict(r) for r in cur.fetchall()]}


@app.put("/api/admin/pricing")
def update_pricing(
    body: UpdatePricingRequest,
    user: dict = Depends(require_admin_role)
):
    with db_cursor() as cur:
        cur.execute("DELETE FROM pricing")
        for tier in body.tiers:
            cur.execute(
                "INSERT INTO pricing (name, max_size_gb, price_usd) VALUES (?,?,?)",
                (tier.name, tier.max_size_gb, tier.price_usd)
            )
    return {"status": "updated", "count": len(body.tiers)}


# ─── Admin media management ───────────────────────────────────────────────────

@app.patch("/api/admin/media/{media_id}/copyable")
def toggle_copyable(
    media_id: str,
    body:     dict,
    user: dict = Depends(require_admin_role)
):
    import uuid as _uuid
    try:
        _uuid.UUID(media_id)
    except ValueError:
        raise HTTPException(400, "Invalid media ID")
    is_copyable = int(bool(body.get("is_copyable", True)))
    with db_cursor() as cur:
        cur.execute("UPDATE media SET is_copyable=? WHERE id=?", (is_copyable, media_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Media not found")
    return {"status": "ok", "is_copyable": bool(is_copyable)}


@app.post("/api/admin/media/scan")
def trigger_scan(user: dict = Depends(require_admin_role)):
    count = scan_library()
    return {"status": "scanned", "files_found": count}


@app.get("/api/admin/media")
def admin_list_media(user: dict = Depends(require_admin_role)):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM media ORDER BY name")
        rows = [dict(r) for r in cur.fetchall()]
    return {"media": rows, "total": len(rows)}


# ─── Admin jobs management ────────────────────────────────────────────────────

@app.get("/api/admin/queue")
def admin_queue(user: dict = Depends(require_admin_role)):
    jobs = queue_engine.get_queue(include_completed=True)
    return {"jobs": jobs, "active_count": queue_engine._active_count}


@app.get("/api/admin/jobs")
def admin_jobs(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_admin_role)
):
    """Get all jobs with optional status filter."""
    with db_cursor() as cur:
        if status:
            cur.execute("""
                SELECT 
                    j.*, 
                    m.name as media_name,
                    m.size_bytes as media_size_bytes,
                    s.price_charged as price_usd
                FROM jobs j
                LEFT JOIN media m ON m.id = j.media_id
                LEFT JOIN sales s ON s.job_id = j.id
                WHERE j.status = ?
                ORDER BY j.created_at DESC
            """, (status,))
        else:
            cur.execute("""
                SELECT 
                    j.*, 
                    m.name as media_name,
                    m.size_bytes as media_size_bytes,
                    s.price_charged as price_usd
                FROM jobs j
                LEFT JOIN media m ON m.id = j.media_id
                LEFT JOIN sales s ON s.job_id = j.id
                ORDER BY j.created_at DESC
                LIMIT 500
            """)
        
        jobs = []
        for row in cur.fetchall():
            job = dict(row)
            job["progress_pct"] = round(job["progress"] * 100, 1) if job["progress"] else 0
            job["speed_mbps"] = round(job["throughput_mbps"], 1) if job["throughput_mbps"] else 0
            job["media_size_gb"] = round(job["media_size_bytes"] / (1024**3), 2) if job["media_size_bytes"] else 0
            jobs.append(job)
    
    return {"jobs": jobs}


# FIX BUG-03: admin_cancel_job lacked UUID validation, unlike the public endpoint.
@app.post("/api/admin/jobs/{job_id}/cancel")
async def admin_cancel_job(job_id: str, user: dict = Depends(require_admin_role)):
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")
    cancelled = await queue_engine.cancel_job(job_id)
    return {"status": "cancelled" if cancelled else "not_found"}


@app.post("/api/admin/jobs/{job_id}/deny")
async def admin_deny_job(job_id: str, user: dict = Depends(require_admin_role)):
    """Deny a pending request (same as cancel). Kept for clear admin UX."""
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")
    cancelled = await queue_engine.cancel_job(job_id)
    return {"status": "denied" if cancelled else "not_found"}


@app.post("/api/admin/jobs/{job_id}/priority")
def set_priority(
    job_id: str,
    body:   dict,
    user: dict = Depends(require_admin_role)
):
    priority = int(body.get("priority", 0))
    with db_cursor() as cur:
        cur.execute(
            "UPDATE jobs SET priority=? WHERE id=? AND status IN ('pending','queued')",
            (priority, job_id)
        )
    return {"status": "ok", "job_id": job_id, "priority": priority}


@app.post("/api/admin/jobs/{job_id}/confirm-payment")
def confirm_payment(
    job_id: str,
    body: dict,
    user: dict = Depends(require_admin_role)
):
    """Confirm manual payment and move job to queued status."""
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")
    
    payment_ref = body.get("payment_ref", "")
    
    with db_cursor() as cur:
        # Check job exists and is pending
        cur.execute("SELECT * FROM jobs WHERE id=?", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(404, "Job not found")
        
        if job["status"] != "pending":
            raise HTTPException(400, f"Job is {job['status']}, cannot confirm payment")
        
        # Update payment status
        cur.execute("""
            UPDATE payments 
            SET status='confirmed', 
                tx_ref=?, 
                confirmed_by=?,
                confirmed_at=strftime('%s','now')
            WHERE job_id=?
        """, (payment_ref, user["sub"], job_id))
        
        # Move job to queued
        cur.execute("UPDATE jobs SET status='queued' WHERE id=?", (job_id,))
        
        # Update sales record
        cur.execute("""
            UPDATE sales 
            SET payment_status='confirmed', payment_ref=?
            WHERE job_id=?
        """, (payment_ref, job_id))
    
    return {"status": "ok", "job_id": job_id}


# PHASE-B.3: Extended approve body to allow delivery_type/payment_mode override from admin UI
from pydantic import BaseModel as _BaseModel
class ApproveJobRequest(_BaseModel):
    delivery_type: Optional[str] = None   # 'usb' | 'mobile' override
    payment_mode:  Optional[str] = None   # 'manual' | 'online' override
    priority:      Optional[int] = None   # queue priority override

@app.post("/api/admin/jobs/{job_id}/approve")
async def approve_job(
    job_id: str,
    body:   ApproveJobRequest = ApproveJobRequest(),
    user:   dict = Depends(require_admin_role)
):
    # FIX BUG-24: was `def approve_job` (sync). FastAPI runs sync endpoints
    # in a thread executor which has no running asyncio event loop, so
    # asyncio.create_task(hub.broadcast(...)) at the end of this function
    # silently failed (RuntimeError: no running event loop in some Python
    # versions, or scheduled the task on an unrelated loop in others).
    # Changed to `async def` so create_task correctly targets the server loop.
    import uuid as _uuid
    try:
        _uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job ID")

    with db_cursor() as cur:
        cur.execute("SELECT status FROM jobs WHERE id=?", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(404, "Job not found")
        if job["status"] != "pending":
            raise HTTPException(400, f"Job is {job['status']}, cannot approve")

        # Build dynamic UPDATE — only override if explicitly provided
        updates = ["status='queued'"]
        params: list = []
        if body.delivery_type in ("usb", "mobile"):
            updates.append("delivery_type=?"); params.append(body.delivery_type)
        if body.payment_mode in ("manual", "online"):
            updates.append("payment_mode=?");  params.append(body.payment_mode)
        if body.priority is not None:
            updates.append("priority=?");      params.append(body.priority)
        params.append(job_id)
        cur.execute(f"UPDATE jobs SET {', '.join(updates)} WHERE id=?", params)

    asyncio.create_task(hub.broadcast("job.approved", {"job_id": job_id}))
    return {"status": "ok", "job_id": job_id}


# ─── Admin agents ─────────────────────────────────────────────────────────────

@app.get("/api/admin/agents")
def admin_list_agents(user: dict = Depends(require_admin_role)):
    from backend.agent_hub import hub as agent_hub
    online = {a["agent_id"] for a in agent_hub.list_agents()}
    with db_cursor() as cur:
        cur.execute("SELECT * FROM agents ORDER BY registered_at DESC")
        db_agents = [dict(r) for r in cur.fetchall()]
    for a in db_agents:
        a["online"] = a["agent_id"] in online
    return {"agents": db_agents, "online_count": len(online)}


# ─── Admin settings ───────────────────────────────────────────────────────────

@app.get("/api/admin/settings")
def get_settings(user: dict = Depends(require_admin_role)):
    with db_cursor() as cur:
        cur.execute("SELECT key, value FROM settings")
        return {"settings": {r["key"]: r["value"] for r in cur.fetchall()}}


@app.put("/api/admin/settings")
def update_setting(
    body: SettingUpdate,
    user: dict = Depends(require_admin_role)
):
    with db_cursor() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)",
            (body.key, body.value)
        )
    return {"status": "ok", "key": body.key}


# ─── Admin QR & License ───────────────────────────────────────────────────────
# QR endpoint lives in backend.routers.qr_router (included above).

@app.get("/api/admin/license")
def get_license_info(user: dict = Depends(require_admin_role)):
    from backend.license import get_license_state
    return get_license_state()


@app.post("/api/admin/license")
def upload_license(
    body: dict,
    user: dict = Depends(require_admin_role)
):
    from backend.license import save_license
    import json

    payload = body.get("license_key")
    if not payload:
        raise HTTPException(400, "Missing 'license_key' field")

    if isinstance(payload, dict):
        payload = json.dumps(payload)

    valid, msg = save_license(payload)
    if not valid:
        raise HTTPException(400, f"License invalid: {msg}")

    return {"status": "success", "message": "License applied successfully"}


# ─── WebSocket (customer-facing live updates) ─────────────────────────────────

@app.websocket("/ws/jobs")
async def websocket_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        drives = drive_registry.get_drive_list()
        await hub.send_to(ws, "state.init", {
            "drives": drives,
            "queue":  queue_engine.get_queue(),
        })
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text('{"event":"pong","payload":{}}')
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(ws)


# ─── Frontend Static Files ────────────────────────────────────────────────────

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Skip API and WS routes
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        
        # Check if file exists in FRONTEND_DIR
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        
        # Fallback to index.html for SPA routing
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        
        return JSONResponse({"error": "Frontend build not found"}, status_code=404)
else:
    @app.get("/")
    def root():
        return JSONResponse({
            "message": "SmartCopy Pro API running.",
            "docs":    "/api/docs",
            "health":  "/api/health",
        })
