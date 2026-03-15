package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Episode(
    String id,
    String startTime,
    String endTime,
    String label,
    String dominantCategory,
    EpisodeSemantics semantics,
    String timeRange,      // e.g. "11:40 – 11:52 PM"
    int edits,             // count of runs with code changes in this episode
    String area,           // heuristic from patch file keys (e.g. "BinarySearchTree.java")
    String outcome,        // e.g. "testRemoveLeaf went from passing to failing"
    String outcomeType,    // "regression" | "fix" | null (final episode may be null)
    String linkedTestId,   // triggering test's testId string
    List<Integer> runNumbers  // all run numbers belonging to this episode
) {
    /**
     * Legacy constructor without new fields (for backwards compatibility).
     */
    public Episode(String id, String startTime, String endTime, String label, String dominantCategory) {
        this(id, startTime, endTime, label, dominantCategory, null, null, 0, null, null, null, null, null);
    }

    public Episode withSemantics(EpisodeSemantics semantics) {
        return new Episode(id, startTime, endTime, label, dominantCategory, semantics,
                           timeRange, edits, area, outcome, outcomeType, linkedTestId, runNumbers);
    }

    /**
     * Returns a copy with the new detail fields populated.
     */
    public Episode withDetails(String timeRange, int edits, String area,
                               String outcome, String outcomeType, String linkedTestId,
                               List<Integer> runNumbers) {
        return new Episode(id, startTime, endTime, label, dominantCategory, semantics,
                           timeRange, edits, area, outcome, outcomeType, linkedTestId, runNumbers);
    }
}
