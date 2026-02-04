package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution;
import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution.ErrorSnapshot;
import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution.ErrorTransition;

import java.util.*;

/**
 * Tracks how error types evolve across runs for each test.
 * This helps identify whether students are making progress or stuck.
 */
public class ErrorEvolutionTracker {

    // testId -> (runNumber -> ErrorInfo)
    private final Map<String, Map<Integer, ErrorInfo>> errorHistory = new HashMap<>();

    // Final status for each test (to know if it passed at the end)
    private final Map<String, String> finalStatus = new HashMap<>();

    /**
     * Internal record to store error information for a run.
     */
    private record ErrorInfo(String exceptionType, String message, String stackTrace) {}

    /**
     * Records error information for a test at a specific run.
     * Call this for every test result, even passing ones.
     */
    public void recordError(String testId, int runNumber, String status,
                           String exceptionType, String message, String stackTrace) {
        // Store final status (will be overwritten as we process runs in order)
        finalStatus.put(testId, status);

        // Only track errors for failing tests
        if (!"pass".equals(status) && exceptionType != null) {
            errorHistory
                .computeIfAbsent(testId, k -> new TreeMap<>())
                .put(runNumber, new ErrorInfo(exceptionType, message, stackTrace));
        }
    }

    /**
     * Builds the ErrorEvolution for a specific test.
     */
    public ErrorEvolution buildErrorEvolution(String testId) {
        Map<Integer, ErrorInfo> history = errorHistory.get(testId);

        if (history == null || history.isEmpty()) {
            return null; // No errors recorded
        }

        List<ErrorSnapshot> sequence = new ArrayList<>();
        List<ErrorTransition> transitions = new ArrayList<>();
        boolean hadStackOverflow = false;
        int maxConsecutiveSameError = 0;
        int currentConsecutive = 0;
        int npeCount = 0;
        String previousType = null;
        int previousRun = -1;

        List<Integer> sortedRuns = new ArrayList<>(history.keySet());
        Collections.sort(sortedRuns);

        for (int run : sortedRuns) {
            ErrorInfo info = history.get(run);
            String errorType = normalizeErrorType(info.exceptionType());

            // Build snapshot (message is truncated for display, but full stackTrace is preserved)
            sequence.add(new ErrorSnapshot(run, errorType, truncateMessage(info.message()), info.stackTrace()));

            // Track StackOverflowError
            if ("StackOverflowError".equals(errorType)) {
                hadStackOverflow = true;
            }

            // Track NullPointerException
            if ("NullPointerException".equals(errorType)) {
                npeCount++;
            }

            // Track consecutive same errors
            if (errorType != null && errorType.equals(previousType)) {
                currentConsecutive++;
                maxConsecutiveSameError = Math.max(maxConsecutiveSameError, currentConsecutive);
            } else {
                currentConsecutive = 1;
            }

            // Track transitions
            if (previousType != null && !Objects.equals(previousType, errorType)) {
                transitions.add(new ErrorTransition(previousRun, run, previousType, errorType));
            }

            previousType = errorType;
            previousRun = run;
        }

        // Build progression summary
        String summary = buildProgressionSummary(sequence, testId);

        return new ErrorEvolution(
            sequence,
            transitions.isEmpty() ? null : transitions,
            hadStackOverflow,
            maxConsecutiveSameError,
            npeCount,
            summary
        );
    }

    /**
     * Builds ErrorEvolution for all tracked tests.
     */
    public Map<String, ErrorEvolution> buildAllEvolutions() {
        Map<String, ErrorEvolution> evolutions = new HashMap<>();
        for (String testId : errorHistory.keySet()) {
            ErrorEvolution evolution = buildErrorEvolution(testId);
            if (evolution != null) {
                evolutions.put(testId, evolution);
            }
        }
        return evolutions;
    }

    /**
     * Normalizes exception type to a simple class name.
     */
    private String normalizeErrorType(String exceptionType) {
        if (exceptionType == null) {
            return "Unknown";
        }

        // Extract simple class name if fully qualified
        int lastDot = exceptionType.lastIndexOf('.');
        if (lastDot >= 0 && lastDot < exceptionType.length() - 1) {
            return exceptionType.substring(lastDot + 1);
        }

        return exceptionType;
    }

    /**
     * Truncates message to reasonable length for storage.
     */
    private String truncateMessage(String message) {
        if (message == null) {
            return null;
        }
        // Take first line only
        int newline = message.indexOf('\n');
        if (newline >= 0) {
            message = message.substring(0, newline);
        }
        // Truncate if too long
        if (message.length() > 200) {
            return message.substring(0, 200) + "...";
        }
        return message;
    }

    /**
     * Builds a progression summary like "NPE→NPE→AssertionError→SUCCESS"
     */
    private String buildProgressionSummary(List<ErrorSnapshot> sequence, String testId) {
        if (sequence.isEmpty()) {
            return null;
        }

        StringBuilder summary = new StringBuilder();
        String lastType = null;
        int repeatCount = 0;

        for (ErrorSnapshot snapshot : sequence) {
            String type = abbreviateErrorType(snapshot.errorType());

            if (type.equals(lastType)) {
                repeatCount++;
            } else {
                if (lastType != null) {
                    appendToSummary(summary, lastType, repeatCount);
                    summary.append("→");
                }
                lastType = type;
                repeatCount = 1;
            }
        }

        // Append final error type
        if (lastType != null) {
            appendToSummary(summary, lastType, repeatCount);
        }

        // Check if test passed at the end
        String status = finalStatus.get(testId);
        if ("pass".equals(status)) {
            summary.append("→SUCCESS");
        }

        return summary.toString();
    }

    private void appendToSummary(StringBuilder sb, String type, int count) {
        if (count > 2) {
            sb.append(type).append("(×").append(count).append(")");
        } else if (count == 2) {
            sb.append(type).append("→").append(type);
        } else {
            sb.append(type);
        }
    }

    /**
     * Abbreviates common error types for summary display.
     */
    private String abbreviateErrorType(String errorType) {
        if (errorType == null) {
            return "ERR";
        }
        return switch (errorType) {
            case "NullPointerException" -> "NPE";
            case "ArrayIndexOutOfBoundsException" -> "AIOOB";
            case "IndexOutOfBoundsException" -> "IOOB";
            case "StackOverflowError" -> "SOE";
            case "AssertionError" -> "Assert";
            case "IllegalArgumentException" -> "IAE";
            case "IllegalStateException" -> "ISE";
            case "ClassCastException" -> "CCE";
            case "ConcurrentModificationException" -> "CME";
            case "NoSuchElementException" -> "NSEE";
            case "ComparisonFailure" -> "Assert";
            default -> {
                // Shorten long names
                if (errorType.length() > 12) {
                    yield errorType.substring(0, 10) + "..";
                }
                yield errorType;
            }
        };
    }
}
