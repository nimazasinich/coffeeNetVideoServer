"""
SmartCopy — Media Library Module
Scans MEDIA_ROOT, indexes files into SQLite, computes SHA-256 checksums.
"""
import asyncio
import hashlib
import logging
import uuid
from pathlib import Path
from typing import List, Optional

from backend.config import MEDIA_ROOT, SUPPORTED_EXTENSIONS, SCAN_INTERVAL_SECONDS
from backend.database import db_cursor

logger = logging.getLogger("smartcopy.media")


def _classify(path: Path) -> str:
    """Heuristic: if path contains 'Series', 'Season', or 'S0' pattern → series."""
    name = str(path).lower()
    if any(k in name for k in ["series", "season", "s0", "s1", "episode", "ep"]):
        return "series"
    return "movie"


def _detect_quality(path: Path, size_bytes: int) -> str:
    """Detect quality category from filename or size."""
    name = str(path).lower()
    if "4k" in name or "2160p" in name or "uhd" in name:
        return "4K"
    if "720p" in name or "sd" in name:
        return "SD"
    # Heuristic by size: >8GB = 4K, >2GB = HD, else SD
    gb = size_bytes / (1024 ** 3)
    if gb > 8:
        return "4K"
    if gb > 2:
        return "HD"
    return "SD"


# BUGFIX: Missing function definition — caused IndentationError on startup
def _compute_checksum(path: Path) -> Optional[str]:
    """Compute SHA-256 of file. Returns hex string."""
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1_048_576), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception as e:
        logger.warning({"event": "checksum_error", "path": str(path), "error": str(e)})
        return None


def _get_price(size_bytes: int, tiers: list) -> float:
    size_gb = size_bytes / (1024 ** 3)
    for tier in sorted(tiers, key=lambda t: t["max_size_gb"]):
        if size_gb <= tier["max_size_gb"]:
            return tier["price_usd"]
    return tiers[-1]["price_usd"] if tiers else 0.0


def scan_library(compute_checksums: bool = False) -> int:
    """
    Scan MEDIA_ROOT and upsert media records into DB.
    Returns count of files found.
    """
    media_root = MEDIA_ROOT
    if not media_root.exists():
        logger.warning({"event": "media_root_missing", "path": str(media_root)})
        # For development/demo: create and populate with dummy entries
        _seed_demo_data()
        return 0

    found = 0
    with db_cursor() as cur:
        # Mark all existing as candidates for removal
        cur.execute("SELECT path FROM media")
        existing_paths = {row["path"] for row in cur.fetchall()}
        found_paths = set()

        for file_path in media_root.rglob("*"):
            if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            if file_path.stat().st_size == 0:
                continue

            path_str = str(file_path)
            found_paths.add(path_str)
            file_id  = str(uuid.uuid5(uuid.NAMESPACE_URL, path_str))
            name     = file_path.stem
            size     = file_path.stat().st_size
            category = _classify(file_path)
            quality  = _detect_quality(file_path, size)
            ext      = file_path.suffix.lower().lstrip(".")
            checksum = _compute_checksum(file_path) if compute_checksums else None

            cur.execute("""
                INSERT INTO media (id, name, path, size_bytes, category, quality_category, extension, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    size_bytes       = excluded.size_bytes,
                    quality_category = excluded.quality_category,
                    checksum         = COALESCE(excluded.checksum, checksum)
            """, (file_id, name, path_str, size, category, quality, ext, checksum))
            found += 1

        # Remove stale entries (files deleted from disk)
        stale = existing_paths - found_paths
        for stale_path in stale:
            cur.execute("DELETE FROM media WHERE path=?", (stale_path,))
            logger.info({"event": "media_removed", "path": stale_path})

    logger.info({"event": "media_scan_complete", "found": found, "stale_removed": len(stale) if found else 0})
    return found


