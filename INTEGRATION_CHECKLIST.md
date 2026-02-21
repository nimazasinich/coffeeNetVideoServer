# INTEGRATION_CHECKLIST.md
## SmartCopy Pro — Integration & Patching Guide
**Repo baseline scan:** `SmartCopy_Pro_v5_FINAL.zip`
**Backend:** Python 3.11 + FastAPI · **Frontend:** React 18 + TypeScript + Vite

---

## STATUS SUMMARY

| Feature | Status | Action Required |
|---|---|---|
| Delivery Type selector (USB/Mobile) in CopyModal | ✅ **DONE** | None — `CopyModal.tsx` already has toggle |
| Payment Mode selector (Manual/Online) in CopyModal | ✅ **DONE** | None — `CopyModal.tsx` already has toggle |
| Kanban cards show delivery_type | ✅ **DONE** | `JobQueuePanel.tsx` already renders it |
| Kanban cards show payment_mode | ✅ **DONE** | `JobQueuePanel.tsx` already renders it |
| Real WebSocket at `/ws/jobs` | ✅ **DONE** | `backend/websocket_hub.py` + `backend/main.py` |
| Approve endpoint `/api/admin/jobs/:id/approve` | ✅ **DONE** | `backend/main.py` line ~approve_job |
| Deny/Cancel endpoint | ✅ **DONE** | `/api/admin/jobs/:id/deny` and `/cancel` |
| Mobile delivery `/api/download/:token` | ✅ **DONE** | `backend/mobile_delivery.py` |
| Stripe payments | ✅ **DONE** | `backend/payments.py` |
| Agent hub endpoints `/api/agent/*` | ✅ **DONE** | `backend/agent_hub.py` |
| DB migration SQL | ✅ **DONE** | `scripts/migrate.sql` |
| **Poster ingestion endpoint** | ❌ **MISSING** | Create `backend/routers/assets_router.py` |
| **Poster import CLI** | ❌ **MISSING** | Create `scripts/import-posters.py` |
| **`media.poster_url` DB column** | ❌ **MISSING** | Add `ALTER TABLE` to migration |
| **audit_logs table** | ❌ **MISSING** | Add to migration |
| **config.example.json** | ❌ **MISSING** | Create from `backend/config.py` vars |
| **Dockerfile + docker-compose** | ❌ **MISSING** | Create |
| **Approve modal delivery_type param** | ⚠️ **PARTIAL** | Admin approve currently ignores delivery_type override — see §5 |
| **Frontend WS reconnect logic** | ⚠️ **CHECK** | Verify `SmartCopyContext.tsx` WS URL matches `/ws/jobs` |

---

## 1. File Placement

### New files to create

```
smartcopy_repo/
├── backend/
│   └── routers/
│       └── assets_router.py          ← NEW: poster upload endpoint
├── scripts/
│   └── import-posters.py             ← NEW: bulk poster import CLI
├── db/
│   └── migrations/
│       └── 002_poster_audit.sql      ← NEW: poster_url + audit_logs columns
├── config.example.json               ← NEW: operator env template
├── Dockerfile                        ← NEW: production container
├── docker-compose.dev.yml            ← NEW: local dev stack
├── smoke_check.sh                    ← NEW: non-assertive endpoint exerciser
├── INTEGRATION_CHECKLIST.md          ← THIS FILE
└── docs/
    ├── PHASE0_ARCHITECTURE.md        ← NEW: arch + threat model
    ├── DEPLOYMENT.md                 ← NEW: TLS + service install guide
    └── MIGRATION_PLAN.md             ← NEW: demo→real API transition
```

### Existing files to patch (minimal)

```
backend/main.py                       ← include assets_router; see §3
backend/routers/__init__.py           ← (no change needed, auto-import)
frontend_react/src/lib/api.ts         ← add approveWithOptions(); see §5
frontend_react/src/context/
  SmartCopyContext.tsx                ← verify WS URL; see §6
```

---

## 2. Database Migration (Phase-1)

Create `db/migrations/002_poster_audit.sql`:

