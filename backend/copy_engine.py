"""
SmartCopy — Copy Execution Engine
Stream-based copy with SHA-256 verification, .tmp safety, and progress reporting.

FIX NOTES
---------
BUG-07  Double / incorrect job update on start: _update_job_db(started_at="datetime('now')")
        set the field to the literal Python string "datetime('now')" because
        _update_job_db uses parameterized queries.  A second raw SQL UPDATE followed
        immediately to fix it — redundant and confusing.  Removed the first call.

BUG-08  Demo simulation too slow: a 12 GB file at 25 MB/s = 480 s per job.
        The simulated speed is now 500 MB/s for demo mode so copying finishes in
        a few seconds, making the UI properly interactive during development.

BUG-21  _stream_copy performed blocking file I/O (open / read / write) directly
        inside an async function without an executor.  Because FastAPI runs async
        route handlers on the event loop, every blocking read() call stalled ALL
        concurrent WebSocket deliveries, progress broadcasts, and queue-scheduler
        ticks for the duration of the chunk read.

        Fix: both the source-read and dest-write are now dispatched to the default
        ThreadPoolExecutor via asyncio.get_running_loop().run_in_executor().  This
        keeps the event loop free to service WebSocket clients and the scheduler
        while the disk I/O proceeds in a worker thread.

        The same executor pattern is applied consistently in _simulate_copy so
        that even the demo path doesn't accidentally block the loop when writing
        the placeholder file.
"""
import asyncio
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional

from backend.config import (
    CHUNK_SIZE_BYTES, COPY_TEMP_EXTENSION, PROGRESS_REPORT_INTERVAL_MS
)
from backend.database import db_cursor
from backend.media_library import get_media_by_id
from backend.websocket_hub import hub

logger = logging.getLogger("smartcopy.engine")


class CopyError(Exception):
    """Base copy error."""
    pass

class DriveRemovedError(CopyError):
    pass

class DiskFullError(CopyError):
    pass

class HashMismatchError(CopyError):
    pass

class SourceMissingError(CopyError):
    pass


def _update_job_db(job_id: str, **fields):
    set_clause = ", ".join(f"{k}=?" for k in fields)
    values = list(fields.values()) + [job_id]
    with db_cursor() as cur:
        cur.execute(f"UPDATE jobs SET {set_clause} WHERE id=?", values)


async def _report_progress(
    job_id: str,
    bytes_written: int,
    total_bytes: int,
    start_time: float,
    throughput: float,
):
    """Persist progress to DB and broadcast via WebSocket."""
    progress        = round((bytes_written / total_bytes * 100), 2) if total_bytes > 0 else 0
    eta             = int((total_bytes - bytes_written) / throughput) if throughput > 0 else 0
    throughput_mbps = round(throughput / 1_048_576, 2)

    with db_cursor() as cur:
        cur.execute(
            "UPDATE jobs SET progress=?, bytes_written=?, throughput_mbps=? WHERE id=?",
            (progress, bytes_written, throughput_mbps, job_id),
        )

    await hub.broadcast("job.progress", {
        "job_id":          job_id,
        "progress":        progress,
        "bytes_written":   bytes_written,
        "total_bytes":     total_bytes,
        "throughput_mbps": throughput_mbps,
        "eta_seconds":     eta,
    })


