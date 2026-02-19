-- SmartCopy Pro – Seed Data
-- Run: sqlite3 smartcopy.db < scripts/seed.sql

BEGIN;

-- Sample media items (file_path relative to MEDIA_ROOT)
INSERT OR IGNORE INTO media_items (id, title, file_path, file_size, media_type, created_at)
VALUES
    ('media-001', 'Inception (2010)', 'movies/inception.mkv', 8589934592, 'movie', unixepoch()),
    ('media-002', 'The Dark Knight (2008)', 'movies/dark_knight.mkv', 7516192768, 'movie', unixepoch()),
    ('media-003', 'Breaking Bad S01E01', 'series/breaking_bad/s01e01.mkv', 1073741824, 'series', unixepoch());

-- Default bandwidth policy (already in migrate.sql, just in case)
INSERT OR IGNORE INTO bandwidth_policies (id, name, max_concurrent, throttle_kbps, daily_quota_per_ip)
VALUES ('default', 'default', 5, 0, 5);

-- Latest agent version (update when releasing new agent builds)
INSERT OR IGNORE INTO agent_versions (id, version, download_url, checksum_sha256, release_notes, is_mandatory)
VALUES (
    'ver-001',
    '1.0.0',
    'http://localhost:8000/downloads/agent/smartcopy_agent_1.0.0.exe',
    'placeholder_sha256_update_after_build',
    'Initial release',
    0
);

COMMIT;
