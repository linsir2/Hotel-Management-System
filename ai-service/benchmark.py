"""
Benchmark: MiniLM dense embedding vs SPLADE sparse embedding.
Test cases cover 4 MVP query templates + edge cases.
All models loaded from local HF cache, HF mirror enforced.
"""
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

import time
import sys
import numpy as np

# ============================================================
# Test queries — 覆盖4类MVP模板 + 边界case
# ============================================================
TEST_QUERIES = [
    # 查房间状态
    ("有哪些空房", "available_rooms"),
    ("101能住吗", "available_rooms"),
    ("维修的房间", "maintenance_rooms"),
    ("全部房间列表", "all_rooms"),
    ("有没有单人间", "all_rooms"),
    # 查客人预订
    ("张伟的订单", "search_guest_bookings"),
    ("李娜住到几号", "search_guest_bookings"),
    ("帮我查一下王五", "search_guest_bookings"),
    # 查日期预订
    ("今天入住的", "checked_in"),
    ("明天退房的", "checked_in"),
    ("当前在住的有哪些", "checked_in"),
    # 查房型
    ("大床房多少钱", "all_rooms"),
    ("有没有套房", "all_rooms"),
    ("标准间价格", "all_rooms"),
    # 边界 — 口语/模糊
    ("我想订房", "available_rooms"),
    ("有人住吗", "available_rooms"),
    ("坏了要修的", "maintenance_rooms"),
    ("住客名单", "guests"),
]

# Template keywords (same as nl_search.py)
TEMPLATE_KEYWORDS = [
    "空房 空闲 available 可预订 没住人 房间空余 订房 有人住吗",
    "维修 维护 maintenance 坏了 在修 故障 要修",
    "全部房间 所有房间 房间列表 all rooms 房间一览 单人间 大床房 套房 标准间 多少钱 价格",
    "订单 预订 booking 预约 预定",
    "入住 checked_in 在住 已入住 当前住客 今天入住 明天退房",
    "客人 住客 guest 名字 姓名 客户 名单 查 是谁",
]

TEMPLATE_SQL_CATEGORIES = [
    "available_rooms",
    "maintenance_rooms",
    "all_rooms",
    "bookings",
    "checked_in",
    "guests",
]


def run_minilm():
    """Test MiniLM dense embedding (paraphrase-multilingual-MiniLM-L12-v2)."""
    from sentence_transformers import SentenceTransformer

    print("=" * 60)
    print("🔵 MiniLM Dense Embedding")
    print("=" * 60)

    # --- Load ---
    t0 = time.time()
    model = SentenceTransformer(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    load_time = time.time() - t0
    print(f"  模型加载: {load_time:.2f}s")

    # --- Encode templates ---
    t0 = time.time()
    template_vecs = model.encode(
        TEMPLATE_KEYWORDS, convert_to_tensor=False, normalize_embeddings=True
    )
    template_vecs = template_vecs.astype(np.float32)
    encode_templates = time.time() - t0
    print(f"  模板编码 (6条): {encode_templates*1000:.0f}ms")

    # --- Single query encode ---
    single_times = []
    for q, _ in TEST_QUERIES:
        t0 = time.time()
        vec = model.encode(q, convert_to_tensor=False, normalize_embeddings=True)
        single_times.append((time.time() - t0) * 1000)
    print(f"  单条编码 (avg): {np.mean(single_times):.0f}ms (min={np.min(single_times):.0f}ms, max={np.max(single_times):.0f}ms)")

    # --- Full query match ---
    correct = 0
    total = 0
    match_times = []
    threshold = 0.4

    for query, expected_category in TEST_QUERIES:
        t0 = time.time()
        q_vec = model.encode(query, convert_to_tensor=False, normalize_embeddings=True)
        scores = np.dot(template_vecs, q_vec.astype(np.float32))
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])
        elapsed = (time.time() - t0) * 1000
        match_times.append(elapsed)

        predicted = TEMPLATE_SQL_CATEGORIES[best_idx] if best_score >= threshold else "no_match"
        if predicted == expected_category:
            correct += 1
        total += 1

    accuracy = correct / total * 100
    print(f"\n  准确率: {correct}/{total} = {accuracy:.1f}% (threshold={threshold})")
    print(f"  单次查询全链路 (avg): {np.mean(match_times):.0f}ms")
    print(f"  模型常驻内存: ~120MB\n")

    return accuracy, np.mean(match_times)


