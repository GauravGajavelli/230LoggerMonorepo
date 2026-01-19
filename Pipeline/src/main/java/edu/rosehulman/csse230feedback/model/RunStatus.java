package edu.rosehulman.csse230feedback.model;

import java.util.List;

/**
 * Per-run status summary for partial results.
 */
public record RunStatus(
    int runNumber,
    String status,
    List<String> errors,
    List<String> warnings
) {}
