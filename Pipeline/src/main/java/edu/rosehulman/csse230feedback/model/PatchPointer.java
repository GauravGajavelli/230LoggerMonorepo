package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PatchPointer(
        String archiveFilename,
        String fileKey,
        int runNumber,
        String baselineEntry,
        String patchEntry,
        String patchKind
) {}
