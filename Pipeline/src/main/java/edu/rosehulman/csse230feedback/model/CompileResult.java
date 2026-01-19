package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Result of a Java compilation operation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CompileResult(
    boolean success,
    String stdout,
    String stderr,
    int exitCode,
    List<String> errors
) {
    /**
     * Creates a successful compilation result.
     */
    public static CompileResult success(String stdout, String stderr) {
        return new CompileResult(true, stdout, stderr, 0, List.of());
    }

    /**
     * Creates a failed compilation result.
     */
    public static CompileResult failure(String stdout, String stderr, int exitCode, List<String> errors) {
        return new CompileResult(false, stdout, stderr, exitCode, errors);
    }
}
