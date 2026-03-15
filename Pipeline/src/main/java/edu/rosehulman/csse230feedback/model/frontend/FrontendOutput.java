package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

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
    List<TimelinePoint> timeline,
    Map<String, TestSource> testSources
) {
    /**
     * Convenience constructor without testSources (backwards compatibility).
     */
    public FrontendOutput(SubmissionContext context, List<Episode> episodes,
                          List<EpisodeTestData> episodeTestData, List<Feedback> feedback,
                          List<TestHistory> testHistories, FailureHighlights failureHighlights,
                          List<CodeSnapshot> codeSnapshots) {
        this(context, episodes, episodeTestData, feedback, testHistories,
             failureHighlights, codeSnapshots, null, null, null);
    }

    /**
     * Convenience constructor without timeline or testSources.
     */
    public FrontendOutput(SubmissionContext context, List<Episode> episodes,
                          List<EpisodeTestData> episodeTestData, List<Feedback> feedback,
                          List<TestHistory> testHistories, FailureHighlights failureHighlights,
                          List<CodeSnapshot> codeSnapshots, SemanticLog semanticLog) {
        this(context, episodes, episodeTestData, feedback, testHistories,
             failureHighlights, codeSnapshots, semanticLog, null, null);
    }

    /**
     * Convenience constructor without testSources (for timeline + semanticLog variant).
     */
    public FrontendOutput(SubmissionContext context, List<Episode> episodes,
                          List<EpisodeTestData> episodeTestData, List<Feedback> feedback,
                          List<TestHistory> testHistories, FailureHighlights failureHighlights,
                          List<CodeSnapshot> codeSnapshots, SemanticLog semanticLog,
                          List<TimelinePoint> timeline) {
        this(context, episodes, episodeTestData, feedback, testHistories,
             failureHighlights, codeSnapshots, semanticLog, timeline, null);
    }
}
