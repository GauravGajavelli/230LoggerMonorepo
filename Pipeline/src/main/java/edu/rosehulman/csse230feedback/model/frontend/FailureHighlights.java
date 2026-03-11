package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FailureHighlights(
    List<String> stillFailing,
    List<String> regressions,
    List<String> costlyDetours,
    List<String> sustainedStruggles
) {
    /** Backwards-compatible constructor without sustainedStruggles. */
    public FailureHighlights(List<String> stillFailing, List<String> regressions, List<String> costlyDetours) {
        this(stillFailing, regressions, costlyDetours, null);
    }
}
