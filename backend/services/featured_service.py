"""
SmartCopy Pro — Featured Media Service
Read-only logic to identify New and Trending content.
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime
from backend.database import db_cursor

logger = logging.getLogger("smartcopy.featured")

def _get_price_map() -> List[Dict]:
    """Helper to fetch pricing for enrichment."""
    with db_cursor() as cur:
        cur.execute("SELECT max_size_gb, price_usd FROM pricing ORDER BY max_size_gb")
        return [{"max_size_gb": r["max_size_gb"], "price_usd": r["price_usd"]} for r in cur.fetchall()]

def _calculate_price(size_bytes: int, tiers: List[Dict]) -> float:
    size_gb = size_bytes / (1024 ** 3)
    for tier in tiers:
        if size_gb <= tier["max_size_gb"]:
            return tier["price_usd"]
    return tiers[-1]["price_usd"] if tiers else 0.0

def get_new_media(limit: int = 10) -> List[Dict]:
    """Return media added most recently."""
    try:
        with db_cursor() as cur:
            cur.execute("""
                SELECT * FROM media 
                ORDER BY added_at DESC 
                LIMIT ?
            """, (limit,))
            rows = [dict(r) for r in cur.fetchall()]
        
        return _enrich_media(rows, tag="NEW")
    except Exception as e:
        logger.error(f"Error fetching new media: {e}")
        return []

def get_trending_media(limit: int = 10) -> List[Dict]:
    """Return media with most sales in the last 7 days."""
    try:
        with db_cursor() as cur:
            cur.execute("""
                SELECT m.*, COUNT(s.id) as sales_count 
                FROM media m
                JOIN sales s ON m.id = s.media_id
                WHERE s.timestamp >= datetime('now', '-7 days')
                GROUP BY m.id
                ORDER BY sales_count DESC
                LIMIT ?
            """, (limit,))
            rows = [dict(r) for r in cur.fetchall()]
            
        return _enrich_media(rows, tag="TRENDING")
    except Exception as e:
        logger.error(f"Error fetching trending media: {e}")
        return []

def get_featured_media(limit: int = 20) -> List[Dict]:
    """Combine New and Trending into a curated list."""
    new_items = get_new_media(limit // 2)
    trending_items = get_trending_media(limit // 2)
    
    # Merge and deduplicate by ID
    seen = set()
    combined = []
    
    # Interleave strategy or just append? 
    # Let's prioritize Trending first, then New
    for item in trending_items:
        if item["id"] not in seen:
            seen.add(item["id"])
            combined.append(item)
            
    for item in new_items:
        if item["id"] not in seen:
            seen.add(item["id"])
            combined.append(item)
            
    return combined[:limit]

def _enrich_media(rows: List[Dict], tag: str = None) -> List[Dict]:
    """Format media for frontend, attach prices and featured tags."""
    tiers = _get_price_map()
    results = []
    for row in rows:
        item = row.copy()
        item["price_usd"] = _calculate_price(item["size_bytes"], tiers)
        item["type"] = item.pop("category", "movie")
        item["category"] = item.pop("quality_category", "HD")
        item["featured_tag"] = tag
        
        # Privacy cleanups
        item.pop("path", None)
        item.pop("checksum", None)
        item.pop("sales_count", None)  # internal metric
        results.append(item)
    return results
