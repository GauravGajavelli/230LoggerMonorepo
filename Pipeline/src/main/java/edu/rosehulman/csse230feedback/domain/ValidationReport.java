package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Report produced by ValidationService comparing LLM output against narrative expectations.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ValidationReport(
    String scenarioId,
    String scenarioName,
    List<ValidationCheck> checks,
    int passCount,
    int failCount,
    int warnCount
) {

    public enum Status { PASS, FAIL, WARN }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ValidationCheck(
        String category,
        String name,
        Status status,
        String expected,
        String actual,
        String detail
    ) {}

    public void printSummary() {
        System.out.println("=== Validation Report: " + scenarioName + " (" + scenarioId + ") ===");
        System.out.println();

        for (ValidationCheck check : checks) {
            String icon = switch (check.status) {
                case PASS -> "[PASS]";
                case FAIL -> "[FAIL]";
                case WARN -> "[WARN]";
            };
            System.out.printf("  %s %s / %s%n", icon, check.category, check.name);
            if (check.expected != null) {
                System.out.println("         Expected: " + check.expected);
            }
            if (check.actual != null) {
                System.out.println("         Actual:   " + check.actual);
            }
            if (check.detail != null) {
                System.out.println("         Detail:   " + check.detail);
            }
        }

        System.out.println();
        System.out.printf("  Summary: %d PASS, %d FAIL, %d WARN%n", passCount, failCount, warnCount);
    }
}
