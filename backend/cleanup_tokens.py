"""
SmartCopy Pro — Token Cleanup Service
Periodic cleanup of expired download tokens and old audit records.
"""
import time
import logging
from backend.database import db_cursor

logger = logging.getLogger("smartcopy.cleanup")


def cleanup_expired_tokens(days_to_keep: int = 7):
    """Delete tokens and audit records older than specified days."""
    cutoff = time.time() - (days_to_keep * 86400)
    
    with db_cursor() as cur:
        # Clean expired tokens
        cur.execute("DELETE FROM download_tokens WHERE expires_at < ?", (cutoff,))
        tokens_deleted = cur.rowcount
        
        # Clean old audit records
        cur.execute("DELETE FROM download_audit WHERE started_at < ?", (cutoff,))
        audits_deleted = cur.rowcount
    
    logger.info({
        "event": "token_cleanup_complete",
        "tokens_deleted": tokens_deleted,
        "audits_deleted": audits_deleted,
        "cutoff_days": days_to_keep
    })
    
    return {"tokens_deleted": tokens_deleted, "audits_deleted": audits_deleted}


def cleanup_rate_limiter_memory(rate_limiter):
    """Clean old rate limiter windows to prevent memory leak."""
    now = time.time()
    cleaned_endpoints = 0
    cleaned_ips = 0
    
    for endpoint in list(rate_limiter._windows.keys()):
        for ip in list(rate_limiter._windows[endpoint].keys()):
            # Keep only timestamps from last hour
            rate_limiter._windows[endpoint][ip] = [
                t for t in rate_limiter._windows[endpoint][ip] if now - t < 3600
            ]
            if not rate_limiter._windows[endpoint][ip]:
                del rate_limiter._windows[endpoint][ip]
                cleaned_ips += 1
        
        if not rate_limiter._windows[endpoint]:
            del rate_limiter._windows[endpoint]
            cleaned_endpoints += 1
    
    logger.debug({
        "event": "rate_limiter_cleanup",
        "endpoints_cleaned": cleaned_endpoints,
        "ips_cleaned": cleaned_ips
    })
    
    return {"endpoints_cleaned": cleaned_endpoints, "ips_cleaned": cleaned_ips}
