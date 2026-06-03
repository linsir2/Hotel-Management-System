"""
Pricing recommendation engine — occupancy-based base rule + multi-factor overlay.
Zero LLM dependency. Python reads only, writes go through Spring Boot.
"""
import logging
from datetime import date, timedelta
from db.connection import get_db

logger = logging.getLogger("uvicorn")

# ── Configurable thresholds ──
HIGH_OCCUPANCY = 0.75   # above → suggest price increase
LOW_OCCUPANCY = 0.40    # below → suggest price decrease
HIGH_UPLIFT_MIN = 0.10   # +10% at 75% occupancy
HIGH_UPLIFT_MAX = 0.15   # +15% at 100% occupancy
LOW_DOWNLIFT_MIN = 0.10  # -10% at 40% occupancy
LOW_DOWNLIFT_MAX = 0.20  # -20% at 0% occupancy

# ── Multi-factor weights (v2, activates when external_events data exists) ──
FACTOR_WEIGHTS = {
    "HOLIDAY": 0.30,
    "LOCAL_EVENT": 0.40,
    "COMPETITOR_INFO": 0.10,
}


def _calculate_occupancy(cursor, days_ahead: int) -> float:
    """Calculate occupancy rate based on past N days (actual demand).
    Uses historical window so 8 rooms × 30 days with 7 occupied nights = 2.9%%.
    """
    today = date.today()
    start_date = today - timedelta(days=days_ahead)

    cursor.execute("SELECT COUNT(*) AS cnt FROM rooms")
    total_rooms = cursor.fetchone()["cnt"]
    if total_rooms == 0:
        return 0.0

    # Count actual booking-nights in the past window (completed + confirmed + checked-in)
    cursor.execute("""
        SELECT SUM(
            DATEDIFF(
                LEAST(DATE(check_out), %s),
                GREATEST(DATE(check_in), %s)
            )
        ) AS occupied_nights
        FROM bookings
        WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
          AND DATE(check_in) < %s
          AND DATE(check_out) > %s
    """, (today, start_date, today, start_date))
    row = cursor.fetchone()
    occupied_nights = float(row["occupied_nights"] or 0)

    total_nights = total_rooms * days_ahead
    return occupied_nights / total_nights if total_nights > 0 else 0.0


def _base_rule_pct(occupancy: float) -> tuple[float, str]:
    """Compute base price change percentage from occupancy rate.
    Returns (change_pct, reasoning).
    """
    if occupancy > HIGH_OCCUPANCY:
        # Linear: 75% → +10%, 100% → +15%
        ratio = (occupancy - HIGH_OCCUPANCY) / (1.0 - HIGH_OCCUPANCY)
        pct = HIGH_UPLIFT_MIN + ratio * (HIGH_UPLIFT_MAX - HIGH_UPLIFT_MIN)
        return round(pct, 4), f"入住率{occupancy:.0%}→上浮{pct*100:.1f}%"

    if occupancy < LOW_OCCUPANCY:
        # Linear: 0% → -20%, 40% → -10%
        ratio = (LOW_OCCUPANCY - occupancy) / LOW_OCCUPANCY
        pct = -(LOW_DOWNLIFT_MIN + ratio * (LOW_DOWNLIFT_MAX - LOW_DOWNLIFT_MIN))
        return round(pct, 4), f"入住率{occupancy:.0%}→下浮{abs(pct)*100:.1f}%"

    return 0.0, f"入住率{occupancy:.0%}→价格不变(40%-75%区间)"


def _get_external_factors(cursor) -> list[dict]:
    """Get active external events for the forecast window.
    Only events where event_date >= today are considered.
    """
    today = date.today()
    cursor.execute("""
        SELECT event_date, event_name, event_type, impact_level, impact_direction,
               competitor_avg_price, notes
        FROM external_events
        WHERE event_date >= %s
        ORDER BY event_date
        LIMIT 20
    """, (today,))
    return cursor.fetchall()


