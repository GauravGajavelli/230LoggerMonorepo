package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FrontendOutput(
    SubmissionContext context,
    List<Episode> episodes,
    List<EpisodeTestData> episodeTestData,
    List<Feedback> feedback,
    List<TestHistory> testHistories,
    FailureHighlights failureHighlights,
    List<CodeSnapshot> codeSnapshots,
    SemanticLog semanticLog,
    List<TimelinePoint> timeline
) {
    /**
     * Convenience constructor without timeline (backwards compatibility).
     */
    public FrontendOutput(SubmissionContext context, List<Episode> episodes,
                          List<EpisodeTestData> episodeTestData, List<Feedback> feedback,
                          List<TestHistory> testHistories, FailureHighlights failureHighlights,
                          List<CodeSnapshot> codeSnapshots) {
        this(context, episodes, episodeTestData, feedback, testHistories,
             failureHighlights, codeSnapshots, null, null);
    }

    /**
     * Convenience constructor without timeline (for semantic log variant).
     */
    public FrontendOutput(SubmissionContext context, List<Episode> episodes,
                          List<EpisodeTestData> episodeTestData, List<Feedback> feedback,
                          List<TestHistory> testHistories, FailureHighlights failureHighlights,
                          List<CodeSnapshot> codeSnapshots, SemanticLog semanticLog) {
        this(context, episodes, episodeTestData, feedback, testHistories,
             failureHighlights, codeSnapshots, semanticLog, null);
    }
}
