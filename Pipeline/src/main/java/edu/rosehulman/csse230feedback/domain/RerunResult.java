package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import edu.rosehulman.csse230feedback.model.EnrichedTestResult;

import java.util.List;
import java.util.Map;

/**
 * Result of a test rerun operation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RerunResult(
    /** Number of runs processed */
    int runsProcessed,

    /** Number of runs that compiled successfully */
    int runsCompiled,

    /** Number of runs that executed tests */
    int runsExecuted,

    /** Total tests found across all runs */
    int totalTestsFound,

    /** Total tests passed across all runs */
    int totalTestsPassed,

    /** Total tests failed across all runs */
    int totalTestsFailed,

    /** Enriched results per run number */
    Map<Integer, List<EnrichedTestResult>> resultsByRun,

    /** Warning messages accumulated during processing */
    List<String> warnings,

    /** Error messages for runs that failed */
    List<String> errors
) {
    /**
     * Builder for RerunResult.
     */
    public static class Builder {
        private int runsProcessed = 0;
        private int runsCompiled = 0;
        private int runsExecuted = 0;
        private int totalTestsFound = 0;
        private int totalTestsPassed = 0;
        private int totalTestsFailed = 0;
        private Map<Integer, List<EnrichedTestResult>> resultsByRun = new java.util.HashMap<>();
        private List<String> warnings = new java.util.ArrayList<>();
        private List<String> errors = new java.util.ArrayList<>();

        public Builder runsProcessed(int runsProcessed) {
            this.runsProcessed = runsProcessed;
            return this;
        }

        public Builder incrementRunsProcessed() {
            this.runsProcessed++;
            return this;
        }

        public Builder incrementRunsCompiled() {
            this.runsCompiled++;
            return this;
        }

        public Builder incrementRunsExecuted() {
            this.runsExecuted++;
            return this;
        }

        public Builder addTestsFound(int count) {
            this.totalTestsFound += count;
            return this;
        }

        public Builder addTestsPassed(int count) {
            this.totalTestsPassed += count;
            return this;
        }

        public Builder addTestsFailed(int count) {
            this.totalTestsFailed += count;
            return this;
        }

        public Builder addRunResult(int runNumber, List<EnrichedTestResult> results) {
            this.resultsByRun.put(runNumber, results);
            return this;
        }

        public Builder addWarning(String warning) {
            this.warnings.add(warning);
            return this;
        }

        public Builder addWarnings(List<String> warnings) {
            this.warnings.addAll(warnings);
            return this;
        }

        public Builder addError(String error) {
            this.errors.add(error);
            return this;
        }

        public RerunResult build() {
            return new RerunResult(
                runsProcessed, runsCompiled, runsExecuted,
                totalTestsFound, totalTestsPassed, totalTestsFailed,
                resultsByRun, warnings, errors
            );
        }
    }

    /**
     * Creates a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Returns true if all runs compiled and executed successfully.
     */
    public boolean isSuccess() {
        return errors.isEmpty() && runsProcessed == runsExecuted;
    }

    /**
     * Returns true if there were any test failures.
     */
    public boolean hasTestFailures() {
        return totalTestsFailed > 0;
    }

    /**
     * Returns true if there were compilation or execution errors.
     */
    public boolean hasErrors() {
        return !errors.isEmpty();
    }
}
