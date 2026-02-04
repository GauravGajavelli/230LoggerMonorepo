package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Tracks how error types evolve across runs for a single test.
 * Helps identify whether a student is making progress (error type changes)
 * or stuck on the same issue (same error repeatedly).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorEvolution(
    List<ErrorSnapshot> sequence,        // Error at each failing run
    List<ErrorTransition> transitions,   // When error type changed
    boolean hadStackOverflow,            // Recursion issue signal
    int stuckOnSameError,                // Consecutive runs with identical error
    int npeCount,                        // Total NullPointerExceptions
    String progressionSummary            // "NPE→NPE→AssertionError→SUCCESS"
) {
    /**
     * Snapshot of error state at a specific run.
     */
    public record ErrorSnapshot(
        int run,
        String errorType,
        String message,
        String stackTrace  // Full stack trace for deeper analysis
    ) {}

    /**
     * Records when error type changed between runs.
     */
    public record ErrorTransition(
        int fromRun,
        int toRun,
        String fromType,
        String toType
    ) {}

    /**
     * Returns true if this test had any error evolution data.
     */
    public boolean hasData() {
        return sequence != null && !sequence.isEmpty();
    }

    /**
     * Returns the number of distinct error types encountered.
     */
    public int distinctErrorTypes() {
        if (sequence == null || sequence.isEmpty()) {
            return 0;
        }
        return (int) sequence.stream()
            .map(ErrorSnapshot::errorType)
            .filter(t -> t != null)
            .distinct()
            .count();
    }
}
