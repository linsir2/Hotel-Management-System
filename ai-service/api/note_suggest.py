"""
Note suggestion API — returns template suggestions for a given booking.
GET /note-suggest?booking_id=123
"""
from fastapi import APIRouter, HTTPException, Query
from services.note_suggest import get_suggestions

router = APIRouter()


@router.get("/suggest")
async def suggest_notes(booking_id: int = Query(..., ge=1)):
    """Get note template suggestions for a booking.
    Auto-triggered: RETURNING_GUEST, HOLIDAY_STAY.
    Manual templates: EXTRA_BED, WAKE_UP_CALL, LATE_CHECKOUT, ALLERGY_NOTE.
    """
    result = get_suggestions(booking_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
