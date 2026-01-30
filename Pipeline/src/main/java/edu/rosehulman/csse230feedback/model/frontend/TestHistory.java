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
    String highlightCategory
) {}
