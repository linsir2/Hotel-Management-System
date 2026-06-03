"""
NL Search — two-stage pipeline: entity extraction → composable intent matching.
Stage 1: Rule-based entity extraction (room #, guest name, date) → precise SQL.
Stage 2: Dense embedding intent matching with top-2 ambiguity + same-table composition.
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np
import logging

from services.embedding import encode, batch_encode, cos_sim
from services.entity_extractor import extract_entities
from db.connection import get_db

router = APIRouter()
logger = logging.getLogger("uvicorn")

_encode_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="nl-encode")

# ═════════════════════════════════════════════════════════════
# Intent fragments — each is a composable SQL fragment.
# Same compose_group + same table → can be AND-combined.
# ═════════════════════════════════════════════════════════════

@dataclass
class Intent:
    intent_id: str
    display_name: str
    keywords: list[str]           # for embedding matching
    table: str                    # 'rooms' | 'bookings' | 'guests'
    where_clause: str             # SQL WHERE fragment (may contain {value})
    compose_group: str            # intents with same (table, compose_group) can AND-combine
    select_columns: str = "*"
    joins: str = ""
    extra_sql: str = ""           # appended after WHERE (ORDER BY, LIMIT, etc.)


INTENTS = [
    # ── Room: status group ──
    Intent("room_available", "空房",
           ["空房", "空闲", "可预订", "没住人", "能住", "可以住", "有空的", "有什么空房",
            "想订", "我想订房", "要订房", "订个房", "有什么房间可以住"],
           "rooms", "r.status = 'AVAILABLE'", "room_status",
           extra_sql="ORDER BY r.price"),

    Intent("room_maintenance", "维修房",
           ["维修", "维护", "坏了", "在修", "故障", "要修", "修理"],
           "rooms", "r.status = 'MAINTENANCE'", "room_status"),

    Intent("room_occupied", "已入住房间",
           ["已入住", "正在住", "住着人", "占用", "occupied"],
           "rooms", "r.status = 'OCCUPIED'", "room_status"),

    # ── Room: type group ──
    Intent("room_type_single", "单人间",
           ["单人间", "单人房", "单间", "单人"],
           "rooms", "r.type LIKE '%单人间%'", "room_type"),

    Intent("room_type_double", "标准间/双人间",
           ["双人间", "双人房", "标间", "标准间", "两人间"],
           "rooms", "(r.type LIKE '%标准%' OR r.type LIKE '%双人%')", "room_type"),

    Intent("room_type_bigbed", "大床房",
           ["大床房", "大床", "双人床", "一米八"],
           "rooms", "r.type LIKE '%大床%'", "room_type"),

    Intent("room_type_suite", "套房",
           ["套房", "总统套房", "套间", "豪华房", "豪华间"],
           "rooms", "(r.type LIKE '%套房%' OR r.type LIKE '%豪华%')", "room_type"),

    # ── Room: other ──
    Intent("room_pricing", "房间价格",
           ["多少钱", "价格", "费用", "房价", "每天多少", "一晚多少"],
           "rooms", "1=1", "room_info",
           select_columns="r.id, r.room_number, r.type, r.price, r.status",
           extra_sql="ORDER BY r.price"),

    Intent("room_all", "全部房间",
           ["所有房间", "全部房间", "房间列表", "房间一览", "都有什么房", "有哪些房间"],
           "rooms", "1=1", "room_info",
           extra_sql="ORDER BY r.id"),

    # ── Booking: status group ──
    Intent("booking_checked_in", "当前在住",
           ["入住", "在住", "已入住", "当前住客", "今天入住", "住店", "住几天", "住到", "退房",
            "住了", "明天退房"],
           "bookings", "b.status = 'CHECKED_IN'", "booking_status",
           select_columns="b.id, r.room_number, g.name AS guest_name, "
                          "b.check_in, b.check_out, b.status, b.total_amount",
           joins="JOIN rooms r ON b.room_id = r.id "
                 "JOIN guests g ON b.guest_id = g.id"),

    Intent("booking_pending", "待处理预订",
           ["待处理", "未处理", "待确认", "pending", "还没确认"],
           "bookings", "b.status = 'PENDING'", "booking_status",
           select_columns="b.id, r.room_number, g.name AS guest_name, "
                          "b.check_in, b.check_out, b.status, b.total_amount",
           joins="JOIN rooms r ON b.room_id = r.id "
                 "JOIN guests g ON b.guest_id = g.id"),

    # ── Booking: list group ──
    Intent("booking_list", "预订列表",
           ["订单", "预订", "预约", "预定", "booking", "订了", "的预订", "订的"],
           "bookings", "1=1", "booking_list",
           select_columns="b.id, r.room_number, g.name AS guest_name, "
                          "b.check_in, b.check_out, b.status, b.total_amount",
           joins="JOIN rooms r ON b.room_id = r.id "
                 "JOIN guests g ON b.guest_id = g.id",
           extra_sql="ORDER BY b.check_in DESC LIMIT 20"),

    # ── Guest ──
    Intent("guest_list", "住客列表",
           ["客人", "住客", "名单", "客户", "联系", "电话", "是谁", "查一下", "帮我查", "找一下"],
           "guests", "1=1", "guest",
           extra_sql="ORDER BY g.name"),
]

# ── Build keyword texts + pre-compute vectors ──
_intent_keyword_texts: list[str] = [" ".join(it.keywords) for it in INTENTS]
_intent_vecs: np.ndarray = None


def warmup():
    """Pre-load model + pre-encode all intent keyword vectors. Called at startup."""
    global _intent_vecs
    _intent_vecs = batch_encode(_intent_keyword_texts)


# ═════════════════════════════════════════════════════════════
# Matching logic
# ═════════════════════════════════════════════════════════════

# Each intent can have its own threshold floor
_INTENT_THRESHOLDS = {
    "room_available": 0.35,
    "room_maintenance": 0.45,
    "room_type_single": 0.55,
    "room_type_double": 0.55,
    "room_type_bigbed": 0.55,
    "room_type_suite": 0.55,
    "room_pricing": 0.40,
    "room_all": 0.50,
    "booking_list": 0.35,
    "booking_checked_in": 0.35,
    "booking_pending": 0.50,
    "guest_list": 0.40,
    "room_occupied": 0.55,
}
_DEFAULT_THRESHOLD = 0.40
_AMBIGUITY_GAP = 0.12   # top-1 vs top-2 score gap below this → ambiguous


# ═════════════════════════════════════════════════════════════
# Hybrid scoring: embedding + keyword-substring + semi-entity bonus.
# Embedding ~60%, lexical ~20%, semi-entity ~20-35%.
# ═════════════════════════════════════════════════════════════

# Room type names → treated as semi-entities (high-precision string match).
# If query contains these, the matching intent gets a strong bonus.
_SEMI_ENTITY_PATTERNS: dict[str, list[str]] = {
    "room_type_single":  ["单人间", "单人房", "单间"],
    "room_type_double":  ["双人间", "双人房", "标间", "标准间", "两人间"],
    "room_type_bigbed":  ["大床房", "大床"],
    "room_type_suite":   ["套房", "总统套房", "套间", "豪华房", "豪华间"],
    "room_available":    ["空房", "空闲"],
    "room_maintenance":  ["维修", "坏了", "在修", "故障"],
    "room_occupied":     ["有人住", "已入住", "住着人"],
    "booking_checked_in": ["入住", "在住", "退房"],
    "booking_list":      ["订单", "预订", "预约", "预定"],
    "guest_list":        ["客人", "住客", "名单", "电话"],
}


def _keyword_hit_bonus(query: str, keywords: list[str]) -> float:
    """Count individual keywords (len>=2) that appear as substrings in query.
    Returns 0.0 – 0.25 range bonus."""
    hits = 0
    for kw in keywords:
        if len(kw) >= 2 and kw in query:
            hits += 1
    # Cap at 5 hits → 0.25 max
    return min(0.25, hits * 0.05)


def _semi_entity_bonus(query: str, intent_id: str) -> float:
    """If query contains a room type / status keyword, give the
    matching intent a large bonus (0.35). This compensates for MiniLM's
    confusion between '有没有X' and general availability queries."""
    patterns = _SEMI_ENTITY_PATTERNS.get(intent_id, [])
    for pat in patterns:
        if pat in query:
            return 0.35
    return 0.0


def _match_intents(query_vec: np.ndarray, query: str) -> list[tuple[int, float]]:
    """Hybrid score: 60% embedding + keyword-hit bonus + semi-entity bonus."""
    emb_scores = np.dot(_intent_vecs, query_vec)
    hybrid = []
    for idx, emb in enumerate(emb_scores):
        intent = INTENTS[idx]
        kw_bonus = _keyword_hit_bonus(query, intent.keywords)
        se_bonus = _semi_entity_bonus(query, intent.intent_id)
        combined = 0.60 * float(emb) + kw_bonus + se_bonus
        hybrid.append((idx, combined))
    hybrid.sort(key=lambda x: -x[1])
    return hybrid


def _above_threshold(intent_id: str, score: float) -> bool:
    threshold = _INTENT_THRESHOLDS.get(intent_id, _DEFAULT_THRESHOLD)
    return score >= threshold


# ═════════════════════════════════════════════════════════════
# SQL builder — entity-aware + composable
# ═════════════════════════════════════════════════════════════

def _build_query(intent: Intent, entities=None) -> str:
    """Build full SQL from an Intent + optional entities."""
    select = intent.select_columns if intent.select_columns != "*" else "*"
    if intent.table == "rooms":
        select = select.replace("r.", "") if "r." in select else select
        base = f"SELECT {select} FROM rooms r"
    elif intent.table == "bookings":
        base = f"SELECT {select} FROM bookings b"
    elif intent.table == "guests":
        select = select.replace("g.", "") if "g." in select else select
        base = f"SELECT {select} FROM guests g"
    else:
        raise ValueError(f"Unknown table: {intent.table}")

    if intent.joins:
        base += f" {intent.joins}"

    where = intent.where_clause

    # Inject entity values into WHERE
    if entities:
        if entities.date and "{date}" in where:
            where = where.replace("{date}", f"'{entities.date['value']}'")
        if entities.guest and "{guest_id}" in where:
            where = where.replace("{guest_id}", str(entities.guest["guest_id"]))
        if entities.room and "{room_id}" in where:
            where = where.replace("{room_id}", str(entities.room["room_id"]))

    base += f" WHERE {where}"

    if intent.extra_sql:
        base += f" {intent.extra_sql}"

    return base


def _compose_query(intents: list[Intent], entities=None) -> str:
    """Combine multiple intents (same table) into one SQL with AND-ed WHERE clauses."""
    main = intents[0]
    where_parts = [it.where_clause for it in intents]
    combined_where = " AND ".join(where_parts)

    select = main.select_columns if main.select_columns != "*" else "*"
    if main.table == "rooms":
        base = f"SELECT {select} FROM rooms r"
    elif main.table == "bookings":
        base = f"SELECT {select} FROM bookings b"
    elif main.table == "guests":
        base = f"SELECT {select} FROM guests g"
    else:
        raise ValueError(f"Unknown table: {main.table}")

    if main.joins:
        base += f" {main.joins}"

    base += f" WHERE {combined_where}"

    if main.extra_sql:
        base += f" {main.extra_sql}"

    return base


# ═════════════════════════════════════════════════════════════
# Entity-aware SQL generation (bypasses embedding)
# ═════════════════════════════════════════════════════════════

def _entity_sql(entities, query: str) -> str | None:
    """Generate precise SQL from extracted entities. Returns None if can't determine intent.

    Only returns SQL for guest_name or room_number entities (high precision).
    Date-only entities are too ambiguous — they fall through to embedding matching.
    """
    e = entities

    # ── Room number entity (high precision) ──
    if e.room:
        room_id = e.room["room_id"]
        booking_words = {"预订", "订单", "订了", "住的", "谁住", "住了谁"}
        if any(w in query for w in booking_words):
            return (
                f"SELECT b.id, r.room_number, g.name AS guest_name, "
                f"b.check_in, b.check_out, b.status "
                f"FROM bookings b "
                f"JOIN rooms r ON b.room_id = r.id "
                f"JOIN guests g ON b.guest_id = g.id "
                f"WHERE b.room_id = {room_id} "
                f"AND b.status IN ('CHECKED_IN', 'CONFIRMED', 'PENDING')"
            )
        return (
            f"SELECT id, room_number, type, price, status "
            f"FROM rooms WHERE id = {room_id}"
        )

    # ── Guest name entity (high precision) ──
    if e.guest:
        guest_id = e.guest["guest_id"]
        booking_words = {"订单", "预订", "订了", "预定", "预约", "住到", "住几天", "住的", "住几号"}
        if any(w in query for w in booking_words):
            return (
                f"SELECT b.id, r.room_number, g.name AS guest_name, "
                f"b.check_in, b.check_out, b.status, b.total_amount "
                f"FROM bookings b "
                f"JOIN rooms r ON b.room_id = r.id "
                f"JOIN guests g ON b.guest_id = g.id "
                f"WHERE b.guest_id = {guest_id} "
                f"ORDER BY b.check_in DESC"
            )
        return (
            f"SELECT g.id, g.name, g.phone, "
            f"b.id AS booking_id, r.room_number, b.check_in, b.check_out, b.status "
            f"FROM guests g "
            f"LEFT JOIN bookings b ON g.id = b.guest_id "
            f"LEFT JOIN rooms r ON b.room_id = r.id "
            f"WHERE g.id = {guest_id} "
            f"ORDER BY b.check_in DESC"
        )

    # ── Date-only: too ambiguous, let embedding handle it ──
    return None


# ═════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════

def _serialize(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "__float__"):
        return float(value)
    return value


def _rows_to_dicts(rows) -> list[dict]:
    return [{k: _serialize(v) for k, v in row.items()} for row in rows]


# ═════════════════════════════════════════════════════════════
# Request model + endpoint
# ═════════════════════════════════════════════════════════════

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


@router.post("/search")
async def natural_language_search(req: SearchRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # ── Stage 1: Entity extraction ──
    with get_db() as conn:
        entities = extract_entities(query, conn)

        # If entity found and we can determine intent → precise SQL
        if entities.has_any:
            sql = _entity_sql(entities, query)
            if sql:
                cursor = conn.cursor()
                cursor.execute(sql)
                rows = cursor.fetchall()
                return {
                    "query": query,
                    "mode": "entity_match",
                    "entity_summary": entities.summary(),
                    "matched_category": "custom",
                    "table": "guests" if "FROM guests" in sql else ("bookings" if "FROM bookings" in sql else "rooms"),
                    "confidence": 1.0,
                    "results": _rows_to_dicts(rows),
                    "count": len(rows),
                }

        # ── Stage 2: Embedding intent matching ──
        loop = __import__("asyncio").get_event_loop()
        query_vec = await loop.run_in_executor(_encode_pool, encode, query)

        ranked = _match_intents(query_vec, query)
        top1_idx, top1_score = ranked[0]
        top2_idx, top2_score = ranked[1] if len(ranked) > 1 else (-1, -1.0)
        top1_intent = INTENTS[top1_idx]

        # Check threshold
        if not _above_threshold(top1_intent.intent_id, top1_score):
            return {
                "query": query,
                "mode": "no_match",
                "matched_category": "no_match",
                "table": "",
                "confidence": round(top1_score, 3),
                "results": [],
                "suggestion": "请尝试更具体的搜索，例如：空房、客人姓名、维修房间",
                "entities_found": entities.summary(),
            }

        # ── Ambiguity: top-2 close scores, different tables ──
        top2_intent = INTENTS[top2_idx] if top2_idx >= 0 else None
        score_gap = top1_score - top2_score

        if top2_intent and score_gap < _AMBIGUITY_GAP and top1_intent.table != top2_intent.table:
            # Ambiguous: return two candidates, let user choose
            return {
                "query": query,
                "mode": "ambiguous",
                "matched_category": top1_intent.intent_id,
                "table": "",
                "confidence": round(top1_score, 3),
                "candidates": [
                    {
                        "category": top1_intent.intent_id,
                        "table": top1_intent.table,
                        "display": top1_intent.display_name,
                        "score": round(top1_score, 3),
                    },
                    {
                        "category": top2_intent.intent_id,
                        "table": top2_intent.table,
                        "display": top2_intent.display_name,
                        "score": round(top2_score, 3),
                    },
                ],
                "suggestion": f"你是想查「{top1_intent.display_name}」还是「{top2_intent.display_name}」？",
                "results": [],
                "count": 0,
                "entities_found": entities.summary(),
            }

        # ── Composition: top-2 same table + same compose_group → AND-combine ──
        if (top2_intent and score_gap < _AMBIGUITY_GAP
                and top1_intent.table == top2_intent.table
                and top1_intent.compose_group != top2_intent.compose_group
                and _above_threshold(top2_intent.intent_id, top2_score)):

            combined_ids = f"{top1_intent.intent_id}+{top2_intent.intent_id}"
            combined_display = f"{top1_intent.display_name}+{top2_intent.display_name}"
            sql = _compose_query([top1_intent, top2_intent], entities)
            cursor = conn.cursor()
            cursor.execute(sql)
            rows = cursor.fetchall()

            return {
                "query": query,
                "mode": "composed",
                "matched_category": combined_ids,
                "table": top1_intent.table,
                "intent_display": combined_display,
                "confidence": round(max(top1_score, top2_score), 3),
                "results": _rows_to_dicts(rows),
                "count": len(rows),
                "entities_found": entities.summary(),
            }

        # ── Direct match ──
        sql = _build_query(top1_intent, entities)
        cursor = conn.cursor()
        cursor.execute(sql)
        rows = cursor.fetchall()

        return {
            "query": query,
            "mode": "direct",
            "matched_category": top1_intent.intent_id,
            "table": top1_intent.table,
            "intent_display": top1_intent.display_name,
            "confidence": round(top1_score, 3),
            "results": _rows_to_dicts(rows),
            "count": len(rows),
            "entities_found": entities.summary(),
        }