def run_splade():
    """Test SPLADE sparse embedding (naver/splade-cocondenser-ensembledistil)."""
    from transformers import AutoTokenizer, AutoModelForMaskedLM
    import torch

    print("=" * 60)
    print("🟡 SPLADE Sparse Embedding")
    print("=" * 60)

    # --- Load ---
    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(
        "naver/splade-cocondenser-ensembledistil"
    )
    model = AutoModelForMaskedLM.from_pretrained(
        "naver/splade-cocondenser-ensembledistil"
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    model.eval()
    load_time = time.time() - t0
    print(f"  模型加载: {load_time:.2f}s (device={device})")

    def splade_encode(texts, batch_size=1):
        """Raw SPLADE encode — compute sparse vectors via max-pooling over log(1+ReLU)."""
        all_vecs = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            with torch.no_grad():
                inputs = tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=128,
                    return_tensors="pt",
                ).to(device)
                outputs = model(**inputs)
                logits = outputs.logits
                # SPLADE aggregation: max over tokens of log(1 + ReLU(x))
                relu = torch.relu(logits)
                log_sat = torch.log1p(relu)
                vec = torch.max(log_sat, dim=1).values
                all_vecs.append(vec.cpu().numpy())
        return np.concatenate(all_vecs, axis=0) if len(all_vecs) > 1 else all_vecs[0]

    # --- Encode templates ---
    t0 = time.time()
    template_vecs = splade_encode(TEMPLATE_KEYWORDS)
    template_norm = np.linalg.norm(template_vecs, axis=1, keepdims=True)
    template_vecs = template_vecs / (template_norm + 1e-8)
    encode_templates = time.time() - t0
    print(f"  模板编码 (6条): {encode_templates*1000:.0f}ms")

    # --- Single query encode ---
    single_times = []
    for q, _ in TEST_QUERIES:
        t0 = time.time()
        splade_encode([q])
        single_times.append((time.time() - t0) * 1000)
    print(f"  单条编码 (avg): {np.mean(single_times):.0f}ms (min={np.min(single_times):.0f}ms, max={np.max(single_times):.0f}ms)")

    # --- Full query match ---
    correct = 0
    total = 0
    match_times = []
    threshold = 0.35  # SPLADE 稀疏向量得分普遍偏低, 阈值需降低

    for query, expected_category in TEST_QUERIES:
        t0 = time.time()
        q_vec = splade_encode([query])
        q_vec = q_vec / (np.linalg.norm(q_vec) + 1e-8)
        scores = np.dot(template_vecs, q_vec.T).flatten()
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])
        elapsed = (time.time() - t0) * 1000
        match_times.append(elapsed)

        predicted = TEMPLATE_SQL_CATEGORIES[best_idx] if best_score >= threshold else "no_match"
        if predicted == expected_category:
            correct += 1
        total += 1

    accuracy = correct / total * 100
    print(f"\n  准确率: {correct}/{total} = {accuracy:.1f}% (threshold={threshold})")
    print(f"  单次查询全链路 (avg): {np.mean(match_times):.0f}ms")
    print(f"  模型常驻内存: ~500MB\n")

    return accuracy, np.mean(match_times)


