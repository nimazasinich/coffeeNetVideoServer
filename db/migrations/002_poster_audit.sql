-- SmartCopy Pro — Migration 002
-- Adds: media.poster_url, media.checksum_sha256, audit_logs, poster_assets
-- Run: sqlite3 data/smartcopy.db < db/migrations/002_poster_audit.sql
--
-- NOTE: SQLite does not support IF NOT EXISTS on ALTER TABLE.
-- This script is idempotent via CREATE TABLE IF NOT EXISTS but the
-- ALTER TABLE lines will error if columns already exist — safe to ignore.

BEGIN;

-- media: poster URL and checksum
-- (ignore errors if columns already exist)
ALTER TABLE media ADD COLUMN poster_url      VARCHAR(512);
ALTER TABLE media ADD COLUMN checksum_sha256 VARCHAR(64);

-- Unified audit log for money, job, device-lock, download events
CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY
                    DEFAULT (lower(hex(randomblob(16)))),
    event_type  VARCHAR(64)  NOT NULL,
    actor       VARCHAR(128),
    target_id   VARCHAR(36),
    detail      TEXT,
    ip          VARCHAR(64),
    created_at  REAL         NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type    ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_target  ON audit_logs(target_id);

-- Poster asset metadata (one row per upload)
CREATE TABLE IF NOT EXISTS poster_assets (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    media_id      VARCHAR(36)  REFERENCES media(id) ON DELETE SET NULL,
    filename      VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type     VARCHAR(64),
    size_bytes    INTEGER,
    thumb_url     VARCHAR(512),
    card_url      VARCHAR(512),
    full_url      VARCHAR(512),
    created_at    REAL         NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_poster_media ON poster_assets(media_id);

COMMIT;
