"""
Pricing recommendations API — returns price suggestions for all rooms.
GET /price-recs?days_ahead=30
"""
from fastapi import APIRouter, Query
from services.pricing import _calculate_all_recommendations

router = APIRouter()


@router.get("/recommendations")
async def get_recommendations(days_ahead: int = Query(default=30, ge=1, le=365)):
    """Generate pricing recommendations for the next N days.
    Based on: occupancy rate → base rule → multi-factor overlay.
    Python only reads DB — writes are handled by Spring Boot.
    """
    result = _calculate_all_recommendations(days_ahead)
    return result
