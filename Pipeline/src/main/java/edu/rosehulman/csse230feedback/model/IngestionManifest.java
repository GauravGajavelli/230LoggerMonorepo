package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record IngestionManifest(
        int schemaVersion,
        String createdAtUtc,
        String repoRoot,
        String runTarPath,
        String runTarSha256,
        List<ExtractedFile> extractedFiles,
        List<DiffArchiveInfo> diffArchives,
        List<String> warnings
) {
    public static IngestionManifest build(
            String repoRoot,
            String runTarPath,
            String runTarSha256,
            List<ExtractedFile> extractedFiles,
            List<DiffArchiveInfo> diffArchives,
            List<String> warnings
    ) {
        return new IngestionManifest(
                1,
                Instant.now().toString(),
                repoRoot,
                runTarPath,
                runTarSha256,
                extractedFiles,
                diffArchives,
                warnings
        );
    }
}
