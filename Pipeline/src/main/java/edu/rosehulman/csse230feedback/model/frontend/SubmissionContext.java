package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SubmissionContext(
    String studentId,
    String assignmentName,
    String submittedAt,
    int totalEpisodes,
    String repoRoot
) {}
