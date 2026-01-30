package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestResult(
    String id,
    String name,
    String status,
    boolean changedThisRun,
    String previousStatus,
    String errorMessage,
    String stackTrace,
    String expected,
    String actual,
    Long durationMs
) {}
