package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Represents a code snapshot at a specific run number.
 * Contains all tracked files' content at that point in time.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CodeSnapshot(
    int runNumber,
    List<FileContent> files
) {}
