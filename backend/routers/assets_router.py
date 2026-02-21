"""
SmartCopy Pro — Poster Assets Router
POST /api/assets/poster  — multipart upload, generates 3 sizes
GET  /api/assets/posters — list ingested posters (admin)

Requires: pip install Pillow --break-system-packages
Image sizes: thumb (120px w), card (300px w), full (800px w)
"""
import io
import uuid
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from fastapi.responses import JSONResponse

from backend.database import db_cursor
from backend.security import require_admin_role

logger = logging.getLogger("smartcopy.assets")

router = APIRouter(prefix="/api/assets", tags=["assets"])

POSTERS_DIR = Path("public/posters")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
SIZES = {"thumb": 120, "card": 300, "full": 800}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


def _get_pillow():
    try:
        from PIL import Image
        return Image
    except ImportError:
        raise HTTPException(
            500,
            "Pillow not installed. Run: pip install Pillow --break-system-packages"
        )


def _generate_sizes(data: bytes, base_name: str) -> dict[str, str]:
    """Generate three image sizes and return URL dict."""
    Image = _get_pillow()
    urls: dict[str, str] = {}

    for size_name, max_width in SIZES.items():
        size_dir = POSTERS_DIR / size_name
        size_dir.mkdir(parents=True, exist_ok=True)

        out_path = size_dir / f"{base_name}.webp"
        with Image.open(io.BytesIO(data)) as img:
            img = img.convert("RGB")
            w, h = img.size
            if w > max_width:
                ratio = max_width / w
                img = img.resize((max_width, int(h * ratio)), Image.LANCZOS)
            img.save(str(out_path), "WEBP", quality=85, method=4)

        urls[size_name] = f"/posters/{size_name}/{base_name}.webp"

    return urls


@router.post("/poster")
async def upload_poster(
    file:     UploadFile = File(...),
    media_id: Optional[str] = Form(None),
    user:     dict = Depends(require_admin_role),
):
    """
    Upload a poster image for a media item.
    Generates thumb (120w), card (300w), full (800w) WebP versions.
    """
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME:
        raise HTTPException(415, f"Unsupported media type: {content_type}. Use JPEG, PNG or WebP.")

    # Read and size-check
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 20 MB)")
    if len(data) == 0:
        raise HTTPException(400, "Empty file")

    # Assign stable UUID-based filename
    poster_id = str(uuid.uuid4())
    base_name = poster_id

    # Generate sizes
    try:
        urls = _generate_sizes(data, base_name)
    except Exception as e:
        logger.error({"event": "poster_resize_error", "error": str(e)})
        raise HTTPException(500, f"Image processing failed: {e}")

    # Persist to DB
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO poster_assets
                (id, media_id, filename, original_name, mime_type, size_bytes,
                 thumb_url, card_url, full_url)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            poster_id, media_id,
            f"{base_name}.webp", file.filename or "unknown",
            content_type, len(data),
            urls["thumb"], urls["card"], urls["full"],
        ))

        # Update media.poster_url if media_id supplied
        if media_id:
            try:
                cur.execute(
                    "UPDATE media SET poster_url=? WHERE id=?",
                    (urls["card"], media_id)
                )
                if cur.rowcount == 0:
                    logger.warning({"event": "poster_media_not_found", "media_id": media_id})
            except Exception as e:
                logger.warning({"event": "poster_media_update_skip", "error": str(e)})

    logger.info({"event": "poster_uploaded", "poster_id": poster_id, "media_id": media_id})
    return {
        "poster_id":  poster_id,
        "media_id":   media_id,
        "thumb_url":  urls["thumb"],
        "card_url":   urls["card"],
        "full_url":   urls["full"],
    }


@router.get("/posters")
def list_posters(
    media_id: Optional[str] = None,
    user:     dict = Depends(require_admin_role),
):
    """List all ingested poster assets, optionally filtered by media_id."""
    with db_cursor() as cur:
        if media_id:
            cur.execute(
                "SELECT * FROM poster_assets WHERE media_id=? ORDER BY created_at DESC",
                (media_id,)
            )
        else:
            cur.execute("SELECT * FROM poster_assets ORDER BY created_at DESC LIMIT 500")
        rows = [dict(r) for r in cur.fetchall()]
    return {"posters": rows, "total": len(rows)}