async def execute_copy(job_id: str, media_id: str, drive_path: str, drive_id: str):
    """
    Main copy coroutine. Called by worker pool.
    State transitions: dispatching → active → completed | failed
    """
    # FIX BUG-07: Removed the broken _update_job_db(started_at="datetime('now')")
    # call that set started_at to the literal string "datetime('now')" via
    # parameterized SQL.  We now issue one correct raw SQL UPDATE.
    with db_cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status='active', started_at=datetime('now'), error_message=NULL WHERE id=?",
            (job_id,),
        )

    await hub.broadcast("job.started", {"job_id": job_id})
    logger.info({"event": "job_started", "job_id": job_id, "media_id": media_id})

    media = get_media_by_id(media_id)
    if not media:
        await _fail_job(job_id, "Media record not found")
        return

    source_path = Path(media["path"])

    # SECURITY: Validate path is under MEDIA_ROOT to prevent traversal
    from backend.security import safe_path_under_root
    from backend.config import MEDIA_ROOT
    if not safe_path_under_root(str(source_path), str(MEDIA_ROOT)):
        logger.error({"event": "path_traversal_attempt", "job_id": job_id, "path": str(source_path)})
        await _fail_job(job_id, "Invalid media path")
        return

    source_checksum = media.get("checksum")

    # Development demo: if source doesn't exist, simulate
    is_demo = not source_path.exists()

    total_bytes  = media["size_bytes"]
    tmp_path: Optional[Path] = None

    try:
        # ── Pre-flight: disk space check ──────────────────────────────────
        import shutil
        usage = shutil.disk_usage(drive_path)
        if usage.free < total_bytes and not is_demo:
            raise DiskFullError(
                f"Need {total_bytes:,} bytes, only {usage.free:,} free"
            )

        # ── Set up destination ────────────────────────────────────────────
        safe_name = _safe_filename(media["name"], media["extension"])
        dest_path = Path(drive_path) / safe_name
        tmp_path  = Path(drive_path) / (safe_name + COPY_TEMP_EXTENSION)

        # ── Execute copy ──────────────────────────────────────────────────
        if is_demo:
            final_checksum = await _simulate_copy(job_id, tmp_path, total_bytes)
        else:
            final_checksum = await _stream_copy(job_id, source_path, tmp_path, total_bytes)

        # ── Verify checksum ───────────────────────────────────────────────
        if source_checksum and final_checksum:
            if final_checksum != source_checksum:
                raise HashMismatchError("SHA-256 mismatch — file corrupted during copy")

        # ── Atomic rename ─────────────────────────────────────────────────
        if tmp_path.exists():
            tmp_path.rename(dest_path)

        # ── Mark completed ────────────────────────────────────────────────
        with db_cursor() as cur:
            cur.execute("""
                UPDATE jobs
                SET status='completed', progress=100, completed_at=datetime('now')
                WHERE id=?
            """, (job_id,))

        await hub.broadcast("job.completed", {
            "job_id":     job_id,
            "media_name": media["name"],
            "drive_path": drive_path,
        })
        logger.info({"event": "job_completed", "job_id": job_id})

    except DiskFullError as e:
        await _cleanup_tmp(tmp_path)
        await _fail_job(job_id, f"DISK_FULL: {e}")

    except HashMismatchError as e:
        await _cleanup_tmp(tmp_path)
        await _fail_job(job_id, f"HASH_MISMATCH: {e}")

    except DriveRemovedError as e:
        await _fail_job(job_id, f"DRIVE_REMOVED: {e}")

    except SourceMissingError as e:
        await _fail_job(job_id, f"SOURCE_MISSING: {e}")

    except Exception as e:
        await _cleanup_tmp(tmp_path)
        await _fail_job(job_id, f"UNEXPECTED: {e}")
        logger.exception({"event": "job_exception", "job_id": job_id})


# ─── FIX BUG-21: Non-blocking stream copy ─────────────────────────────────────
#
# Original code did:
#
#   with open(source, "rb") as src, open(dest, "wb") as dst:
#       while True:
#           chunk = src.read(CHUNK_SIZE_BYTES)   ← blocks event loop
#           dst.write(chunk)                      ← blocks event loop
#
# Each read() on a spinning disk can take 10–100 ms.  For a 10 GB file with
# 512 KB chunks that is ~20,000 read() calls; in the worst case the event loop
# is blocked for minutes and no WebSocket message can get through.
#
# Fix: open the file handles in a thread via run_in_executor(), then perform
# each read/write pair in the executor as well.  The await on run_in_executor
# yields control back to the event loop between every chunk so WebSocket
# broadcasts, scheduler ticks, and heartbeats all proceed normally.

