"""
Entity extractor — rule-based extraction of room numbers, guest names, dates.
All entities verified against DB (reverse-lookup pattern). No ML dependency.
"""
import re
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger("uvicorn")

# ═══════════════════════════════════════════════════════════
# Room number extraction
# ═══════════════════════════════════════════════════════════
_ROOM_NUM_RE = re.compile(r"(?<!\d)(\d{3,4})(?!\d)")
# Context words near the number — within 5 chars either side
_ROOM_POSITIVE_CTX = {"房", "号", "房间", "能住", "可以住", "住", "空闲", "有人", "在修", "维修", "坏了"}
_ROOM_NEGATIVE_CTX = {"价格", "元", "块", "钱", "金额", "总共", "合计", "费用", "岁", "人", "位", "晚", "天"}

def _room_context_ok(query: str, num_str: str) -> tuple[bool, float]:
    """Check 5-char window around room number for positive/negative signals."""
    pos = query.find(num_str)
    if pos < 0:
        return False, 0.0
    start = max(0, pos - 5)
    end = min(len(query), pos + len(num_str) + 5)
    window = query[start:end]

    has_positive = any(w in window for w in _ROOM_POSITIVE_CTX)
    has_negative = any(w in window for w in _ROOM_NEGATIVE_CTX)

    if has_negative:
        return False, 0.0
    if has_positive:
        return True, 0.9
    # No context signal either way — still check DB, but lower confidence
    return True, 0.5


def _extract_room(query: str, db_conn) -> Optional[dict]:
    """Extract room number, verify against rooms table."""
    matches = _ROOM_NUM_RE.findall(query)
    if not matches:
        return None

    cursor = db_conn.cursor()
    for num in matches:
        ok, confidence = _room_context_ok(query, num)
        if not ok:
            continue
        cursor.execute(
            "SELECT id, room_number, type, price, status FROM rooms WHERE room_number = %s",
            (num,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "type": "room_number",
                "value": num,
                "room_id": row["id"],
                "room": row,
                "confidence": confidence,
            }
    return None


# ═══════════════════════════════════════════════════════════
# Guest name extraction
# ═══════════════════════════════════════════════════════════
# Natural text boundaries — only check the RIGHT side of the name.
# Chinese names often follow verbs/prepositions ("找张伟","查王五"),
# so the left side is not a reliable boundary.
# Chars that can follow a name without forming a compound word.
# Includes: punctuation, function words (的/了/在/是/...),
# common post-name verbs (住/订/要/到/...), question particles (呢/吗/吧/...).
_RIGHT_BOUNDARY_OK = re.compile(
    r"(?:$|[\s，。！？、的了在是有着和与到从给被让因所以这边那更也都还就才"
    r"住订要说到问想去来请帮呢吗吧啊哦哈哎喂叫把向或但而且跟给没对])"
)

_guest_cache: list[dict] = []
_guest_cache_loaded = False


def _load_guest_cache(db_conn) -> list[dict]:
    global _guest_cache, _guest_cache_loaded
    if _guest_cache_loaded:
        return _guest_cache
    cursor = db_conn.cursor()
    cursor.execute("SELECT id, name FROM guests")
    _guest_cache = cursor.fetchall()
    _guest_cache_loaded = True
    logger.info(f"Guest name cache loaded: {len(_guest_cache)} entries")
    return _guest_cache


def _extract_guest(query: str, db_conn) -> Optional[dict]:
    """Find guest names in query string. Verify against guests table.
    Only checks RIGHT boundary — "张伟的订单" OK, "纸张伟大" rejected.
    Prefers longest name match.
    """
    guests = _load_guest_cache(db_conn)
    candidates = []

    for guest in guests:
        name = guest["name"]
        pos = query.find(name)
        if pos < 0:
            continue

        # Right boundary check: char after name must be natural break or end-of-string
        after_idx = pos + len(name)
        if after_idx < len(query):
            after_char = query[after_idx]
            if not _RIGHT_BOUNDARY_OK.match(after_char):
                continue  # e.g., "纸张伟大" — "大" is not a boundary

        candidates.append({
            **guest,
            "position": pos,
            "name_len": len(name),
        })

    if not candidates:
        return None

    # Prefer longest name (most specific)
    candidates.sort(key=lambda c: -c["name_len"])
    best = candidates[0]

    return {
        "type": "guest_name",
        "value": best["name"],
        "guest_id": best["id"],
        "position": best["position"],
    }


# ═══════════════════════════════════════════════════════════
# Date extraction
# ═══════════════════════════════════════════════════════════
_RELATIVE_DATES = {"今天": 0, "明天": 1, "后天": 2}
_ABSOLUTE_DATE_RE = re.compile(r"(\d{1,2})月(\d{1,2})[号日]?")
_CHECK_IN_WORDS = {"入住", "住进来", "来住", "入住的", "住店的", "check in", "办理"}
_CHECK_OUT_WORDS = {"退房", "离开", "走", "退房的", "住到", "check out", "结账"}


def _extract_date(query: str) -> Optional[dict]:
    """Extract date reference. Supports relative (今天/明天/后天) and absolute (X月X日)."""
    today = date.today()

    # ── Relative dates ──
    for keyword, offset in _RELATIVE_DATES.items():
        if keyword in query:
            target = today + timedelta(days=offset)
            # Derive direction from surrounding words
            direction = None
            if any(w in query for w in _CHECK_IN_WORDS):
                direction = "check_in"
            elif any(w in query for w in _CHECK_OUT_WORDS):
                direction = "check_out"

            return {
                "type": "date",
                "value": target.isoformat(),
                "keyword": keyword,
                "direction": direction,
            }

    # ── Absolute dates ──
    m = _ABSOLUTE_DATE_RE.search(query)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            target = date(today.year, month, day)
        except ValueError:
            return None
        return {
            "type": "date",
            "value": target.isoformat(),
            "keyword": m.group(),
            "direction": None,
        }

    return None


# ═══════════════════════════════════════════════════════════
# Main API
# ═══════════════════════════════════════════════════════════

@dataclass
class ExtractedEntities:
    """All entities found in a single query. Check .has_any to decide routing."""
    guest: Optional[dict] = None
    room: Optional[dict] = None
    date: Optional[dict] = None

    @property
    def has_any(self) -> bool:
        return self.guest is not None or self.room is not None or self.date is not None

    def summary(self) -> str:
        parts = []
        if self.guest:
            parts.append(f"guest={self.guest['value']}")
        if self.room:
            parts.append(f"room={self.room['value']}")
        if self.date:
            parts.append(f"date={self.date['value']}")
        return ", ".join(parts) if parts else "none"


def extract_entities(query: str, db_conn) -> ExtractedEntities:
    """Extract all entities from a natural language query.
    Room numbers → context-filtered + DB-verified.
    Guest names → right-boundary check + DB-verified, longest match preferred.
    Dates → relative (今天/明天/后天) or absolute (X月X日) + direction inference.
    """
    result = ExtractedEntities()
    result.room = _extract_room(query, db_conn)      # precision-targeted
    result.date = _extract_date(query)                # no DB needed
    result.guest = _extract_guest(query, db_conn)     # DB-verified, boundary-checked
    return result
