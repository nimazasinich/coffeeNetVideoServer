# SmartCopy Pro — Phase 0: Architecture Blueprint & Threat Model

> **Status:** Awaiting approval before Phase-1 coding begins.
> **Repo baseline:** Python / FastAPI backend · React + TypeScript frontend · SQLite (WAL mode) · existing agent in `agent/main.py`

---

## 1. Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET CAFÉ LAN                           │
│                                                                     │
│  ┌──────────────┐     wss://<server>:8000/ws/jobs                  │
│  │  Customer    │ ─────────────────────────────────────┐            │
│  │  Browser     │  GET /api/media · POST /api/jobs     │            │
│  └──────────────┘  GET /api/download/:token            │            │
│                                                         │            │
│  ┌──────────────┐   HTTPS + Admin JWT                  ▼            │
│  │  Admin       │ ────────────────────► ┌─────────────────────┐    │
│  │  Browser     │                       │   FastAPI Server     │    │
│  └──────────────┘                       │   (main.py)          │    │
│                                         │                      │    │
│  ┌──────────────┐   HTTPS + Agent JWT   │  Services            │    │
│  │  Windows     │ ─────────────────────►│  ├─ AuthService      │    │
│  │  Agent       │   /api/agent/*        │  ├─ MediaLibrary      │    │
│  │  (agent/)    │◄──────────────────────│  ├─ QueueEngine       │    │
│  └──────┬───────┘   job payload         │  ├─ CopyEngine        │    │
│         │                               │  ├─ MobileDelivery   │    │
│  ┌──────▼───────┐   Streaming copy      │  ├─ PaymentService   │    │
│  │  USB Drive   │                       │  ├─ AgentHub          │    │
│  │  /Flash/     │                       │  ├─ WebSocketHub      │    │
│  │  Movies/     │                       │  └─ AuditLogger       │    │
│  └──────────────┘                       └──────────┬────────────┘   │
│                                                     │                │
│  ┌──────────────┐                         ┌─────────▼──────────┐    │
│  │  Mobile      │◄────────────────────────│  SQLite (WAL)      │    │
│  │  Browser     │   /api/download/:token  │  smartcopy.db      │    │
│  └──────────────┘   Range + throttle      └────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Optional: Gateway Container (gateway/)                   │      │
│  │  DNS redirect → http://cafe.local · QR code onboarding   │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘

External: Stripe API (HTTPS outbound only)
```

---

## 2. Bounded Contexts & Service Responsibilities

| Service | Location | Responsibility |
|---|---|---|
| **AuthService** | `backend/auth.py` · `backend/security.py` | Admin JWT (HS256→RS256), Agent JWT, rate limiting |
| **MediaLibrary** | `backend/media_library.py` | Catalog scan, posterUrl enrichment, file-path validation |
| **QueueEngine** | `backend/queue_engine.py` | FIFO+priority queue, DB locking, retry policy, job lifecycle |
| **CopyEngine** | `backend/copy_engine.py` | USB copy orchestration (delegates to Agent) |
| **AgentHub** | `backend/agent_hub.py` | Agent registration, heartbeat, job dispatch, drive registry |
| **MobileDelivery** | `backend/mobile_delivery.py` | Single-use token issuance, Range-enabled streaming, throttle |
| **PaymentService** | `backend/payments.py` | Stripe Checkout, webhook signature verification, manual confirm |
| **WebSocketHub** | `backend/websocket_hub.py` | Fan-out events to admin and customer clients |
| **AuditLogger** | DB `download_audit` table | Immutable log of all money, job, and device-lock actions |
| **PosterIngestion** | `backend/routers/assets_router.py` (NEW) | Multipart upload, sharp optimisation, `/posters/:size/:filename` |
| **Gateway** | `gateway/` (NEW container) | DNS captive portal, QR onboard flow |

---

## 3. Ports & Network Boundaries

| Port | Protocol | Listener | Exposed to |
|---|---|---|---|
| **8000** | HTTPS | FastAPI (uvicorn + TLS) | LAN only (bind `0.0.0.0` but firewall to LAN) |
| **8000/ws** | WSS | `/ws/jobs`, `/ws/agent` | LAN only |
| **53** | DNS/UDP | Gateway container | LAN only |
| **80** | HTTP | Gateway (redirect to HTTPS) | LAN only |
| **443** (outbound) | HTTPS | Stripe API | Internet (outbound only) |

**Trust boundaries:**
- `INTERNET` → `LAN edge` — only outbound Stripe calls allowed
- `LAN` → `Server` — all endpoints require TLS; admin endpoints require JWT
- `Server` → `Agent` — short-lived Agent JWT; agent endpoints isolated at `/api/agent/*`
- `Server` → `DB` — localhost socket only; WAL mode; no remote DB access

---

## 4. Data Flows

### 4a. USB Copy (Agent path)
```
Customer Browser
  POST /api/jobs {delivery_type:"usb", payment_mode:"manual"}
    → QueueEngine creates job (status=pending)
    → WS broadcast job.created
Admin Browser
  POST /api/admin/jobs/:id/approve
    → QueueEngine → status=queued
  POST /api/admin/jobs/:id/confirm-payment (manual)
    → payments.status=confirmed → status=queued
QueueEngine (background loop)
  GET /api/agent/:id/next-job → Agent pulls job
  Agent: streaming copy to /Flash/Movies/ (writes .part, renames atomically)
  POST /api/agent/:id/progress (every 500ms)
    → WS broadcast job:update
  POST /api/agent/:id/complete
    → status=completed, drive unlocked, audit log entry
```

### 4b. Mobile Download (Agentless)
```
Customer Browser
  POST /api/jobs {delivery_type:"mobile", payment_mode:"online"}
    → status=pending
  POST /api/payments/stripe/create-session
    → Stripe Checkout Session issued
  [Customer completes payment on Stripe-hosted page]
Stripe → POST /api/payments/webhook (verified sig)
    → payment.status=succeeded → job.status=queued
QueueEngine
  MobileDeliveryService issues single-use download_token (TTL 10 min)
  WS: payment:update → token URL sent to customer
Customer Browser
  GET /api/download/:token (Range header optional)
    → token validated atomically (DB CAS used=1)
    → file streamed with X-File-Hash: sha256, throttle per-IP
```

### 4c. Poster Ingestion
```
Operator CLI: python scripts/import-posters.py --dir /posters
  → POST /api/assets/poster (multipart)
    → sharp: generate 3 sizes (thumb 120w, card 300w, full 800w)
    → writes to /public/posters/{thumb,card,full}/
    → UPDATE media SET poster_url = '/posters/card/{filename}'
CatalogService (GET /api/media)
  → returns posterUrl per item
```

---

## 5. DB Schema Overview (additions beyond existing migrate.sql)

The following tables already exist in `scripts/migrate.sql` and `backend/database.py`:
`jobs`, `media`, `drives`, `payments`, `download_tokens`, `download_audit`, `agents`, `agent_versions`, `bandwidth_policies`, `wifi_sessions`, `settings`, `admin_users`, `pricing`, `sales`

**New columns/tables required:**

```sql
-- Phase-1 additions
ALTER TABLE media ADD COLUMN poster_url VARCHAR(512);
ALTER TABLE media ADD COLUMN checksum_sha256 VARCHAR(64);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36) PRIMARY KEY,
    event_type  VARCHAR(64) NOT NULL,
    actor       VARCHAR(128),
    target_id   VARCHAR(36),
    detail      TEXT,
    ip          VARCHAR(64),
    created_at  REAL NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type    ON audit_logs(event_type);
```

---

## 6. Authentication Architecture

```
Admin JWT
  Algorithm:  HS256 (current) → migrate to RS256 in Phase-2
  Claims:     sub (username), role (admin|superadmin), exp (12h), iat
  Storage:    sessionStorage on client (never localStorage)
  Rotation:   refresh endpoint planned (Phase-2)

Agent JWT
  Algorithm:  RS256
  Claims:     sub (agent_id), role=agent, exp (1h)
  Issued by:  POST /api/agent/register
  Rotation:   agent requests new token on 401 from heartbeat
  mTLS:       optional hardening (self-signed CA, Phase-7)

Download Token
  Type:       opaque nonce (64 hex chars) stored in download_tokens table
  TTL:        10 minutes (configurable)
  Single-use: atomic UPDATE used=1 WHERE used=0; reject if rowcount=0
  Bound to:   job_id + media_id + optional customer IP
```

---

## 7. STRIDE Threat Model

| # | Threat | STRIDE | Asset | Mitigation |
|---|---|---|---|---|
| T-01 | Fake admin login | **S**poofing | Admin JWT | bcrypt passwords; rate limit 5/min; constant-time compare |
| T-02 | Token replay (download) | **R**epudiation | Download token | Single-use DB flag; short TTL 10 min; IP binding optional |
| T-03 | Path traversal via media_id | **T**ampering | File system | `safe_path_under_root()` guard; UUID-only media IDs |
| T-04 | SQL injection | **T**ampering | DB | Parameterised queries only (sqlite3 `?` placeholders) |
| T-05 | Agent impersonation | **S**poofing | Job queue | Agent JWT RS256; agent_id registered and DB-persisted |
| T-06 | Stripe webhook forgery | **T**ampering | Payment state | `stripe.Webhook.construct_event()` HMAC verify |
| T-07 | DoS via job spam | **D**enial of Service | Queue | rate_limit_jobs dep (5 req/min per IP); max queue depth config |
| T-08 | Download bandwidth abuse | **D**enial of Service | Server bandwidth | Per-IP throttle (token bucket); daily quota via bandwidth_policies |
| T-09 | XSS via media name | **T**ampering | Admin UI | `re.sub` sanitise in search; CSP header; React auto-escaping |
| T-10 | Sensitive file read via /stream | **I**nformation Disclosure | Media files | `safe_path_under_root()` + agent token required |
| T-11 | CORS credential leak | **I**nformation Disclosure | Admin session | `allow_credentials=False` for wildcard origin (BUG-02 already fixed) |
| T-12 | Agent writes outside Flash dir | **T**ampering | Windows FS | Agent enforces write-only to `/Flash/Movies/` & `/Flash/Series/`; no exec |
| T-13 | MitM on LAN (sniff tokens) | **I**nformation Disclosure | All tokens | TLS mandatory on all endpoints; HSTS header |
| T-14 | Poster upload RCE | **T**ampering | Server | Allowlist mime types (image/jpeg, image/png, image/webp); rename to UUID; never execute |

---

## 8. Deployment Requirements

| Requirement | Detail |
|---|---|
| **OS** | Ubuntu 22.04 LTS / Windows Server 2022 (agent only) |
| **Python** | 3.11+ with `pip install -r requirements.txt` |
| **TLS** | Self-signed cert for dev (`mkcert localhost`); LetsEncrypt for production |
| **SQLite WAL** | `PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=1000;` (set in `database.py`) |
| **Ports** | 8000 inbound from LAN; 443 outbound to Stripe |
| **Service account** | Run uvicorn as non-root `smartcopy` user; no sudo |
| **Env vars** | See `config.example.json` — never commit secrets |
| **Logging** | Rotating file: `logs/smartcopy.log` (10MB × 5 files); structured JSON |
| **Poster storage** | `public/posters/` — min 2 GB free recommended |
| **Agent** | Windows Service via NSSM; Python 3.11 bundled with PyInstaller |

---

## 9. Phase Delivery Order (approved scope)

| Phase | Deliverable | Dependency |
|---|---|---|
| **0** | This document (arch + threat model) | — |
| **1** | DB migrations (`ALTER TABLE media ADD COLUMN poster_url`); `scripts/import-posters.py`; `backend/routers/assets_router.py` | Phase-0 approval |
| **2** | Core backend hardening: RS256 JWT migration, audit_logs table, rate limit tuning | Phase-1 |
| **3** | Agent hardening: RS256, progress reporting, per-device lock with TTL | Phase-2 |
| **4** | Mobile delivery hardening: atomic token redemption, Range streaming, per-IP throttle | Phase-2 |
| **5** | Poster ingestion pipeline + frontend `posterUrl` wiring + `INTEGRATION_CHECKLIST.md` | Phase-1 |
| **6** | Captive portal PoC + docs + QR fallback | Phase-4 |
| **7** | Dockerfile, docker-compose, deployment guide, smoke-check script | Phase-5 |

---

## 10. Decisions Requiring Approval

1. **JWT algorithm**: upgrade admin from HS256 → RS256 (requires key generation step for operators)?
2. **mTLS for agents**: implement full mTLS cert chain or rely on RS256 JWT?
3. **PostgreSQL migration**: include now or document as future path?
4. **Gateway**: deploy as Docker container or standalone Python process?
5. **Poster image optimisation**: use `Pillow` (already in requirements?) or require `sharp` (Node)?

---

*Phase-0 complete. Awaiting review and approval to begin Phase-1.*
