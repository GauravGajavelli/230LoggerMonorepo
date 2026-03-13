package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.model.AssignmentConfig;

import java.nio.file.Path;

public record PrepareOptions(
    Path inputDir,
    Path outputFile,
    long idleThresholdMinutes,
    int categoryShiftWindow,
    String studentIdOverride,
    String assignmentNameOverride,
    boolean includeCodeSnapshots,
    // LLM options
    String llmProvider,
    String llmModel,
    String llmApiKey,
    boolean noCache,
    boolean clearCache,
    Path cacheDir,
    boolean dryRun,
    Path ingestDir,
    /** If false (default), prepare fails when enriched_runs/ is absent. Pass true to degrade gracefully. */
    boolean allowBasicFallback,
    /** If true, include raw lastError.message text in LLM input (default: false). */
    boolean includeErrorMessages,
    /** Per-assignment configuration (excluded test classes, etc.). Null means no exclusions. */
    AssignmentConfig assignmentConfig
) {
    public long idleThresholdMs() {
        return idleThresholdMinutes * 60 * 1000;
    }

    /**
     * Returns ingestDir if set, otherwise falls back to inputDir.
     */
    public Path resolvedIngestDir() {
        return ingestDir != null ? ingestDir : inputDir;
    }

    /**
     * Builder-style constructor with defaults for non-LLM options.
     */
    public PrepareOptions(Path inputDir, Path outputFile, long idleThresholdMinutes,
                          int categoryShiftWindow, String studentIdOverride,
                          String assignmentNameOverride) {
        this(inputDir, outputFile, idleThresholdMinutes, categoryShiftWindow,
             studentIdOverride, assignmentNameOverride, true,
             null, null, null, false, false, null, false, null, false, false, null);
    }

    /**
     * Constructor preserving backwards compatibility with 7-arg version.
     */
    public PrepareOptions(Path inputDir, Path outputFile, long idleThresholdMinutes,
                          int categoryShiftWindow, String studentIdOverride,
                          String assignmentNameOverride, boolean includeCodeSnapshots) {
        this(inputDir, outputFile, idleThresholdMinutes, categoryShiftWindow,
             studentIdOverride, assignmentNameOverride, includeCodeSnapshots,
             null, null, null, false, false, null, false, null, false, false, null);
    }

    /**
     * Returns the resolved cache directory, defaulting to Pipeline/cache/llm/.
     */
    public Path resolvedCacheDir() {
        if (cacheDir != null) return cacheDir;
        // Default: relative to current working directory
        return Path.of("cache", "llm");
    }
}
