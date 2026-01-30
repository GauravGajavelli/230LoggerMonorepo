package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FailureInterval(
    int startRun,
    Integer endRun,
    int duration,
    boolean isLingering,
    boolean isRegression,
    Long effortTimeMs,
    Integer runsWhileFailing
) {}
