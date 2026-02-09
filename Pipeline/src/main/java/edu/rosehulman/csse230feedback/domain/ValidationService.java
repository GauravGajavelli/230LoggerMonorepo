package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.model.frontend.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Compares LLM-generated semantic output against narrative expectations.
 */
public class ValidationService {

    public ValidationReport validate(FrontendOutput output, NarrativeSpec spec) {
        List<ValidationReport.ValidationCheck> checks = new ArrayList<>();
        NarrativeSpec.ValidationExpectations expectations = spec.expectations();

        if (expectations == null) {
            checks.add(new ValidationReport.ValidationCheck(
                "config", "expectations", ValidationReport.Status.WARN,
                "non-null", "null", "No expectations defined in narrative spec"));
            return buildReport(spec, checks);
        }

        // Check if semantic data is present
        SemanticLog semanticLog = output.semanticLog();
        boolean hasSemantics = semanticLog != null && semanticLog.entries() != null;

        if (!hasSemantics) {
            checks.add(new ValidationReport.ValidationCheck(
                "data", "semanticLog", ValidationReport.Status.WARN,
                "present", "null",
                "No semantic log present — LLM enrichment may not have run. Pattern/intent checks skipped."));
        }

        // 1. Pattern checks
        if (expectations.detectedPatterns() != null && hasSemantics) {
            checkPatterns(checks, semanticLog, expectations.detectedPatterns());
        }

        // 2. Episode assessment checks
        if (expectations.episodeAssessments() != null) {
            checkEpisodes(checks, output.episodes(), expectations.episodeAssessments());
        }

        // 3. Intent checks
        if (expectations.intents() != null && hasSemantics) {
            checkIntents(checks, semanticLog, expectations.intents());
        }

        // 4. Narrative keyword checks
        if (expectations.narrativeKeywords() != null && hasSemantics) {
            checkKeywords(checks, semanticLog, expectations.narrativeKeywords());
        }

        // 5. Concept checks
        if (expectations.conceptsCovered() != null) {
            checkConcepts(checks, output.episodes(), expectations.conceptsCovered());
        }

        return buildReport(spec, checks);
    }

    private void checkPatterns(List<ValidationReport.ValidationCheck> checks,
                                SemanticLog log,
                                NarrativeSpec.PatternExpectations patterns) {
        List<String> detected = log.detectedPatterns();
        String detectedStr = (detected != null) ? String.join(", ", detected) : "(none)";

        // mustInclude
        if (patterns.mustInclude() != null) {
            for (String required : patterns.mustInclude()) {
                boolean found = detected != null && detected.stream()
                    .anyMatch(p -> containsIgnoreCase(p, required));
                checks.add(new ValidationReport.ValidationCheck(
                    "patterns", "mustInclude: " + required,
                    found ? ValidationReport.Status.PASS : ValidationReport.Status.FAIL,
                    "present in detectedPatterns",
                    detectedStr,
                    null));
            }
        }

        // mustNotInclude
        if (patterns.mustNotInclude() != null) {
            for (String forbidden : patterns.mustNotInclude()) {
                boolean found = detected != null && detected.stream()
                    .anyMatch(p -> containsIgnoreCase(p, forbidden));
                checks.add(new ValidationReport.ValidationCheck(
                    "patterns", "mustNotInclude: " + forbidden,
                    found ? ValidationReport.Status.FAIL : ValidationReport.Status.PASS,
                    "absent from detectedPatterns",
                    detectedStr,
                    null));
            }
        }

        // mayInclude (informational)
        if (patterns.mayInclude() != null) {
            for (String optional : patterns.mayInclude()) {
                boolean found = detected != null && detected.stream()
                    .anyMatch(p -> containsIgnoreCase(p, optional));
                checks.add(new ValidationReport.ValidationCheck(
                    "patterns", "mayInclude: " + optional,
                    found ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                    "optionally in detectedPatterns",
                    detectedStr,
                    null));
            }
        }
    }

