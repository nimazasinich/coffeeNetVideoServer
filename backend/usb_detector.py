"""
SmartCopy — USB Detection Module
Detects USB drive insertion/removal via WMI (Windows) or polling (cross-platform).
"""
import asyncio
import logging
import platform
import shutil
import uuid
from pathlib import Path
from typing import Dict, Set, Optional

from backend.database import db_cursor
from backend.websocket_hub import hub

logger = logging.getLogger("smartcopy.usb")

IS_WINDOWS = platform.system() == "Windows"


class DriveRegistry:
    """In-memory drive registry with DB persistence."""

    def __init__(self):
        self._drives: Dict[str, dict] = {}  # path -> drive info
        self._poll_interval = 3  # seconds

    def _make_drive_id(self, path: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, path))

    def _get_drive_info(self, path: str) -> Optional[dict]:
        try:
            p = Path(path)
            if not p.exists():
                return None
            usage = shutil.disk_usage(path)
            label = self._get_label(path)
            drive_id = self._make_drive_id(path)
            return {
                "id":             drive_id,
                "path":           path,
                "label":          label,
                "capacity_bytes": usage.total,
                "free_bytes":     usage.free,
                "is_locked":      False,
            }
        except Exception as e:
            logger.warning({"event": "drive_info_error", "path": path, "error": str(e)})
            return None

    def _get_label(self, path: str) -> str:
        if IS_WINDOWS:
            try:
                import ctypes
                label_buf = ctypes.create_unicode_buffer(261)
                ctypes.windll.kernel32.GetVolumeInformationW(
                    path, label_buf, 261, None, None, None, None, 0
                )
                return label_buf.value or path
            except Exception:
                pass
        return Path(path).name or path

    def _get_removable_drives_windows(self) -> Set[str]:
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
                        drives.add(drive_path)
            return drives
        except Exception as e:
            logger.error({"event": "win_drive_scan_error", "error": str(e)})
            return set()

    def _get_removable_drives_linux(self) -> Set[str]:
        """Scan /media and /mnt for mounted volumes (Linux/Mac development)."""
        drives: Set[str] = set()
        for base in ["/media", "/mnt", "/run/media"]:
            base_path = Path(base)
            if base_path.exists():
                for entry in base_path.iterdir():
                    if entry.is_dir() and entry.stat().st_dev != Path(base).stat().st_dev:
                        drives.add(str(entry))
        return drives

    def get_current_drives(self) -> Set[str]:
        if IS_WINDOWS:
            return self._get_removable_drives_windows()
        return self._get_removable_drives_linux()

    async def _handle_insertion(self, path: str):
        info = self._get_drive_info(path)
        if not info:
            return
        self._drives[path] = info

        # Persist to DB
        with db_cursor() as cur:
            cur.execute("""
                INSERT OR REPLACE INTO drives (id, path, label, capacity_bytes, free_bytes)
                VALUES (?, ?, ?, ?, ?)
            """, (info["id"], info["path"], info["label"],
                  info["capacity_bytes"], info["free_bytes"]))

        logger.info({"event": "drive_inserted", "path": path, "label": info["label"]})
        await hub.broadcast("drive.connected", {
            "drive": info,
        })

    async def _handle_removal(self, path: str):
        info = self._drives.pop(path, None)
        if not info:
            return

        drive_id = info["id"]

        # Find any active job for this drive and fail it
        with db_cursor() as cur:
            cur.execute("""
                UPDATE jobs SET status='failed', error_message='Drive removed during copy'
                WHERE drive_id=? AND status='active'
            """, (drive_id,))
            cur.execute("""
                UPDATE drives SET locked_by_job=NULL WHERE id=?
            """, (drive_id,))

        logger.warning({"event": "drive_removed", "path": path, "drive_id": drive_id})
        await hub.broadcast("drive.disconnected", {
            "drive_id": drive_id,
            "path": path,
        })

    def get_drive_list(self) -> list:
        result = []
        for path, info in self._drives.items():
            # Refresh free space
            try:
                usage = shutil.disk_usage(path)
                info["free_bytes"] = usage.free
                info["capacity_bytes"] = usage.total
            except Exception:
                pass
            result.append(info)
        return result

    def get_drive_by_id(self, drive_id: str) -> Optional[dict]:
        for info in self._drives.values():
            if info["id"] == drive_id:
                return info
        return None

    def refresh_drive(self, drive_id: str):
        """Update free space for a drive."""
        for path, info in self._drives.items():
            if info["id"] == drive_id:
                try:
                    usage = shutil.disk_usage(path)
                    info["free_bytes"] = usage.free
                except Exception:
                    pass
                break

    async def start_polling(self):
        """Main polling loop to detect drive changes."""
        logger.info({"event": "usb_polling_started", "interval_s": self._poll_interval})
        known: Set[str] = set()

        while True:
            try:
                current = self.get_current_drives()
                inserted = current - known
                removed = known - current

                for path in inserted:
                    await self._handle_insertion(path)
                for path in removed:
                    await self._handle_removal(path)

                known = current
            except Exception as e:
                logger.error({"event": "usb_poll_error", "error": str(e)})

            await asyncio.sleep(self._poll_interval)


# Singleton
drive_registry = DriveRegistry()
