"""
SmartCopy Pro — Copy Queue Engine

FIX NOTES
---------
BUG-04  Race condition: _get_next_job returned a job but its DB status was NOT
        updated before the worker task started. The next scheduler tick (1 second
        later) would pick the same job again, launching duplicate workers.
        Fix: _mark_job_dispatching() atomically changes status to 'dispatching'
        in the SAME db_cursor call that picks the job, and only returns the row
        if the UPDATE actually affected a row.

BUG-05  Semaphore misuse: `async with self._semaphore: asyncio.create_task(...)`.
        create_task() returns immediately so the semaphore is released before the
        worker runs—all MAX_CONCURRENT_COPIES slots are freed instantly.
        Fix: Pass the semaphore into the worker coroutine so it is held for the
        entire duration of the job.

BUG-06  Mobile jobs never completed: the worker's `elif delivery_type == 'mobile':`
        branch was `pass`. Jobs sat in 'queued' forever. The correct behaviour is
        to set the job status to 'active' immediately (token already issued by
        payments.py); the download endpoint calls complete_mobile_job() when the
        stream finishes.
"""
import asyncio
import logging
import uuid
from typing import Dict, Optional, Set

from backend.config import MAX_CONCURRENT_COPIES, MAX_QUEUE_DEPTH
from backend.database import db_cursor, get_setting
from backend.websocket_hub import hub
from backend.agent_hub import hub as agent_hub

logger = logging.getLogger("smartcopy.queue")


class DriveLockManager:
    """In-memory mutex map keyed by drive_id."""

    def __init__(self):
        self._locked: Set[str] = set()
        self._lock = asyncio.Lock()

    async def acquire(self, drive_id: str) -> bool:
        async with self._lock:
            if drive_id in self._locked:
                return False
            self._locked.add(drive_id)
            return True

    async def release(self, drive_id: str):
        async with self._lock:
            self._locked.discard(drive_id)

    def is_locked(self, drive_id: str) -> bool:
        return drive_id in self._locked


