package edu.rosehulman.csse230feedback.domain;

import java.util.List;

public record PrepareResult(
    int episodeCount,
    int totalRuns,
    int totalTests,
    List<String> warnings
) {}
