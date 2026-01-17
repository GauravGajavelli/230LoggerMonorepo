package edu.rosehulman.csse230feedback.domain;

import java.util.List;

public record IngestResult(
        int runsParsed,
        int diffArchivesFound,
        List<String> warnings
) {}
