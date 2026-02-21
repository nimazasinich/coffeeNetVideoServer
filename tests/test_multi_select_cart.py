"""
Tests: Multi-select cart → individual job creation (item B).
The frontend creates one job per media item.
The backend must accept each independently and enforce queue depth.
"""
import pytest
from tests.conftest import make_media, make_drive
from backend.queue_engine import CopyQueueEngine


def test_two_items_create_two_jobs(fresh_db):
    engine = CopyQueueEngine()
    m1 = make_media("Film A", 1_000_000_000)
    m2 = make_media("Film B", 2_000_000_000)
    d = make_drive()

    j1 = engine.create_job(m1, d, "usb", "manual")
    j2 = engine.create_job(m2, d, "usb", "manual")

    assert j1["id"] != j2["id"]
    assert j1["media_id"] == m1
    assert j2["media_id"] == m2


def test_five_items_create_five_jobs(fresh_db):
    engine = CopyQueueEngine()
    drive = make_drive()
    job_ids = []
    for i in range(5):
        m = make_media(f"Movie {i}")
        j = engine.create_job(m, drive, "usb", "manual")
        job_ids.append(j["id"])
    assert len(set(job_ids)) == 5  # all unique


def test_pricing_deterministic_for_each_item(fresh_db):
    """Each job should carry the media size so pricing can be computed correctly."""
    from backend.database import db_cursor
    engine = CopyQueueEngine()
    m_small = make_media("SmallFilm",  500_000_000)   # ~0.5 GB
    m_large = make_media("LargeFilm", 8_000_000_000)  # ~7.5 GB
    d = make_drive()

    j_small = engine.create_job(m_small, d, "usb", "manual")
    j_large = engine.create_job(m_large, d, "usb", "manual")

    # Confirm total_bytes is stored on each job for downstream pricing
    with db_cursor() as cur:
        cur.execute("SELECT total_bytes FROM jobs WHERE id=?", (j_small["id"],))
        assert cur.fetchone()["total_bytes"] == 500_000_000

        cur.execute("SELECT total_bytes FROM jobs WHERE id=?", (j_large["id"],))
        assert cur.fetchone()["total_bytes"] == 8_000_000_000


def test_insufficient_space_raises_for_oversized_item(fresh_db):
    """Job creation must fail if item is larger than available drive space."""
    engine = CopyQueueEngine()
    big_media = make_media("4KMovie", 10_000_000_000)  # 10 GB
    tiny_drive = make_drive(free_bytes=1_000_000_000)  # 1 GB free

    with pytest.raises(RuntimeError, match="Insufficient space"):
        engine.create_job(big_media, tiny_drive, "usb", "manual")


def test_cart_items_with_mobile_delivery(fresh_db):
    """Mobile delivery items don't need a drive_id."""
    engine = CopyQueueEngine()
    m1 = make_media("Mobile1")
    m2 = make_media("Mobile2")

    j1 = engine.create_job(m1, None, "mobile", "online")
    j2 = engine.create_job(m2, None, "mobile", "online")

    assert j1["delivery_type"] == "mobile"
    assert j2["delivery_type"] == "mobile"
    assert j1["drive_id"] is None
    assert j2["drive_id"] is None
