package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.DiffCategoryMapping;
import edu.rosehulman.csse230feedback.model.DiffCategoryMapping.DiffLabel;
import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution;
import edu.rosehulman.csse230feedback.model.frontend.FailureInterval;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile.DiffCategoryCount;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile.TestCorrelation;

import java.util.*;

/**
 * Generates enhanced struggle profiles by combining multiple signals:
 * - Error evolution (how errors changed over time)
 * - Diff categories (what code change strategies were tried)
 * - Test correlations (which tests fail together)
 * - Existing failure interval data
 */
public class StruggleProfileGenerator {

    /**
     * Generates a StruggleProfile for a single test.
     *
     * @param testId The test identifier
     * @param statusByRun Status history for this test
     * @param failureIntervals Pre-computed failure intervals
     * @param errorEvolution Pre-computed error evolution
     * @param relatedTests Pre-computed test correlations
     * @param diffCategories Optional diff category mapping
     * @param baseMeaningfulnessScore The existing meaningfulness score
     * @return StruggleProfile or null if test never failed
     */
    public StruggleProfile generate(
            String testId,
            Map<Integer, String> statusByRun,
            List<FailureInterval> failureIntervals,
            ErrorEvolution errorEvolution,
            List<TestCorrelation> relatedTests,
            DiffCategoryMapping diffCategories,
            double baseMeaningfulnessScore) {

        if (failureIntervals == null || failureIntervals.isEmpty()) {
            return null; // Test never failed
        }

        // Calculate attempts to fix (total runs spent failing)
        int attemptsToFix = calculateAttemptsToFix(failureIntervals);

        // Analyze diff categories used during failure intervals
        DiffCategoryAnalysis diffAnalysis = analyzeDiffCategories(
            statusByRun, failureIntervals, diffCategories
        );

        // Calculate enhanced struggle score
        double struggleScore = calculateEnhancedStruggleScore(
            baseMeaningfulnessScore,
            attemptsToFix,
            diffAnalysis.distinctStrategies,
            errorEvolution,
            relatedTests
        );

        return new StruggleProfile(
            attemptsToFix,
            diffAnalysis.distinctStrategies,
            diffAnalysis.strategiesTried.isEmpty() ? null : diffAnalysis.strategiesTried,
            diffAnalysis.winningFix,
            relatedTests == null || relatedTests.isEmpty() ? null : relatedTests,
            round(struggleScore, 2),
            errorEvolution
        );
    }

    /**
     * Calculates total runs spent in failure state.
     */
    private int calculateAttemptsToFix(List<FailureInterval> intervals) {
        return intervals.stream()
            .mapToInt(FailureInterval::duration)
            .sum();
    }

    /**
     * Analyzes what diff categories (code change strategies) were used
     * during failure intervals.
     */
    private DiffCategoryAnalysis analyzeDiffCategories(
            Map<Integer, String> statusByRun,
            List<FailureInterval> failureIntervals,
            DiffCategoryMapping diffCategories) {

        Map<String, Integer> categoryCounts = new HashMap<>();
        DiffCategoryCount winningFix = null;

        if (diffCategories == null) {
            return new DiffCategoryAnalysis(Collections.emptyList(), 0, null);
        }

        // For each failure interval, track the diff categories used
        for (FailureInterval interval : failureIntervals) {
            int start = interval.startRun();
            Integer end = interval.endRun();
            int lastRun = end != null ? end : Collections.max(statusByRun.keySet());

            // Track categories during the failure interval
            for (int run = start; run <= lastRun; run++) {
                DiffLabel label = diffCategories.getLabelForRun(run);
                if (label != null && label.categories() != null) {
                    for (String category : label.categories()) {
                        categoryCounts.merge(category, 1, Integer::sum);
                    }
                }
            }

            // If interval ended (not lingering), the run after is the fix
            if (!interval.isLingering() && end != null) {
                int fixRun = end + 1;
                String status = statusByRun.get(fixRun);
                if ("pass".equals(status)) {
                    DiffLabel fixLabel = diffCategories.getLabelForRun(fixRun);
                    if (fixLabel != null && fixLabel.categories() != null && !fixLabel.categories().isEmpty()) {
                        String winningCategory = fixLabel.categories().get(0);
                        winningFix = new DiffCategoryCount(winningCategory, 1);
                    }
                }
            }
        }

        // Convert to sorted list
        List<DiffCategoryCount> strategies = categoryCounts.entrySet().stream()
            .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
            .map(e -> new DiffCategoryCount(e.getKey(), e.getValue()))
            .toList();

        return new DiffCategoryAnalysis(
            strategies,
            strategies.size(),
            winningFix
        );
    }

    /**
     * Calculates an enhanced struggle score combining multiple signals.
     */
    private double calculateEnhancedStruggleScore(
            double baseMeaningfulnessScore,
            int attemptsToFix,
            int distinctStrategies,
            ErrorEvolution errorEvolution,
            List<TestCorrelation> relatedTests) {

        double score = baseMeaningfulnessScore;

        // Bonus for many attempts (indicates sustained effort)
        if (attemptsToFix > 5) {
            score += Math.min(attemptsToFix - 5, 15); // Cap at +15
        }

        // Bonus for trying multiple strategies (shows experimentation)
        if (distinctStrategies > 1) {
            score += (distinctStrategies - 1) * 5; // +5 per additional strategy
        }

        // Error evolution signals
        if (errorEvolution != null) {
            // Stuck on same error is concerning
            if (errorEvolution.stuckOnSameError() > 3) {
                score += 10;
            }

            // StackOverflow errors indicate recursion confusion
            if (errorEvolution.hadStackOverflow()) {
                score += 15;
            }

            // Multiple NPEs might indicate fundamental understanding issue
            if (errorEvolution.npeCount() > 2) {
                score += 10;
            }

            // Changing error types could be progress or thrashing
            int transitions = errorEvolution.transitions() != null ? errorEvolution.transitions().size() : 0;
            if (transitions > 2) {
                score += 5; // Some bonus for trying different things
            }
        }

        // Correlated test failures suggest systemic issues
        if (relatedTests != null && !relatedTests.isEmpty()) {
            // High correlation with many tests = shared underlying issue
            double avgCorrelation = relatedTests.stream()
                .mapToDouble(TestCorrelation::correlation)
                .average()
                .orElse(0);
            if (avgCorrelation > 0.7) {
                score += 10;
            }
        }

        return score;
    }

    private double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }

    /**
     * Internal record for diff category analysis results.
     */
    private record DiffCategoryAnalysis(
        List<DiffCategoryCount> strategiesTried,
        int distinctStrategies,
        DiffCategoryCount winningFix
    ) {}
}
