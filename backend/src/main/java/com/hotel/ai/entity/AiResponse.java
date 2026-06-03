package com.hotel.ai.entity;

import java.util.Map;

/**
 * Generic response wrapper for AI service communication.
 */
public class AiResponse<T> {
    private boolean success;
    private T data;
    private String error;
    private long timestamp;

    public AiResponse() {
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> AiResponse<T> ok(T data) {
        AiResponse<T> r = new AiResponse<>();
        r.success = true;
        r.data = data;
        return r;
    }

    public static <T> AiResponse<T> fail(String error) {
        AiResponse<T> r = new AiResponse<>();
        r.success = false;
        r.error = error;
        return r;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
