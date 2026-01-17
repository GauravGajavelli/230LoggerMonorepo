package edu.rosehulman.csse230feedback.domain;

import java.nio.file.Path;

public record IngestOptions(
        Path repoRoot,
        Path outDir,
        Path workDir,
        boolean keepWorkDir,
        int maxExtractedFiles,
        long maxExtractedBytes
) {}