def _seed_demo_data():
    """Seed demo media for development when MEDIA_ROOT doesn't exist."""
    demo_items = [
        ("Inception (2010)",              8_589_934_592,  "movie",  "mkv", "HD"),
        ("The Dark Knight (2008)",         7_516_192_768,  "movie",  "mkv", "HD"),
        ("Interstellar (2014)",           10_737_418_240,  "movie",  "mkv", "4K"),
        ("Avengers Endgame (2019)",        6_442_450_944,  "movie",  "mp4", "HD"),
        ("Parasite (2019)",                4_294_967_296,  "movie",  "mkv", "HD"),
        ("Breaking Bad S01E01",            1_073_741_824,  "series", "mkv", "HD"),
        ("Breaking Bad S01E02",            1_073_741_824,  "series", "mkv", "HD"),
        ("Game of Thrones S01E01",         2_147_483_648,  "series", "mkv", "4K"),
        ("Oppenheimer (2023)",            12_884_901_888,  "movie",  "mkv", "4K"),
        ("Dune Part Two (2024)",          11_811_160_064,  "movie",  "mkv", "4K"),
        ("The Godfather (1972)",           5_368_709_120,  "movie",  "mp4", "HD"),
        ("Pulp Fiction (1994)",            4_831_838_208,  "movie",  "mkv", "HD"),
        ("The Matrix (1999)",              6_979_321_856,  "movie",  "mkv", "HD"),
        ("Joker (2019)",                   5_905_580_032,  "movie",  "mp4", "HD"),
        ("Spider-Man No Way Home (2021)",  8_053_063_680,  "movie",  "mkv", "4K"),
        ("Stranger Things S04E01",         3_221_225_472,  "series", "mkv", "4K"),
        ("The Witcher S01E01",             2_684_354_560,  "series", "mkv", "HD"),
        ("Squid Game S01E01",              1_610_612_736,  "series", "mkv", "HD"),
        ("Avatar The Way of Water (2022)", 900_000_000,    "movie",  "mp4", "SD"),
    ]
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM media")
        if cur.fetchone()["cnt"] > 0:
            return
        for name, size, category, ext, quality in demo_items:
            file_id   = str(uuid.uuid4())
            fake_path = f"/demo/{name}.{ext}"
            cur.execute("""
                INSERT OR IGNORE INTO media
                (id, name, path, size_bytes, category, quality_category, extension, is_copyable)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (file_id, name, fake_path, size, category, quality, ext))
    logger.info({"event": "demo_data_seeded", "count": len(demo_items)})


def get_media_list(category: Optional[str] = None, search: Optional[str] = None) -> List[dict]:
    with db_cursor() as cur:
        # Load pricing tiers
        cur.execute("SELECT max_size_gb, price_usd FROM pricing ORDER BY max_size_gb")
        tiers = [{"max_size_gb": r["max_size_gb"], "price_usd": r["price_usd"]}
                 for r in cur.fetchall()]

        query = "SELECT * FROM media WHERE 1=1"
        params = []
        if category and category in ("movie", "series"):
            query += " AND category=?"
            params.append(category)
        if search:
            # Sanitized: only alphanumeric+space passed through models layer
            query += " AND name LIKE ?"
            params.append(f"%{search}%")
        query += " ORDER BY name ASC"

        cur.execute(query, params)
        rows = cur.fetchall()

    result = []
    for row in rows:
        item = dict(row)
        item["price_usd"]   = _get_price(item["size_bytes"], tiers)
        item["type"]        = item.pop("category")        # rename for frontend compat
        item["category"]    = item.pop("quality_category", "HD")  # SD/HD/4K
        item["is_copyable"] = bool(item.get("is_copyable", 1))
        # Never expose filesystem path to clients
        item.pop("path", None)
        item.pop("checksum", None)
        result.append(item)
    return result


def get_media_by_id(media_id: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM media WHERE id=?", (media_id,))
        row = cur.fetchone()
    return dict(row) if row else None


async def start_periodic_scan():
    """Background task: re-scan every SCAN_INTERVAL_SECONDS."""
    logger.info({"event": "media_scanner_started", "interval_s": SCAN_INTERVAL_SECONDS})
    while True:
        try:
            scan_library()
        except Exception as e:
            logger.error({"event": "scan_error", "error": str(e)})
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)
