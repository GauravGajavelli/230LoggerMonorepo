package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.model.frontend.Feedback;
import edu.rosehulman.csse230feedback.model.frontend.TestHistory;

import java.util.*;
import java.util.regex.*;

/**
 * Validates LLM-generated feedback text against ground-truth TestHistory data.
 *
 * Run after both the generation and refinement passes. Reports violations as
 * warnings so the pipeline can still complete, but operators see exactly which
 * factual claims the model got wrong.
 *
 * Two rules are enforced:
 *
 *   1. Linger consistency — if the test was eventually fixed (isLingeringFailure=false),
 *      the explanation must not contain phrases that imply it is still failing, and
 *      vice versa.
 *
 *   2. Run-number plausibility — every run number explicitly cited in the explanation
 *      must fall within the test's actual recorded run range. A mention of "run 40"
 *      for a test whose last recorded run is 9 is almost certainly a hallucination.
 */
public class FeedbackFactChecker {

    public record Violation(String testId, String rule, String detail) {}

    // Phrases that unambiguously imply the test is currently failing —
    // checked against the FULL explanation text. These cannot legitimately
    // refer to a past struggle period.
    private static final List<String> ALWAYS_WRONG_STILL_FAILING = List.of(
        "never passed",
        "has not passed",
        "has not been fixed",
        "is still failing",
        "remains failing"
    );

    // Phrases that are only wrong when they appear in the FINAL SENTENCE
    // of the explanation (where the model states its overall conclusion).
    // They are legitimate when describing a bounded historical period
    // (e.g., "remained failing through runs 4–8").
    private static final List<String> CONCLUSION_STILL_FAILING = List.of(
        "continues to fail",
        "continued to fail",
        "still failing",
        "still fails",
        "remained failing",
        "did not pass",
        "failed through run",
        "continued failing"
    );

    // Phrases that unambiguously imply the test was fixed —
    // checked against the full explanation text.
    private static final List<String> ALWAYS_WRONG_NOW_PASSING = List.of(
        "the test now passes",
        "is now passing",
        "has been fixed",
        "successfully fixed",
        "test passes now"
    );

    private static final Pattern RUN_PATTERN =
        Pattern.compile("\\brun (\\d+)\\b", Pattern.CASE_INSENSITIVE);

    /** Returns the text of the last sentence in the explanation (lowercase). */
    private static String lastSentence(String explLower) {
        // Split on sentence-ending punctuation followed by whitespace or end-of-string
        String[] sentences = explLower.split("(?<=[.!?])\\s+");
        return sentences.length > 0 ? sentences[sentences.length - 1].trim() : explLower;
    }

    /** Returns the first phrase from the list found in text, or null. */
    private static String firstMatch(String text, List<String> phrases) {
        for (String phrase : phrases) {
            if (text.contains(phrase)) return phrase;
        }
        return null;
    }

    /**
     * Checks each feedback item's explanation against its corresponding TestHistory.
     *
     * @return list of violations (empty means all clear)
     */
    public List<Violation> check(List<Feedback> feedbacks, List<TestHistory> testHistories) {
        Map<String, TestHistory> historyMap = new LinkedHashMap<>();
        for (TestHistory h : testHistories) {
            historyMap.put(h.testId(), h);
        }

        List<Violation> violations = new ArrayList<>();

        for (Feedback fb : feedbacks) {
            if (fb.explanation() == null) continue;
            TestHistory history = historyMap.get(fb.testId());
            if (history == null) continue;

            String explLower = fb.explanation().toLowerCase();
            String lastSentence = lastSentence(explLower);

            // Rule 1a: test was fixed — explanation must not imply it is still failing.
            // Unambiguous phrases are checked in the full text; context-sensitive phrases
            // only in the final sentence, where the model states its overall conclusion.
            if (!history.isLingeringFailure()) {
                String hit = firstMatch(explLower, ALWAYS_WRONG_STILL_FAILING);
                if (hit == null) hit = firstMatch(lastSentence, CONCLUSION_STILL_FAILING);
                if (hit != null) {
                    violations.add(new Violation(fb.testId(), "linger-consistency",
                        "isLingeringFailure=false but explanation contains \""
                            + hit + "\" (test is currently passing)"));
                }
            }

            // Rule 1b: test is still failing — explanation must not imply it was fixed.
            if (history.isLingeringFailure()) {
                String hit = firstMatch(explLower, ALWAYS_WRONG_NOW_PASSING);
                if (hit != null) {
                    violations.add(new Violation(fb.testId(), "linger-consistency",
                        "isLingeringFailure=true but explanation contains \""
                            + hit + "\" (test is currently failing)"));
                }
            }

            // Rule 2: run numbers mentioned must be within the test's actual run range
            if (history.statusByRun() != null && !history.statusByRun().isEmpty()) {
                int maxActualRun = Collections.max(history.statusByRun().keySet());
                Matcher m = RUN_PATTERN.matcher(fb.explanation());
                Set<Integer> flagged = new HashSet<>();
                while (m.find()) {
                    int mentioned = Integer.parseInt(m.group(1));
                    if (mentioned > maxActualRun && flagged.add(mentioned)) {
                        violations.add(new Violation(fb.testId(), "run-plausibility",
                            "Explanation references run " + mentioned
                                + " but test's last known run is " + maxActualRun));
                    }
                }
            }
        }

        return violations;
    }
}
