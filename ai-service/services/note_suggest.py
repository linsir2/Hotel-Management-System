"""
Note template suggestions — AI suggests, human writes.
Python read-only. Write permission stays with Spring Boot.

6 MVP categories:
  - RETURNING_GUEST (auto): guest has ≥2 historical bookings
  - HOLIDAY_STAY (auto): check-in falls on holiday/event from external_events
  - EXTRA_BED (manual): extra bed request template
  - WAKE_UP_CALL (manual): wake-up call template
  - LATE_CHECKOUT (manual): late checkout template
  - ALLERGY_NOTE (manual): allergy note template
"""
from datetime import date
from db.connection import get_db


def get_suggestions(booking_id: int) -> dict:
    """Generate note suggestions for a given booking.
    Returns {suggestions: [...], booking_summary: {...}}.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Fetch booking + guest + room info
        cursor.execute("""
            SELECT b.id AS booking_id, b.check_in, b.check_out, b.status,
                   g.id AS guest_id, g.name AS guest_name,
                   r.id AS room_id, r.room_number, r.type AS room_type
            FROM bookings b
            JOIN guests g ON b.guest_id = g.id
            JOIN rooms r ON b.room_id = r.id
            WHERE b.id = %s
        """, (booking_id,))
        booking = cursor.fetchone()
        if not booking:
            return {"suggestions": [], "error": "Booking not found"}

        suggestions = []

        # ── Auto-triggered suggestions ──

        # RETURNING_GUEST: guest has ≥2 historical bookings
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM bookings WHERE guest_id = %s AND id != %s",
            (booking["guest_id"], booking_id)
        )
        history_count = cursor.fetchone()["cnt"]
        if history_count >= 2:
            suggestions.append({
                "category": "RETURNING_GUEST",
                "text": "回头客，建议升级房型",
                "confidence": round(min(0.95, 0.7 + history_count * 0.05), 2),
                "auto": True,
            })

        # HOLIDAY_STAY: check-in date matches external_event
        check_in = booking["check_in"]
        if hasattr(check_in, "date"):
            check_in_date = check_in.date()
        elif isinstance(check_in, date):
            check_in_date = check_in
        else:
            check_in_date = check_in

        cursor.execute(
            "SELECT event_name, event_type, impact_level FROM external_events " +
            "WHERE event_date = %s",
            (check_in_date,)
        )
        events = cursor.fetchall()
        for evt in events:
            etype = evt["event_type"]
            if etype == "HOLIDAY":
                suggestions.append({
                    "category": "HOLIDAY_STAY",
                    "text": f"{evt['event_name']}入住，注意前台排队",
                    "confidence": 0.92 if evt["impact_level"] == "HIGH" else 0.80,
                    "auto": True,
                })
            elif etype == "LOCAL_EVENT":
                suggestions.append({
                    "category": "HOLIDAY_STAY",
                    "text": f"{evt['event_name']}期间入住，提醒客人交通/人流情况",
                    "confidence": 0.85,
                    "auto": True,
                })

        # ── Manual templates (auto=false) ──

        manual_templates = [
            {
                "category": "EXTRA_BED",
                "text": "客人需加床，已备注",
                "confidence": 0.0,
                "auto": False,
            },
            {
                "category": "WAKE_UP_CALL",
                "text": "需叫醒服务，时间：___",
                "confidence": 0.0,
                "auto": False,
            },
            {
                "category": "LATE_CHECKOUT",
                "text": "延迟退房至___点，已确认",
                "confidence": 0.0,
                "auto": False,
            },
            {
                "category": "ALLERGY_NOTE",
                "text": "客人过敏源：___，请注意",
                "confidence": 0.0,
                "auto": False,
            },
        ]
        suggestions.extend(manual_templates)

        # Limit to 5 total
        suggestions = suggestions[:5]

        return {
            "suggestions": suggestions,
            "booking_summary": {
                "booking_id": booking["booking_id"],
                "guest_name": booking["guest_name"],
                "room_number": booking["room_number"],
                "room_type": booking["room_type"],
                "check_in": str(check_in_date),
                "check_out": str(booking["check_out"]),
                "history_count": history_count if 'history_count' in dir() else 0,
            },
        }
