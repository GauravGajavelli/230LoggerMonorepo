package edu.rosehulman.csse230feedback.domain;

public record SimulateResult(
    int runsGenerated,
    int totalTestResults,
    boolean tarGenerated
) {}
