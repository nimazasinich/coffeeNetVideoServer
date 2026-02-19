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

from backend.config import CORS_ORIGINS, FRONTEND_DIR, MEDIA_ROOT
from backend.database import init_db, recover_stale_jobs, db_cursor
from backend.media_library import (
    get_media_list, get_media_by_id, start_periodic_scan, scan_library
)
from backend.queue_engine import queue_engine
from backend.usb_detector import drive_registry
from backend.websocket_hub import hub
from backend.security import (
    verify_password, create_access_token, get_current_admin,
    require_admin_role, ensure_default_admin,
    rate_limit_jobs, rate_limit_media, rate_limit_login,
    hash_password, JWT_EXPIRY_MINUTES
)
from backend.models import (
    CreateJobRequest, LoginRequest, TokenResponse,
    ChangePasswordRequest, UpdatePricingRequest,
    ConfirmPaymentRequest, SettingUpdate,
)
# Sub-routers for additional features
from backend.mobile_delivery import router as mobile_router
from backend.payments       import router as payment_router
from backend.agent_hub      import router as agent_ws_router, agent_router
from backend.routers.qr_router       import router as qr_router
from backend.routers.featured_router import router as featured_router

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
    """Run cleanup tasks every 6 hours."""
    from backend.cleanup_tokens import cleanup_expired_tokens, cleanup_rate_limiter_memory
    from backend.security import _limiter
    
    while True:
        await asyncio.sleep(6 * 3600)  # 6 hours
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
    from pathlib import Path
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
    except:
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


# ─── Jobs ─────────────────────────────────────────────────────────────────────

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
    """Endpoint for Windows agents to download media files."""
    with db_cursor() as cur:
        cur.execute("SELECT value FROM settings WHERE key='media_server_url'")
        row = cur.fetchone()
        media_server_url = row["value"] if row else None

    if media_server_url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{media_server_url.rstrip('/')}/api/media/{media_id}/stream?agent_token={agent_token}")

    media = get_media_by_id(media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    
    file_path = Path(media["path"])
    
    # SECURITY: Validate path is under MEDIA_ROOT to prevent traversal
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

    token = create_access_token(body.username, row["role"])
    logger.info({"event": "login_success", "username": body.username})
    return {
        "access_token": token,
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
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
else:
    @app.get("/")
    def root():
        return JSONResponse({
            "message": "SmartCopy Pro API running.",
            "docs":    "/api/docs",
            "health":  "/api/health",
        })
