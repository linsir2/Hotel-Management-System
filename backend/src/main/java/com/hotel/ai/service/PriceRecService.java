package com.hotel.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Handles pricing recommendation persistence + approval/rejection workflow.
 * Python generates recommendations → this service persists them.
 * Manager approves/rejects → this service executes the changes.
 *
 * Three-iron-rule compliance:
 *   - Only Spring Boot writes to MySQL.
 *   - Every action is auditable (logged).
 *   - Original code untouched (new service, new tables only).
 */
@Service("priceRecService")
public class PriceRecService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public PriceRecService(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    // ═══════════════════════════════════════════════════════════
    // Save recommendations from Python response
    // ═══════════════════════════════════════════════════════════

    @Transactional
    public int saveRecommendations(Map<String, Object> pythonResponse) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recs = (List<Map<String, Object>>) pythonResponse.get("recommendations");
        if (recs == null || recs.isEmpty()) return 0;

        // Mark older PENDING recommendations as SUPERSEDED
        jdbc.update("UPDATE price_recommendations SET status = 'REJECTED', " +
                "reject_reason = 'Superseded by newer recommendations' WHERE status = 'PENDING'");

        // Reject reason column may not be long enough, truncate if needed
        int count = 0;
        for (Map<String, Object> rec : recs) {
            jdbc.update(
                "INSERT INTO price_recommendations " +
                "(room_id, room_type, current_price, suggested_price, change_pct, " +
                "occupancy_pct, confidence, reasoning, status, created_by, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'AI_SERVICE', NOW())",
                toInt(rec.get("room_id")),
                String.valueOf(rec.get("room_type")),
                toBigDecimal(rec.get("current_price")),
                toBigDecimal(rec.get("suggested_price")),
                toBigDecimal(rec.get("final_change_pct")),
                toBigDecimal(pythonResponse.get("occupancy_rate")),
                toBigDecimal(rec.get("confidence")),
                safeJson(rec.get("reasoning"))
            );
            count++;
        }
        return count;
    }

    // ═══════════════════════════════════════════════════════════
    // Approve — update rooms.price + insert price_history
    // ═══════════════════════════════════════════════════════════

    @Transactional
    public Map<String, Object> approve(Integer recommendationId, String reviewedBy) {
        // 1. Read the recommendation
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM price_recommendations WHERE id = ?", recommendationId);
        if (rows.isEmpty()) {
            return Map.of("success", false, "error", "Recommendation not found");
        }
        Map<String, Object> rec = rows.get(0);
        if (!"PENDING".equals(rec.get("status"))) {
            return Map.of("success", false, "error",
                "Recommendation already " + rec.get("status"));
        }

        Integer roomId = (Integer) rec.get("room_id");
        BigDecimal oldPrice = (BigDecimal) rec.get("current_price");
        BigDecimal newPrice = (BigDecimal) rec.get("suggested_price");

        // 2. Update rooms.price
        jdbc.update("UPDATE rooms SET price = ? WHERE id = ?", newPrice, roomId);

        // 3. Insert price_history
        jdbc.update(
            "INSERT INTO price_history (room_id, old_price, new_price, " +
            "recommendation_id, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, NOW())",
            roomId, oldPrice, newPrice, recommendationId, reviewedBy
        );

        // 4. Update recommendation status
        jdbc.update(
            "UPDATE price_recommendations SET status = 'APPROVED', " +
            "reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
            reviewedBy, recommendationId
        );

        return Map.of(
            "success", true,
            "recommendation_id", recommendationId,
            "room_id", roomId,
            "old_price", oldPrice,
            "new_price", newPrice,
            "approved_by", reviewedBy
        );
    }

    // ═══════════════════════════════════════════════════════════
    // Reject — record reason
    // ═══════════════════════════════════════════════════════════

    @Transactional
    public Map<String, Object> reject(Integer recommendationId, String reason, String reviewedBy) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, status FROM price_recommendations WHERE id = ?", recommendationId);
        if (rows.isEmpty()) {
            return Map.of("success", false, "error", "Recommendation not found");
        }
        String status = (String) rows.get(0).get("status");
        if (!"PENDING".equals(status)) {
            return Map.of("success", false, "error",
                "Recommendation already " + status);
        }

        jdbc.update(
            "UPDATE price_recommendations SET status = 'REJECTED', " +
            "reject_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
            reason != null ? reason : "No reason given",
            reviewedBy,
            recommendationId
        );

        return Map.of(
            "success", true,
            "recommendation_id", recommendationId,
            "rejected_by", reviewedBy,
            "reason", reason
        );
    }

    // ═══════════════════════════════════════════════════════════
    // Query pending recommendations
    // ═══════════════════════════════════════════════════════════

    public List<Map<String, Object>> getPendingRecommendations() {
        return jdbc.queryForList(
            "SELECT pr.id, pr.room_id, r.room_number, pr.room_type, " +
            "pr.current_price, pr.suggested_price, pr.change_pct, " +
            "pr.confidence, pr.status, pr.reasoning, " +
            "DATE_FORMAT(pr.created_at, '%Y-%m-%d %H:%i:%s') AS created_at " +
            "FROM price_recommendations pr " +
            "JOIN rooms r ON pr.room_id = r.id " +
            "WHERE pr.status = 'PENDING' ORDER BY pr.room_id"
        );
    }

    public int getPendingCount() {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM price_recommendations WHERE status = 'PENDING'",
            Integer.class);
        return count != null ? count : 0;
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    private Integer toInt(Object val) {
        if (val == null) return null;
        if (val instanceof Integer) return (Integer) val;
        if (val instanceof Number) return ((Number) val).intValue();
        return Integer.parseInt(val.toString());
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal) return (BigDecimal) val;
        if (val instanceof Number) {
            return BigDecimal.valueOf(((Number) val).doubleValue())
                .setScale(4, RoundingMode.HALF_UP);
        }
        return new BigDecimal(val.toString());
    }

    private String safeJson(Object val) {
        if (val == null) return "{}";
        try {
            return objectMapper.writeValueAsString(val);
        } catch (Exception e) {
            return "{}";
        }
    }
}
