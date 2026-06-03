package com.hotel.controller;

import com.hotel.service.LossReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Operational reports — loss analysis, occupancy stats, etc.
 * /api/reports/* — pure SQL reports, no Python/ML dependency.
 *
 * These are visible only to managers (role check enforced by interceptor / frontend).
 */
@RestController
@RequestMapping("/api/reports")
@CrossOrigin
public class ReportController {

    @Autowired
    private LossReportService lossReportService;

    /**
     * GET /api/reports/losses?period=2026-06
     * Generate operational loss report for a given month.
     * Three categories: price mismatch, vacancy, anomaly orders.
     * Results are persisted to operation_losses table.
     */
    @GetMapping("/losses")
    public ResponseEntity<Map<String, Object>> getLossReport(
            @RequestParam(defaultValue = "") String period) {

        if (period.isEmpty()) {
            // Default to current month
            period = java.time.YearMonth.now().toString();
        }

        try {
            Map<String, Object> report = lossReportService.generateReport(period);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to generate loss report");
            error.put("detail", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * GET /api/reports/losses/summary
     * Lightweight summary for Dashboard card — just the total.
     */
    @GetMapping("/losses/summary")
    public ResponseEntity<Map<String, Object>> getLossSummary(
            @RequestParam(defaultValue = "") String period) {

        if (period.isEmpty()) {
            period = java.time.YearMonth.now().toString();
        }

        try {
            Map<String, Object> report = lossReportService.generateReport(period);
            Map<String, Object> summary = new HashMap<>();
            summary.put("period", period);
            summary.put("total_loss", report.get("total_loss"));
            @SuppressWarnings("unchecked")
            Map<String, Object> breakdown = (Map<String, Object>) report.get("breakdown");
            summary.put("breakdown_summary", Map.of(
                "price_mismatch", ((Map<?, ?>) breakdown.get("price_mismatch")).get("amount"),
                "vacancy", ((Map<?, ?>) breakdown.get("vacancy")).get("amount"),
                "anomaly_order", ((Map<?, ?>) breakdown.get("anomaly_order")).get("amount")
            ));
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to generate summary");
            error.put("detail", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
