package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Record hierarchy describing a simulation scenario.
 * Loaded from a scenario JSON file (e.g. scenarios/steady-learner.json).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NarrativeSpec(
    String id,
    String name,
    String description,
    SimulationParams simulation,
    ProgressionOverrides progression,
    ValidationExpectations expectations
) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SimulationParams(
        Long seed,
        Integer runs,
        String difficulty,
        String studentId,
        String assignment,
        String format
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ProgressionOverrides(
        Integer breakthroughRun,
        Integer regressionRun,
        Double regressionSeverity,
        Integer reactiveDebugCount,
        Integer oscillatingCount,
        Integer plateauStartRun,
        Integer plateauEndRun,
        Integer finalPhase,
        Double phaseSpeedMultiplier
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ValidationExpectations(
        PatternExpectations detectedPatterns,
        EpisodeExpectations episodeAssessments,
        IntentExpectations intents,
        List<String> narrativeKeywords,
        List<String> conceptsCovered
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PatternExpectations(
        List<String> mustInclude,
        List<String> mustNotInclude,
        List<String> mayInclude
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EpisodeExpectations(
        String dominant,
        Integer maxStuckCount,
        Integer maxRegressingCount,
        Integer minBreakthroughCount,
        Integer minProductiveCount
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IntentExpectations(
        String dominant,
        Double minExtendingRatio,
        Double maxDebuggingRatio
    ) {}
}
