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
    List<CodeSnapshot> codeSnapshots
) {}
