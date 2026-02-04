package edu.rosehulman.csse230feedback.model;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public record TestCategoryMapping(
    Map<String, CategoryInfo> categories,
    Map<String, List<String>> testToCategories
) {
    public record CategoryInfo(
        String description,
        List<String> tests
    ) {}

    public List<String> getCategoriesForTest(String testId) {
        if (testToCategories == null) return Collections.emptyList();
        return testToCategories.getOrDefault(testId, Collections.emptyList());
    }

    public String getPrimaryCategoryForTest(String testId) {
        List<String> cats = getCategoriesForTest(testId);
        return cats.isEmpty() ? null : cats.get(0);
    }
}
