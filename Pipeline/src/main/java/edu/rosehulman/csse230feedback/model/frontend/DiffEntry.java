package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DiffEntry(
    String label,          // e.g. "Run 50 — BinarySearchTree.java"
    List<String> before,   // removed lines (shown with - prefix in UI)
    List<String> after,    // added lines (shown with + prefix in UI)
    String note            // LLM-generated: what changed and why it relates to this test
) {
    public DiffEntry(String label, List<String> before, List<String> after) {
        this(label, before, after, null);
    }
}