def _apply_factors(base_pct: float, base_reasoning: str, factors: list[dict]) -> tuple[float, dict]:
    """Apply multi-factor overlay to base change percentage.
    Returns (final_change_pct, reasoning_dict).
    Factors only apply in the same direction — they don't cancel each other out.
    """
    reasoning = {
        "base_rule": base_reasoning,
        "base_rule_pct": round(base_pct * 100, 1),
        "holiday_factor": 0.0,
        "local_event_factor": 0.0,
        "competitor_factor": 0.0,
        "factors_applied": [],
    }

    total_adjustment = 0.0
    has_holiday = any(f["event_type"] == "HOLIDAY" for f in factors)
    has_event = any(f["event_type"] == "LOCAL_EVENT" for f in factors)

    if has_holiday and base_pct > 0:
        weight = FACTOR_WEIGHTS["HOLIDAY"]
        holiday_pct = 0.075 * weight  # ~7.5% holiday uplift × 0.3 weight = +2.25%
        total_adjustment += holiday_pct
        reasoning["holiday_factor"] = round(holiday_pct * 100, 1)
        reasoning["factors_applied"].append("holiday")

    if has_event and base_pct > 0:
        weight = FACTOR_WEIGHTS["LOCAL_EVENT"]
        event_pct = 0.15 * weight  # ~15% event uplift × 0.4 weight = +6%
        total_adjustment += event_pct
        reasoning["local_event_factor"] = round(event_pct * 100, 1)
        reasoning["factors_applied"].append("local_event")

    # Competitor: only alerts, doesn't change price directly
    # (manager uses competitor data to make their own judgment)
    competitor_events = [f for f in factors if f["event_type"] == "COMPETITOR_INFO"]
    if competitor_events:
        reasoning["competitor_factor"] = 0.0  # alert only
        reasoning["factors_applied"].append("competitor_alert")

    final_pct = round(base_pct + total_adjustment, 4)
    return final_pct, reasoning


def _calculate_all_recommendations(days_ahead: int = 30) -> dict:
    """Main entry point. Calculate pricing recommendations for all rooms."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Calculate occupancy
        occupancy = _calculate_occupancy(cursor, days_ahead)

        # 2. Base rule
        base_pct, base_reasoning = _base_rule_pct(occupancy)

        # 3. External factors
        factors = _get_external_factors(cursor)

        # 4. Apply multi-factor overlay
        final_pct, reasoning = _apply_factors(base_pct, base_reasoning, factors)

        # 5. For each room, calculate suggested price
        cursor.execute("""
            SELECT id, room_number, type, price, status
            FROM rooms
            ORDER BY id
        """)
        rooms = cursor.fetchall()

        recommendations = []
        for room in rooms:
            suggested_price = round(float(room["price"]) * (1 + final_pct), 2)
            rec = {
                "room_id": room["id"],
                "room_number": room["room_number"],
                "room_type": room["type"],
                "current_price": float(room["price"]),
                "suggested_price": suggested_price,
                "base_rule_pct": round(base_pct * 100, 1),
                "holiday_factor": reasoning["holiday_factor"],
                "local_event_factor": reasoning["local_event_factor"],
                "competitor_factor": reasoning["competitor_factor"],
                "final_change_pct": round(final_pct * 100, 1),
                "reasoning": reasoning,
                "confidence": round(min(0.9, 0.5 + occupancy * 0.4), 4),
            }
            recommendations.append(rec)

        return {
            "recommendations": recommendations,
            "occupancy_rate": round(occupancy, 4),
            "total_rooms": len(rooms),
            "days_ahead": days_ahead,
            "base_rule_pct": round(base_pct * 100, 1),
            "final_change_pct": round(final_pct * 100, 1),
            "factors_applied": reasoning["factors_applied"],
            "pending_count": len(rooms),
        }
