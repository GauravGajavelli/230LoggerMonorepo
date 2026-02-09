package edu.rosehulman.csse230feedback.llm;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Exponential backoff with jitter for LLM API rate limiting.
 * <p>
 * Retry strategy:
 * <pre>
 * attempt 1: immediate
 * attempt 2: wait 1s + jitter(0-500ms)
 * attempt 3: wait 2s + jitter
 * attempt 4: wait 4s + jitter
 * attempt 5: wait 8s + jitter
 * max retries: 5
 * </pre>
 * Respects Retry-After headers from the API when available.
 */
public class RateLimiter {

    private static final int MAX_RETRIES = 5;
    private static final long BASE_DELAY_MS = 1000;
    private static final long MAX_JITTER_MS = 500;

    private final LlmSessionLogger logger;

    public RateLimiter(LlmSessionLogger logger) {
        this.logger = logger;
    }

    /**
     * Executes an LLM request with retry logic.
     *
     * @param provider the LLM provider
     * @param request the request to send
     * @param requestNumber current request number (for logging)
     * @param totalRequests total number of requests (for logging)
     * @return the LLM response
     * @throws LlmException if all retries are exhausted
     */
    public LlmResponse executeWithRetry(LlmProvider provider, LlmRequest request,
                                         int requestNumber, int totalRequests) throws LlmException {
        LlmException lastException = null;

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return provider.complete(request);
            } catch (LlmException e) {
                lastException = e;

                if (!e.isRetryable() || attempt == MAX_RETRIES) {
                    throw e;
                }

                long backoffMs = computeBackoff(attempt, e);
                logger.logRateLimit(requestNumber, totalRequests, e.httpStatus(),
                    e.getMessage(), backoffMs, attempt, MAX_RETRIES);

                sleep(backoffMs);
            }
        }

        throw lastException;
    }

    /**
     * Computes backoff time, respecting Retry-After header if present.
     */
    long computeBackoff(int attempt, LlmException exception) {
        // Check for Retry-After header (stored as suppressed exception)
        Long retryAfterMs = parseRetryAfter(exception);
        if (retryAfterMs != null) {
            return retryAfterMs;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        long baseDelay = BASE_DELAY_MS * (1L << (attempt - 1));
        long jitter = ThreadLocalRandom.current().nextLong(MAX_JITTER_MS);
        return baseDelay + jitter;
    }

    /**
     * Parses Retry-After value from the exception's suppressed exceptions.
     */
    private Long parseRetryAfter(LlmException exception) {
        for (Throwable suppressed : exception.getSuppressed()) {
            String msg = suppressed.getMessage();
            if (msg != null && msg.startsWith("Retry-After: ")) {
                String value = msg.substring("Retry-After: ".length()).trim();
                try {
                    // Retry-After can be seconds (integer)
                    int seconds = Integer.parseInt(value);
                    return seconds * 1000L;
                } catch (NumberFormatException e) {
                    // Could be an HTTP-date, but we'll ignore that for simplicity
                }
            }
        }
        return null;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
