package edu.rosehulman.csse230feedback.domain;

import java.nio.file.Path;

public record PrepareOptions(
    Path inputDir,
    Path outputFile,
    long idleThresholdMinutes,
    int categoryShiftWindow,
    String studentIdOverride,
    String assignmentNameOverride,
    boolean includeCodeSnapshots
) {
    public long idleThresholdMs() {
        return idleThresholdMinutes * 60 * 1000;
    }

    /**
     * Builder-style constructor with default for includeCodeSnapshots.
     */
    public PrepareOptions(Path inputDir, Path outputFile, long idleThresholdMinutes,
                          int categoryShiftWindow, String studentIdOverride,
                          String assignmentNameOverride) {
        this(inputDir, outputFile, idleThresholdMinutes, categoryShiftWindow,
             studentIdOverride, assignmentNameOverride, true);
    }
}
