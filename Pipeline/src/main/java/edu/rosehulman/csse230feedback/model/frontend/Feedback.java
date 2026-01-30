package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Feedback(
    String testId,
    String pattern,
    String confidence,
    String explanation,
    List<String> nextSteps
) {}
