package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Feedback(
    String testId,
    String pattern,
    String confidence,
    String explanation,       // synthesized prose paragraph (all contributing causes)
    String suggestion,        // synthesized prose paragraph (primary fix first)
    List<DiffEntry> diffs,    // chronologically ordered list of relevant code changes
    List<String> relatedTestIds // testIds of tests in same group, null if singleton
) {}
