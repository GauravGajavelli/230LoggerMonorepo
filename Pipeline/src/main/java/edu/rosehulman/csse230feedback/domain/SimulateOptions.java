package edu.rosehulman.csse230feedback.domain;

import java.nio.file.Path;

public record SimulateOptions(
    Path outputDir,
    long seed,
    int numRuns,
    String studentId,
    String assignment,
    String difficulty,
    boolean includeCategories,
    String format,  // "prepare" | "tar" | "both"
    NarrativeSpec.ProgressionOverrides progressionOverrides,
    Path narrativePath
) {
    public SimulateOptions(Path outputDir, long seed, int numRuns, String studentId,
                           String assignment, String difficulty, boolean includeCategories,
                           String format) {
        this(outputDir, seed, numRuns, studentId, assignment, difficulty,
             includeCategories, format, null, null);
    }
}
