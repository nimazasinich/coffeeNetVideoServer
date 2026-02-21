"""
Tests: License enforcement (item C).
Verifies that invalid / expired licenses block job creation
and that tier-based job caps are enforced.
"""
import json
import hmac
import hashlib
import pytest
import time
from pathlib import Path
from tests.conftest import make_media, make_drive


def _sign(data: dict, secret: str) -> str:
    clean = {k: v for k, v in data.items() if k != "signature"}
    payload = json.dumps(clean, sort_keys=True, separators=(',', ':'))
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _write_license(tmp_path, data: dict, sign: bool = True, secret: str = "test-secret-key-32chars-for-tests!"):
    import backend.config as cfg
    cfg.DATA_DIR = tmp_path
    cfg.DB_PATH = tmp_path / "test.db"
    lic_path = tmp_path / "license.lic"
    if sign:
        data["signature"] = _sign(data, secret)
    lic_path.write_text(json.dumps(data))
    # Update license module path references
    import backend.license as lic_mod
    lic_mod.LICENSE_FILE = lic_path
    return lic_path


def test_no_license_allows_up_to_5_jobs(fresh_db, tmp_path):
    import backend.config as cfg
    cfg.DATA_DIR = tmp_path
    # Ensure no license file
    lic_path = tmp_path / "license.lic"
    if lic_path.exists():
        lic_path.unlink()
    import backend.license as lic_mod
    lic_mod.LICENSE_FILE = lic_path

    from backend.main import _check_license_for_job_creation
    from tests.conftest import make_media, make_drive
    from backend.queue_engine import CopyQueueEngine

    engine = CopyQueueEngine()
    drive = make_drive()

    # Create 5 jobs — should succeed (demo cap)
    for i in range(5):
        m = make_media(f"Movie {i}")
        engine.create_job(m, drive, "usb", "manual")

    # 6th job should trigger license cap (job 1-5 are pending)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        _check_license_for_job_creation()
    assert exc_info.value.status_code == 429


def test_valid_license_returns_no_error(fresh_db, tmp_path):
    _write_license(tmp_path, {
        "tier": "professional",
        "issued_to": "Test Shop",
        "expires_at": "2099-01-01T00:00:00"
    })
    from backend.license import read_license
    valid, data, msg = read_license()
    assert valid is True
    assert data["tier"] == "professional"


def test_expired_license_blocks_jobs(fresh_db, tmp_path):
    _write_license(tmp_path, {
        "tier": "standard",
        "issued_to": "Test Shop",
        "expires_at": "2000-01-01T00:00:00"  # past
    })
    from backend.main import _check_license_for_job_creation
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        _check_license_for_job_creation()
    assert exc_info.value.status_code == 403
    assert "expired" in exc_info.value.detail.lower() or "invalid" in exc_info.value.detail.lower()


def test_tampered_license_blocks_jobs(fresh_db, tmp_path):
    lic_path = tmp_path / "license.lic"
    data = {
        "tier": "enterprise",
        "issued_to": "Attacker",
        "expires_at": "2099-01-01T00:00:00",
        "signature": "badsignature000000000000"
    }
    lic_path.write_text(json.dumps(data))
    import backend.license as lic_mod
    lic_mod.LICENSE_FILE = lic_path

    from backend.main import _check_license_for_job_creation
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        _check_license_for_job_creation()
    assert exc_info.value.status_code == 403


def test_get_license_state_returns_structured_info(fresh_db, tmp_path):
    _write_license(tmp_path, {
        "tier": "standard",
        "issued_to": "My Shop",
        "expires_at": "2099-06-01T00:00:00"
    })
    from backend.license import get_license_state
    state = get_license_state()
    assert state["valid"] is True
    assert state["tier"] == "standard"
    assert state["issued_to"] == "My Shop"
    assert "install_id" in state