```sql
BEGIN;

-- Add poster_url to existing media table
-- (table may be named 'media' or 'media_items' depending on DB version)
ALTER TABLE media ADD COLUMN poster_url VARCHAR(512);
ALTER TABLE media ADD COLUMN checksum_sha256 VARCHAR(64);

-- Unified audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36) PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type  VARCHAR(64)  NOT NULL,
    actor       VARCHAR(128),
    target_id   VARCHAR(36),
    detail      TEXT,
    ip          VARCHAR(64),
    created_at  REAL NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type    ON audit_logs(event_type);

-- Poster metadata
CREATE TABLE IF NOT EXISTS poster_assets (
    id           VARCHAR(36) PRIMARY KEY,
    media_id     VARCHAR(36) REFERENCES media(id),
    filename     VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type    VARCHAR(64),
    size_bytes   INTEGER,
    thumb_url    VARCHAR(512),
    card_url     VARCHAR(512),
    full_url     VARCHAR(512),
    created_at   REAL NOT NULL DEFAULT (unixepoch())
);

COMMIT;
```

**Run:** `sqlite3 data/smartcopy.db < db/migrations/002_poster_audit.sql`

---

## 3. Backend: Register Assets Router

**File:** `backend/main.py`
**After line:** `from backend.routers.featured_router import router as featured_router`

**Add:**
```python
from backend.routers.assets_router import router as assets_router
```

**After:** `app.include_router(featured_router)`

**Add:**
```python
app.include_router(assets_router)

# Static serving for posters
from fastapi.staticfiles import StaticFiles
from pathlib import Path
POSTERS_DIR = Path("public/posters")
POSTERS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/posters", StaticFiles(directory=str(POSTERS_DIR)), name="posters")
```

---

## 4. Backend: Approve with Delivery/Payment Override (§5 partial fix)

**File:** `backend/main.py`
**Function:** `approve_job` (around line with `@app.post("/api/admin/jobs/{job_id}/approve")`)

**Current body:**
```python
@app.post("/api/admin/jobs/{job_id}/approve")
def approve_job(job_id: str, user: dict = Depends(require_admin_role)):
    ...
    cur.execute("UPDATE jobs SET status='queued' WHERE id=?", (job_id,))
```

**Replace with:**
```python
class ApproveJobRequest(BaseModel):
    delivery_type: Optional[str] = None   # override from approve modal
    payment_mode:  Optional[str] = None   # override from approve modal
    priority:      Optional[int] = None

@app.post("/api/admin/jobs/{job_id}/approve")
def approve_job(
    job_id: str,
    body:   ApproveJobRequest = ApproveJobRequest(),
    user:   dict = Depends(require_admin_role)
):
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

        updates = ["status='queued'"]
        params  = []
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
```

---

## 5. Frontend: `api.ts` — Add approveWithOptions

**File:** `frontend_react/src/lib/api.ts`
**In `adminApi` object, replace:**
```typescript
approveJob:  (id: string) => post<void>(`/api/admin/jobs/${id}/approve`, {}),
```
**With:**
```typescript
approveJob: (
  id: string,
  opts?: { delivery_type?: string; payment_mode?: string; priority?: number }
) => post<void>(`/api/admin/jobs/${id}/approve`, opts ?? {}),
```

This is **backward-compatible** — existing callers pass no opts and the backend defaults to no override.

---

## 6. Frontend: Verify WebSocket URL

**File:** `frontend_react/src/context/SmartCopyContext.tsx`

Search for the WebSocket constructor. It must point to `/ws/jobs`:

```typescript
// CORRECT — matches backend/main.py @app.websocket("/ws/jobs")
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/jobs`);
```

If it uses a hardcoded `ws://localhost:8000/...`, replace with the dynamic form above so it works in any deployment.

---

## 7. Naming & Routing Conflicts

