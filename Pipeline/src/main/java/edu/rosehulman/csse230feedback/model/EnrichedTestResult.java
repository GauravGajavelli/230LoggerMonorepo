package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Test result with enriched evidence data captured during test execution.
 * Extends the basic test result with duration, stack trace, and assertion details.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EnrichedTestResult(
    // Basic test identification
    String testClassSimple,
    String testDisplayName,
    String testId,
    TestStatus status,
    String cause,

    // Enriched evidence fields
    Long durationMs,
    String stackTrace,
    String exceptionType,
    String message,
    String expected,
    String actual,
    String uniqueId
) {
    /**
     * Creates an EnrichedTestResult from a basic TestResultRecord with no evidence.
     */
    public static EnrichedTestResult fromBasic(TestResultRecord basic) {
        return new EnrichedTestResult(
            basic.testClassSimple(),
            basic.testDisplayName(),
            basic.testId(),
            basic.status(),
            basic.cause(),
            null, null, null, null, null, null, null
        );
    }

    /**
     * Creates an EnrichedTestResult from a basic TestResultRecord with evidence.
     */
    public static EnrichedTestResult fromBasicWithEvidence(
            TestResultRecord basic,
            Long durationMs,
            String stackTrace,
            String exceptionType,
            String message,
            String expected,
            String actual,
            String uniqueId) {
        return new EnrichedTestResult(
            basic.testClassSimple(),
            basic.testDisplayName(),
            basic.testId(),
            basic.status(),
            basic.cause(),
            durationMs, stackTrace, exceptionType, message, expected, actual, uniqueId
        );
    }

    /**
     * Creates a fully specified EnrichedTestResult.
     */
    public static EnrichedTestResult create(
            String testClassSimple,
            String testDisplayName,
            TestStatus status,
            String cause,
            Long durationMs,
            String stackTrace,
            String exceptionType,
            String message,
            String expected,
            String actual,
            String uniqueId) {
        String testId = testClassSimple + "#" + testDisplayName;
        return new EnrichedTestResult(
            testClassSimple, testDisplayName, testId, status, cause,
            durationMs, stackTrace, exceptionType, message, expected, actual, uniqueId
        );
    }

    /**
     * Returns true if this result has enriched evidence data.
     */
    public boolean hasEvidence() {
        return durationMs != null || stackTrace != null || exceptionType != null;
    }

    /**
     * Returns true if this test passed.
     */
    public boolean passed() {
        return status == TestStatus.SUCCESSFUL;
    }

    /**
     * Returns true if this test failed.
     */
    public boolean failed() {
        return status == TestStatus.FAILED;
    }
}
