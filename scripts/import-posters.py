#!/usr/bin/env python3
"""
SmartCopy Pro — Bulk Poster Import CLI
======================================
Bulk-import poster images into the catalog.
Generates thumb/card/full WebP sizes and updates media.poster_url in the DB.

Usage:
    python scripts/import-posters.py --dir /path/to/posters [--db data/smartcopy.db] [--dry-run]

Requirements:
    pip install Pillow requests --break-system-packages

Matching:
    Filename (sans extension) is matched case-insensitively against media.name.
    Example: "Inception (2010).jpg" → matches media WHERE name LIKE 'Inception%'

Output:
    Prints a summary table of matched / unmatched / skipped items.
"""
import argparse
import io
import sqlite3
import sys
import uuid
from pathlib import Path

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
SIZES = {"thumb": 120, "card": 300, "full": 800}


def get_pillow():
    try:
        from PIL import Image
        return Image
    except ImportError:
        print("ERROR: Pillow not installed. Run: pip install Pillow --break-system-packages")
        sys.exit(1)


def resize_image(Image, data: bytes, base_name: str, posters_dir: Path) -> dict:
    urls = {}
    for size_name, max_width in SIZES.items():
        size_dir = posters_dir / size_name
        size_dir.mkdir(parents=True, exist_ok=True)
        out_path = size_dir / f"{base_name}.webp"
        with Image.open(io.BytesIO(data)) as img:
            img = img.convert("RGB")
            w, h = img.size
            if w > max_width:
                ratio = max_width / w
                img = img.resize((max_width, int(h * ratio)), Image.LANCZOS)
            img.save(str(out_path), "WEBP", quality=85)
        urls[size_name] = f"/posters/{size_name}/{base_name}.webp"
    return urls


def match_media(cur: sqlite3.Cursor, stem: str):
    """Find media row matching poster filename stem (fuzzy)."""
    # Exact match first
    cur.execute("SELECT id, name FROM media WHERE LOWER(name)=LOWER(?)", (stem,))
    row = cur.fetchone()
    if row:
        return row
    # Prefix match
    cur.execute("SELECT id, name FROM media WHERE LOWER(name) LIKE LOWER(?) LIMIT 1", (f"{stem}%",))
    row = cur.fetchone()
    if row:
        return row
    # Substring match
    cur.execute("SELECT id, name FROM media WHERE LOWER(name) LIKE LOWER(?) LIMIT 1", (f"%{stem}%",))
    return cur.fetchone()


def main():
    parser = argparse.ArgumentParser(description="SmartCopy Pro — bulk poster import")
    parser.add_argument("--dir",     required=True,              help="Directory containing poster images")
    parser.add_argument("--db",      default="data/smartcopy.db", help="Path to SQLite database")
    parser.add_argument("--posters", default="public/posters",    help="Output directory for resized posters")
    parser.add_argument("--dry-run", action="store_true",          help="Preview matches without writing")
    args = parser.parse_args()

    poster_dir  = Path(args.dir)
    db_path     = Path(args.db)
    posters_out = Path(args.posters)

    if not poster_dir.is_dir():
        print(f"ERROR: --dir '{poster_dir}' is not a directory")
        sys.exit(1)
    if not db_path.exists():
        print(f"ERROR: DB not found at '{db_path}'")
        sys.exit(1)

    Image = get_pillow()

    image_files = [
        f for f in poster_dir.iterdir()
        if f.is_file() and f.suffix.lower() in ALLOWED_SUFFIXES
    ]
    if not image_files:
        print(f"No image files found in {poster_dir}")
        sys.exit(0)

    print(f"Found {len(image_files)} image(s) in {poster_dir}")
    if args.dry_run:
        print("DRY RUN — no files will be written\n")

    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Ensure poster_assets table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS poster_assets (
            id           TEXT PRIMARY KEY,
            media_id     TEXT,
            filename     TEXT NOT NULL,
            original_name TEXT,
            thumb_url    TEXT,
            card_url     TEXT,
            full_url     TEXT,
            created_at   REAL DEFAULT (unixepoch())
        )
    """)

    results = {"matched": 0, "unmatched": 0, "skipped": 0, "error": 0}

    for img_path in sorted(image_files):
        stem = img_path.stem
        media_row = match_media(cur, stem)

        if not media_row:
            print(f"  [UNMATCHED] {img_path.name}")
            results["unmatched"] += 1
            continue

        media_id   = media_row["id"]
        media_name = media_row["name"]
        poster_id  = str(uuid.uuid4())

        if args.dry_run:
            print(f"  [MATCH] '{img_path.name}' → '{media_name}' ({media_id})")
            results["matched"] += 1
            continue

        try:
            data = img_path.read_bytes()
            urls = resize_image(Image, data, poster_id, posters_out)

            cur.execute("""
                INSERT OR REPLACE INTO poster_assets
                    (id, media_id, filename, original_name, thumb_url, card_url, full_url)
                VALUES (?,?,?,?,?,?,?)
            """, (poster_id, media_id, f"{poster_id}.webp", img_path.name,
                  urls["thumb"], urls["card"], urls["full"]))

            cur.execute(
                "UPDATE media SET poster_url=? WHERE id=?",
                (urls["card"], media_id)
            )
            con.commit()
            print(f"  [OK] '{img_path.name}' → '{media_name}' → card:{urls['card']}")
            results["matched"] += 1

        except Exception as e:
            print(f"  [ERROR] {img_path.name}: {e}")
            results["error"] += 1
            con.rollback()

    con.close()

    print(f"\n{'DRY RUN ' if args.dry_run else ''}Summary:")
    print(f"  Matched  : {results['matched']}")
    print(f"  Unmatched: {results['unmatched']}")
    print(f"  Errors   : {results['error']}")
    print("\nDone. Run 'python scripts/import-posters.py --help' for options.")


if __name__ == "__main__":
    main()
