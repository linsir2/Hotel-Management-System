from fastapi import APIRouter
from services.rule_engine import ALL_RULES

router = APIRouter()


def _serialize(value):
    """Convert DB types to JSON-safe Python types."""
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    if hasattr(value, '__float__'):
        return float(value)
    return value


@router.get("/scan")
async def scan_all_anomalies():
    """Run all 9 anomaly detection rules, return categorized results."""
    results = {"summary": {"critical": 0, "warning": 0, "info": 0}, "anomalies": []}

    for rule_key, rule_name, rule_fn, severity in ALL_RULES:
        try:
            items = rule_fn()
            if items:
                items_clean = [
                    {k: _serialize(v) for k, v in row.items()}
                    for row in items
                ]
                results["anomalies"].append({
                    "rule_key": rule_key,
                    "rule_name": rule_name,
                    "severity": severity,
                    "count": len(items),
                    "items": items_clean,
                })
                results["summary"][severity] += len(items)
        except Exception as e:
            results["anomalies"].append({
                "rule_key": rule_key,
                "rule_name": rule_name,
                "severity": severity,
                "count": 0,
                "error": str(e),
            })

    return results


@router.get("/types")
async def list_anomaly_types():
    """Return all anomaly rule types for frontend filtering."""
    return {
        "types": [
            {"key": k, "name": n, "severity": s}
            for k, n, _, s in ALL_RULES
        ]
    }
