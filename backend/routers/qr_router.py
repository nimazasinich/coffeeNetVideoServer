"""
SmartCopy Pro — QR Code Router
Admin endpoints for QR code generation and IP change detection.
"""
import io
import time

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from backend.security import require_admin_role
from backend.qr import (
    generate_qr_base64, generate_high_res_qr,
    get_lan_ip, detect_ip_change, get_ip_change_status,
)

router = APIRouter(prefix="/api/admin/qr", tags=["qr"])


@router.get("/print")
def get_qr_print(user: dict = Depends(require_admin_role)):
    """Returns a high-resolution PNG image (~1000px) for printing."""
    # BUGFIX: was cluttered with dev scaffolding comments — now uses generate_high_res_qr directly
    png_bytes = generate_high_res_qr()
    return Response(content=png_bytes, media_type="image/png")


@router.get("")
def get_qr_status(user: dict = Depends(require_admin_role)):
    """Enhanced QR status with real IP change detection."""
    # BUGFIX: was hardcoded ip_changed = False with placeholder comments
    url, img_b64 = generate_qr_base64()
    ip_changed = detect_ip_change()
    ip_status  = get_ip_change_status()

    return {
        "resolved_base_url": url,
        "qr_image_base64":   img_b64,
        "ip_changed":        ip_changed,
        "current_ip":        ip_status["current_ip"],
        "last_ip":           ip_status.get("last_ip"),
        "timestamp":         time.time(),
    }
