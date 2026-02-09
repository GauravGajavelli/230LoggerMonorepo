package edu.rosehulman.csse230feedback.llm;

import java.time.Duration;
import java.time.Instant;

/**
 * Tracks running totals for an LLM session (requests, tokens, cost, timing).
 */
public class LlmStats {

    private int totalRequests;
    private int cacheHits;
    private int apiCalls;
    private int retries;
    private long totalPromptTokens;
    private long totalCompletionTokens;
    private double totalCostUsd;
    private Instant sessionStart;
    private Instant sessionEnd;

    public LlmStats() {
        this.sessionStart = Instant.now();
    }

    public synchronized void recordCacheHit() {
        totalRequests++;
        cacheHits++;
    }

    public synchronized void recordApiCall(LlmResponse response) {
        totalRequests++;
        apiCalls++;
        if (response.usage() != null) {
            totalPromptTokens += response.usage().promptTokens();
            totalCompletionTokens += response.usage().completionTokens();
        }
        totalCostUsd += response.costEstimateUsd();
    }

    public synchronized void recordRetry() {
        retries++;
    }

    public void finish() {
        sessionEnd = Instant.now();
    }

    // --- Accessors ---

    public int totalRequests() { return totalRequests; }
    public int cacheHits() { return cacheHits; }
    public int apiCalls() { return apiCalls; }
    public int retries() { return retries; }
    public long totalPromptTokens() { return totalPromptTokens; }
    public long totalCompletionTokens() { return totalCompletionTokens; }
    public double totalCostUsd() { return totalCostUsd; }

    public double cacheHitRate() {
        return totalRequests > 0 ? (double) cacheHits / totalRequests * 100.0 : 0.0;
    }

    public Duration wallTime() {
        Instant end = sessionEnd != null ? sessionEnd : Instant.now();
        return Duration.between(sessionStart, end);
    }

    /**
     * Formats the session summary as a human-readable string.
     */
    public String formatSummary() {
        Duration wall = wallTime();
        long minutes = wall.toMinutes();
        long seconds = wall.toSecondsPart();

        return String.format("""
            SESSION SUMMARY
                       total_requests: %d
                       cache_hits: %d (%.1f%%)
                       api_calls: %d
                       retries: %d
                       total_tokens: %,d in / %,d out
                       estimated_cost: $%.2f
                       wall_time: %dm %ds""",
            totalRequests, cacheHits, cacheHitRate(),
            apiCalls, retries,
            totalPromptTokens, totalCompletionTokens,
            totalCostUsd,
            minutes, seconds
        );
    }

    /**
     * Returns a short progress line for console output.
     */
    public String formatProgress(int current, int total) {
        return String.format("[prepare] LLM: %d/%d requests (%d cached) | %d retries | $%.2f spent",
            current, total, cacheHits, retries, totalCostUsd);
    }
}
