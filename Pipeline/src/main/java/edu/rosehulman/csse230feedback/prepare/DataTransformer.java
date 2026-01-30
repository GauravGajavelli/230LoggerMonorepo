package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.TestStatus;
import edu.rosehulman.csse230feedback.model.frontend.*;
import java.util.ArrayList;
import java.util.List;

public class DataTransformer {

    public TestResult transformTestResult(
        EnrichedTestResult enriched,
        StatusChangeTracker tracker,
        int runNumber
    ) {
        String testId = enriched.testId();
        String status = mapStatus(enriched.status());
        String previousStatus = tracker.getPreviousStatus(testId);
        boolean changedThisRun = tracker.hasStatusChanged(testId, status);

        // Track this test in the tracker
        tracker.recordTest(testId, enriched.testDisplayName(), runNumber, status);
        tracker.updateCurrentStatus(testId, status);

        String errorMessage = extractFirstLine(enriched.message());

        return new TestResult(
            testId,
            enriched.testDisplayName(),
            status,
            changedThisRun,
            previousStatus,
            errorMessage,
            enriched.stackTrace(),
            enriched.expected(),
            enriched.actual(),
            enriched.durationMs()
        );
    }

    public TestSummary calculateSummary(List<TestResult> results) {
        int total = results.size();
        int passed = 0;
        int failed = 0;
        int errored = 0;
        int skipped = 0;

        for (TestResult result : results) {
            switch (result.status()) {
                case "pass" -> passed++;
                case "fail" -> failed++;
                case "error" -> errored++;
                case "skip" -> skipped++;
            }
        }

        return new TestSummary(total, passed, failed, errored, skipped);
    }

    public TestRun createTestRun(
        int runNumber,
        String timestamp,
        List<EnrichedTestResult> enrichedTests,
        StatusChangeTracker tracker
    ) {
        List<TestResult> results = new ArrayList<>();
        for (EnrichedTestResult enriched : enrichedTests) {
            results.add(transformTestResult(enriched, tracker, runNumber));
        }

        TestSummary summary = calculateSummary(results);
        return new TestRun(runNumber, timestamp, summary, results);
    }

    private String mapStatus(TestStatus status) {
        return switch (status) {
            case SUCCESSFUL -> "pass";
            case FAILED -> "fail";
            case ABORTED -> "error";
            case DISABLED -> "skip";
        };
    }

    private String extractFirstLine(String message) {
        if (message == null || message.isEmpty()) {
            return null;
        }

        int newlineIndex = message.indexOf('\n');
        if (newlineIndex >= 0) {
            return message.substring(0, newlineIndex);
        }

        return message;
    }
}
