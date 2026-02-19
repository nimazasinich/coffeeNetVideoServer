# SmartCopy Pro v3 — Backend Bug Report & Fix Log

All 16 bugs identified across 6 Python source files have been fixed in this
release. Every fix is annotated in the source with a `FIX BUG-nn` comment.

---

## Critical Bugs (would crash or corrupt data at runtime)

### BUG-01 · `main.py` — `create_job` sync endpoint calls `asyncio.create_task`
**File:** `backend/main.py`  
**Symptom:** `RuntimeError: no running event loop` in production; WebSocket
`job.created` broadcast silently dropped.  
**Root cause:** FastAPI executes `def` (sync) route handlers in a thread pool
executor. `asyncio.create_task()` requires the current thread **to be** the
event-loop thread.  
**Fix:** Changed `def create_job` → `async def create_job`. FastAPI then runs it
directly on the event loop where `create_task` is safe.

---

### BUG-02 · `main.py` — CORS wildcard + `allow_credentials=True` violates spec
**File:** `backend/main.py`  
**Symptom:** All browsers reject credentialed cross-origin requests (CORS
`Access-Control-Allow-Origin: *` is forbidden with credentials per RFC 6454 §3.2).
Admin login and all `Authorization` header calls fail from a different origin.  
**Root cause:** `CORSMiddleware(allow_origins=["*"], allow_credentials=True)` is
invalid.  
**Fix:** `allow_credentials` is now `True` only when specific (non-wildcard)
origins are configured. Wildcard origin mode uses `allow_credentials=False`.

---

### BUG-03 · `main.py` — `admin_cancel_job` / `admin_deny_job` missing UUID validation
**File:** `backend/main.py`  
**Symptom:** Passing a malformed job_id could cause a SQLite error (and a 500
response) instead of a clean 400. Inconsistent with the public `cancel_job`
endpoint that validates properly.  
**Fix:** Added UUID validation to both admin job management endpoints.

---

### BUG-04 · `queue_engine.py` — Race condition: same job dispatched multiple times
**File:** `backend/queue_engine.py`  
**Symptom:** Under load a single copy job was dispatched to multiple workers
simultaneously, causing duplicate file writes and duplicate agent commands.  
**Root cause:** `_get_next_job()` selected a row without changing its status.
The scheduler loop ran every 1 second — well before the async worker had a
chance to mark the job `active`.  
**Fix:** Replaced `_get_next_job()` with `_pick_and_mark_job()` which performs
an atomic `UPDATE jobs SET status='dispatching' WHERE id=? AND status IN
('pending','queued')`. If `rowcount == 0` the job was already claimed.
`'dispatching'` is a new transient status invisible to end-users.

---

### BUG-05 · `queue_engine.py` — Semaphore does not actually limit concurrency
**File:** `backend/queue_engine.py`  
**Symptom:** All jobs ran simultaneously regardless of `MAX_CONCURRENT_COPIES`.  
**Root cause:**
```python
async with self._semaphore:
    asyncio.create_task(self._worker(job))  # returns immediately
# ← semaphore released here, before worker even starts
```
**Fix:** The semaphore is now acquired **inside** `_worker` with
`async with self._semaphore:` wrapping the entire job execution body.

---

### BUG-06 · `queue_engine.py` — Mobile jobs never completed
**File:** `backend/queue_engine.py`  
**Symptom:** Mobile delivery jobs stayed in `queued` state forever. Revenue
stats were broken; the admin queue showed stale entries.  
**Root cause:** The mobile branch of `_worker` was `pass`.  
**Fix:** Mobile worker now sets status to `active` immediately (token was
already issued by `payments.py`). `mobile_delivery.py` calls
`complete_mobile_job()` at the end of the download stream.

---

### BUG-07 · `copy_engine.py` — `started_at` set to literal string `"datetime('now')"`
**File:** `backend/copy_engine.py`  
**Symptom:** `started_at` column contained the text `"datetime('now')"` instead
of a real timestamp for local USB copy jobs.  
**Root cause:** `_update_job_db(started_at="datetime('now')")` uses
parameterized SQL — the value is bound as a string literal, not executed as an
SQLite function.  
**Fix:** Removed the broken first call. The correct `UPDATE jobs SET status=
'active', started_at=datetime('now') WHERE id=?` raw SQL remains.

---

### BUG-08 · `copy_engine.py` — Demo simulation takes 8 minutes for a 12 GB file
**File:** `backend/copy_engine.py`  
**Symptom:** In development (no real media on disk), a demo copy job ran for
~480 seconds, making the UI appear broken.  
**Root cause:** Demo speed was hardcoded to 25 MB/s.  
**Fix:** Raised simulated speed to 500 MB/s. Largest demo files (~12 GB) now
finish in ~24 seconds — fast enough for interactive testing.

---