def print_detail_comparison():
    """Print per-query comparison table."""
    from sentence_transformers import SentenceTransformer
    import torch
    from transformers import AutoTokenizer, AutoModelForMaskedLM

    print("\n" + "=" * 60)
    print("📊 逐查询详细对比")
    print("=" * 60)

    # Load both models
    print("  加载模型中...")
    minilm = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    mini_vecs = minilm.encode(TEMPLATE_KEYWORDS, convert_to_tensor=False, normalize_embeddings=True)

    tokenizer = AutoTokenizer.from_pretrained("naver/splade-cocondenser-ensembledistil")
    splade_model = AutoModelForMaskedLM.from_pretrained("naver/splade-cocondenser-ensembledistil")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    splade_model = splade_model.to(device)
    splade_model.eval()

    def splade_encode_single(text):
        with torch.no_grad():
            inputs = tokenizer([text], padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
            outputs = splade_model(**inputs)
            relu = torch.relu(outputs.logits)
            log_sat = torch.log1p(relu)
            vec = torch.max(log_sat, dim=1).values.cpu().numpy().flatten()
            return vec / (np.linalg.norm(vec) + 1e-8)

    splade_vecs = []
    for kw in TEMPLATE_KEYWORDS:
        splade_vecs.append(splade_encode_single(kw))
    splade_vecs = np.stack(splade_vecs)

    print(f"\n  {'查询':<16s} {'预期':<22s} | {'MiniLM得分':>10s} {'预测':<20s} | {'SPLADE得分':>10s} {'预测':<20s}")
    print(f"  {'-'*16} {'-'*22} | {'-'*10} {'-'*20} | {'-'*10} {'-'*20}")

    for query, expected in TEST_QUERIES:
        # MiniLM
        q_mini = minilm.encode(query, convert_to_tensor=False, normalize_embeddings=True)
        scores_mini = np.dot(mini_vecs, q_mini)
        best_mini = int(np.argmax(scores_mini))
        score_mini = float(scores_mini[best_mini])
        pred_mini = TEMPLATE_SQL_CATEGORIES[best_mini] if score_mini >= 0.4 else "no_match"

        # SPLADE
        q_sp = splade_encode_single(query)
        scores_sp = np.dot(splade_vecs, q_sp)
        best_sp = int(np.argmax(scores_sp))
        score_sp = float(scores_sp[best_sp])
        pred_sp = TEMPLATE_SQL_CATEGORIES[best_sp] if score_sp >= 0.35 else "no_match"

        mini_ok = "✅" if pred_mini == expected else "❌"
        sp_ok = "✅" if pred_sp == expected else "❌"

        print(f"  {query:<16s} {expected:<22s} | {mini_ok} {score_mini:>8.3f} {pred_mini:<20s} | {sp_ok} {score_sp:>8.3f} {pred_sp:<20s}")


if __name__ == "__main__":
    print("\n🏨 Hotel AI Service — NL Search Model Benchmark\n")

    try:
        mini_acc, mini_avg = run_minilm()
    except Exception as e:
        print(f"  ❌ MiniLM 失败: {e}")
        mini_acc, mini_avg = 0, 0

    try:
        sp_acc, sp_avg = run_splade()
    except Exception as e:
        print(f"  ❌ SPLADE 失败: {e}")
        sp_acc, sp_avg = 0, 0

    # Summary
    print("=" * 60)
    print("📈 总结")
    print("=" * 60)
    print(f"  MiniLM:  准确率 {mini_acc:.0f}% | 全链路 {mini_avg:.0f}ms | 内存 ~120MB")
    print(f"  SPLADE:  准确率 {sp_acc:.0f}% | 全链路 {sp_avg:.0f}ms | 内存 ~500MB")

    if mini_avg > 0 and sp_avg > 0:
        speedup = sp_avg / mini_avg
        print(f"\n  MiniLM 比 SPLADE 快 {speedup:.1f}x")

    # Per-query detail
    if mini_acc > 0 and sp_acc > 0:
        try:
            print_detail_comparison()
        except Exception as e:
            print(f"\n  详细对比失败: {e}")
