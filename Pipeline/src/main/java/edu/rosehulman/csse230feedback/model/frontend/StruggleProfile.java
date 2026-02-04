package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Enhanced struggle profile that combines multiple signals to characterize
 * how a student struggled with a test and what strategies they tried.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StruggleProfile(
    int attemptsToFix,                         // Total runs spent trying to fix
    int distinctStrategies,                    // Number of different approaches tried (from diff categories)
    List<DiffCategoryCount> strategiesTried,   // What code change patterns were attempted
    DiffCategoryCount winningFix,              // What finally worked (null if still failing)
    List<TestCorrelation> relatedTests,        // Tests that fail together
    double struggleScore,                      // Enhanced score combining all signals
    ErrorEvolution errorEvolution              // How errors evolved during struggle
) {
    /**
     * Count of how many times a diff category was used while fixing this test.
     */
    public record DiffCategoryCount(
        String category,
        int count
    ) {}

    /**
     * Correlation between two tests - when one fails, does the other fail too?
     */
    public record TestCorrelation(
        String testId,
        String testName,
        double correlation   // Pearson correlation coefficient (-1 to 1)
    ) {}

    /**
     * Returns true if this test has significant struggle indicators.
     */
    public boolean isSignificantStruggle() {
        return attemptsToFix >= 5 || distinctStrategies >= 3 || struggleScore >= 50;
    }

    /**
     * Returns true if the student eventually fixed the test.
     */
    public boolean wasFixed() {
        return winningFix != null;
    }
}
