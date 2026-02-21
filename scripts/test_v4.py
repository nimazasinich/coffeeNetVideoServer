import os
import sys
import uuid
import time
import pytest
import sqlite3
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# 1. Setup paths and environment
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

# Use a temporary database for testing
TEST_DB = BASE_DIR / "data" / "test_smartcopy.db"
os.environ["SMARTCOPY_SECRET"] = "test-secret-key-12345678901234567890"

# Mock DB_PATH in backend.config before importing anything that uses it
with patch("backend.config.DB_PATH", TEST_DB):
    from backend.main import app
    from backend.database import init_db, db_cursor
    from backend.mobile_delivery import _sign, _verify, TokenError
    from backend.security import hash_password

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_teardown_db():
    # Setup: Initialize clean test database
    if TEST_DB.exists():
        TEST_DB.unlink()
    init_db()
    
    # Ensure default admin exists
    with db_cursor() as cur:
        cur.execute("INSERT OR IGNORE INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)",
                    ("admin", hash_password("admin1234"), "admin"))
    
    yield
    
    # Teardown: Remove test database
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except PermissionError:
            pass # Windows file lock issue in some environments

def get_admin_token():
    resp = client.post("/api/admin/login", json={"username": "admin", "password": "admin1234"})
    return resp.json()["access_token"]

# ─── 1. Health & System Tests ────────────────────────────────────────────────

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "db_size_mb" in data

# ─── 2. Token Security Tests (Ref: BUG-14, BUG-15) ───────────────────────────

class TestTokens:
    def test_sign_and_verify(self):
        payload = {"job_id": "job-123", "media_id": "media-456", "nonce": "n1", "exp": time.time() + 300}
        token = _sign(payload)
        verified = _verify(token)
        assert verified["job_id"] == "job-123"
        assert verified["nonce"] == "n1"

    def test_expired_token(self):
        payload = {"job_id": "j1", "exp": time.time() - 10}
        token = _sign(payload)
        with pytest.raises(TokenError, match="expired"):
            _verify(token)

    def test_invalid_signature(self):
        token = _sign({"a": 1})
        bad_token = token[:-5] + "XXXXX"
        with pytest.raises(TokenError, match="invalid signature"):
            _verify(bad_token)

# ─── 3. UUID Validation Tests (Ref: BUG-03) ──────────────────────────────────

def test_invalid_uuid_media_endpoint():
    resp = client.get("/api/media/not-a-uuid")
    assert resp.status_code == 400
    assert "Invalid media ID" in resp.json()["detail"]

def test_invalid_uuid_job_endpoint():
    resp = client.get("/api/jobs/not-a-uuid")
    assert resp.status_code == 400
    assert "Invalid job ID" in resp.json()["detail"]

# ─── 4. Job Creation Tests (Ref: BUG-01) ─────────────────────────────────────

