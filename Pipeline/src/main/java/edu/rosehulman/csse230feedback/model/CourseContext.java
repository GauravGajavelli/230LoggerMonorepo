package edu.rosehulman.csse230feedback.model;

import java.util.Collection;
import java.util.List;

/**
 * Course context data for an assignment: maps concept entries to future appearances
 * (exams, future assignments) where the same concept recurs.
 * Injected into the LLM prompt so nextSteps become forward-looking.
 */
public record CourseContext(List<ConceptEntry> concepts) {

    public record ConceptEntry(
        String concept,
        List<String> testCategories,    // matches test category labels (e.g. "remove", "iterator")
        List<FutureAppearance> futureAppearances
    ) {}

    public record FutureAppearance(String label, String description, String url) {}

    public static CourseContext empty() { return new CourseContext(List.of()); }

    /** All FutureAppearances whose testCategories overlap the given set. */
    public List<FutureAppearance> forCategories(Collection<String> categories) {
        return concepts.stream()
            .filter(e -> e.testCategories().stream().anyMatch(categories::contains))
            .flatMap(e -> e.futureAppearances().stream())
            .distinct().toList();
    }
}
