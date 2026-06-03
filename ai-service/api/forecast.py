"""
Revenue forecast API — weekly revenue predictions.
GET /forecast/revenue?weeks=12
"""
from fastapi import APIRouter, Query
from services.forecast import forecast_revenue

router = APIRouter()


@router.get("/revenue")
async def get_revenue_forecast(weeks: int = Query(default=12, ge=1, le=52)):
    """Generate weekly revenue forecast for the next N weeks.
    Cold-start aware:
      < 4 weeks data → simple moving average
      4-52 weeks → exponential smoothing
      > 52 weeks → Prophet evaluation recommended

    Returns historical data for chart + forecast with confidence intervals.
    """
    result = forecast_revenue(weeks)
    return result
