package edu.rosehulman.csse230feedback.llm;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * Writes a human-readable session log to {@code _session_log.txt} in the cache directory.
 * <p>
 * Each pipeline run appends entries showing requests, responses, cache hits,
 * rate limit events, and a final session summary.
 */
public class LlmSessionLogger {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final Path logFile;
    private BufferedWriter writer;

    public LlmSessionLogger(Path cacheDir) {
        this.logFile = cacheDir.resolve("_session_log.txt");
    }

    /**
     * Opens the log file for writing. Creates the cache directory if needed.
     */
    public void open() throws IOException {
        Files.createDirectories(logFile.getParent());
        writer = Files.newBufferedWriter(logFile, StandardCharsets.UTF_8,
            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        writeLine("=== LLM Session Log ===");
        writeLine("");
    }

    /**
     * Logs an outgoing request.
     */
    public void logRequest(int requestNum, int totalRequests, String label,
                           String model, int estimatedTokens, boolean cacheHit, String cacheDate) {
        String time = now();
        String cacheStatus = cacheHit
            ? "cache=HIT" + (cacheDate != null ? " (from " + cacheDate + ")" : "")
            : "cache=MISS";

        writeLine(String.format("[%s] REQUEST #%d/%d  %s", time, requestNum, totalRequests, label));
        writeLine(String.format("           model=%s  tokens_in=%d  %s", model, estimatedTokens, cacheStatus));
    }

    /**
     * Logs a received response.
     */
    public void logResponse(int requestNum, int totalRequests,
                            int tokensOut, double costUsd, double latencySeconds) {
        String time = now();
        writeLine(String.format("[%s] RESPONSE #%d/%d  tokens_out=%d  cost=$%.3f  latency=%.1fs",
            time, requestNum, totalRequests, tokensOut, costUsd, latencySeconds));
    }

    /**
     * Logs a rate limit event.
     */
    public void logRateLimit(int requestNum, int totalRequests, int httpStatus,
                             String message, long backoffMs, int attempt, int maxAttempts) {
        String time = now();
        writeLine(String.format("[%s] RATE_LIMITED #%d  %d %s", time, requestNum, httpStatus, message));
        writeLine(String.format("           backoff=%.1fs  attempt=%d/%d",
            backoffMs / 1000.0, attempt, maxAttempts));
    }

    /**
     * Logs a dry-run request (no actual API call made).
     */
    public void logDryRun(int requestNum, int totalRequests, String label,
                          String model, int estimatedTokens) {
        String time = now();
        writeLine(String.format("[%s] DRY_RUN #%d/%d  %s", time, requestNum, totalRequests, label));
        writeLine(String.format("           model=%s  estimated_tokens=%d", model, estimatedTokens));
    }

    /**
     * Writes the session summary.
     */
    public void logSummary(LlmStats stats) {
        writeLine("");
        writeLine("[" + now() + "] " + stats.formatSummary());
    }

    /**
     * Closes the log file.
     */
    public void close() {
        if (writer != null) {
            try {
                writer.flush();
                writer.close();
            } catch (IOException ignored) {}
        }
    }

    private void writeLine(String line) {
        if (writer == null) return;
        try {
            writer.write(line);
            writer.newLine();
            writer.flush();
        } catch (IOException e) {
            System.err.println("Warning: could not write to session log: " + e.getMessage());
        }
    }

    private String now() {
        return LocalTime.now().format(TIME_FMT);
    }
}