| Conflict | Resolution |
|---|---|
| Frontend calls `/api/media` but backend has `GET /api/media` | ✅ No conflict |
| Frontend `adminApi.mediaRescan()` calls `/api/admin/media/rescan` but backend has `/api/admin/media/scan` | ⚠️ **Fix:** Change `api.ts` to use `/api/admin/media/scan` OR add alias route in `main.py` |
| Frontend `adminApi.denyJob()` calls `/api/admin/jobs/:id/cancel` but backend route is `/api/admin/jobs/:id/deny` | ⚠️ **Fix:** Either rename `api.ts` call to `deny` or keep both routes (already aliased in `main.py`) |
| `seed.sql` references `media_items` table but `main.py` uses `media` table | ⚠️ **Fix:** Update `seed.sql` to use `INSERT INTO media` |

---

## 8. Environment File — config.example.json

```json
{
  "MEDIA_ROOT": "/mnt/media",
  "DB_PATH": "data/smartcopy.db",
  "SECRET_KEY": "CHANGE_ME_32_CHARS_MINIMUM",
  "CORS_ORIGINS": ["http://localhost:5173"],
  "STRIPE_SECRET_KEY": "sk_test_...",
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "STRIPE_PUBLISHABLE_KEY": "pk_test_...",
  "JWT_EXPIRY_MINUTES": 720,
  "AGENT_JWT_EXPIRY_MINUTES": 60,
  "MAX_CONCURRENT_JOBS": 5,
  "THROTTLE_KBPS": 0,
  "TLS_CERT_FILE": "certs/server.crt",
  "TLS_KEY_FILE": "certs/server.key",
  "LOG_LEVEL": "INFO",
  "POSTERS_DIR": "public/posters"
}
```

Copy to `config.json` and fill in real values before starting the server.

---

## 9. Poster Assets Integration

### 9a. Endpoint — `backend/routers/assets_router.py`

See attached `assets_router.py` deliverable. Registers at:
- `POST /api/assets/poster` — multipart upload; writes 3 sizes to `/public/posters/`
- `GET /api/assets/posters` — list ingested posters (admin only)

### 9b. CLI — `scripts/import-posters.py`

See attached `import-posters.py` deliverable. Usage:
```bash
python scripts/import-posters.py --dir /path/to/poster/images --media-root data/smartcopy.db
```

### 9c. CatalogService — posterUrl in API response

After migration 002 runs and posters are imported, `GET /api/media` will return `poster_url` automatically because `media_library.py` runs `SELECT *` (all columns) from the `media` table.

**Frontend:** `MediaCard.tsx` should consume `media.poster_url` if present. No layout change needed — add:
```typescript
// In MediaCard.tsx, in the poster/thumbnail area:
{media.poster_url
  ? <img src={media.poster_url} alt={media.name} style={{...}} />
  : <span style={{fontSize:'2rem'}}>{mediaEmoji(media.type)}</span>
}
```

---

## 10. Manual Verification Steps (no assertions)

Run the smoke check script:
```bash
bash smoke_check.sh http://localhost:8000
```

Or manually:
```bash
# 1. Health
curl -sk https://localhost:8000/api/health | python3 -m json.tool

# 2. Login (returns token)
TOKEN=$(curl -sk -X POST https://localhost:8000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 3. List media
curl -sk https://localhost:8000/api/media | python3 -m json.tool

# 4. Dashboard overview
curl -sk -H "Authorization: Bearer $TOKEN" https://localhost:8000/api/dashboard/overview | python3 -m json.tool

# 5. WebSocket (requires wscat: npm i -g wscat)
wscat -c wss://localhost:8000/ws/jobs --no-check
```

---

## 11. Files NOT to Touch

These files work correctly and must **not** be modified:
- `backend/queue_engine.py` — queue logic is sound
- `backend/mobile_delivery.py` — token issuance and streaming complete
- `backend/payments.py` — Stripe integration complete
- `backend/security.py` — auth guards correct (BUG-02 already fixed)
- `frontend_react/src/components/CopyModal.tsx` — delivery/payment toggles already present
- `frontend_react/src/components/JobQueuePanel.tsx` — delivery_type display already present

---

*Generated from repo scan of SmartCopy_Pro_v5_FINAL.zip · February 2026*
