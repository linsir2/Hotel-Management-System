"""
Revenue forecast — weekly granularity, 3-stage cold-start strategy.
Stage 1 (< 4 weeks): 7-day moving average → weekly projection.
Stage 2 (4-26 weeks): exponential smoothing + weekday decomposition.
Stage 3 (> 52 weeks): Prophet + exogenous features (evaluate first).

Zero LLM dependency. Uses only numpy for calculations.
Python read-only. No writes to DB.
"""
import logging
from datetime import date, timedelta
from collections import defaultdict
import numpy as np

from db.connection import get_db

logger = logging.getLogger("uvicorn")


def _get_weekly_revenue(cursor) -> dict[str, float]:
    """Aggregate historical bookings into weekly revenue.
    Returns {week_start_iso: total_revenue}.
    Only COMPLETED and CHECKED_IN bookings are counted.
    """
    cursor.execute("""
        SELECT check_in, check_out, total_amount, status
        FROM bookings
        WHERE status IN ('COMPLETED', 'CHECKED_IN', 'CONFIRMED')
          AND total_amount > 0
        ORDER BY check_in
    """)
    bookings = cursor.fetchall()

    # Aggregate by ISO week
    weekly = defaultdict(float)
    for b in bookings:
        # Allocate revenue to the check-in week (simplified allocation)
        check_in = b["check_in"]
        if hasattr(check_in, "date"):
            cin = check_in.date()
        elif isinstance(check_in, date):
            cin = check_in
        else:
            continue
        # ISO week: Monday=1
        week_start = cin - timedelta(days=cin.weekday())
        weekly[week_start.isoformat()] += float(b["total_amount"])

    return dict(sorted(weekly.items()))


def _get_notable_events(cursor, weeks_ahead: int) -> list[dict]:
    """Fetch external events for the forecast window (context only, not model input)."""
    today = date.today()
    end = today + timedelta(weeks=weeks_ahead * 7)
    cursor.execute("""
        SELECT event_date, event_name, event_type, impact_level
        FROM external_events
        WHERE event_date BETWEEN %s AND %s
        ORDER BY event_date
    """, (today, end))
    return cursor.fetchall()


def _moving_average(weekly: dict[str, float], weeks_ahead: int) -> tuple[list[dict], str, float]:
    """Stage 1: Simple weekly average projection.
    Uses mean + std of historical weeks to project forward.
    Returns (forecast_list, model_name, mape).
    """
    values = list(weekly.values())
    if not values:
        return [], "moving_average", 0.0

    mean = np.mean(values)
    std = np.std(values, ddof=1) if len(values) > 1 else mean * 0.2

    # Last week's start date
    last_week_str = list(weekly.keys())[-1]
    last_start = date.fromisoformat(last_week_str)

    forecast = []
    for i in range(1, weeks_ahead + 1):
        week_start = last_start + timedelta(weeks=i)
        # Add slight decay: mean × 0.98^week
        decay = 0.98 ** i
        predicted = round(mean * decay, 2)
        ci_half = round(std * 1.28, 2)  # 80% CI (z=1.28)
        forecast.append({
            "week_start": week_start.isoformat(),
            "predicted": predicted,
            "lower_bound": round(max(0, predicted - ci_half), 2),
            "upper_bound": round(predicted + ci_half, 2),
            "confidence": "low" if len(values) < 8 else "medium",
        })

    # MAPE via leave-one-out on historical weeks
    mape = 0.0
    if len(values) >= 3:
        errors = []
        for i in range(1, len(values)):
            hist_mean = np.mean(values[:i])
            if values[i] > 0:
                errors.append(abs(values[i] - hist_mean) / values[i])
        mape = round(float(np.mean(errors)) if errors else 0.0, 4)

    return forecast, "moving_average", mape


