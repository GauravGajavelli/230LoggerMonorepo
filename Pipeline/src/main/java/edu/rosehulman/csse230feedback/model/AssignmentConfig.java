package edu.rosehulman.csse230feedback.model;

import java.util.List;

/**
 * Per-assignment configuration for the feedback pipeline.
 * Controls which test classes are excluded from rerun and prepare steps.
 */
public record AssignmentConfig(
    String assignmentName,
    List<String> excludeTestClasses,   // simple class names, e.g. "BSTConcurrencyTesting"
    CourseContext courseContext         // nullable; absent from JSON → treated as empty
) {
    public static AssignmentConfig empty() {
        return new AssignmentConfig(null, List.of(), null);
    }

    public boolean isExcluded(String testClassSimple) {
        return excludeTestClasses != null && excludeTestClasses.contains(testClassSimple);
    }

    public CourseContext resolvedCourseContext() {
        return courseContext != null ? courseContext : CourseContext.empty();
    }
}
