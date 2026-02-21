"""
Tests: Disk space validation (item G), crash recovery (item F),
       idempotent state transitions (item H).
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock
from tests.conftest import make_media, make_drive
from backend.queue_engine import CopyQueueEngine
from backend.database import db_cursor


# ── Disk space tests ──────────────────────────────────────────────────────────

def test_disk_check_returns_none_when_space_ok(fresh_db, tmp_path):
    engine = CopyQueueEngine()
    job = {
        "drive_id": str(make_drive()),
        "size_bytes": 1_000,
        "drive_path": str(tmp_path),
    }
    with patch("shutil.disk_usage", return_value=MagicMock(free=10_000_000_000)):
        result = engine._check_disk_space(job)
    assert result is None


def test_disk_check_returns_error_when_insufficient(fresh_db, tmp_path):
    engine = CopyQueueEngine()
    job = {
        "drive_id": "local-drive-no-colon",
        "size_bytes": 5_000_000_000,
        "drive_path": str(tmp_path),
    }
    with patch("shutil.disk_usage", return_value=MagicMock(free=1_000_000)):
        result = engine._check_disk_space(job)
    assert result is not None
    assert "Insufficient" in result


def test_disk_check_skips_agent_drives(fresh_db, tmp_path):
    """Agent drives (contain ':') should skip disk check."""
    engine = CopyQueueEngine()
    job = {
        "drive_id": "agent-abc:D:",
        "size_bytes": 999_999_999_999,  # impossibly large
        "drive_path": "D:\\",
    }
    result = engine._check_disk_space(job)
    assert result is None  # agent drives are skipped


def test_job_creation_blocks_when_drive_too_small(fresh_db):
    engine = CopyQueueEngine()
    media_id = make_media("BigMovie", 9_000_000_000)  # 9 GB
    drive_id = make_drive(free_bytes=500_000_000)      # 0.5 GB free

    with pytest.raises(RuntimeError, match="Insufficient space"):
        engine.create_job(media_id, drive_id, "usb", "manual")


# ── Crash recovery tests ──────────────────────────────────────────────────────

def test_recover_stale_jobs_resets_active_to_pending(fresh_db):
    """After server restart, active/dispatching jobs → pending."""
    import uuid
    from backend.database import recover_stale_jobs

    # Use make_media to satisfy FK constraint
    from tests.conftest import make_media
    real_media_id = make_media("RecoveryTestMedia")

    job_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO jobs (id,media_id,drive_id,status,delivery_type,payment_mode,
                              priority,total_bytes,customer_ip)
            VALUES (?,?,NULL,'active','usb','manual',0,0,NULL)
        """, (job_id, real_media_id))

    recover_stale_jobs()

    with db_cursor() as cur:
        cur.execute("SELECT status, error_message FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
    assert row["status"] == "pending"
    assert "restarted" in (row["error_message"] or "").lower()


def test_recover_stale_jobs_leaves_completed_untouched(fresh_db):
    import uuid
    from backend.database import recover_stale_jobs
    from tests.conftest import make_media

    real_media_id = make_media("CompletedMedia")
    job_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO jobs (id,media_id,drive_id,status,delivery_type,payment_mode,
                              priority,total_bytes,customer_ip)
            VALUES (?,?,NULL,'completed','usb','manual',0,0,NULL)
        """, (job_id, real_media_id))

    recover_stale_jobs()

    with db_cursor() as cur:
        cur.execute("SELECT status FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
    assert row["status"] == "completed"


# ── Idempotent state transitions ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancel_twice_is_idempotent(fresh_db):
    engine = CopyQueueEngine()
    media_id = make_media()
    drive_id = make_drive()
    job = engine.create_job(media_id, drive_id, "usb", "manual")
    job_id = job["id"]

    r1 = await engine.cancel_job(job_id)
    r2 = await engine.cancel_job(job_id)  # second cancel

    assert r1 is True
    assert r2 is False  # already cancelled, cannot cancel again


@pytest.mark.asyncio
async def test_enqueue_already_queued_is_idempotent(fresh_db):
    """Calling enqueue_job twice on a 'queued' job must not break state."""
    from backend.queue_engine import CopyQueueEngine
    import uuid

    engine = CopyQueueEngine()
    media_id = make_media(f"MobileMedia-{uuid.uuid4().hex[:6]}")
    job = engine.create_job(media_id, None, "mobile", "manual")
    job_id = job["id"]

    engine.enqueue_job(job_id)
    engine.enqueue_job(job_id)  # second call — must be safe

    with db_cursor() as cur:
        cur.execute("SELECT status FROM jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
    # Should still be queued (or pending if second enqueue had no effect)
    assert row["status"] in ("queued", "pending")
