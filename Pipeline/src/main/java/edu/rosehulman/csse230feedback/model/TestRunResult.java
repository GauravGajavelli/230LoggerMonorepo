package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Result of a JUnit test execution.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestRunResult(
    int exitCode,
    String stdout,
    String stderr,
    int testsFound,
    int testsStarted,
    int testsSucceeded,
    int testsFailed,
    int testsAborted,
    int testsSkipped
) {
    /**
     * Returns true if all tests passed (exit code 0).
     */
    public boolean allTestsPassed() {
        return exitCode == 0;
    }

    /**
     * Returns true if there were test failures (exit code 1).
     */
    public boolean hasFailures() {
        return testsFailed > 0 || exitCode == 1;
    }

    /**
     * Returns true if there was an error during test execution (exit code > 1).
     */
    public boolean hasErrors() {
        return exitCode > 1;
    }

    /**
     * Creates a result indicating no tests were found or run.
     */
    public static TestRunResult noTests(String stdout, String stderr) {
        return new TestRunResult(-1, stdout, stderr, 0, 0, 0, 0, 0, 0);
    }

    /**
     * Creates a result from JUnit console launcher output.
     * Parses the summary line if present.
     */
    public static TestRunResult fromExecution(int exitCode, String stdout, String stderr,
            int found, int started, int succeeded, int failed, int aborted, int skipped) {
        return new TestRunResult(exitCode, stdout, stderr, found, started, succeeded, failed, aborted, skipped);
    }
}
