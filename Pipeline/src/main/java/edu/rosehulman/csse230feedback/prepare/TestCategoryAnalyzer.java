package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class TestCategoryAnalyzer {

    public String extractDominantCategory(List<EnrichedTestResult> tests) {
        if (tests == null || tests.isEmpty()) {
            return "Unknown";
        }

        Map<String, Long> categoryCounts = tests.stream()
            .map(this::extractCategoryFromTest)
            .collect(Collectors.groupingBy(c -> c, Collectors.counting()));

        return categoryCounts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("Unknown");
    }

    private String extractCategoryFromTest(EnrichedTestResult test) {
        String className = test.testClassSimple();
        if (className == null || className.isEmpty()) {
            return "Unknown";
        }

        // Strip "Test" suffix if present
        if (className.endsWith("Test")) {
            className = className.substring(0, className.length() - 4);
        }

        return className.isEmpty() ? "Unknown" : className;
    }
}
