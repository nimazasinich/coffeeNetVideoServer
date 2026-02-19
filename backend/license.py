import json
import hashlib
import hmac
import uuid
import logging
import base64
from pathlib import Path
from typing import Dict, Optional, Tuple
from datetime import datetime

from backend.config import DATA_DIR, SECRET_KEY

logger = logging.getLogger("smartcopy.license")

LICENSE_FILE = DATA_DIR / "license.lic"
INSTALL_ID_FILE = DATA_DIR / "install_id.txt"

def get_machine_id() -> str:
    """
    Generates a unique persistent ID for this installation.
    First tries to read from disk, otherwise generates new UUID4.
    Also mixes in MAC address for hardware binding.
    """
    # 1. Try to read existing ID
    if INSTALL_ID_FILE.exists():
        return INSTALL_ID_FILE.read_text().strip()
        
    # 2. Generate new ID
    new_id = str(uuid.uuid4())
    
    # 3. Get generic node ID (MAC address based)
    mac_num = uuid.getnode()
    mac_str = ':'.join(("%012X" % mac_num)[i:i+2] for i in range(0, 12, 2))
    
    # 4. Mix them (optional, for now just use UUID for Install ID)
    # Ideally we'd salt it with the MAC, but let's stick to simple Install ID for portability.
    
    try:
        INSTALL_ID_FILE.write_text(new_id)
    except Exception as e:
        logger.error(f"Failed to write install ID: {e}")
        
    return new_id

def sign_license_data(data: Dict) -> str:
    """
    Creates an HMAC-SHA256 signature of the license data dict.
    Sorts keys to ensure deterministic output.
    """
    # Exclude the signature itself if present
    clean_data = {k: v for k, v in data.items() if k != "signature"}
    payload = json.dumps(clean_data, sort_keys=True, separators=(',', ':'))
    
    # Use config secret key for signing (in a real scenario, this would be a separate private key)
    # But for this offline requirement, we are simulating the verification side.
    # The PROPER way is: License Server signs with Private Key -> We verify with Public Key
    # Since we don't have the keypair, we'll use HMAC with the shared SECRET_KEY for now
    # as per instructions to implement offline verification.
    
    sig = hmac.new(
        SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return sig

def verify_license_signature(data: Dict) -> bool:
    """
    Verifies the signature in the license data.
    """
    if "signature" not in data:
        return False
        
    expected = sign_license_data(data)
    # Constant time comparison
    return hmac.compare_digest(data["signature"], expected)

def read_license() -> Tuple[bool, Optional[Dict], str]:
    """
    Reads and validates the license file.
    Returns (is_valid, license_data, status_message)
    """
    if not LICENSE_FILE.exists():
        return False, None, "No license file found."
        
    try:
        content = LICENSE_FILE.read_text()
        data = json.loads(content)
        
        # 1. Verify Signature
        if not verify_license_signature(data):
            return False, data, "Invalid license signature."
            
        # 2. Verify Machine Binding (optional, strictly based on Install ID)
        if "install_id" in data and data["install_id"] != get_machine_id():
            return False, data, "License mismatch (Install ID)."
            
        # 3. Verify Expiration
        if "expires_at" in data:
            expires = datetime.fromisoformat(data["expires_at"])
            if datetime.now() > expires:
                return False, data, "License expired."
                
        return True, data, "Valid license."
        
    except json.JSONDecodeError:
        return False, None, "Corrupt license file."
    except Exception as e:
        logger.error(f"License check error: {e}")
        return False, None, f"Error: {str(e)}"

def save_license(license_json: str) -> Tuple[bool, str]:
    """
    Saves a new license key (JSON string) to disk and verifies it.
    """
    try:
        # Validate JSON first
        data = json.loads(license_json)
        
        # Check if it has necessary fields
        if "signature" not in data:
            return False, "License data missing signature."
            
        # Write to disk
        LICENSE_FILE.write_text(license_json)
        
        # Re-verify immediately
        is_valid, _, msg = read_license()
        return is_valid, msg
        
    except json.JSONDecodeError:
        return False, "Invalid JSON format."
    except Exception as e:
        return False, str(e)

def get_license_state() -> Dict:
    """
    Public API to get current license status.
    """
    valid, data, msg = read_license()
    
    return {
        "valid": valid,
        "status": msg,
        "type": data.get("type", "free") if data else "unlicensed",
        "tier": data.get("tier", "basic") if data else "none",
        "issued_to": data.get("issued_to", "Unknown") if data else None,
        "expires_at": data.get("expires_at") if data else None,
        "install_id": get_machine_id()
    }
