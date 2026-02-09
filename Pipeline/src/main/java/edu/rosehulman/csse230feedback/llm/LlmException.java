package edu.rosehulman.csse230feedback.llm;

/**
 * Exception for LLM-related failures (API errors, rate limits, configuration issues).
 */
public class LlmException extends Exception {

    private final int httpStatus;
    private final boolean retryable;

    public LlmException(String message) {
        this(message, 0, false);
    }

    public LlmException(String message, Throwable cause) {
        super(message, cause);
        this.httpStatus = 0;
        this.retryable = false;
    }

    public LlmException(String message, int httpStatus, boolean retryable) {
        super(message);
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }

    public LlmException(String message, int httpStatus, boolean retryable, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }

    public int httpStatus() {
        return httpStatus;
    }

    public boolean isRetryable() {
        return retryable;
    }

    public boolean isRateLimited() {
        return httpStatus == 429;
    }
}
