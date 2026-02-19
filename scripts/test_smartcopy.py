# NOTE: These tests were written for an SQLAlchemy/async version of the project and are NOT compatible with
# this codebase (which uses plain sqlite3). They are preserved for reference only. Do not run them as-is.

"""
SmartCopy Pro – Test Suite
==========================
Run: pytest tests/ -v

Tests cover:
  - Token issuance, verification, expiry, replay prevention
  - Mobile download endpoint (range requests, throttle, quota)
  - Queue engine (USB vs Mobile dispatch, priority, cancellation)
  - Payment flows (manual confirm, Stripe webhook)
  - Agent hub (register, progress, complete)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# ─── Setup in-memory DB for tests ─────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Patch settings before importing app modules
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["MEDIA_ROOT"] = "/tmp/smartcopy_test_media"
os.environ["SERVER_BASE_URL"] = "http://testserver"
os.environ["MAX_CONCURRENT_MOBILE_DOWNLOADS"] = "3"
os.environ["MOBILE_THROTTLE_KBPS"] = "0"
os.environ["MAX_DAILY_DOWNLOADS_PER_IP"] = "10"

Path("/tmp/smartcopy_test_media").mkdir(exist_ok=True)

# Now import app modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.mobile_delivery import (
    _sign, _verify, TokenError, issue_download_token, _throttled_file_chunks
)
from backend.models import Base, Job, MediaItem, DownloadToken
from backend.config import settings
from backend.database import get_db
from backend.app import app


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Test HTTP client with overridden DB."""
    from backend import crud
    app.dependency_overrides[get_db] = lambda: db_session

    # Initialize queue engine
    from backend.queue_engine import get_queue_engine
    engine = get_queue_engine()
    await engine.start()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac

    await engine.stop()
    app.dependency_overrides.clear()


@pytest.fixture
def sample_media_file() -> Path:
    """Create a 1 MB test file."""
    path = Path("/tmp/smartcopy_test_media/test_movie.mp4")
    path.write_bytes(os.urandom(1024 * 1024))  # 1 MB
    yield path
    path.unlink(missing_ok=True)


# ─── Token Tests ──────────────────────────────────────────────────────────────

class TestTokens:
    def test_sign_and_verify(self):
        payload = {"job_id": "abc", "media_id": "xyz", "nonce": "n1",
                   "iat": int(time.time()), "exp": int(time.time()) + 900}
        token = _sign(payload)
        result = _verify(token)
        assert result["job_id"] == "abc"
        assert result["nonce"] == "n1"

    def test_expired_token(self):
        payload = {"job_id": "abc", "media_id": "xyz", "nonce": "n1",
                   "iat": int(time.time()) - 1000, "exp": int(time.time()) - 1}
        token = _sign(payload)
        with pytest.raises(TokenError, match="expired"):
            _verify(token)

    def test_tampered_signature(self):
        payload = {"job_id": "abc", "media_id": "xyz", "nonce": "n1",
                   "iat": int(time.time()), "exp": int(time.time()) + 900}
        token = _sign(payload)
        tampered = token[:-4] + "XXXX"
        with pytest.raises(TokenError, match="invalid signature"):
            _verify(tampered)

    def test_malformed_token(self):
        with pytest.raises(TokenError, match="malformed"):
            _verify("notavalidtoken")

    def test_issue_download_token(self):
        token_str, nonce = issue_download_token("job1", "media1", ttl_seconds=600)
        assert token_str
        assert len(nonce) == 32  # uuid4().hex
        payload = _verify(token_str)
        assert payload["job_id"] == "job1"
        assert payload["media_id"] == "media1"
        assert payload["nonce"] == nonce


# ─── Mobile Download Tests ────────────────────────────────────────────────────

