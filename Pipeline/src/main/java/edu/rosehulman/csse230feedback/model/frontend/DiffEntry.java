package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DiffEntry(
    String label,          // e.g. "10:05 PM — BinarySearchTree.java"
    List<String> before,   // removed lines (shown with - prefix in UI)
    List<String> after     // added lines (shown with + prefix in UI)
) {}
