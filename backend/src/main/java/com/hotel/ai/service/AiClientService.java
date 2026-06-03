package com.hotel.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * HTTP client for calling Python AI Service.
 * Communicates over internal network (localhost:8000).
 * No extra dependencies — uses standard java.net.HttpURLConnection.
 */
@Service("aiClientService")
public class AiClientService {

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * POST JSON to AI service and return raw response string.
     */
    public String post(String path, Object requestBody) throws IOException {
        String urlStr = aiServiceUrl + path;
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setRequestProperty("Accept", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(30000);

        // Write request body
        if (requestBody != null) {
            String json = objectMapper.writeValueAsString(requestBody);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }
        }

        // Read response
        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 300)
                ? conn.getInputStream()
                : conn.getErrorStream();

        StringBuilder response = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
        }

        conn.disconnect();

        if (status >= 400) {
            throw new IOException("AI Service returned " + status + ": " + response);
        }

        return response.toString();
    }

    /**
     * GET request to AI service.
     */
    public String get(String path) throws IOException {
        String urlStr = aiServiceUrl + path;
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(30000);

        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 300)
                ? conn.getInputStream()
                : conn.getErrorStream();

        StringBuilder response = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
        }

        conn.disconnect();

        if (status >= 400) {
            throw new IOException("AI Service returned " + status + ": " + response);
        }

        return response.toString();
    }

    /**
     * Health check — returns true if AI service is reachable.
     */
    public boolean isHealthy() {
        try {
            String resp = get("/health");
            return resp.contains("\"status\":\"ok\"");
        } catch (Exception e) {
            return false;
        }
    }

    public String getAiServiceUrl() {
        return aiServiceUrl;
    }
}
