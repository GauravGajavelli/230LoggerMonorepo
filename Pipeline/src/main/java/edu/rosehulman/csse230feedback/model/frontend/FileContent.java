package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Represents a single file's content for display in the frontend.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record FileContent(
    String name,      // e.g., "BinarySearchTree.java"
    String language,  // e.g., "java"
    String content    // The full file content
) {}
