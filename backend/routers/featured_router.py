from fastapi import APIRouter, Depends
from backend.services.featured_service import get_featured_media
from backend.security import rate_limit_media

router = APIRouter(prefix="/api/featured", tags=["featured"])

@router.get("")
def get_featured(limit: int = 20, _: None = Depends(rate_limit_media)):
    """
    Get a list of featured media (New & Trending).
    """
    return {"items": get_featured_media(limit)}