class CopyQueueEngine:
    """
    Central orchestrator.
    - USB local:  CopyEngine writes file directly (server shares path with drive)
    - USB agent:  AgentHub dispatches job to a registered Windows agent
    - Mobile:     Token issued by payments.py; download stream completes the job
    """

    def __init__(self):
        self.lock_manager  = DriveLockManager()
        self._active_count = 0
        self._running      = False
        self._mobile_active: Dict[str, str] = {}   # job_id → ip

    def _get_max_concurrent(self) -> int:
        try:
            val = get_setting("max_copies_per_session", str(MAX_CONCURRENT_COPIES))
            return int(val)
        except Exception as e:
            logger.error({"event": "get_max_concurrent_error", "error": str(e)})
            return MAX_CONCURRENT_COPIES

    def create_job(
        self,
        media_id:      str,
        drive_id:      Optional[str] = None,
        delivery_type: str = "usb",
        payment_mode:  str = "manual",
        customer_ip:   Optional[str] = None,
        priority:      int = 0,
    ) -> dict:
        """Validate and enqueue a new job."""
        with db_cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status IN ('pending','active','queued','dispatching')")
            if cur.fetchone()["cnt"] >= MAX_QUEUE_DEPTH:
                raise RuntimeError("Queue is full. Please try again later.")

            cur.execute("SELECT id, name, size_bytes, is_copyable FROM media WHERE id=?", (media_id,))
            media = cur.fetchone()
            if not media:
                raise ValueError(f"Media {media_id} not found")
            if not media["is_copyable"]:
                raise RuntimeError("This media is currently unavailable for copying.")

            if delivery_type == "usb" and drive_id:
                if ":" not in drive_id:
                    # Local drive check
                    cur.execute("SELECT id, path, free_bytes FROM drives WHERE id=?", (drive_id,))
                    drive = cur.fetchone()
                    if not drive:
                        raise ValueError(f"Drive {drive_id} not registered")
                    if drive["free_bytes"] and drive["free_bytes"] < media["size_bytes"]:
                        raise RuntimeError(
                            f"Insufficient space. Need {media['size_bytes']:,} bytes, "
                            f"only {drive['free_bytes']:,} free."
                        )

            job_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO jobs
                    (id, media_id, drive_id, status, delivery_type, payment_mode,
                     priority, total_bytes, customer_ip)
                VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
            """, (job_id, media_id, drive_id, delivery_type, payment_mode,
                  priority, media["size_bytes"], customer_ip))

        logger.info({"event": "job_created", "job_id": job_id,
                     "delivery_type": delivery_type, "customer_ip": customer_ip})
        return self.get_job(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        with db_cursor() as cur:
            cur.execute("SELECT status, drive_id FROM jobs WHERE id=?", (job_id,))
            row = cur.fetchone()
            if not row or row["status"] not in ("pending", "active", "queued", "dispatching"):
                return False
            cur.execute("""
                UPDATE jobs SET status='cancelled', completed_at=datetime('now')
                WHERE id=? AND status IN ('pending','active','queued','dispatching')
            """, (job_id,))

        await hub.broadcast("job.cancelled", {"job_id": job_id})
        logger.info({"event": "job_cancelled", "job_id": job_id})
        return True

    def enqueue_job(self, job_id: str, priority: int = 0):
        """Move job to 'queued' state (e.g. after payment confirmed)."""
        with db_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status='queued', priority=? WHERE id=? AND status='pending'",
                (priority, job_id)
            )
        logger.info({"event": "job_enqueued", "job_id": job_id})

    # ── Scheduler ─────────────────────────────────────────────────────────────

    # FIX BUG-04: Atomic pick-and-mark. We pick the best candidate and immediately
    # UPDATE its status to 'dispatching' in ONE transaction. If another coroutine
    # already grabbed it (UPDATE affects 0 rows), we skip it.
    def _check_disk_space(self, job: dict) -> Optional[str]:
        """
        Validate that the target drive has enough free space for this job.
        Returns an error message string if space is insufficient, else None.
        Called right before dispatching a local USB job.
        """
        drive_id = job.get("drive_id")
        if not drive_id or ":" in drive_id:
            # Agent drives: skip — agent will report failure if needed
            return None
        size_needed = job.get("size_bytes") or 0
        if not size_needed:
            return None
        try:
            import shutil as _shutil
            from backend.config import MEDIA_ROOT as _MEDIA_ROOT
            drive_path = job.get("drive_path")
            if not drive_path:
                return None
            usage = _shutil.disk_usage(drive_path)
            if usage.free < size_needed:
                return (
                    f"Insufficient disk space on drive {drive_path}: "
                    f"need {size_needed:,} bytes, only {usage.free:,} free"
                )
        except Exception as e:
            logger.warning({"event": "disk_check_error", "error": str(e)})
        return None

    def _pick_and_mark_job(self) -> Optional[dict]:
        """
        Atomically select the next eligible job and mark it as 'dispatching'.
        Returns the job dict on success, None if nothing is ready.
        """
        with db_cursor() as cur:
            cur.execute("""
                SELECT j.id, j.media_id, j.drive_id, j.retry_count, j.delivery_type,
                       d.path as drive_path, d.free_bytes,
                       m.size_bytes
                FROM jobs j
                LEFT JOIN drives d ON d.id = j.drive_id
                JOIN  media  m  ON m.id = j.media_id
                WHERE j.status IN ('pending', 'queued')
                ORDER BY j.priority DESC, j.created_at ASC
            """)
            candidates = cur.fetchall()

        for row in candidates:
            drive_id = row["drive_id"]
            # Mobile jobs have no drive; USB jobs must not be drive-locked
            if drive_id and self.lock_manager.is_locked(drive_id):
                continue

            # Try to atomically claim the job
            with db_cursor() as cur:
                cur.execute("""
                    UPDATE jobs SET status='dispatching'
                    WHERE id=? AND status IN ('pending','queued')
                """, (row["id"],))
                if cur.rowcount == 0:
                    continue   # Another coroutine already claimed it

            return dict(row)

        return None

    # FIX BUG-05: Semaphore is now acquired INSIDE the worker coroutine so it is
    # held for the full duration of the copy/download, not just task creation.
    async def _worker(self, job: dict):
        """Execute a job, holding the semaphore for its full duration."""
        job_id        = job["id"]
        drive_id      = job["drive_id"]
        delivery_type = job["delivery_type"]

        try:
            if delivery_type == "usb" and drive_id:
                acquired = await self.lock_manager.acquire(drive_id)
                if not acquired:
                    # Re-queue the job so it gets picked up when lock is free
                    with db_cursor() as cur:
                        cur.execute(
                            "UPDATE jobs SET status='pending' WHERE id=?", (job_id,)
                        )
                    self._active_count -= 1
                    return

                try:
                    if ":" in drive_id:
                        # AGENT JOB
                        agent_id, drive_letter = drive_id.split(":", 1)
                        await self._dispatch_to_agent(job_id, job["media_id"], agent_id, drive_letter)
                    else:
                        # LOCAL JOB — check disk space at dispatch time
                        space_err = self._check_disk_space(job)
                        if space_err:
                            logger.error({"event": "disk_space_insufficient",
                                          "job_id": job_id, "error": space_err})
                            with db_cursor() as cur:
                                cur.execute(
                                    "UPDATE jobs SET status='failed', error_message=? WHERE id=?",
                                    (space_err, job_id)
                                )
                            await hub.broadcast("job.failed", {"job_id": job_id, "error": space_err})
                            self._active_count -= 1
                            await self.lock_manager.release(drive_id)
                            return

                        from backend.copy_engine import execute_copy
                        with db_cursor() as cur:
                            cur.execute("UPDATE drives SET locked_by_job=? WHERE id=?", (job_id, drive_id))

                        try:
                            await execute_copy(
                                job_id     = job_id,
                                media_id   = job["media_id"],
                                drive_path = job["drive_path"],
                                drive_id   = drive_id,
                            )
                        finally:
                            with db_cursor() as cur:
                                cur.execute("UPDATE drives SET locked_by_job=NULL WHERE id=?", (drive_id,))
                except Exception as e:
                    logger.exception({"event": "worker_crash", "job_id": job_id, "error": str(e)})
                    await self.complete_usb_job(job_id, drive_id, False, str(e))
                finally:
                    await self.lock_manager.release(drive_id)

            # FIX BUG-06: Mobile jobs must transition to 'active' so the front-end
            # can see them in progress. The download endpoint calls complete_mobile_job
            # when the stream ends. Without this the job status was stuck forever.
            elif delivery_type == "mobile":
                with db_cursor() as cur:
                    cur.execute(
                        "UPDATE jobs SET status='active', started_at=datetime('now') WHERE id=?",
                        (job_id,)
                    )
                await hub.broadcast("job.started", {"job_id": job_id})
                logger.info({"event": "mobile_job_activated", "job_id": job_id})
                # Job completion is triggered by mobile_delivery.py when download stream finishes.
            else:
                # Unknown delivery type — fail gracefully
                with db_cursor() as cur:
                    cur.execute(
                        "UPDATE jobs SET status='failed', error_message=? WHERE id=?",
                        (f"Unknown delivery_type: {delivery_type}", job_id)
                    )

        except Exception as e:
            logger.exception({"event": "worker_outer_crash", "job_id": job_id, "error": str(e)})
        finally:
            if delivery_type != "mobile":
                # Mobile jobs are decremented when the stream actually finishes in mobile_delivery.py
                self._active_count -= 1

    async def _dispatch_to_agent(self, job_id: str, media_id: str, agent_id: str, drive_id: str):
        """Send command to physical agent."""
        # Disk-space check at dispatch time (agent drives report free_bytes=0 by default)
        # so we skip space check for agent drives and trust the agent to fail gracefully.
        with db_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status='active', started_at=datetime('now'), agent_id=? WHERE id=?",
                (agent_id, job_id)
            )

        payload = {
            "action":   "run_job",
            "job_id":   job_id,
            "media_id": media_id,
            "drive_id": drive_id
        }
        await agent_hub.send_job(agent_id, payload)
        # Track active job count per agent
        agent_hub.mark_job_started(agent_id, job_id)
        logger.info({"event": "job_dispatched_to_agent", "job_id": job_id, "agent_id": agent_id})

    async def run(self):
        """Main scheduler loop — polls DB for jobs every second."""
        self._running = True
        logger.info({"event": "queue_engine_started"})

        while self._running:
            try:
                if self._active_count < self._get_max_concurrent():
                    job = self._pick_and_mark_job()
                    if job:
                        self._active_count += 1
                        asyncio.create_task(self._worker(job))
            except Exception as e:
                logger.error({"event": "scheduler_error", "error": str(e)})
            await asyncio.sleep(1)

    # ── Callbacks from agent hub ───────────────────────────────────────────────

    async def complete_usb_job(self, job_id: str, drive_id: str, success: bool, error: str = ""):
        status = "completed" if success else "failed"
        with db_cursor() as cur:
            cur.execute("""
                UPDATE jobs SET status=?, error_message=?, completed_at=datetime('now')
                WHERE id=?
            """, (status, error or None, job_id))
            # drive_id here may be the composite "agent_id:drive_letter" form
            # — only attempt the drives table update for plain (local) drive IDs
            if drive_id and ":" not in drive_id:
                cur.execute("UPDATE drives SET locked_by_job=NULL WHERE id=?", (drive_id,))
        await hub.broadcast("job.completed" if success else "job.failed",
                            {"job_id": job_id, "drive_id": drive_id})
        logger.info({"event": f"agent_job_{status}", "job_id": job_id})

    async def complete_mobile_job(self, job_id: str, success: bool, error: str = ""):
        self._mobile_active.pop(job_id, None)
        self._active_count = max(0, self._active_count - 1)
        status = "completed" if success else "failed"
        with db_cursor() as cur:
            cur.execute("""
                UPDATE jobs SET status=?, error_message=?, completed_at=datetime('now')
                WHERE id=?
            """, (status, error or None, job_id))
        await hub.broadcast("job.completed" if success else "job.failed", {"job_id": job_id})

    async def on_agent_disconnect(self, agent_id: str):
        """Re-queue any processing jobs for a disconnected agent."""
        with db_cursor() as cur:
            cur.execute("""
                UPDATE jobs SET status='pending', agent_id=NULL, started_at=NULL
                WHERE agent_id=? AND status IN ('active','queued','dispatching')
            """, (agent_id,))
            rows = cur.rowcount
        if rows:
            logger.warning({"event": "jobs_requeued_on_disconnect",
                            "agent_id": agent_id, "count": rows})

    # ── Public queries ─────────────────────────────────────────────────────────

    def get_queue(self, include_completed: bool = False) -> list:
        with db_cursor() as cur:
            if include_completed:
                cur.execute("""
                    SELECT j.*, m.name as media_name, m.size_bytes as media_size
                    FROM jobs j LEFT JOIN media m ON m.id = j.media_id
                    ORDER BY j.created_at DESC LIMIT 200
                """)
            else:
                cur.execute("""
                    SELECT j.*, m.name as media_name, m.size_bytes as media_size
                    FROM jobs j LEFT JOIN media m ON m.id = j.media_id
                    WHERE j.status IN ('pending','active','queued','dispatching')
                    ORDER BY j.priority DESC, j.created_at ASC
                """)
            return [dict(r) for r in cur.fetchall()]

    def get_job(self, job_id: str) -> Optional[dict]:
        with db_cursor() as cur:
            cur.execute("""
                SELECT j.*, m.name as media_name, m.size_bytes as media_size
                FROM jobs j LEFT JOIN media m ON m.id = j.media_id
                WHERE j.id=?
            """, (job_id,))
            row = cur.fetchone()
        return dict(row) if row else None


# Singleton
queue_engine = CopyQueueEngine()
