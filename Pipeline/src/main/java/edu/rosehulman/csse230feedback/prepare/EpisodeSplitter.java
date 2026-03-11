package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.TestStatus;
import java.util.*;

public class EpisodeSplitter {

    /**
     * Describes one episode boundary (the span from startRunNumber to endRunNumber).
     * triggeringTestId is the first test whose status changed, causing the boundary.
     * For the final episode, all trigger fields are null.
     */
    public record EpisodeBoundary(
        int startRunNumber,
        int endRunNumber,
        String triggeringTestId,  // test whose status flip ends this episode (null for final)
        String statusBefore,      // "pass" or "fail"
        String statusAfter,       // "pass" or "fail"
        String outcomeType        // "regression" | "fix" | null
    ) {}

    public record RunWithTests(
        int runNumber,
        Long timestampMs,
        String timestamp,
        List<EnrichedTestResult> tests
    ) {}

    /**
     * Constructor kept for backwards compatibility with PrepareService.
     * The idleThresholdMs and categoryShiftWindow params are no longer used —
     * the new algorithm splits on test-outcome boundaries only.
     */
    public EpisodeSplitter(long idleThresholdMs, int categoryShiftWindow) {
        // No-op: new algorithm does not use these parameters
    }

    public EpisodeSplitter() {}

    /**
     * Splits runs into episodes using test-outcome-boundary detection.
     * An episode boundary is created whenever any test's SUCCESSFUL/failing status
     * flips between two consecutive runs.
     */
    public List<EpisodeBoundary> splitIntoEpisodes(List<RunWithTests> runs) {
        if (runs.isEmpty()) {
            return Collections.emptyList();
        }

        if (runs.size() == 1) {
            return List.of(new EpisodeBoundary(
                runs.get(0).runNumber(), runs.get(0).runNumber(),
                null, null, null, null
            ));
        }

        List<EpisodeBoundary> episodes = new ArrayList<>();
        int episodeStart = runs.get(0).runNumber();

        Map<String, TestStatus> previousStatusMap = buildStatusMap(runs.get(0));

        for (int i = 1; i < runs.size(); i++) {
            RunWithTests current = runs.get(i);
            Map<String, TestStatus> currentStatusMap = buildStatusMap(current);

            // Find the first test that flipped status
            String triggeringTestId = null;
            String statusBefore = null;
            String statusAfter = null;
            String outcomeType = null;

            for (Map.Entry<String, TestStatus> entry : currentStatusMap.entrySet()) {
                String testId = entry.getKey();
                TestStatus newStatus = entry.getValue();
                TestStatus prevStatus = previousStatusMap.get(testId);

                if (prevStatus == null) continue; // newly appeared test

                boolean prevPassing = prevStatus == TestStatus.SUCCESSFUL;
                boolean newPassing = newStatus == TestStatus.SUCCESSFUL;

                if (prevPassing != newPassing) {
                    triggeringTestId = testId;
                    statusBefore = prevPassing ? "pass" : "fail";
                    statusAfter = newPassing ? "pass" : "fail";
                    outcomeType = newPassing ? "fix" : "regression";
                    break; // first flip triggers boundary
                }
            }

            if (triggeringTestId != null) {
                episodes.add(new EpisodeBoundary(
                    episodeStart,
                    runs.get(i - 1).runNumber(),
                    triggeringTestId,
                    statusBefore,
                    statusAfter,
                    outcomeType
                ));
                episodeStart = current.runNumber();
            }

            previousStatusMap = currentStatusMap;
        }

        // Final episode (no triggering test)
        episodes.add(new EpisodeBoundary(
            episodeStart,
            runs.get(runs.size() - 1).runNumber(),
            null, null, null, null
        ));

        return episodes;
    }

    private Map<String, TestStatus> buildStatusMap(RunWithTests run) {
        Map<String, TestStatus> map = new LinkedHashMap<>();
        for (EnrichedTestResult test : run.tests()) {
            if (test.testId() != null && test.status() != null) {
                map.put(test.testId(), test.status());
            }
        }
        return map;
    }
}
