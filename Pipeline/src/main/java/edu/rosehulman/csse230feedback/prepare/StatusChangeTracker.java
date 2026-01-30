package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.frontend.FailureHighlights;
import edu.rosehulman.csse230feedback.model.frontend.FailureInterval;
import edu.rosehulman.csse230feedback.model.frontend.TestHistory;
import java.util.*;

public class StatusChangeTracker {

    private final Map<String, String> currentStatus = new HashMap<>();
    private final Map<String, Map<Integer, String>> statusHistory = new HashMap<>();
    private final Map<String, String> testNames = new HashMap<>();

    public void recordTest(String testId, String testName, int runNumber, String status) {
        testNames.put(testId, testName);
        statusHistory.computeIfAbsent(testId, k -> new TreeMap<>()).put(runNumber, status);
    }

    public String getPreviousStatus(String testId) {
        return currentStatus.get(testId);
    }

    public void updateCurrentStatus(String testId, String status) {
        currentStatus.put(testId, status);
    }

    public boolean hasStatusChanged(String testId, String newStatus) {
        String previous = currentStatus.get(testId);
        return previous != null && !previous.equals(newStatus);
    }

    public List<TestHistory> buildTestHistories() {
        List<TestHistory> histories = new ArrayList<>();

        for (Map.Entry<String, Map<Integer, String>> entry : statusHistory.entrySet()) {
            String testId = entry.getKey();
            Map<Integer, String> statusByRun = entry.getValue();

            List<FailureInterval> intervals = computeFailureIntervals(statusByRun);
            boolean isLingeringFailure = isLingeringFailure(statusByRun);
            boolean isRegression = isRegression(statusByRun);
            int recursCount = intervals.size();
            int flipsWithin = countFlips(statusByRun);
            int totalFailedRuns = countFailedRuns(statusByRun);
            double meaningfulnessScore = computeMeaningfulnessScore(
                isLingeringFailure, isRegression, recursCount, totalFailedRuns, false
            );
            String highlightCategory = classifyHighlight(
                isLingeringFailure, recursCount, totalFailedRuns, intervals
            );

            histories.add(new TestHistory(
                testId,
                testNames.get(testId),
                statusByRun,
                intervals,
                isLingeringFailure,
                isRegression,
                recursCount,
                flipsWithin,
                totalFailedRuns,
                meaningfulnessScore,
                highlightCategory
            ));
        }

        return histories;
    }

    public FailureHighlights buildFailureHighlights(List<TestHistory> histories) {
        List<String> stillFailing = new ArrayList<>();
        List<String> regressions = new ArrayList<>();
        List<String> costlyDetours = new ArrayList<>();

        for (TestHistory history : histories) {
            if (history.highlightCategory() == null) {
                continue;
            }
            switch (history.highlightCategory()) {
                case "stillFailing" -> stillFailing.add(history.testId());
                case "regression" -> regressions.add(history.testId());
                case "costlyDetour" -> costlyDetours.add(history.testId());
            }
        }

        return new FailureHighlights(stillFailing, regressions, costlyDetours);
    }

    private List<FailureInterval> computeFailureIntervals(Map<Integer, String> statusByRun) {
        List<FailureInterval> intervals = new ArrayList<>();
        Integer intervalStart = null;
        boolean hadPassBeforeInterval = false;

        List<Integer> sortedRuns = new ArrayList<>(statusByRun.keySet());
        Collections.sort(sortedRuns);

        int lastRun = sortedRuns.isEmpty() ? 0 : sortedRuns.get(sortedRuns.size() - 1);

        for (int runNumber : sortedRuns) {
            String status = statusByRun.get(runNumber);
            boolean isFailing = "fail".equals(status) || "error".equals(status);
            boolean isPassing = "pass".equals(status);

            if (isFailing && intervalStart == null) {
                intervalStart = runNumber;
            } else if (!isFailing && intervalStart != null) {
                int duration = runNumber - intervalStart;
                boolean isLingering = false;
                boolean isRegression = hadPassBeforeInterval;
                intervals.add(new FailureInterval(
                    intervalStart,
                    runNumber - 1,
                    duration,
                    isLingering,
                    isRegression,
                    null,
                    duration
                ));
                intervalStart = null;
            }

            if (isPassing) {
                hadPassBeforeInterval = true;
            }
        }

        // Close open interval (still failing at end)
        if (intervalStart != null) {
            int duration = lastRun - intervalStart + 1;
            boolean isLingering = true;
            boolean isRegression = hadPassBeforeInterval;
            intervals.add(new FailureInterval(
                intervalStart,
                null,
                duration,
                isLingering,
                isRegression,
                null,
                duration
            ));
        }

        return intervals;
    }

