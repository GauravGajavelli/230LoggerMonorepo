package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import java.util.*;

public class EpisodeSplitter {

    public record EpisodeBoundary(
        int startRunNumber,
        int endRunNumber,
        String splitReason
    ) {}

    public record RunWithTests(
        int runNumber,
        Long timestampMs,
        String timestamp,
        List<EnrichedTestResult> tests
    ) {}

    private final long idleThresholdMs;
    private final int categoryShiftWindow;
    private final TestCategoryAnalyzer categoryAnalyzer;

    public EpisodeSplitter(long idleThresholdMs, int categoryShiftWindow) {
        this.idleThresholdMs = idleThresholdMs;
        this.categoryShiftWindow = categoryShiftWindow;
        this.categoryAnalyzer = new TestCategoryAnalyzer();
    }

    public List<EpisodeBoundary> splitIntoEpisodes(List<RunWithTests> runs) {
        if (runs.isEmpty()) {
            return Collections.emptyList();
        }

        List<EpisodeBoundary> episodes = new ArrayList<>();
        int episodeStart = runs.get(0).runNumber();

        String previousCategory = null;
        Long previousTimestamp = null;
        int categoryShiftCounter = 0;

        for (int i = 0; i < runs.size(); i++) {
            RunWithTests run = runs.get(i);
            String dominantCategory = categoryAnalyzer.extractDominantCategory(run.tests());

            boolean shouldSplit = false;
            String splitReason = null;

            // Check idle gap trigger
            if (previousTimestamp != null && run.timestampMs() != null) {
                long timeSincePrevious = run.timestampMs() - previousTimestamp;
                if (timeSincePrevious > idleThresholdMs) {
                    shouldSplit = true;
                    long minutes = timeSincePrevious / (60 * 1000);
                    splitReason = String.format("Idle gap: %d minutes", minutes);
                }
            }

            // Check category shift trigger (with persistence window)
            if (!shouldSplit && previousCategory != null && !dominantCategory.equals(previousCategory)) {
                categoryShiftCounter++;
                if (categoryShiftCounter >= categoryShiftWindow) {
                    shouldSplit = true;
                    splitReason = String.format("Category shift: %s → %s", previousCategory, dominantCategory);
                    categoryShiftCounter = 0;
                }
            } else if (previousCategory != null && dominantCategory.equals(previousCategory)) {
                categoryShiftCounter = 0;
            }

            // Create new episode if triggered
            if (shouldSplit && i > 0) {
                episodes.add(new EpisodeBoundary(
                    episodeStart,
                    runs.get(i - 1).runNumber(),
                    splitReason
                ));
                episodeStart = run.runNumber();
            }

            previousCategory = dominantCategory;
            previousTimestamp = run.timestampMs();
        }

        // Add final episode
        episodes.add(new EpisodeBoundary(
            episodeStart,
            runs.get(runs.size() - 1).runNumber(),
            null
        ));

        return episodes;
    }
}
