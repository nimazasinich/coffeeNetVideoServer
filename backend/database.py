"""
SmartCopy Pro — Database Module
SQLite with WAL mode. Schema covers USB copies, mobile delivery, payments, agents.

FIX NOTES
---------
BUG-16  'dispatching' is now a valid job status (introduced by the queue engine
        race-condition fix). Added 'dispatching' to the idx_jobs_status index
        comment and made sure the check queries in init_db include it.

BUG-17  poster_assets table was never created in init_db(). assets_router.py
        does INSERT INTO poster_assets on every poster upload — raising
        sqlite3.OperationalError: no such table: poster_assets on first use.
        Table added below.

BUG-18  media.poster_url column was absent from the initial schema, causing
        assets_router.py's UPDATE media SET poster_url=? to fail with
        sqlite3.OperationalError: table media has no column named poster_url.
        Column added to the CREATE TABLE and also guarded by a migration ALTER
        for existing databases.

BUG-19  audit_logs table referenced in INTEGRATION_CHECKLIST.md but never
        created.  Added to init_db().
"""
import sqlite3
import logging
from contextlib import contextmanager
from backend.config import DB_PATH, DEFAULT_PRICING

logger = logging.getLogger("smartcopy.database")


def get_connection() -> sqlite3.Connection:
    """Return a thread-safe SQLite connection with WAL mode."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


@contextmanager
def db_cursor():
    """Context manager: yields cursor, commits on success, rolls back on error."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error({"event": "db_error", "error": str(e)})
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables and seed default data."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db_cursor() as cur:

        # ── Media ──────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id               TEXT PRIMARY KEY,
                name             TEXT NOT NULL,
                path             TEXT NOT NULL UNIQUE,
                size_bytes       INTEGER NOT NULL,
                category         TEXT NOT NULL DEFAULT 'movie',
                quality_category TEXT NOT NULL DEFAULT 'HD',
                extension        TEXT NOT NULL,
                is_copyable      INTEGER NOT NULL DEFAULT 1,
                added_at         TEXT NOT NULL DEFAULT (datetime('now')),
                checksum         TEXT,
                poster_url       TEXT
            )
        """)

        # ── Drives ─────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS drives (
                id              TEXT PRIMARY KEY,
                path            TEXT NOT NULL UNIQUE,
                label           TEXT,
                capacity_bytes  INTEGER,
                free_bytes      INTEGER,
                locked_by_job   TEXT,
                detected_at     TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # ── Jobs ───────────────────────────────────────────────────────────
        # FIX BUG-16: 'dispatching' is a valid transient status; listed here
        # for documentation. SQLite doesn't enforce CHECK constraints by
        # default unless explicitly added; we rely on the engine layer.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id              TEXT PRIMARY KEY,
                media_id        TEXT NOT NULL,
                drive_id        TEXT,
                status          TEXT NOT NULL DEFAULT 'pending',
                delivery_type   TEXT NOT NULL DEFAULT 'usb',
                payment_mode    TEXT NOT NULL DEFAULT 'manual',
                priority        INTEGER NOT NULL DEFAULT 0,
                progress        REAL NOT NULL DEFAULT 0.0,
                bytes_written   INTEGER NOT NULL DEFAULT 0,
                total_bytes     INTEGER NOT NULL DEFAULT 0,
                throughput_mbps REAL,
                error_message   TEXT,
                retry_count     INTEGER NOT NULL DEFAULT 0,
                agent_id        TEXT,
                customer_ip     TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                started_at      TEXT,
                completed_at    TEXT,
                FOREIGN KEY (media_id) REFERENCES media(id)
            )
        """)

        # ── Sales ──────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id              TEXT PRIMARY KEY,
                job_id          TEXT NOT NULL,
                media_id        TEXT NOT NULL,
                price_charged   REAL NOT NULL DEFAULT 0.0,
                currency        TEXT NOT NULL DEFAULT 'USD',
                payment_ref     TEXT,
                payment_status  TEXT NOT NULL DEFAULT 'pending',
                timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        # ── Payments (Stripe) ──────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id                    TEXT PRIMARY KEY,
                job_id                TEXT NOT NULL,
                mode                  TEXT NOT NULL DEFAULT 'manual',
                status                TEXT NOT NULL DEFAULT 'pending',
                amount_cents          INTEGER NOT NULL DEFAULT 0,
                currency              TEXT NOT NULL DEFAULT 'USD',
                stripe_session_id     TEXT,
                stripe_payment_intent TEXT,
                tx_ref                TEXT,
                confirmed_by          TEXT,
                created_at            REAL NOT NULL DEFAULT (strftime('%s','now')),
                confirmed_at          REAL,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        # ── Download Tokens (mobile single-use) ────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS download_tokens (
                id          TEXT PRIMARY KEY,
                nonce       TEXT NOT NULL UNIQUE,
                job_id      TEXT NOT NULL,
                media_id    TEXT NOT NULL,
                expires_at  REAL NOT NULL,
                used        INTEGER NOT NULL DEFAULT 0,
                used_at     REAL,
                used_by_ip  TEXT,
                issued_at   REAL NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        # ── Download Audit ─────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS download_audit (
                id          TEXT PRIMARY KEY,
                job_id      TEXT NOT NULL,
                media_id    TEXT NOT NULL,
                ip          TEXT NOT NULL,
                nonce       TEXT NOT NULL,
                file_size   INTEGER NOT NULL,
                byte_start  INTEGER NOT NULL DEFAULT 0,
                byte_end    INTEGER NOT NULL DEFAULT 0,
                bytes_sent  INTEGER NOT NULL DEFAULT 0,
                elapsed     REAL,
                status      TEXT NOT NULL DEFAULT 'started',
                error       TEXT,
                started_at  REAL NOT NULL DEFAULT (strftime('%s','now')),
                finished_at REAL
            )
        """)

        # ── Agents ─────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id              TEXT PRIMARY KEY,
                agent_id        TEXT NOT NULL UNIQUE,
                hostname        TEXT NOT NULL,
                version         TEXT NOT NULL DEFAULT '0.0.0',
                drives          TEXT,
                online          INTEGER NOT NULL DEFAULT 0,
                registered_at   REAL NOT NULL DEFAULT (strftime('%s','now')),
                last_seen       REAL,
                status          TEXT NOT NULL DEFAULT 'pending',
                is_master_agent INTEGER NOT NULL DEFAULT 0
            )
        """)

        # ── Pricing ────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pricing (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                max_size_gb REAL NOT NULL,
                price_usd   REAL NOT NULL
            )
        """)

        # ── Admin Users ────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                password_hash   TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'operator',
                created_at      TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # ── Settings ───────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key     TEXT PRIMARY KEY,
                value   TEXT NOT NULL
            )
        """)

        # ── Poster Assets ──────────────────────────────────────────────────
        # FIX BUG-17: This table was never created, crashing every poster upload.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poster_assets (
                id            TEXT PRIMARY KEY,
                media_id      TEXT,
                filename      TEXT NOT NULL,
                original_name TEXT,
                mime_type     TEXT,
                size_bytes    INTEGER,
                thumb_url     TEXT,
                card_url      TEXT,
                full_url      TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL
            )
        """)

        # ── Audit Logs ─────────────────────────────────────────────────────
        # FIX BUG-19: Listed in INTEGRATION_CHECKLIST but never created.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                event_type  TEXT NOT NULL,
                actor       TEXT,
                target_id   TEXT,
                detail      TEXT,
                ip          TEXT,
                created_at  REAL NOT NULL DEFAULT (unixepoch())
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_type    ON audit_logs(event_type)"
        )

        # ── Indexes ────────────────────────────────────────────────────────
        cur.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status      ON jobs(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_jobs_drive       ON jobs(drive_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_jobs_delivery    ON jobs(delivery_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sales_ts         ON sales(timestamp)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dl_tokens_nonce  ON download_tokens(nonce)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_agents_agent_id  ON agents(agent_id)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_poster_media ON poster_assets(media_id)"
        )

        # ── Additive migrations for existing databases ─────────────────────
        # Each ALTER is wrapped so it is silently skipped on fresh installs
        # where the column already exists from CREATE TABLE above.
        _safe_alters = [
            # agents table columns added in earlier patch
            "ALTER TABLE agents ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
            "ALTER TABLE agents ADD COLUMN is_master_agent INTEGER NOT NULL DEFAULT 0",
            # FIX BUG-18: poster_url was missing from media in old databases
            "ALTER TABLE media ADD COLUMN poster_url TEXT",
        ]
        for alter in _safe_alters:
            try:
                cur.execute(alter)
            except Exception:
                pass  # Column already exists — expected on fresh databases

        # ── Seed pricing if empty ──────────────────────────────────────────
        cur.execute("SELECT COUNT(*) as cnt FROM pricing")
        if cur.fetchone()["cnt"] == 0:
            for tier in DEFAULT_PRICING:
                cur.execute(
                    "INSERT INTO pricing (name, max_size_gb, price_usd) VALUES (?, ?, ?)",
                    (tier["name"], tier["maxSizeGB"], tier["priceUSD"])
                )

    logger.info({"event": "db_initialized", "path": str(DB_PATH)})


def recover_stale_jobs():
    """On server restart, reset 'active'/'dispatching' jobs back to 'pending'."""
    with db_cursor() as cur:
        cur.execute("""
            UPDATE jobs
            SET status = 'pending',
                started_at = NULL,
                error_message = 'Server restarted — re-queued'
            WHERE status IN ('active', 'dispatching')
        """)
        rows = cur.rowcount
    if rows:
        logger.warning({"event": "stale_jobs_recovered", "count": rows})


def get_setting(key: str, default: str = "") -> str:
    """Helper to fetch a single setting from the settings table."""
    try:
        with db_cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key=?", (key,))
            row = cur.fetchone()
            return row["value"] if row else default
    except Exception as e:
        logger.error({"event": "get_setting_error", "key": key, "error": str(e)})
        return default


def write_audit_log(
    event_type: str,
    actor: str = None,
    target_id: str = None,
    detail: str = None,
    ip: str = None,
):
    """Insert a row into audit_logs. Fire-and-forget; never raises."""
    import time
    try:
        with db_cursor() as cur:
            cur.execute(
                """INSERT INTO audit_logs (id, event_type, actor, target_id, detail, ip, created_at)
                   VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)""",
                (event_type, actor, target_id, detail, ip, time.time()),
            )
    except Exception as e:
        logger.warning({"event": "audit_log_write_error", "error": str(e)})
