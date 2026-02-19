-- SmartCopy Pro – Database Migration
-- From: smartcopy_v2 (original schema)
-- To:   smartcopy_v2 Pro (extended schema)
--
-- Run: sqlite3 smartcopy.db < scripts/migrate.sql
-- For PostgreSQL: psql -d smartcopy -f scripts/migrate.sql

BEGIN;

-- ─── Extend jobs table ────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(16) DEFAULT 'usb';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_mode  VARCHAR(16) DEFAULT 'manual';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority      INTEGER     DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS agent_id      VARCHAR(64);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_ip   VARCHAR(64);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bytes_written INTEGER     DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_bytes   INTEGER     DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS queued_at     REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at    REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS finished_at   REAL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ─── download_tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_tokens (
    id          VARCHAR(36)  PRIMARY KEY,
    nonce       VARCHAR(64)  NOT NULL UNIQUE,
    job_id      VARCHAR(36)  NOT NULL REFERENCES jobs(id),
    media_id    VARCHAR(36)  NOT NULL,
    expires_at  REAL         NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT 0,
    used_at     REAL,
    used_by_ip  VARCHAR(64),
    issued_at   REAL         NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dt_nonce ON download_tokens(nonce);

-- ─── download_audit ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_audit (
    id          VARCHAR(36)  PRIMARY KEY,
    job_id      VARCHAR(36)  NOT NULL REFERENCES jobs(id),
    media_id    VARCHAR(36)  NOT NULL,
    ip          VARCHAR(64)  NOT NULL,
    nonce       VARCHAR(64)  NOT NULL,
    file_size   INTEGER      NOT NULL,
    byte_start  INTEGER      NOT NULL DEFAULT 0,
    byte_end    INTEGER      NOT NULL DEFAULT 0,
    bytes_sent  INTEGER      NOT NULL DEFAULT 0,
    elapsed     REAL,
    status      VARCHAR(32)  NOT NULL DEFAULT 'started',
    error       TEXT,
    started_at  REAL         NOT NULL DEFAULT (unixepoch()),
    finished_at REAL
);

-- ─── agents ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
    id            VARCHAR(36)  PRIMARY KEY,
    agent_id      VARCHAR(64)  NOT NULL UNIQUE,
    hostname      VARCHAR(255) NOT NULL,
    version       VARCHAR(32)  NOT NULL DEFAULT '0.0.0',
    drives        TEXT,
    online        BOOLEAN      NOT NULL DEFAULT 0,
    registered_at REAL         NOT NULL DEFAULT (unixepoch()),
    last_seen     REAL
);
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

-- ─── agent_versions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_versions (
    id              VARCHAR(36)  PRIMARY KEY,
    version         VARCHAR(32)  NOT NULL UNIQUE,
    download_url    VARCHAR(512) NOT NULL,
    checksum_sha256 VARCHAR(64)  NOT NULL,
    release_notes   TEXT,
    is_mandatory    BOOLEAN      NOT NULL DEFAULT 0,
    published_at    REAL         NOT NULL DEFAULT (unixepoch())
);

-- ─── bandwidth_policies ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bandwidth_policies (
    id                  VARCHAR(36)  PRIMARY KEY,
    name                VARCHAR(128) NOT NULL UNIQUE,
    max_concurrent      INTEGER      NOT NULL DEFAULT 5,
    throttle_kbps       INTEGER      NOT NULL DEFAULT 0,
    daily_quota_per_ip  INTEGER      NOT NULL DEFAULT 5,
    is_active           BOOLEAN      NOT NULL DEFAULT 1,
    updated_at          REAL         NOT NULL DEFAULT (unixepoch())
);

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                    VARCHAR(36)  PRIMARY KEY,
    job_id                VARCHAR(36)  NOT NULL REFERENCES jobs(id),
    mode                  VARCHAR(16)  NOT NULL,
    status                VARCHAR(32)  NOT NULL DEFAULT 'pending',
    amount_cents          INTEGER      NOT NULL DEFAULT 0,
    currency              VARCHAR(8)   NOT NULL DEFAULT 'USD',
    stripe_session_id     VARCHAR(128),
    stripe_payment_intent VARCHAR(128),
    tx_ref                VARCHAR(128),
    confirmed_by          VARCHAR(64),
    created_at            REAL         NOT NULL DEFAULT (unixepoch()),
    confirmed_at          REAL
);

-- ─── wifi_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wifi_sessions (
    id               VARCHAR(36)  PRIMARY KEY,
    mac_address      VARCHAR(32),
    ip_address       VARCHAR(64)  NOT NULL,
    user_agent       TEXT,
    portal_shown_at  REAL,
    first_seen       REAL         NOT NULL DEFAULT (unixepoch()),
    last_seen        REAL         NOT NULL DEFAULT (unixepoch()),
    accepted_terms   BOOLEAN      NOT NULL DEFAULT 0
);

-- ─── Default bandwidth policy ─────────────────────────────────────────────────
INSERT OR IGNORE INTO bandwidth_policies (id, name, max_concurrent, throttle_kbps, daily_quota_per_ip)
VALUES ('default', 'default', 5, 0, 5);

COMMIT;
