package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestRun(
    int runNumber,
    String timestamp,
    TestSummary summary,
    List<TestResult> results
) {}