class TestMobileDownload:
    @pytest_asyncio.fixture
    async def job_and_token(self, db_session: AsyncSession, sample_media_file: Path):
        """Create a job, media item, and valid download token in DB."""
        from backend import crud

        media = await crud.create_media(
            db_session,
            title="Test Movie",
            file_path="test_movie.mp4",
            file_size=sample_media_file.stat().st_size,
            media_type="movie",
        )
        job = await crud.create_job(
            db_session,
            media_id=media.id,
            delivery_type="mobile",
        )
        token_str, nonce = issue_download_token(job.id, media.id, ttl_seconds=900)
        await crud.create_download_token(
            db_session, nonce=nonce, job_id=job.id,
            media_id=media.id, expires_at=time.time() + 900,
        )
        return job, media, token_str, nonce

    @pytest.mark.asyncio
    async def test_full_download(self, client, job_and_token, sample_media_file):
        job, media, token, _ = job_and_token
        resp = await client.get(f"/api/download/{job.id}", params={"token": token})
        assert resp.status_code == 200
        assert len(resp.content) == sample_media_file.stat().st_size
        assert "X-Checksum-SHA256" in resp.headers

    @pytest.mark.asyncio
    async def test_range_request(self, client, job_and_token, sample_media_file):
        job, media, token, _ = job_and_token
        resp = await client.get(
            f"/api/download/{job.id}",
            params={"token": token},
            headers={"Range": "bytes=0-1023"},
        )
        assert resp.status_code == 206
        assert len(resp.content) == 1024
        assert "Content-Range" in resp.headers

    @pytest.mark.asyncio
    async def test_replay_rejected(self, client, job_and_token):
        job, media, token, _ = job_and_token
        # First download
        r1 = await client.get(f"/api/download/{job.id}", params={"token": token})
        assert r1.status_code == 200
        # Replay attempt
        r2 = await client.get(f"/api/download/{job.id}", params={"token": token})
        assert r2.status_code == 401
        assert "already used" in r2.json()["detail"]

    @pytest.mark.asyncio
    async def test_invalid_token_rejected(self, client, job_and_token):
        job, *_ = job_and_token
        resp = await client.get(f"/api/download/{job.id}", params={"token": "invalid"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self, client, db_session, sample_media_file):
        from backend import crud
        media = await crud.create_media(db_session, title="X", file_path="test_movie.mp4",
                                        file_size=100, media_type="movie")
        job = await crud.create_job(db_session, media_id=media.id, delivery_type="mobile")
        # Issue with -1s TTL (already expired)
        token_str, nonce = issue_download_token(job.id, media.id, ttl_seconds=-1)
        await crud.create_download_token(db_session, nonce=nonce, job_id=job.id,
                                          media_id=media.id, expires_at=time.time() - 1)
        resp = await client.get(f"/api/download/{job.id}", params={"token": token_str})
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_checksum_header_correct(self, client, job_and_token, sample_media_file):
        job, media, token, _ = job_and_token
        resp = await client.get(f"/api/download/{job.id}", params={"token": token})
        assert resp.status_code == 200
        expected = hashlib.sha256(sample_media_file.read_bytes()).hexdigest()
        assert resp.headers["X-Checksum-SHA256"] == expected


# ─── Throttled Streaming Tests ────────────────────────────────────────────────

class TestThrottledStreaming:
    @pytest.mark.asyncio
    async def test_streams_full_file(self, sample_media_file: Path):
        path = sample_media_file
        size = path.stat().st_size
        received = 0
        async for chunk in _throttled_file_chunks(path, 0, size, throttle_kbps=0):
            received += len(chunk)
        assert received == size

    @pytest.mark.asyncio
    async def test_range_streaming(self, sample_media_file: Path):
        path = sample_media_file
        received = 0
        async for chunk in _throttled_file_chunks(path, 0, 512, throttle_kbps=0):
            received += len(chunk)
        assert received == 512


# ─── Queue Engine Tests ───────────────────────────────────────────────────────

class TestQueueEngine:
    @pytest.mark.asyncio
    async def test_enqueue_and_dispatch_mobile(self, db_session, client):
        from backend import crud
        from backend.queue_engine import get_queue_engine

        media = await crud.create_media(db_session, title="Q Movie",
                                        file_path="test.mp4", file_size=100)
        job = await crud.create_job(db_session, media_id=media.id, delivery_type="mobile")

        engine = get_queue_engine()
        await engine.enqueue(job.id)
        await asyncio.sleep(0.2)  # Let dispatcher run

        from sqlalchemy import select
        result = await db_session.execute(select(Job).where(Job.id == job.id))
        updated = result.scalar_one()
        assert updated.status in ("processing", "queued")

    @pytest.mark.asyncio
    async def test_cancel_job(self, db_session, client):
        from backend import crud
        from backend.queue_engine import get_queue_engine

        media = await crud.create_media(db_session, title="Cancel Movie",
                                        file_path="test.mp4", file_size=100)
        job = await crud.create_job(db_session, media_id=media.id, delivery_type="mobile")
        await crud.create_job.__module__  # ensure import

        engine = get_queue_engine()
        await engine.enqueue(job.id)
        await engine.cancel_job(job.id)

        from sqlalchemy import select
        result = await db_session.execute(select(Job).where(Job.id == job.id))
        updated = result.scalar_one()
        assert updated.status == "cancelled"

    @pytest.mark.asyncio
    async def test_priority_bump(self, db_session, client):
        from backend import crud
        from backend.queue_engine import get_queue_engine

        media = await crud.create_media(db_session, title="Priority Movie",
                                        file_path="test.mp4", file_size=100)
        job = await crud.create_job(db_session, media_id=media.id, delivery_type="mobile")
        engine = get_queue_engine()
        await engine.enqueue(job.id, priority=0)
        await engine.bump_priority(job.id, priority=10)

        from sqlalchemy import select
        result = await db_session.execute(select(Job).where(Job.id == job.id))
        updated = result.scalar_one()
        assert updated.priority == 10


# ─── Admin API Tests ──────────────────────────────────────────────────────────

class TestAdminAPI:
    @pytest.mark.asyncio
    async def test_create_job_usb(self, client, db_session):
        from backend import crud
        media = await crud.create_media(db_session, title="USB Movie",
                                        file_path="test.mp4", file_size=100)
        resp = await client.post("/api/admin/jobs", json={
            "media_id": media.id,
            "delivery_type": "usb",
            "drive_id": "E:",
        })
        assert resp.status_code == 200
        assert "job_id" in resp.json()

    @pytest.mark.asyncio
    async def test_create_job_mobile(self, client, db_session):
        from backend import crud
        media = await crud.create_media(db_session, title="Mobile Movie",
                                        file_path="test.mp4", file_size=100)
        resp = await client.post("/api/admin/jobs", json={
            "media_id": media.id,
            "delivery_type": "mobile",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_manual_payment_confirm_issues_token(self, client, db_session,
                                                        sample_media_file):
        from backend import crud
        media = await crud.create_media(db_session, title="Pay Movie",
                                        file_path="test_movie.mp4",
                                        file_size=sample_media_file.stat().st_size)
        job = await crud.create_job(db_session, media_id=media.id,
                                     delivery_type="mobile")

        resp = await client.post("/api/admin/payment/confirm", json={
            "job_id": job.id,
            "admin_user": "manager1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "download_url" in data
        assert "download_token" in data

    @pytest.mark.asyncio
    async def test_list_agents(self, client):
        resp = await client.get("/api/admin/agents")
        assert resp.status_code == 200
        assert "agents" in resp.json()

    @pytest.mark.asyncio
    async def test_issue_token_endpoint(self, client, db_session, sample_media_file):
        from backend import crud
        media = await crud.create_media(db_session, title="Token Movie",
                                        file_path="test_movie.mp4",
                                        file_size=sample_media_file.stat().st_size)
        job = await crud.create_job(db_session, media_id=media.id, delivery_type="mobile")

        resp = await client.post("/api/admin/issue_download_token", json={
            "job_id": job.id,
            "media_id": media.id,
            "ttl_seconds": 300,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "download_url" in data
        assert data["expires_in"] == 300


# ─── Integration Scenario ─────────────────────────────────────────────────────

class TestEndToEndMobileFlow:
    """
    Full flow: create job → admin confirms → token issued → download with range
    → verify checksum.
    """

    @pytest.mark.asyncio
    async def test_full_mobile_flow(self, client, db_session, sample_media_file):
        from backend import crud

        # 1. Create media
        media = await crud.create_media(
            db_session, title="Integration Movie",
            file_path="test_movie.mp4",
            file_size=sample_media_file.stat().st_size,
        )

        # 2. Customer requests mobile delivery
        resp = await client.post("/api/admin/jobs", json={
            "media_id": media.id,
            "delivery_type": "mobile",
            "payment_mode": "manual",
        })
        assert resp.status_code == 200
        job_id = resp.json()["job_id"]

        # 3. Admin confirms payment
        confirm_resp = await client.post("/api/admin/payment/confirm", json={
            "job_id": job_id,
            "admin_user": "cashier1",
        })
        assert confirm_resp.status_code == 200
        download_url = confirm_resp.json()["download_url"]
        token = confirm_resp.json()["download_token"]

        # 4. Client downloads first 512 KB (range)
        file_size = sample_media_file.stat().st_size
        mid = file_size // 2
        r1 = await client.get(
            f"/api/download/{job_id}",
            params={"token": token},
            headers={"Range": f"bytes=0-{mid - 1}"},
        )
        assert r1.status_code == 206
        assert len(r1.content) == mid

        # Token is now used — need fresh token for continuation test
        resend_resp = await client.post("/api/admin/resend_download_link", json={
            "job_id": job_id,
        })
        assert resend_resp.status_code == 200
        new_token = resend_resp.json()["download_url"].split("token=")[1]

        # 5. Resume: download remaining bytes
        r2 = await client.get(
            f"/api/download/{job_id}",
            params={"token": new_token},
            headers={"Range": f"bytes={mid}-{file_size - 1}"},
        )
        assert r2.status_code == 206
        assert len(r2.content) == file_size - mid

        # 6. Verify checksum of original file
        expected_sha = hashlib.sha256(sample_media_file.read_bytes()).hexdigest()
        combined = r1.content + r2.content
        assert hashlib.sha256(combined).hexdigest() == expected_sha

        # 7. Check job status
        status_resp = await client.get(f"/api/admin/jobs/{job_id}")
        assert status_resp.status_code == 200
