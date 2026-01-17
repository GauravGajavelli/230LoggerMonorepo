package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestResultRecord(
        String testClassSimple,
        String testDisplayName,
        String testId,
        TestStatus status,
        String cause
) {}
