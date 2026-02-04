package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestHistory(
    String testId,
    String testName,
    Map<Integer, String> statusByRun,
    List<FailureInterval> failureIntervals,
    boolean isLingeringFailure,
    boolean isRegression,
    int recursCount,
    int flipsWithin,
    int totalFailedRuns,
    double meaningfulnessScore,
    String highlightCategory,
    List<String> categories,
    ErrorEvolution errorEvolution,
    StruggleProfile struggleProfile
) {
    /**
     * Constructor for backwards compatibility - creates TestHistory without
     * errorEvolution and struggleProfile fields.
     */
    public TestHistory(
            String testId,
            String testName,
            Map<Integer, String> statusByRun,
            List<FailureInterval> failureIntervals,
            boolean isLingeringFailure,
            boolean isRegression,
            int recursCount,
            int flipsWithin,
            int totalFailedRuns,
            double meaningfulnessScore,
            String highlightCategory,
            List<String> categories) {
        this(testId, testName, statusByRun, failureIntervals, isLingeringFailure,
             isRegression, recursCount, flipsWithin, totalFailedRuns,
             meaningfulnessScore, highlightCategory, categories, null, null);
    }

    /**
     * Returns a copy of this TestHistory with errorEvolution added.
     */
    public TestHistory withErrorEvolution(ErrorEvolution evolution) {
        return new TestHistory(
            testId, testName, statusByRun, failureIntervals, isLingeringFailure,
            isRegression, recursCount, flipsWithin, totalFailedRuns,
            meaningfulnessScore, highlightCategory, categories, evolution, struggleProfile
        );
    }

    /**
     * Returns a copy of this TestHistory with struggleProfile added.
     */
    public TestHistory withStruggleProfile(StruggleProfile profile) {
        return new TestHistory(
            testId, testName, statusByRun, failureIntervals, isLingeringFailure,
            isRegression, recursCount, flipsWithin, totalFailedRuns,
            meaningfulnessScore, highlightCategory, categories, errorEvolution, profile
        );
    }

    /**
     * Returns a copy with both errorEvolution and struggleProfile.
     */
    public TestHistory withStruggleData(ErrorEvolution evolution, StruggleProfile profile) {
        return new TestHistory(
            testId, testName, statusByRun, failureIntervals, isLingeringFailure,
            isRegression, recursCount, flipsWithin, totalFailedRuns,
            meaningfulnessScore, highlightCategory, categories, evolution, profile
        );
    }
}
