package com.hotel.ai.filter;

import com.hotel.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.logging.Logger;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * AI Gateway Filter — intercepts /api/ai/* requests.
 *
 * Responsibilities:
 *   1. Auth check — require login session
 *   2. PII masking — strip guest names/phone/ID from Python responses
 *   3. Audit logging — record every AI call
 *   4. Rate limiting — simple IP-based rate limiter
 *
 * Registered in web.xml.
 */
public class AiGatewayFilter implements Filter {

    private static final Logger logger = Logger.getLogger(AiGatewayFilter.class.getName());

    // PII patterns for masking in response bodies
    private static final Pattern PHONE_PATTERN =
            Pattern.compile("1[3-9]\\d{9}");
    private static final Pattern ID_CARD_PATTERN =
            Pattern.compile("\\d{6}(19|20)\\d{2}(0[1-9]|1[0-2])([0-2]\\d|3[01])\\d{3}[\\dXx]");

    // Simple rate limiter: IP -> deque of timestamps
    private static final int MAX_REQUESTS_PER_MINUTE = 30;
    private final ConcurrentHashMap<String, Deque<Long>> rateLimitMap = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper = new ObjectMapper();
    private boolean enabled = true;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        String enabledParam = filterConfig.getInitParameter("enabled");
        if (enabledParam != null) {
            this.enabled = Boolean.parseBoolean(enabledParam);
        }
        logger.info(String.format("AiGatewayFilter initialized, enabled=%s", enabled));
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpResp = (HttpServletResponse) response;

        if (!enabled) {
            chain.doFilter(request, response);
            return;
        }

        // 1. Auth check
        HttpSession session = httpReq.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            httpResp.setStatus(401);
            httpResp.setContentType("application/json; charset=UTF-8");
            httpResp.getWriter().write("{\"error\":\"Unauthorized: login required\"}");
            return;
        }

        // 2. Rate limiting
        String ip = getClientIp(httpReq);
        if (!checkRateLimit(ip)) {
            httpResp.setStatus(429);
            httpResp.setContentType("application/json; charset=UTF-8");
            httpResp.getWriter().write("{\"error\":\"Rate limit exceeded, max 30 req/min\"}");
            return;
        }

        // 3. Wrap response to capture body for PII masking + audit
        CharResponseWrapper responseWrapper = new CharResponseWrapper(httpResp);
        long startTime = System.currentTimeMillis();
        String username = ((User) session.getAttribute("user")).getUsername();

        try {
            chain.doFilter(request, responseWrapper);

            long duration = System.currentTimeMillis() - startTime;
            String originalBody = responseWrapper.toString();
            String maskedBody = maskPii(originalBody);

            // 4. Write masked response
            httpResp.setContentType("application/json; charset=UTF-8");
            httpResp.getOutputStream().write(maskedBody.getBytes("UTF-8"));

            // 5. Audit log (async-friendly, just log for now)
            logger.info(String.format(
                    "AI_CALL | user=%s | method=%s | path=%s | status=%s | duration=%sms",
                    username, httpReq.getMethod(), httpReq.getRequestURI(),
                    httpResp.getStatus(), duration));

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.severe(String.format("AI_CALL_ERROR | user=%s | path=%s | error=%s | duration=%sms", username, httpReq.getRequestURI(), e.getMessage(), duration));
            if (!response.isCommitted()) {
                httpResp.setStatus(502);
                httpResp.setContentType("application/json; charset=UTF-8");
                httpResp.getWriter().write("{\"error\":\"AI Service error: " + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    @Override
    public void destroy() {
        rateLimitMap.clear();
    }

    // --------------- PII Masking ---------------

    /**
     * Mask PII in response JSON string.
     * Replaces phone numbers with "138****0000" and ID cards with "110101****010011".
     */
    String maskPii(String body) {
        if (body == null || body.isEmpty()) return body;

        // Mask phone numbers: keep first 3 + last 4
        body = PHONE_PATTERN.matcher(body).replaceAll(match -> {
            String phone = match.group();
            return phone.substring(0, 3) + "****" + phone.substring(7);
        });

        // Mask ID cards: keep first 6 + last 4
        body = ID_CARD_PATTERN.matcher(body).replaceAll(match -> {
            String idCard = match.group();
            return idCard.substring(0, 6) + "****" + idCard.substring(idCard.length() - 4);
        });

        return body;
    }

    // --------------- Rate Limiting ---------------

    private boolean checkRateLimit(String ip) {
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = rateLimitMap.computeIfAbsent(ip,
                k -> new ArrayDeque<>());

        synchronized (timestamps) {
            // Remove timestamps older than 1 minute
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > 60_000) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= MAX_REQUESTS_PER_MINUTE) {
                return false;
            }

            timestamps.addLast(now);
            return true;
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip != null ? ip.split(",")[0].trim() : "unknown";
    }

    private String escapeJson(String s) {
        if (s == null) return "null";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n");
    }
}