### BUG-09 · `mobile_delivery.py` — `range` parameter shadows Python built-in
**File:** `backend/mobile_delivery.py`  
**Symptom:** Linting errors; confusing stack traces if `range()` is accidentally
called nearby.  
**Root cause:** `range: Optional[str] = Header(None)` — `range` is a Python
built-in name.  
**Fix:** Renamed to `range_header: Optional[str] = Header(None, alias="range")`.
FastAPI `alias` preserves the HTTP header name.

---

### BUG-10 · `mobile_delivery.py` — `asyncio.get_event_loop()` deprecated/broken in Python 3.10+
**File:** `backend/mobile_delivery.py`  
**Symptom:** `DeprecationWarning` on Python 3.10; `RuntimeError` on Python 3.12
when called inside a coroutine without an explicit event loop.  
**Root cause:** Two calls to `asyncio.get_event_loop()` in async functions.  
**Fix:** Both replaced with `asyncio.get_running_loop()`.

---

### BUG-11 · `mobile_delivery.py` — Mobile job never marked `completed` after download
**File:** `backend/mobile_delivery.py`  
**Symptom:** Even after a successful mobile download, the job stayed `active`
forever. Related to BUG-06.  
**Root cause:** `_stream()` generator finished without calling `complete_mobile_job`.  
**Fix:** Added `queue_engine.complete_mobile_job(job_id, True)` at the end of
the `_stream` generator's success path, and `complete_mobile_job(job_id, False, error)`
in the except path.

---

### BUG-12 · `payments.py` — `admin_confirm_payment` had no authentication
**File:** `backend/payments.py`  
**Symptom:** Any HTTP client that knew a valid `job_id` could confirm payment
and receive a download token for free.  
**Root cause:** Missing `Depends(require_admin_role)` on the endpoint.  
**Fix:** Added `user: dict = Depends(require_admin_role)` to
`admin_confirm_payment`. The admin's username is now also captured for audit.

---

### BUG-13 · `payments.py` — Manual payments never recorded in `sales` table
**File:** `backend/payments.py`  
**Symptom:** Admin dashboard showed `revenue_today = 0` even after confirming
many manual payments. Sales report was empty.  
**Root cause:** `admin_confirm_payment` created a `payments` record but never
inserted into the `sales` table (which the dashboard queries).  
**Fix:** After confirming, the correct price is looked up from pricing tiers and
a `sales` record is inserted.

---

## Minor / Hygiene Bugs

### BUG-14 · `security.py` — Conditional import of `hmac`/`hashlib`
**File:** `backend/security.py`  
**Root cause:** `hmac`, `hashlib`, `json`, `base64` were imported inside the
`except ImportError` block for PyJWT, making them unavailable at module scope in
edge cases.  
**Fix:** Moved all standard-library imports to the top of the file unconditionally.

### BUG-15 · `security.py` — Fallback HMAC token decode re-verified incorrectly
**File:** `backend/security.py`  
**Root cause:** `decode_token` fallback assumed padding `parts[1] + "=="` but
base64 padding requires `-len % 4` extra chars, not always 2.  
**Fix:** Used `"=" * (-len(parts[1]) % 4)` for correct padding in both
`create_access_token` and `decode_token`.

### BUG-16 · `database.py` — `recover_stale_jobs` missed `dispatching` status
**File:** `backend/database.py`  
**Root cause:** After the race-condition fix, `dispatching` is a new valid
transient status. A server crash with jobs in `dispatching` state would leave
them stranded.  
**Fix:** `recover_stale_jobs` now resets `WHERE status IN ('active',
'dispatching')`.

---

## Frontend Bugs Fixed (from previous session — included in this build)

| # | File | Bug | Fix |
|---|------|-----|-----|
| F1 | `src/index.css` | `--orange` CSS variable used but not defined in `:root` | Added `--orange: #ff7c4d` |
| F2 | `src/App.tsx` | `handleSingleCopy` missing 4th `_amountCents?` parameter expected by `CopyModal` | Added optional param |
| F3 | `tailwind.config.js` | `text-accent`, `bg-accent`, etc. used but color not registered | Added all CSS-variable-backed color tokens |

---

## How to Run

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Build the React frontend
cd frontend_react
npm install
npm run build    # outputs to ../frontend/

# 3. Start the server
cd ..
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080

# Default admin credentials: admin / admin1234
# Change immediately via: POST /api/admin/change-password
```

Environment variables (optional, see `backend/config.py`):
```
SMARTCOPY_MEDIA_ROOT   Path to video library (default: C:\SmartCopyMedia)
SMARTCOPY_SECRET       JWT/HMAC signing secret (change in production!)
STRIPE_API_KEY         Stripe secret key (leave empty to disable online payments)
SMARTCOPY_LOG_LEVEL    DEBUG | INFO | WARNING (default: INFO)
SMARTCOPY_MAX_COPIES   Max parallel copy workers (default: 4)
```
