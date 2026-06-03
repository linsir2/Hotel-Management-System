"""
Test NL search accuracy on 18 queries — using httpx to call the running API.
Start service first: cd ai-service && bash start.sh
Then run: python test_search.py
"""
import sys
import json
import httpx

BASE = "http://localhost:8000"

TEST_QUERIES = [
    ("有哪些空房", "room_available"),
    ("101能住吗", "room_number"),         # entity: room 101
    ("维修的房间", "room_maintenance"),
    ("全部房间列表", "room_all"),
    ("有没有单人间", "room_type_single"),   # room type query
    ("张伟的订单", "guest_name"),          # entity: 张伟
    ("李娜住到几号", "guest_name"),        # entity: 李娜
    ("帮我查一下王五", "guest_name"),      # entity: 王五
    ("今天入住的", "booking_checked_in"),
    ("明天退房的", "booking_checked_in"),
    ("当前在住的有哪些", "booking_checked_in"),
    ("大床房多少钱", "room_type_bigbed"),
    ("有没有套房", "room_type_suite"),
    ("标准间价格", "room_type_double"),    # or room_pricing — both acceptable
    ("我想订房", "room_available"),
    ("有人住吗", "room_occupied"),         # genuine ambiguity: could also be room_available
    ("坏了要修的", "room_maintenance"),
    ("住客名单", "guest_list"),
]


def is_correct(result: dict, expected: str) -> tuple[bool, str]:
    """Judge whether result matches expected intent."""
    mode = result.get("mode", "unknown")
    category = result.get("matched_category", "")
    entity_summary = result.get("entity_summary", "")
    entities = result.get("entities_found", "")

    # Entity match
    if expected in ("guest_name", "room_number", "date"):
        if mode == "entity_match":
            if expected == "guest_name" and "guest=" in entity_summary:
                return True, f"entity_match ✓ ({entity_summary})"
            if expected == "room_number" and "room=" in entity_summary:
                return True, f"entity_match ✓ ({entity_summary})"
            if expected == "date" and "date=" in entity_summary:
                return True, f"entity_match ✓ ({entity_summary})"
        return False, f"expected entity_match({expected}), got mode={mode}"

    # Embedding match
    if category == expected:
        return True, f"{mode} ✓"
    # Partial: if category starts with expected or vice versa
    if expected in category or category in expected:
        return True, f"{mode} ✓ (partial)"

    return False, f"expected {expected}, got {category} ({mode})"


def main():
    # Health check
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        print(f"Health: {r.json()['status']}\n")
    except Exception as e:
        print(f"❌ Service not reachable at {BASE}: {e}")
        print("Start with: cd ai-service && bash start.sh")
        sys.exit(1)

    correct = 0
    total = 0

    print(f"{'Query':<18s} {'Expected':<22s} {'Result':>50s}")
    print("-" * 90)

    for query, expected in TEST_QUERIES:
        try:
            r = httpx.post(
                f"{BASE}/nl-search/search",
                json={"query": query, "top_k": 5},
                timeout=10,
            )
            result = r.json()
            ok, detail = is_correct(result, expected)
            if ok:
                correct += 1
            total += 1
            status = "✅" if ok else "❌"
            print(f"{query:<18s} {expected:<22s} {status} {detail}")
        except Exception as e:
            print(f"{query:<18s} {expected:<22s} ❌ error: {e}")
            total += 1

    print("-" * 90)
    print(f"\nAccuracy: {correct}/{total} = {correct/total*100:.1f}%\n")


if __name__ == "__main__":
    main()