    private int countFlips(Map<Integer, String> statusByRun) {
        List<Integer> sortedRuns = new ArrayList<>(statusByRun.keySet());
        Collections.sort(sortedRuns);

        int flips = 0;
        String previousCategory = null;

        for (int runNumber : sortedRuns) {
            String status = statusByRun.get(runNumber);
            String category = isFailing(status) ? "fail" : "pass";

            if (previousCategory != null && !previousCategory.equals(category)) {
                flips++;
            }
            previousCategory = category;
        }

        return flips;
    }

    private int countFailedRuns(Map<Integer, String> statusByRun) {
        int count = 0;
        for (String status : statusByRun.values()) {
            if (isFailing(status)) {
                count++;
            }
        }
        return count;
    }

    private boolean isFailing(String status) {
        return "fail".equals(status) || "error".equals(status);
    }

    private double computeMeaningfulnessScore(
        boolean isLingering, boolean isRegression,
        int recurs, int effort, boolean hasEvidence
    ) {
        // From error_detection.md Step 3:
        // 100*lingering + 40*regression + 35*recurring + effort + evidence - penalties
        double score = 0;

        if (isLingering) {
            score += 100;
        }
        if (isRegression) {
            score += 40;
        }
        if (recurs > 1) {
            score += 35 * (recurs - 1);
        }

        // Effort: runs while failing contributes to score
        score += Math.min(effort, 20);

        // Evidence strength (placeholder - would need stack trace analysis)
        if (hasEvidence) {
            score += 15;
        }

        return score;
    }

    private String classifyHighlight(
        boolean isLingering, int recursCount, int totalFailedRuns,
        List<FailureInterval> intervals
    ) {
        // "stillFailing" if lingering
        if (isLingering) {
            return "stillFailing";
        }

        // "regression" if recurs > 1 (multiple failure intervals = broke it again after fixing)
        if (recursCount > 1) {
            return "regression";
        }

        // "costlyDetour" ONLY if it was a regression (test passed first, then broke)
        // AND took > 3 runs to fix
        if (!intervals.isEmpty()) {
            FailureInterval interval = intervals.get(0);
            // Must be a regression (was passing before it failed) AND took long to fix
            if (interval.isRegression() && interval.duration() > 3) {
                return "costlyDetour";
            }
        }

        return null; // Normal bug fix - no highlight needed
    }

    private boolean isLingeringFailure(Map<Integer, String> statusByRun) {
        if (statusByRun.isEmpty()) {
            return false;
        }

        int lastRun = Collections.max(statusByRun.keySet());
        String lastStatus = statusByRun.get(lastRun);
        return isFailing(lastStatus);
    }

    private boolean isRegression(Map<Integer, String> statusByRun) {
        boolean hadPass = false;
        boolean hadFailAfterPass = false;

        List<Integer> sortedRuns = new ArrayList<>(statusByRun.keySet());
        Collections.sort(sortedRuns);

        for (int runNumber : sortedRuns) {
            String status = statusByRun.get(runNumber);
            if ("pass".equals(status)) {
                hadPass = true;
            } else if (hadPass && isFailing(status)) {
                hadFailAfterPass = true;
                break;
            }
        }

        return hadFailAfterPass;
    }
}
