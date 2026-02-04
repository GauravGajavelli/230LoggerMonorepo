package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile.TestCorrelation;

import java.util.*;

/**
 * Computes correlation between tests - when one test fails, which other tests
 * tend to fail at the same time? This helps identify related conceptual issues.
 */
public class CrossTestCorrelator {

    private static final int MAX_CORRELATIONS_PER_TEST = 5;
    private static final double MIN_CORRELATION_THRESHOLD = 0.3;

    /**
     * Computes correlations between tests based on their pass/fail status across runs.
     *
     * @param statusHistories Map of testId -> (runNumber -> status)
     * @param testNames Map of testId -> display name
     * @param categoryMapping Optional mapping of tests to categories (for grouping)
     * @return Map of testId -> list of correlated tests (sorted by correlation descending)
     */
    public Map<String, List<TestCorrelation>> computeCorrelations(
            Map<String, Map<Integer, String>> statusHistories,
            Map<String, String> testNames,
            TestCategoryMapping categoryMapping) {

        if (statusHistories.size() < 2) {
            return Collections.emptyMap();
        }

        // Find common runs across all tests
        Set<Integer> commonRuns = findCommonRuns(statusHistories);
        if (commonRuns.size() < 3) {
            return Collections.emptyMap(); // Not enough data for meaningful correlation
        }

        // Convert status to numeric (fail=1, pass=0) for each test
        Map<String, double[]> numericStatus = new HashMap<>();
        List<Integer> sortedRuns = new ArrayList<>(commonRuns);
        Collections.sort(sortedRuns);

        for (Map.Entry<String, Map<Integer, String>> entry : statusHistories.entrySet()) {
            String testId = entry.getKey();
            Map<Integer, String> statusByRun = entry.getValue();

            double[] values = new double[sortedRuns.size()];
            for (int i = 0; i < sortedRuns.size(); i++) {
                int run = sortedRuns.get(i);
                String status = statusByRun.get(run);
                values[i] = isFailing(status) ? 1.0 : 0.0;
            }
            numericStatus.put(testId, values);
        }

        // Compute pairwise correlations
        Map<String, List<TestCorrelation>> result = new HashMap<>();
        List<String> testIds = new ArrayList<>(numericStatus.keySet());

        for (String testA : testIds) {
            double[] valuesA = numericStatus.get(testA);

            // Skip tests that never failed or always failed (no variance)
            if (!hasVariance(valuesA)) {
                continue;
            }

            List<TestCorrelation> correlations = new ArrayList<>();

            for (String testB : testIds) {
                if (testA.equals(testB)) {
                    continue;
                }

                double[] valuesB = numericStatus.get(testB);
                if (!hasVariance(valuesB)) {
                    continue;
                }

                // Optionally filter by same category
                if (categoryMapping != null) {
                    if (!shareCategory(testA, testB, categoryMapping)) {
                        continue;
                    }
                }

                double correlation = pearsonCorrelation(valuesA, valuesB);

                if (correlation >= MIN_CORRELATION_THRESHOLD) {
                    String name = testNames.getOrDefault(testB, testB);
                    correlations.add(new TestCorrelation(testB, name, round(correlation, 2)));
                }
            }

            // Sort by correlation descending and limit
            correlations.sort((a, b) -> Double.compare(b.correlation(), a.correlation()));
            if (correlations.size() > MAX_CORRELATIONS_PER_TEST) {
                correlations = correlations.subList(0, MAX_CORRELATIONS_PER_TEST);
            }

            if (!correlations.isEmpty()) {
                result.put(testA, correlations);
            }
        }

        return result;
    }

    /**
     * Finds run numbers that exist in all test histories.
     */
    private Set<Integer> findCommonRuns(Map<String, Map<Integer, String>> statusHistories) {
        Set<Integer> common = null;
        for (Map<Integer, String> history : statusHistories.values()) {
            if (common == null) {
                common = new HashSet<>(history.keySet());
            } else {
                common.retainAll(history.keySet());
            }
        }
        return common != null ? common : Collections.emptySet();
    }

    /**
     * Checks if two tests share at least one category.
     */
    private boolean shareCategory(String testA, String testB, TestCategoryMapping mapping) {
        List<String> catsA = mapping.getCategoriesForTest(testA);
        List<String> catsB = mapping.getCategoriesForTest(testB);

        if (catsA.isEmpty() || catsB.isEmpty()) {
            return true; // If no category info, allow correlation
        }

        for (String cat : catsA) {
            if (catsB.contains(cat)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if an array has variance (not all same value).
     */
    private boolean hasVariance(double[] values) {
        if (values.length < 2) {
            return false;
        }
        double first = values[0];
        for (int i = 1; i < values.length; i++) {
            if (values[i] != first) {
                return true;
            }
        }
        return false;
    }

    /**
     * Computes Pearson correlation coefficient between two arrays.
     */
    private double pearsonCorrelation(double[] x, double[] y) {
        if (x.length != y.length || x.length == 0) {
            return 0.0;
        }

        int n = x.length;

        // Calculate means
        double sumX = 0, sumY = 0;
        for (int i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
        }
        double meanX = sumX / n;
        double meanY = sumY / n;

        // Calculate correlation components
        double numerator = 0;
        double sumSqX = 0;
        double sumSqY = 0;

        for (int i = 0; i < n; i++) {
            double diffX = x[i] - meanX;
            double diffY = y[i] - meanY;
            numerator += diffX * diffY;
            sumSqX += diffX * diffX;
            sumSqY += diffY * diffY;
        }

        double denominator = Math.sqrt(sumSqX * sumSqY);

        if (denominator == 0) {
            return 0.0;
        }

        return numerator / denominator;
    }

    private boolean isFailing(String status) {
        return "fail".equals(status) || "error".equals(status);
    }

    private double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }
}
