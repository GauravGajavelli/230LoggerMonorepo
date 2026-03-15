package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Source location and content of a single @Test method, extracted from the test class file.
 * Stored in frontend.json under testSources, keyed by testId.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TestSource(
    String fileName,   // e.g. "BSTManualTesting.java"
    int startLine,     // 1-based line of @Test annotation
    int endLine,       // 1-based line of closing }
    String content     // full method text including @Test annotation
) {}
