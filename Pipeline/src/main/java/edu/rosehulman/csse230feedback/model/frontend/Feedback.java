package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Feedback(
    String testId,
    String pattern,
    String confidence,
    String explanation,                    // synthesized prose paragraph (all contributing causes)
    List<String> nextSteps,                // ordered list of 2-3 concrete skill-building steps
    List<DiffEntry> diffs,                 // chronologically ordered list of relevant code changes
    List<String> relatedTestIds,           // testIds of tests in same group, null if singleton
    List<CourseAppearance> courseAppearances, // future appearances of this concept; empty = omitted
    List<PracticeDrill> drills             // generated practice drill(s); null omitted
) {}
