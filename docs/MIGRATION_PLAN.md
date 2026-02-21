# MIGRATION_PLAN.md
## Demo → Real API Transition Guide
### SmartCopy Pro v5 FINAL

---

## Overview

The existing repo ships with a functional FastAPI backend already wired to the
React frontend. The primary migration work is:

1. Run DB migrations to add missing columns
2. Drop demo/stub data modes in the frontend
3. Wire the real WebSocket URL
4. Register the new assets router
5. Apply the approve-with-options patch

---

## Step-by-Step Migration

### Step 1 — Run DB Migrations

```bash
# Migration 001 (already exists)
sqlite3 data/smartcopy.db < scripts/migrate.sql

# Migration 002 (new — poster_url, audit_logs)
sqlite3 data/smartcopy.db < db/migrations/002_poster_audit.sql
```

> **Note:** The `ALTER TABLE media ADD COLUMN` lines will print "duplicate column name"
> errors if run a second time — these are safe to ignore.

---

### Step 2 — Register the Assets Router

**File:** `backend/main.py`

Find the block where sub-routers are imported (around line 45):
```python
from backend.routers.featured_router import router as featured_router
```

Add after it:
```python
from backend.routers.assets_router import router as assets_router
```

Find the block where routers are registered (around line 60):
```python
app.include_router(featured_router)
```

Add after it:
```python
app.include_router(assets_router)

from fastapi.staticfiles import StaticFiles
from pathlib import Path
_POSTERS = Path("public/posters")
_POSTERS.mkdir(parents=True, exist_ok=True)
app.mount("/posters", StaticFiles(directory=str(_POSTERS)), name="posters")
```

---

### Step 3 — Patch Approve Endpoint (accept delivery_type override)

See `INTEGRATION_CHECKLIST.md §4` for the exact diff.

Summary: add a Pydantic `ApproveJobRequest` body to `approve_job()` that
optionally overrides `delivery_type`, `payment_mode`, and `priority` when
the admin clicks Approve in the dashboard.

---

### Step 4 — Frontend: Fix Media Rescan URL

**File:** `frontend_react/src/lib/api.ts`

Change:
```typescript
mediaRescan: () => post<void>('/api/admin/media/rescan', {}),
```
To:
```typescript
mediaRescan: () => post<void>('/api/admin/media/scan', {}),
```

---

### Step 5 — Frontend: Verify WebSocket URL

**File:** `frontend_react/src/context/SmartCopyContext.tsx`

Ensure the WebSocket is connected to `/ws/jobs` (not a hardcoded localhost):
```typescript
const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/jobs`;
const ws = new WebSocket(wsUrl);
```

---

### Step 6 — Frontend: approveJob with Options

**File:** `frontend_react/src/lib/api.ts`

Update `approveJob` signature (see `INTEGRATION_CHECKLIST.md §5`).

Then in the admin dashboard component that calls `approveJob`, pass the
selected delivery_type and payment_mode from the Approve modal:
```typescript
await adminApi.approveJob(jobId, {
  delivery_type: selectedDelivery,  // 'usb' | 'mobile'
  payment_mode:  selectedPayment,   // 'manual' | 'online'
});
```

---

### Step 7 — Copy New Files into Repo

```bash
cp backend/routers/assets_router.py  <repo>/backend/routers/
cp db/migrations/002_poster_audit.sql <repo>/db/migrations/
cp scripts/import-posters.py          <repo>/scripts/
cp smoke_check.sh                     <repo>/
cp Dockerfile                         <repo>/
cp docker-compose.dev.yml             <repo>/
cp config.example.json                <repo>/
```

---

### Step 8 — Install Pillow (for poster ingestion)

```bash
pip install Pillow --break-system-packages
# Or add to requirements.txt:
echo "Pillow>=10.0.0" >> requirements.txt
```

---

### Step 9 — Import Poster Assets (when available)

```bash
# Bulk import from a directory of poster JPEGs/PNGs
python scripts/import-posters.py --dir /path/to/poster/images

# Or upload one at a time via API
curl -X POST https://localhost:8000/api/assets/poster \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/poster.jpg" \
  -F "media_id=<uuid-of-media>"
```

---

### Step 10 — Verify

```bash
bash smoke_check.sh https://localhost:8000 admin admin123
```

---

## What Already Works (no migration needed)

| Feature | Status |
|---|---|
| USB delivery end-to-end | ✅ Working |
| Mobile download (`/api/download/:token`) | ✅ Working |
| Stripe payments | ✅ Working |
| Agent registration + heartbeat | ✅ Working |
| Admin JWT auth | ✅ Working |
| QR code generation | ✅ Working |
| WebSocket live updates | ✅ Working |
| Delivery Type toggle in CopyModal | ✅ Already in UI |
| Payment Mode toggle in CopyModal | ✅ Already in UI |
| Kanban cards show delivery_type | ✅ Already in UI |

---

## Rollback

If anything goes wrong, the SQLite migrations can be partially reversed:
```sql
-- Remove audit_logs (safe, data-less table)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS poster_assets;
-- poster_url and checksum_sha256 columns cannot be dropped in SQLite without
-- recreating the table — but NULL values cause no harm.
```

The Python source changes are isolated to `backend/main.py` (2 import lines,
1 function body change) and `backend/routers/assets_router.py` (new file).
