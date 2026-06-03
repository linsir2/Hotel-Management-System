package com.hotel.ai.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotel.ai.service.AiClientService;
import com.hotel.ai.service.PriceRecService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI API Gateway Controller.
 * All /api/ai/* requests are routed through here.
 * Acts as a proxy to Python AI Service with PII protection enforced by AiGatewayFilter.
 *
 * New (Tier 2): Pricing recommendations + approval workflow.
 * Python generates recommendations → this controller persists them.
 * Manager approves/rejects → this controller executes the changes.
 */
@RestController
@RequestMapping("/api/ai")
@CrossOrigin
public class AiController {

    @Autowired
    private AiClientService aiClientService;

    @Autowired
    private PriceRecService priceRecService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ═══════════════════════════════════════════════════════════
    // Health
    // ═══════════════════════════════════════════════════════════

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> result = new HashMap<>();
        boolean aiOk = aiClientService.isHealthy();
        result.put("gateway", "ok");
        result.put("ai_service", aiOk ? "ok" : "unreachable");
        result.put("ai_service_url", aiClientService.getAiServiceUrl());
        return ResponseEntity.ok(result);
    }

    // ═══════════════════════════════════════════════════════════
    // NL Search (Tier 1)
    // ═══════════════════════════════════════════════════════════

    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> search(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        try {
            String response = aiClientService.post("/nl-search/search", request);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Anomaly Detection (Tier 1)
    // ═══════════════════════════════════════════════════════════

    @GetMapping("/anomalies")
    public ResponseEntity<Map<String, Object>> scanAnomalies() {
        try {
            String response = aiClientService.get("/anomaly/scan");
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }

    @GetMapping("/anomalies/types")
    public ResponseEntity<Map<String, Object>> anomalyTypes() {
        try {
            String response = aiClientService.get("/anomaly/types");
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }

    @PostMapping("/anomalies/{id}/acknowledge")
    public ResponseEntity<Map<String, Object>> acknowledgeAnomaly(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body,
            HttpSession session) {
        // TODO: Write to audit_log table
        Map<String, Object> result = new HashMap<>();
        result.put("status", "ACKNOWLEDGED");
        result.put("anomaly_id", id);
        result.put("acknowledged_by", session.getAttribute("username"));
        return ResponseEntity.ok(result);
    }

    // ═══════════════════════════════════════════════════════════
    // Pricing Recommendations (Tier 2)
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /api/ai/price-recs?days_ahead=30
     * Proxy to Python /price-recs/recommendations + persist results.
     */
    @GetMapping("/price-recs")
    public ResponseEntity<Map<String, Object>> getPriceRecommendations(
            @RequestParam(defaultValue = "30") int daysAhead,
            HttpSession session) {
        try {
            String response = aiClientService.get("/price-recs/recommendations?days_ahead=" + daysAhead);
            @SuppressWarnings("unchecked")
            Map<String, Object> pythonResult = objectMapper.readValue(response, Map.class);

            // Persist recommendations to DB
            int saved = priceRecService.saveRecommendations(pythonResult);
            pythonResult.put("saved_count", saved);
            pythonResult.put("pending_count", priceRecService.getPendingCount());

            return ResponseEntity.ok(pythonResult);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }

    /**
     * POST /api/ai/price-recs/{id}/approve
     * Manager approves a price recommendation → updates rooms.price.
     */
    @PostMapping("/price-recs/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveRecommendation(
            @PathVariable Integer id,
            HttpSession session) {

        String username = (String) session.getAttribute("username");
        if (username == null) {
            username = "admin"; // fallback for dev
        }

        Map<String, Object> result = priceRecService.approve(id, username);
        if (Boolean.TRUE.equals(result.get("success"))) {
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
    }

    /**
     * POST /api/ai/price-recs/{id}/reject
     * Manager rejects a price recommendation with reason.
     */
    @PostMapping("/price-recs/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectRecommendation(
            @PathVariable Integer id,
            @RequestBody(required = false) Map<String, String> body,
            HttpSession session) {

        String reason = body != null ? body.getOrDefault("reason", "") : "";
        String username = (String) session.getAttribute("username");
        if (username == null) {
            username = "admin"; // fallback for dev
        }

        Map<String, Object> result = priceRecService.reject(id, reason, username);
        if (Boolean.TRUE.equals(result.get("success"))) {
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
    }

    /**
     * GET /api/ai/price-recs/pending
     * Returns list of pending recommendations for the manager dashboard.
     */
    @GetMapping("/price-recs/pending")
    public ResponseEntity<Map<String, Object>> getPendingRecommendations() {
        List<Map<String, Object>> pending = priceRecService.getPendingRecommendations();
        Map<String, Object> result = new HashMap<>();
        result.put("pending", pending);
        result.put("count", pending.size());
        return ResponseEntity.ok(result);
    }

    // ═══════════════════════════════════════════════════════════
    // Note Suggestions (Tier 2)
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /api/ai/note-suggest?booking_id=123
     * Proxy to Python /note-suggest/suggest.
     * Returns auto-triggered + manual template suggestions.
     * AI suggests, human writes — no DB writes from Python.
     */
    @GetMapping("/note-suggest")
    public ResponseEntity<Map<String, Object>> getNoteSuggestions(
            @RequestParam("booking_id") int bookingId) {
        try {
            String response = aiClientService.get("/note-suggest/suggest?booking_id=" + bookingId);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Revenue Forecast (Tier 2)
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /api/ai/forecast?weeks=12
     * Proxy to Python /forecast/revenue.
     * Manager-only. Returns weekly revenue predictions.
     */
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getRevenueForecast(
            @RequestParam(defaultValue = "12") int weeks) {
        try {
            String response = aiClientService.get("/forecast/revenue?weeks=" + weeks);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "AI Service unavailable");
            error.put("detail", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
        }
    }
}
