package com.hotel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/**
 * Operational loss report — 3 metrics via pure SQL.
 * No Python dependency. No ML. Just arithmetic on existing data.
 *
 * Three loss categories:
 *   1. PRICE_MISMATCH  — 错价损耗: revenue lost from rejected price recommendations
 *   2. VACANCY         — 空房损耗: opportunity cost of empty rooms
 *   3. ANOMALY_ORDER   — 异常订单损耗: cancelled/rejected booking amounts
 */
@Service("lossReportService")
public class LossReportService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public LossReportService(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    // ═══════════════════════════════════════════════════════════
    // Main API — calculate report for a given period
    // ═══════════════════════════════════════════════════════════

    @Transactional
    public Map<String, Object> generateReport(String period) {
        YearMonth ym = YearMonth.parse(period);  // "2026-06"
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        // 1. Calculate three loss categories
        Map<String, Object> priceMismatch = calcPriceMismatch(start, end);
        Map<String, Object> vacancy = calcVacancy(start, end);
        Map<String, Object> anomalyOrder = calcAnomalyOrder(start, end);

        BigDecimal priceLoss = toBigDecimal(priceMismatch.get("amount"));
        BigDecimal vacancyLoss = toBigDecimal(vacancy.get("amount"));
        BigDecimal anomalyLoss = toBigDecimal(anomalyOrder.get("amount"));
        BigDecimal totalLoss = priceLoss.add(vacancyLoss).add(anomalyLoss);

        // 2. Build response
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("period", period);
        report.put("date_range", Map.of("start", start.toString(), "end", end.toString()));
        report.put("total_loss", totalLoss);
        report.put("breakdown", Map.of(
            "price_mismatch", buildBreakdown(priceMismatch, totalLoss),
            "vacancy", buildBreakdown(vacancy, totalLoss),
            "anomaly_order", buildBreakdown(anomalyOrder, totalLoss)
        ));

        // 3. Persist to operation_losses
        saveLossRecord(period, "MONTHLY", "PRICE_MISMATCH", priceLoss, priceMismatch);
        saveLossRecord(period, "MONTHLY", "VACANCY", vacancyLoss, vacancy);
        saveLossRecord(period, "MONTHLY", "ANOMALY_ORDER", anomalyLoss, anomalyOrder);

        return report;
    }

    // ═══════════════════════════════════════════════════════════
    // 1. Price mismatch — rejected recommendations × actual bookings
    // ═══════════════════════════════════════════════════════════

    Map<String, Object> calcPriceMismatch(LocalDate start, LocalDate end) {
        // For REJECTED price recommendations within the period,
        // calculate: (suggested_price - current_price) × nights_stayed
        // where deviation > 10%
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT pr.id AS rec_id, pr.room_id, r.room_number, r.type, " +
            "pr.current_price, pr.suggested_price, " +
            "COALESCE(SUM(DATEDIFF(LEAST(b.check_out, ?), GREATEST(b.check_in, ?))), 0) AS stayed_nights " +
            "FROM price_recommendations pr " +
            "JOIN rooms r ON pr.room_id = r.id " +
            "LEFT JOIN bookings b ON pr.room_id = b.room_id " +
            "  AND b.check_in < ? AND b.check_out > ? " +
            "  AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED') " +
            "WHERE pr.status = 'REJECTED' " +
            "  AND pr.reviewed_at BETWEEN ? AND ? " +
            "  AND ABS(pr.suggested_price - pr.current_price) / NULLIF(pr.current_price, 0) > 0.1 " +
            "GROUP BY pr.id, pr.room_id, r.room_number, r.type, pr.current_price, pr.suggested_price",
            end, start, end, start, start.atStartOfDay(), end.atTime(23,59,59)
        );

        BigDecimal total = BigDecimal.ZERO;
        List<Map<String, Object>> details = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            BigDecimal current = toBigDecimal(row.get("current_price"));
            BigDecimal suggested = toBigDecimal(row.get("suggested_price"));
            int nights = toInt(row.get("stayed_nights"));
            BigDecimal loss = suggested.subtract(current).multiply(BigDecimal.valueOf(nights));
            if (loss.compareTo(BigDecimal.ZERO) > 0) {
                total = total.add(loss);
                details.add(Map.of(
                    "room_number", row.get("room_number"),
                    "current_price", current,
                    "suggested_price", suggested,
                    "stayed_nights", nights,
                    "loss", loss
                ));
            }
        }

        return Map.of("amount", total, "count", details.size(), "details", details);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Vacancy loss — empty room × price per night
    // ═══════════════════════════════════════════════════════════

    Map<String, Object> calcVacancy(LocalDate start, LocalDate end) {
        // Total room-nights available in period
        Integer totalRooms = jdbc.queryForObject("SELECT COUNT(*) FROM rooms", Integer.class);
        if (totalRooms == null || totalRooms == 0) return Map.of("amount", 0, "count", 0);

        long days = end.toEpochDay() - start.toEpochDay() + 1;
        long totalRoomNights = totalRooms * days;

        // Occupied room-nights: sum of booking-nights within the period
        Long occupiedNights = jdbc.queryForObject(
            "SELECT COALESCE(SUM(DATEDIFF(LEAST(check_out, ?), GREATEST(check_in, ?))), 0) " +
            "FROM bookings " +
            "WHERE check_in < ? AND check_out > ? " +
            "  AND status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')",
            Long.class, end, start, end, start
        );
        if (occupiedNights == null) occupiedNights = 0L;

        long vacantNights = Math.max(0, totalRoomNights - occupiedNights);

        // Average room price
        BigDecimal avgPrice = jdbc.queryForObject(
            "SELECT COALESCE(AVG(price), 0) FROM rooms", BigDecimal.class
        );
        if (avgPrice == null) avgPrice = BigDecimal.ZERO;

        BigDecimal vacancyLoss = avgPrice.multiply(BigDecimal.valueOf(vacantNights));

        // Per-room detail
        List<Map<String, Object>> roomDetails = jdbc.queryForList(
            "SELECT r.id, r.room_number, r.type, r.price, " +
            "COALESCE(SUM(DATEDIFF(LEAST(b.check_out, ?), GREATEST(b.check_in, ?))), 0) AS occupied, " +
            "(? - COALESCE(SUM(DATEDIFF(LEAST(b.check_out, ?), GREATEST(b.check_in, ?))), 0)) AS vacant " +
            "FROM rooms r " +
            "LEFT JOIN bookings b ON r.id = b.room_id " +
            "  AND b.check_in < ? AND b.check_out > ? " +
            "  AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED') " +
            "GROUP BY r.id, r.room_number, r.type, r.price",
            end, start, days, end, start, end, start
        );

        return Map.of(
            "amount", vacancyLoss,
            "total_room_nights", totalRoomNights,
            "occupied_nights", occupiedNights,
            "vacant_nights", vacantNights,
            "avg_price", avgPrice,
            "count", roomDetails.size(),
            "room_details", roomDetails
        );
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Anomaly order loss — CANCELLED/REJECTED bookings
    // ═══════════════════════════════════════════════════════════

    Map<String, Object> calcAnomalyOrder(LocalDate start, LocalDate end) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.id, r.room_number, g.name AS guest_name, " +
            "DATE_FORMAT(b.check_in, '%Y-%m-%d %H:%i') AS check_in, " +
            "DATE_FORMAT(b.check_out, '%Y-%m-%d %H:%i') AS check_out, " +
            "b.status, b.total_amount " +
            "FROM bookings b " +
            "JOIN rooms r ON b.room_id = r.id " +
            "JOIN guests g ON b.guest_id = g.id " +
            "WHERE b.status IN ('CANCELLED', 'REJECTED') " +
            "  AND b.updated_at BETWEEN ? AND ?",
            start.atStartOfDay(), end.atTime(23, 59, 59)
        );

        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> row : rows) {
            total = total.add(toBigDecimal(row.get("total_amount")));
        }

        return Map.of("amount", total, "count", rows.size(), "orders", rows);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    private void saveLossRecord(String period, String reportType,
                                 String category, BigDecimal amount,
                                 Map<String, Object> detail) {
        try {
            jdbc.update(
                "INSERT INTO operation_losses " +
                "(report_period, report_type, loss_category, loss_amount, detail_json) " +
                "VALUES (?, ?, ?, ?, ?)",
                period, reportType, category, amount,
                detail != null ? objectMapper.writeValueAsString(detail) : "{}"
            );
        } catch (JsonProcessingException e) {
            jdbc.update(
                "INSERT INTO operation_losses " +
                "(report_period, report_type, loss_category, loss_amount) " +
                "VALUES (?, ?, ?, ?)",
                period, reportType, category, amount
            );
        }
    }

    private Map<String, Object> buildBreakdown(Map<String, Object> metric, BigDecimal total) {
        BigDecimal amount = toBigDecimal(metric.get("amount"));
        double pct = total.compareTo(BigDecimal.ZERO) > 0
            ? amount.divide(total, 4, RoundingMode.HALF_UP).doubleValue() * 100
            : 0;
        Map<String, Object> breakdown = new LinkedHashMap<>(metric);
        breakdown.put("pct", Math.round(pct * 10) / 10.0); // round to 1 decimal
        return breakdown;
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal bd) return bd;
        if (val instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try { return new BigDecimal(val.toString()); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.intValue();
        try { return Integer.parseInt(val.toString()); }
        catch (NumberFormatException e) { return 0; }
    }
}
