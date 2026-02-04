package edu.rosehulman.csse230feedback.model;

import java.util.Collections;
import java.util.List;

public record DiffCategoryMapping(
    String assignmentContext,
    String generatedAt,
    String generationMethod,
    List<DiffLabel> diffLabels
) {
    public record DiffLabel(
        int runNumber,
        String changeType,
        List<String> categories,
        String confidence,
        String explanation,
        List<String> affectedMethods
    ) {}

    public DiffLabel getLabelForRun(int runNumber) {
        if (diffLabels == null) return null;
        return diffLabels.stream()
            .filter(d -> d.runNumber() == runNumber)
            .findFirst()
            .orElse(null);
    }

    public List<String> getCategoriesForRun(int runNumber) {
        DiffLabel label = getLabelForRun(runNumber);
        return label != null ? label.categories() : Collections.emptyList();
    }
}
