package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.TestStatus;
import edu.rosehulman.csse230feedback.model.frontend.TimelinePoint;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.*;

/**
 * Generates cumulative timeline data for the timeline chart.
 *
 * Maintains last-known status for each test and emits a TimelinePoint whenever
 * the passing/failing counts change (or at the first and last run).
 * Skips intermediate runs where counts are identical to avoid chart clutter.
 */
public class TimelineGenerator {

    private static final DateTimeFormatter TS_PARSER =
        new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd HH:mm:ss")
            .optionalStart()
            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true)
            .optionalEnd()
            .toFormatter();
    private static final DateTimeFormatter TIME_FMT =
        DateTimeFormatter.ofPattern("h:mm a");

    /**
     * Generates timeline points from a chronological list of runs.
     *
     * @param runs chronologically ordered runs with test results
     * @return list of TimelinePoints suitable for a chart Y-axis
     */
    public List<TimelinePoint> generate(List<EpisodeSplitter.RunWithTests> runs) {
        if (runs.isEmpty()) return Collections.emptyList();

        List<TimelinePoint> points = new ArrayList<>();
        Map<String, TestStatus> lastKnownStatus = new LinkedHashMap<>();

        int prevPassing = -1;
        int prevFailing = -1;

        for (int i = 0; i < runs.size(); i++) {
            EpisodeSplitter.RunWithTests run = runs.get(i);
            boolean isFirst = (i == 0);
            boolean isLast = (i == runs.size() - 1);

            // Detect flips and update last-known status
            List<String> eventParts = new ArrayList<>();
            for (EnrichedTestResult test : run.tests()) {
                if (test.testId() == null || test.status() == null) continue;

                TestStatus prev = lastKnownStatus.get(test.testId());
                TestStatus curr = test.status();

                if (prev != null && prev != curr) {
                    boolean wasPass = prev == TestStatus.SUCCESSFUL;
                    boolean nowPass = curr == TestStatus.SUCCESSFUL;
                    String shortName = shortTestName(test.testId());
                    if (wasPass) {
                        eventParts.add(shortName + " broke");
                    } else if (nowPass) {
                        eventParts.add(shortName + " fixed");
                    }
                }

                lastKnownStatus.put(test.testId(), curr);
            }

            // Count cumulative passing/failing across all ever-seen tests
            int passing = 0, failing = 0;
            for (TestStatus s : lastKnownStatus.values()) {
                if (s == TestStatus.SUCCESSFUL) passing++;
                else failing++;
            }

            boolean countsChanged = (passing != prevPassing || failing != prevFailing);

            if (isFirst || isLast || countsChanged) {
                String event = null;
                if (!eventParts.isEmpty()) {
                    // Report up to 2 events to keep the label short
                    event = String.join("; ", eventParts.subList(0, Math.min(2, eventParts.size())));
                }
                points.add(new TimelinePoint(formatTime(run.timestamp()), passing, failing, event));
                prevPassing = passing;
                prevFailing = failing;
            }
        }

        return points;
    }

    /** Formats a raw timestamp string to "h:mm a" format. */
    private String formatTime(String timestamp) {
        if (timestamp == null) return null;
        try {
            LocalDateTime dt = LocalDateTime.parse(timestamp, TS_PARSER);
            return dt.format(TIME_FMT);
        } catch (DateTimeParseException e) {
            return timestamp;
        }
    }

    /** Extracts the method name from a full testId like "ClassName#methodName()". */
    private String shortTestName(String testId) {
        int hash = testId.indexOf('#');
        if (hash >= 0) {
            String method = testId.substring(hash + 1);
            if (method.endsWith("()")) method = method.substring(0, method.length() - 2);
            return method;
        }
        return testId;
    }
}
