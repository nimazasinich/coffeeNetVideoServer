"""
Shared fixtures for SmartCopy Pro tests.
Uses an in-memory SQLite DB isolated per test session.
"""
import os
import sys
import asyncio
import tempfile
import pytest
from pathlib import Path

# Put project root on path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

# Point DB and media root to temp locations before importing app modules
TMP = tempfile.mkdtemp()
os.environ["SMARTCOPY_MEDIA_ROOT"] = TMP
os.environ.setdefault("SMARTCOPY_SECRET", "test-secret-key-32chars-for-tests!")

# Override DB path to per-test temp
import backend.config as _cfg
_cfg.DB_PATH = Path(TMP) / "test.db"
_cfg.MEDIA_ROOT = Path(TMP)
_cfg.DATA_DIR = Path(TMP)

from backend.database import init_db, db_cursor
from backend.security import ensure_default_admin


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    """Recreate DB tables before every test."""
    import backend.config as cfg
    cfg.DB_PATH = tmp_path / "test.db"
    cfg.DATA_DIR = tmp_path
    init_db()
    ensure_default_admin()
    yield
    # cleanup is implicit since tmp_path is per-test


def make_media(name="Test Movie", size_bytes=500_000_000) -> str:
    """Insert a dummy media row and return its id."""
    import uuid
    media_id = str(uuid.uuid4())
    unique_suffix = uuid.uuid4().hex[:8]
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO media (id,name,path,size_bytes,category,quality_category,extension,is_copyable)
               VALUES (?,?,?,?,'movie','HD','.mp4',1)""",
            (media_id, name, f"/fake/{name}_{unique_suffix}.mp4", size_bytes),
        )
    return media_id


def make_drive(free_bytes=10_000_000_000) -> str:
    """Insert a dummy drive and return its id."""
    import uuid
    drive_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO drives (id,path,label,capacity_bytes,free_bytes)
               VALUES (?,?,?,?,?)""",
            (drive_id, f"/mnt/drive_{drive_id[:6]}", "USB Drive", 20_000_000_000, free_bytes),
        )
    return drive_id