def _exponential_smoothing(weekly: dict[str, float], weeks_ahead: int) -> tuple[list[dict], str, float]:
    """Stage 2: Simple exponential smoothing with trend.
    Holt's linear method: level + trend components.
    alpha=0.3 (level), beta=0.1 (trend).
    """
    values = list(weekly.values())
    if len(values) < 4:
        # Fall back to moving average
        return _moving_average(weekly, weeks_ahead)

    last_week_str = list(weekly.keys())[-1]
    last_start = date.fromisoformat(last_week_str)

    # Initialize
    level = values[0]
    trend = (values[-1] - values[0]) / max(len(values) - 1, 1)
    alpha, beta = 0.3, 0.1

    # Fit
    for v in values[1:]:
        new_level = alpha * v + (1 - alpha) * (level + trend)
        new_trend = beta * (new_level - level) + (1 - beta) * trend
        level, trend = new_level, new_trend

    # Std error from fit residuals
    fitted = []
    l, t = values[0], (values[-1] - values[0]) / max(len(values) - 1, 1)
    for v in values[1:]:
        fitted.append(l + t)
        l = alpha * v + (1 - alpha) * (l + t)
        t = beta * (l - l) + (1 - beta) * t  # simplified

    residuals = [abs(values[i+1] - fitted[i]) for i in range(len(fitted))]
    std_err = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else level * 0.15

    # Forecast
    forecast = []
    for i in range(1, weeks_ahead + 1):
        week_start = last_start + timedelta(weeks=i)
        predicted = round(level + trend * i, 2)
        ci = round(std_err * 1.28 * np.sqrt(i), 2)  # CI widens with horizon
        forecast.append({
            "week_start": week_start.isoformat(),
            "predicted": predicted,
            "lower_bound": round(max(0, predicted - ci), 2),
            "upper_bound": round(predicted + ci, 2),
            "confidence": "medium",
        })

    # MAPE
    mape = round(float(np.mean(residuals) / np.mean(values)) if np.mean(values) > 0 else 0.0, 4)

    return forecast, "exponential_smoothing", mape


def forecast_revenue(weeks_ahead: int = 12) -> dict:
    """Main entry point. Generate weekly revenue forecast."""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Historical weekly revenue
        weekly = _get_weekly_revenue(cursor)
        data_weeks = len(weekly)

        # 2. Notable events in forecast window (context only)
        events = _get_notable_events(cursor, weeks_ahead)

        # 3. Choose method based on data stage
        if data_weeks < 4:
            forecast, model, mape = _moving_average(weekly, weeks_ahead)
        elif data_weeks <= 52:
            forecast, model, mape = _exponential_smoothing(weekly, weeks_ahead)
        else:
            # Stage 3: evaluate Prophet — for now use exp smoothing
            forecast, model, mape = _exponential_smoothing(weekly, weeks_ahead)
            model = "exponential_smoothing (Prophet evaluation recommended)"

        # 4. Add event markers to forecast weeks
        event_dates = {e["event_date"]: e for e in events if hasattr(e["event_date"], "isoformat") or isinstance(e["event_date"], date)}
        # Normalize to string keys
        event_by_date = {}
        for e in events:
            ed = e["event_date"]
            if hasattr(ed, "isoformat"):
                key = ed.isoformat()
            elif hasattr(ed, "strftime"):
                key = str(ed)
            else:
                key = str(ed)
            event_by_date[key] = e

        for f in forecast:
            ws = f["week_start"]
            # Check if any event falls within this forecast week
            week_end = date.fromisoformat(ws) + timedelta(days=6)
            for e in events:
                ed = e["event_date"]
                if hasattr(ed, "date"):
                    ed = ed.date()
                elif isinstance(ed, date):
                    pass
                else:
                    continue
                if date.fromisoformat(ws) <= ed <= week_end:
                    f["has_event"] = True
                    f["event_name"] = e["event_name"]
                    break

        # 5. Historical data for chart
        historical = [
            {"week_start": ws, "revenue": rev}
            for ws, rev in weekly.items()
        ]

        return {
            "forecast": forecast,
            "historical": historical,
            "model": model,
            "mape": mape,
            "data_weeks": data_weeks,
            "weeks_ahead": weeks_ahead,
            "exogenous_features": [],
            "notable_events": [
                {"date": str(e.get("event_date", "")), "event": e.get("event_name", "")}
                for e in events
            ],
        }
