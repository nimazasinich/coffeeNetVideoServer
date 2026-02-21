"""
SmartCopy Pro – Windows USB Delivery Agent
==========================================
Runs as a Windows service (via NSSM) or standalone for debugging.

Workflow
--------
1. Register with server: POST /api/agent/register
2. Open WebSocket: ws://<server>/ws/agent/<agent_id>
3. Monitor USB drives (WMI events or polling)
4. On job assignment: download file from server → write to USB (tmp → rename)
5. Compute sha256 → report result to server

Requirements
------------
    pip install websockets httpx pywin32 aiofiles

Run as debug
------------
    python -m agent.main --server http://192.168.1.100:8000 --debug

Run as Windows service (after NSSM install)
-------------------------------------------
    nssm install SmartCopyAgent "C:\Python311\python.exe" "-m agent.main"
    nssm set SmartCopyAgent AppDirectory "C:\SmartCopyAgent"
    nssm start SmartCopyAgent
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import platform
import shutil
import socket
import sys
import time
import uuid
from pathlib import Path
from typing import Dict, Optional, Set

import httpx
import aiofiles
import websockets

logger = logging.getLogger("agent")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("agent.log", encoding="utf-8"),
    ],
)

AGENT_VERSION = "1.0.0"
CHUNK_SIZE = 256 * 1024  # 256 KB
RETRY_DELAY = 5          # seconds between reconnect attempts
DRIVE_POLL_INTERVAL = 3  # seconds


def _is_windows() -> bool:
    return platform.system() == "Windows"


# ─── Drive monitoring ─────────────────────────────────────────────────────────

def _get_removable_drives() -> Set[str]:
    """Return set of removable drive letters (Windows) or /media/* mounts (Linux).
    BUGFIX: was using win32file (crashed with ModuleNotFoundError) — replaced with ctypes (no extra deps).
    """
    if _is_windows():
        try:
            import ctypes
            drives: Set[str] = set()
            bitmask = ctypes.windll.kernel32.GetLogicalDrives()
            DRIVE_REMOVABLE = 2
            for i in range(26):
                if bitmask & (1 << i):
                    letter = chr(65 + i)
                    drive_path = f"{letter}:\\"
                    dtype = ctypes.windll.kernel32.GetDriveTypeW(drive_path)
                    if dtype == DRIVE_REMOVABLE:
                        drives.add(f"{letter}:")
            drives.add("Z:")  # test drive
            return drives
        except Exception as e:
            logger.error("Drive scan error: %s", e)
            return {"Z:"}
    else:
        # Linux / Mac fallback — scan /media, /mnt, /run/media
        drives: Set[str] = set()
        for base in ["/media", "/mnt", "/run/media"]:
            base_path = Path(base)
            if base_path.exists():
                for entry in base_path.iterdir():
                    if entry.is_dir():
                        drives.add(str(entry))
        drives.add("Z:")  # always include test drive
        return drives


class DriveMonitor:
    """Polls for USB drive changes and calls callbacks."""

    def __init__(self, on_insert, on_remove):
        self._known: Set[str] = set()
        self._on_insert = on_insert
        self._on_remove = on_remove

    async def run(self):
        self._known = _get_removable_drives()
        while True:
            await asyncio.sleep(DRIVE_POLL_INTERVAL)
            current = _get_removable_drives()
            for d in current - self._known:
                logger.info("Drive inserted: %s", d)
                await self._on_insert(d)
            for d in self._known - current:
                logger.info("Drive removed: %s", d)
                await self._on_remove(d)
            self._known = current


# ─── Agent core ───────────────────────────────────────────────────────────────

class SmartCopyAgent:
    def __init__(self, server_url: str, agent_id: Optional[str] = None):
        self.server_url = server_url.rstrip("/")
        self.ws_url = server_url.replace("http://", "ws://").replace("https://", "wss://")
        self.agent_id = agent_id or self._load_or_create_agent_id()
        self.hostname = socket.gethostname()
        self.drives: Set[str] = set()
        self._active_jobs: Dict[str, asyncio.Task] = {}
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._running = True

    # ── ID persistence ────────────────────────────────────────────────────────

    @staticmethod
    def _load_or_create_agent_id() -> str:
        id_file = Path("agent_id.txt")
        if id_file.exists():
            return id_file.read_text().strip()
        new_id = uuid.uuid4().hex
        id_file.write_text(new_id)
        return new_id

    # ── Registration ──────────────────────────────────────────────────────────

    async def register(self) -> str:
        """Register with server, get WS token."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.server_url}/api/agent/register",
                json={
                    "agent_id": self.agent_id,
                    "hostname": self.hostname,
                    "version": AGENT_VERSION,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Registered as agent_id=%s", self.agent_id)
            return data["ws_token"]

    # ── Drive callbacks ───────────────────────────────────────────────────────

    async def on_drive_insert(self, drive_id: str):
        self.drives.add(drive_id)
        await self._send({"action": "drive_inserted", "drive_id": drive_id})

    async def on_drive_remove(self, drive_id: str):
        self.drives.discard(drive_id)
        await self._send({"action": "drive_removed", "drive_id": drive_id})

    # ── WebSocket session ─────────────────────────────────────────────────────

    async def run(self):
        self.drives = _get_removable_drives()
        monitor = DriveMonitor(self.on_drive_insert, self.on_drive_remove)
        asyncio.create_task(monitor.run())

        while self._running:
            try:
                await self._ws_session()
            except Exception as e:
                logger.error("WS error: %s — retrying in %ds", e, RETRY_DELAY)
                await asyncio.sleep(RETRY_DELAY)

    async def _ws_session(self):
        ws_token = await self.register()
        uri = f"{self.ws_url}/ws/agent/{self.agent_id}?token={ws_token}"
        logger.info("Connecting to %s", uri)

        async with websockets.connect(uri, ping_interval=20) as ws:
            self._ws = ws
            # Announce
            await self._send({
                "action": "register",
                "agent_id": self.agent_id,
                "hostname": self.hostname,
                "version": AGENT_VERSION,
                "drives": list(self.drives),
            })

            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await self._handle_server_message(msg)

        self._ws = None

    async def _send(self, payload: dict):
        if self._ws:
            await self._ws.send(json.dumps(payload))

    # ── Message handling ──────────────────────────────────────────────────────

    async def _handle_server_message(self, msg: dict):
        action = msg.get("action")

        if action == "run_job":
            job_id = msg["job_id"]
            media_id = msg["media_id"]
            drive_id = msg["drive_id"]
            if job_id not in self._active_jobs:
                task = asyncio.create_task(
                    self._execute_job(job_id, media_id, drive_id)
                )
                self._active_jobs[job_id] = task

        elif action == "cancel_job":
            job_id = msg["job_id"]
            task = self._active_jobs.pop(job_id, None)
            if task:
                task.cancel()
                logger.info("Job %s cancelled", job_id)

        elif action == "ping":
            await self._send({"action": "pong"})

    # ── Job execution ─────────────────────────────────────────────────────────

    async def _execute_job(self, job_id: str, media_id: str, drive_id: str):
        logger.info("Starting job %s → drive %s", job_id, drive_id)
        drive_path = Path(drive_id) / "Flash" / "Movies"

        try:
            drive_path.mkdir(parents=True, exist_ok=True)

            # Download from server
            url = f"{self.server_url}/api/media/{media_id}/stream"
            tmp_path = drive_path / f".tmp_{job_id}"
            sha256 = hashlib.sha256()
            total_bytes = 0

            async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
                async with client.stream("GET", url, params={"agent_token": self.agent_id}) as resp:
                    resp.raise_for_status()
                    total_size = int(resp.headers.get("content-length", 0))
                    filename = resp.headers.get("x-filename", f"{media_id}.bin")

                    async with aiofiles.open(tmp_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=CHUNK_SIZE):
                            await f.write(chunk)
                            sha256.update(chunk)
                            total_bytes += len(chunk)
                            # Report progress
                            await self._send({
                                "action": "progress",
                                "job_id": job_id,
                                "bytes_written": total_bytes,
                                "total_bytes": total_size,
                            })

            # Rename tmp → final
            final_path = drive_path / filename
            shutil.move(str(tmp_path), str(final_path))

            checksum = sha256.hexdigest()
            logger.info("Job %s complete: %d bytes, sha256=%s", job_id, total_bytes, checksum)

            await self._send({
                "action": "complete",
                "job_id": job_id,
                "drive_id": drive_id,
                "checksum": checksum,
                "bytes_written": total_bytes,
                "success": True,
            })

        except asyncio.CancelledError:
            logger.info("Job %s was cancelled", job_id)
            # Cleanup tmp
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise

        except Exception as e:
            logger.error("Job %s failed: %s", job_id, e)
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            await self._send({
                "action": "error",
                "job_id": job_id,
                "drive_id": drive_id,
                "message": str(e),
                "success": False,
            })

        finally:
            self._active_jobs.pop(job_id, None)


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SmartCopy Pro Agent")
    parser.add_argument("--server", default="http://localhost:8000",
                        help="Server base URL")
    parser.add_argument("--agent-id", default=None,
                        help="Force a specific agent ID")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    agent = SmartCopyAgent(
        server_url=args.server,
        agent_id=args.agent_id,
    )

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")


if __name__ == "__main__":
    main()