async def _stream_copy(
    job_id: str,
    source: Path,
    dest: Path,
    total_bytes: int,
) -> str:
    """Non-blocking stream copy using run_in_executor for all disk I/O."""
    loop          = asyncio.get_running_loop()
    h             = hashlib.sha256()
    bytes_written = 0
    start_time    = time.time()
    last_report   = start_time

    def _open_handles():
        return open(source, "rb"), open(dest, "wb")

    src, dst = await loop.run_in_executor(None, _open_handles)

    try:
        while True:
            # ── Read chunk in thread so the event loop stays free ─────────
            chunk = await loop.run_in_executor(None, src.read, CHUNK_SIZE_BYTES)
            if not chunk:
                break

            # Detect drive removal between chunks
            if not dest.parent.exists():
                raise DriveRemovedError("Destination drive disappeared")

            # ── Write chunk in thread ─────────────────────────────────────
            await loop.run_in_executor(None, dst.write, chunk)

            h.update(chunk)
            bytes_written += len(chunk)

            now = time.time()
            if (now - last_report) * 1000 >= PROGRESS_REPORT_INTERVAL_MS:
                elapsed    = now - start_time
                throughput = bytes_written / elapsed if elapsed > 0 else 0
                await _report_progress(job_id, bytes_written, total_bytes, start_time, throughput)
                last_report = now

            # Explicit yield so the scheduler can run between executor calls
            await asyncio.sleep(0)

    finally:
        await loop.run_in_executor(None, src.close)
        await loop.run_in_executor(None, dst.close)

    return h.hexdigest()


async def _simulate_copy(
    job_id: str,
    dest: Path,
    total_bytes: int,
) -> str:
    """
    Demo mode: simulate copy without a real file.

    FIX BUG-08: Original speed was 25 MB/s making a 12 GB file take 8 minutes.
    Raised to 500 MB/s so demo jobs finish in ~24 s for the largest files,
    keeping the UI interactive and testable without real media.
    """
    DEMO_SPEED_BYTES_PER_SEC = 500 * 1024 * 1024   # 500 MB/s
    loop          = asyncio.get_running_loop()
    h             = hashlib.sha256()
    bytes_written = 0
    start_time    = time.time()
    last_report   = start_time

    # Write minimal placeholder file (non-blocking)
    def _write_placeholder():
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"SMARTCOPY_DEMO\n")

    try:
        await loop.run_in_executor(None, _write_placeholder)
    except Exception:
        pass

    chunk_size = 4 * 1024 * 1024  # simulate 4 MB chunks
    while bytes_written < total_bytes:
        step = min(chunk_size, total_bytes - bytes_written)
        bytes_written += step
        h.update(b"\x00" * step)

        now = time.time()
        if (now - last_report) * 1000 >= PROGRESS_REPORT_INTERVAL_MS:
            elapsed    = now - start_time
            throughput = DEMO_SPEED_BYTES_PER_SEC
            await _report_progress(job_id, bytes_written, total_bytes, start_time, throughput)
            last_report = now

        await asyncio.sleep(step / DEMO_SPEED_BYTES_PER_SEC)

    return h.hexdigest()


async def _fail_job(job_id: str, reason: str):
    with db_cursor() as cur:
        cur.execute("""
            UPDATE jobs
            SET status='failed', error_message=?, completed_at=datetime('now')
            WHERE id=?
        """, (reason, job_id))
    await hub.broadcast("job.failed", {"job_id": job_id, "reason": reason})
    logger.warning({"event": "job_failed", "job_id": job_id, "reason": reason})


async def _cleanup_tmp(tmp_path: Optional[Path]):
    if tmp_path and tmp_path.exists():
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, tmp_path.unlink)
            logger.info({"event": "tmp_cleaned", "path": str(tmp_path)})
        except Exception as e:
            logger.warning({"event": "tmp_cleanup_error", "error": str(e)})


def _safe_filename(name: str, extension: str) -> str:
    """Strip dangerous characters from filename."""
    import re
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    safe = safe.strip(". ")[:200]
    return f"{safe}.{extension}"
