package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DiffArchiveInfo(
        String filename,
        Integer baselineRunNumber,
        String sha256,
        int baselineCount,
        int patchCount,
        Integer minPatchRunNumber,
        Integer maxPatchRunNumber
) {}
