package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestSummary(
    int total,
    int passed,
    int failed,
    int errored,
    int skipped
) {}
