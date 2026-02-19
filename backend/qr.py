import socket
import base64
import io
import time
import logging
import json
import shutil
from pathlib import Path
from typing import Optional, Tuple, Dict

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask

from backend.config import SERVER_PORT, SERVER_BASE_URL, ALLOWED_SUBNET

logger = logging.getLogger("smartcopy.qr")

STATE_FILE = Path("runtime_state.json")

def get_lan_ip() -> str:
    """
    Detects the machine's LAN IP address by connecting to a public DNS.
    Does NOT actually send data, just opens a socket to determine the routing interface.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0.1)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    
    # If allowed subnet is configured, verify IP matches
    if ALLOWED_SUBNET and not ip.startswith(ALLOWED_SUBNET):
        logger.warning(f"Detected IP {ip} does not match configured subnet {ALLOWED_SUBNET}")
        
    return ip

def build_base_url() -> str:
    """
    Constructs the base URL for the QR code.
    Prioritizes SERVER_BASE_URL if it's not localhost, otherwise uses detected LAN IP.
    """
    if "localhost" in SERVER_BASE_URL or "127.0.0.1" in SERVER_BASE_URL:
        lan_ip = get_lan_ip()
        return f"http://{lan_ip}:{SERVER_PORT}"
    return SERVER_BASE_URL

def generate_qr_base64(url: str = None) -> Tuple[str, str]:
    """
    Generates a QR code for the given URL (or auto-detected URL).
    Returns (url_used, base64_image).
    """
    if url is None:
        url = build_base_url()
        
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    # Styling: Rounded modules, dark blue/purple gradient-ish color
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(
            front_color=(40, 40, 60),  # Dark gray-blue
            back_color=(255, 255, 255)
        )
    )

    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return url, f"data:image/png;base64,{img_str}"

def generate_high_res_qr(url: str = None) -> bytes:
    """
    Generates a high-resolution QR code (approx 1000px) for printing.
    Returns raw PNG bytes.
    """
    if url is None:
        url = build_base_url()

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=40,  # 40px per box * ~25 boxes = ~1000px
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(
            front_color=(0, 0, 0),  # Black for printing
            back_color=(255, 255, 255)
        )
    )

    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return buffered.getvalue()

def _load_state() -> Dict:
    if not STATE_FILE.exists():
        return {}
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load runtime state: {e}")
        return {}

def _save_state(data: Dict):
    """Atomic write to runtime state file."""
    temp = STATE_FILE.with_suffix(".tmp")
    try:
        with open(temp, "w") as f:
            json.dump(data, f, indent=2)
        shutil.move(temp, STATE_FILE)
    except Exception as e:
        logger.error(f"Failed to save runtime state: {e}")

def detect_ip_change() -> bool:
    """
    Checks if the LAN IP has changed since the last run.
    Returns True if changed, False otherwise.
    Updates runtime_state.json with the current IP.
    """
    current_ip = get_lan_ip()
    state = _load_state()
    last_ip = state.get("last_lan_ip")
    
    if last_ip and last_ip != current_ip:
        logger.warning(f"IP Address changed from {last_ip} to {current_ip}")
        # Update state
        state["last_lan_ip"] = current_ip
        state["ip_changed_at"] = time.time()
        _save_state(state)
        return True
        
    if last_ip is None:
        # First run, just save it
        state["last_lan_ip"] = current_ip
        _save_state(state)
        
    return False

def get_ip_change_status() -> Dict:
    """Returns details about IP change status for the admin dashboard."""
    state = _load_state()
    return {
        "current_ip": get_lan_ip(),
        "last_ip": state.get("last_lan_ip"),
        "changed_at": state.get("ip_changed_at")
    }