    private void checkEpisodes(List<ValidationReport.ValidationCheck> checks,
                                List<Episode> episodes,
                                NarrativeSpec.EpisodeExpectations expectations) {
        if (episodes == null || episodes.isEmpty()) {
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "data", ValidationReport.Status.WARN,
                "episodes present", "0 episodes", null));
            return;
        }

        // Count episode labels and semantics assessments
        Map<String, Integer> labelCounts = new HashMap<>();
        Map<String, Integer> assessmentCounts = new HashMap<>();
        for (Episode ep : episodes) {
            String label = ep.label() != null ? ep.label().toLowerCase() : "unknown";
            labelCounts.merge(label, 1, Integer::sum);

            if (ep.semantics() != null && ep.semantics().progressAssessment() != null) {
                String assessment = ep.semantics().progressAssessment().toLowerCase();
                assessmentCounts.merge(assessment, 1, Integer::sum);
            }
        }

        // Use assessment counts if available, fall back to label counts
        Map<String, Integer> counts = assessmentCounts.isEmpty() ? labelCounts : assessmentCounts;
        String countsStr = counts.entrySet().stream()
            .map(e -> e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining(", "));

        // Dominant check
        if (expectations.dominant() != null) {
            String dominant = counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("none");
            boolean match = containsIgnoreCase(dominant, expectations.dominant());
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "dominant assessment",
                match ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                expectations.dominant(),
                dominant + " (counts: " + countsStr + ")",
                null));
        }

        // Count thresholds
        int stuckCount = countMatching(counts, "stuck");
        int regressingCount = countMatching(counts, "regress");
        int breakthroughCount = countMatching(counts, "breakthrough");
        int productiveCount = countMatching(counts, "productive");

        if (expectations.maxStuckCount() != null) {
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "maxStuckCount",
                stuckCount <= expectations.maxStuckCount()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                "<= " + expectations.maxStuckCount(),
                String.valueOf(stuckCount),
                null));
        }

        if (expectations.maxRegressingCount() != null) {
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "maxRegressingCount",
                regressingCount <= expectations.maxRegressingCount()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                "<= " + expectations.maxRegressingCount(),
                String.valueOf(regressingCount),
                null));
        }

        if (expectations.minBreakthroughCount() != null) {
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "minBreakthroughCount",
                breakthroughCount >= expectations.minBreakthroughCount()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                ">= " + expectations.minBreakthroughCount(),
                String.valueOf(breakthroughCount),
                null));
        }

        if (expectations.minProductiveCount() != null) {
            checks.add(new ValidationReport.ValidationCheck(
                "episodes", "minProductiveCount",
                productiveCount >= expectations.minProductiveCount()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                ">= " + expectations.minProductiveCount(),
                String.valueOf(productiveCount),
                null));
        }
    }

    private void checkIntents(List<ValidationReport.ValidationCheck> checks,
                               SemanticLog log,
                               NarrativeSpec.IntentExpectations expectations) {
        List<SemanticRunEntry> entries = log.entries();
        if (entries == null || entries.isEmpty()) {
            checks.add(new ValidationReport.ValidationCheck(
                "intents", "data", ValidationReport.Status.WARN,
                "entries present", "0 entries", null));
            return;
        }

        // Count intents
        Map<String, Integer> intentCounts = new HashMap<>();
        int total = 0;
        for (SemanticRunEntry entry : entries) {
            if (entry.intent() != null) {
                String intent = entry.intent().toLowerCase();
                intentCounts.merge(intent, 1, Integer::sum);
                total++;
            }
        }

        if (total == 0) {
            checks.add(new ValidationReport.ValidationCheck(
                "intents", "data", ValidationReport.Status.WARN,
                "intent data present", "no intents found", null));
            return;
        }

        String countsStr = intentCounts.entrySet().stream()
            .map(e -> e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining(", "));

        // Dominant intent
        if (expectations.dominant() != null) {
            String dominant = intentCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("none");
            boolean match = containsIgnoreCase(dominant, expectations.dominant());
            checks.add(new ValidationReport.ValidationCheck(
                "intents", "dominant",
                match ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                expectations.dominant(),
                dominant + " (" + countsStr + ")",
                null));
        }

        // Ratio checks
        int extendingCount = countMatching(intentCounts, "extend");
        int debuggingCount = countMatching(intentCounts, "debug");

        if (expectations.minExtendingRatio() != null) {
            double ratio = (double) extendingCount / total;
            checks.add(new ValidationReport.ValidationCheck(
                "intents", "minExtendingRatio",
                ratio >= expectations.minExtendingRatio()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                ">= " + expectations.minExtendingRatio(),
                String.format("%.2f (%d/%d)", ratio, extendingCount, total),
                null));
        }

        if (expectations.maxDebuggingRatio() != null) {
            double ratio = (double) debuggingCount / total;
            checks.add(new ValidationReport.ValidationCheck(
                "intents", "maxDebuggingRatio",
                ratio <= expectations.maxDebuggingRatio()
                    ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                "<= " + expectations.maxDebuggingRatio(),
                String.format("%.2f (%d/%d)", ratio, debuggingCount, total),
                null));
        }
    }

    private void checkKeywords(List<ValidationReport.ValidationCheck> checks,
                                SemanticLog log,
                                List<String> keywords) {
        // Build searchable text from narrative + all entry contexts
        StringBuilder searchText = new StringBuilder();
        if (log.currentNarrative() != null) {
            searchText.append(log.currentNarrative()).append(" ");
        }
        if (log.entries() != null) {
            for (SemanticRunEntry entry : log.entries()) {
                if (entry.narrativeContext() != null) {
                    searchText.append(entry.narrativeContext()).append(" ");
                }
                if (entry.semanticDescription() != null) {
                    searchText.append(entry.semanticDescription()).append(" ");
                }
            }
        }
        String text = searchText.toString().toLowerCase();

        for (String keyword : keywords) {
            boolean found = text.contains(keyword.toLowerCase());
            checks.add(new ValidationReport.ValidationCheck(
                "keywords", keyword,
                found ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                "found in narrative text",
                found ? "found" : "not found",
                null));
        }
    }

    private void checkConcepts(List<ValidationReport.ValidationCheck> checks,
                                List<Episode> episodes,
                                List<String> concepts) {
        // Collect all concepts from episode semantics
        Set<String> allConcepts = new HashSet<>();
        if (episodes != null) {
            for (Episode ep : episodes) {
                if (ep.semantics() != null && ep.semantics().conceptsAddressed() != null) {
                    for (String c : ep.semantics().conceptsAddressed()) {
                        allConcepts.add(c.toLowerCase());
                    }
                }
            }
        }

        String allConceptsStr = allConcepts.isEmpty() ? "(none)" : String.join(", ", allConcepts);

        for (String concept : concepts) {
            boolean found = allConcepts.stream()
                .anyMatch(c -> containsIgnoreCase(c, concept));
            checks.add(new ValidationReport.ValidationCheck(
                "concepts", concept,
                found ? ValidationReport.Status.PASS : ValidationReport.Status.WARN,
                "found in episode concepts",
                allConceptsStr,
                null));
        }
    }

    private ValidationReport buildReport(NarrativeSpec spec,
                                          List<ValidationReport.ValidationCheck> checks) {
        int pass = 0, fail = 0, warn = 0;
        for (var check : checks) {
            switch (check.status()) {
                case PASS -> pass++;
                case FAIL -> fail++;
                case WARN -> warn++;
            }
        }
        return new ValidationReport(spec.id(), spec.name(), checks, pass, fail, warn);
    }

    private static boolean containsIgnoreCase(String text, String search) {
        if (text == null || search == null) return false;
        return text.toLowerCase().contains(search.toLowerCase());
    }

    private static int countMatching(Map<String, Integer> counts, String substring) {
        int total = 0;
        for (var entry : counts.entrySet()) {
            if (containsIgnoreCase(entry.getKey(), substring)) {
                total += entry.getValue();
            }
        }
        return total;
    }
}