def test_create_job_success():
    # First, we need a media item in DB
    media_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("INSERT INTO media (id, name, path, size_bytes, extension) VALUES (?, ?, ?, ?, ?)",
                    (media_id, "Test Movie", "test.mp4", 1024*1024, ".mp4"))
    
    resp = client.post("/api/jobs", json={
        "media_id": media_id,
        "delivery_type": "mobile",
        "payment_mode": "manual"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["media_id"] == media_id
    assert data["status"] == "pending"

# ─── 5. Admin Security Tests (Ref: BUG-12) ────────────────────────────────────

def test_admin_confirm_payment_unauthorized():
    # BUG-12: This endpoint should require admin auth
    resp = client.post("/api/admin/payment/confirm", json={
        "job_id": str(uuid.uuid4()),
        "admin_user": "attacker"
    })
    assert resp.status_code == 401 # No token provided

def test_admin_confirm_payment_authorized():
    token = get_admin_token()
    media_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    with db_cursor() as cur:
        cur.execute("INSERT INTO media (id, name, path, size_bytes, extension) VALUES (?, ?, ?, ?, ?)",
                    (media_id, "Test Movie", "test.mp4", 1024*1024, ".mp4"))
        cur.execute("INSERT INTO jobs (id, media_id, delivery_type, status) VALUES (?, ?, ?, ?)",
                    (job_id, media_id, "mobile", "pending"))

    resp = client.post("/api/admin/payment/confirm", 
                      headers={"Authorization": f"Bearer {token}"},
                      json={
                          "job_id": job_id,
                          "admin_user": "admin"
                      })
    assert resp.status_code == 200
    assert "download_url" in resp.json()

# ─── 6. Mobile Delivery Logic (Ref: BUG-06, BUG-11) ──────────────────────────

def test_issue_token_via_admin():
    token = get_admin_token()
    media_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    with db_cursor() as cur:
        cur.execute("INSERT INTO media (id, name, path, size_bytes, extension) VALUES (?, ?, ?, ?, ?)",
                    (media_id, "Test Movie", "test.mp4", 1024*1024, ".mp4"))
        cur.execute("INSERT INTO jobs (id, media_id, delivery_type, status) VALUES (?, ?, ?, ?)",
                    (job_id, media_id, "mobile", "pending"))

    resp = client.post("/api/admin/issue_download_token",
                      headers={"Authorization": f"Bearer {token}"},
                      json={
                          "job_id": job_id,
                          "media_id": media_id,
                          "ttl_seconds": 600
                      })
    assert resp.status_code == 200
    assert "token" in resp.json()
    assert "download_url" in resp.json()

# ─── 7. Security Audit Tests (Ref: BUG-05, BUG-07, BUG-06) ───────────────────

def test_admin_sales_sql_injection():
    token = get_admin_token()
    # Attempt to inject into the 'date' parameter
    # Original: cur.execute(f"SELECT ... WHERE date(timestamp) = '{date}'")
    # Vulnerable would return all sales if we pass '2023-01-01' OR 1=1 --
    injection = "2023-01-01' OR '1'='1"
    resp = client.get(f"/api/admin/sales?date={injection}",
                      headers={"Authorization": f"Bearer {token}"})
    
    # If it's fixed, it uses ? placeholder, so it will look for a literal date 
    # string like "2023-01-01' OR '1'='1" and find 0 results.
    # If it's vulnerable, it might return results or a syntax error.
    # In SQLite, it should return 0 results because the string literal doesn't match any date.
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

def test_admin_reports_sql_injection():
    token = get_admin_token()
    # Attempt to inject into the 'days' parameter
    # Original: cur.execute(f"SELECT ... WHERE timestamp >= datetime('now', '-{days} days')")
    # If we pass something like "30') OR 1=1 --"
    # But since 'days' is typed as int in FastAPI, it should fail validation first.
    injection = "30') OR 1=1 --"
    resp = client.get(f"/api/admin/reports/daily?days={injection}",
                      headers={"Authorization": f"Bearer {token}"})
    
    # FastAPI should return 422 Unprocessable Entity for invalid int
    assert resp.status_code == 422

def test_stream_media_path_traversal():
    # Mocking agent token since it's required
    agent_token = "any-token"
    # Attempt to access something outside MEDIA_ROOT
    # Path: /api/media/{media_id}/stream
    # We need a media item with a malicious path in DB for this test to be meaningful
    # OR we can just try a media_id that doesn't exist but has traversal-like characters 
    # if the backend uses the media_id to construct the path (it doesn't, it uses the 'path' column).
    
    # So let's insert a media with a traversal path
    media_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("INSERT INTO media (id, name, path, size_bytes, extension) VALUES (?, ?, ?, ?, ?)",
                    (media_id, "Secret", "../../etc/passwd", 1024, ".txt"))
    
    resp = client.get(f"/api/media/{media_id}/stream?agent_token={agent_token}")
    
    # Should be 403 Forbidden because of safe_path_under_root check
    assert resp.status_code == 403
    assert "Invalid file path" in resp.json()["detail"]

if __name__ == "__main__":
    # Run with: pytest scripts/test_v4.py
    import pytest
    sys.exit(pytest.main([__file__]))
