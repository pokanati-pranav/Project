package com.greenpulse.common;
import java.time.Instant;
public record ApiEnvelope<T>(boolean success, String message, T data, Instant timestamp) {
    public static <T> ApiEnvelope<T> ok(String message, T data) { return new ApiEnvelope<>(true, message, data, Instant.now()); }
    public static <T> ApiEnvelope<T> fail(String message, T data) { return new ApiEnvelope<>(false, message, data, Instant.now()); }
}
