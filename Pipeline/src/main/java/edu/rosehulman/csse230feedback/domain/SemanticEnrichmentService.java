package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmResponse;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.DiffCategoryMapping;
import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.prepare.EpisodeSplitter;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.IOException;
import java.util.*;

public class SemanticEnrichmentService {

    private static final int TOKEN_BUDGET = 4000;
    private static final int MAX_DIFF_CHARS = 1500;

    private final LlmService llmService;
    private final PromptLoader promptLoader;

    public SemanticEnrichmentService(LlmService llmService, PromptLoader promptLoader) {
        this.llmService = llmService;
        this.promptLoader = promptLoader;
    }

    public record SemanticEnrichmentResult(
        SemanticLog semanticLog,
        Map<String, EpisodeSemantics> episodeSemantics
    ) {}

    /**
     * Backward-compatible overload without diff data or test categories.
     */
    public SemanticEnrichmentResult enrich(
            List<EpisodeSplitter.RunWithTests> runsWithTests,
            List<Episode> episodes,
            String assignmentName) throws LlmException, IOException {
        return enrich(runsWithTests, episodes, assignmentName, null, null, null);
    }

    /**
     * Backward-compatible overload without test categories.
     */
    public SemanticEnrichmentResult enrich(
            List<EpisodeSplitter.RunWithTests> runsWithTests,
            List<Episode> episodes,
            String assignmentName,
            DiffCategoryMapping diffCategories,
            Map<Integer, String> patchesByRun) throws LlmException, IOException {
        return enrich(runsWithTests, episodes, assignmentName, diffCategories, patchesByRun, null);
    }

    public SemanticEnrichmentResult enrich(
            List<EpisodeSplitter.RunWithTests> runsWithTests,
            List<Episode> episodes,
            String assignmentName,
            DiffCategoryMapping diffCategories,
            Map<Integer, String> patchesByRun,
            TestCategoryMapping testCategories) throws LlmException, IOException {

        // Pre-compute structural signals (passCountDelta, failCountDelta, newCategories)
        Map<Integer, RunSignals> signalsByRun = computeRunSignals(runsWithTests, testCategories);

        // Build test categories summary string for prompt injection
        String testCategoriesSummary = buildTestCategoriesSummary(testCategories);

        // Form batches of runs within token budget
        List<List<EpisodeSplitter.RunWithTests>> batches = formBatches(runsWithTests, patchesByRun, diffCategories);
        int totalBatches = batches.size();

        List<SemanticRunEntry> allEntries = new ArrayList<>();
        List<String> allPatterns = new ArrayList<>();
        String currentNarrative = "";

        // Seed first batch narrative with assignment structure if test categories available
        String firstBatchNarrative = "(first batch)";
        if (testCategories != null && testCategories.categories() != null && !testCategories.categories().isEmpty()) {
            StringBuilder sb = new StringBuilder("This is a ");
            sb.append(assignmentName != null ? assignmentName : "programming");
            sb.append(" assignment with ").append(testCategories.categories().size()).append(" test categories: ");
            sb.append(String.join(", ", testCategories.categories().keySet()));
            sb.append(". The student builds functionality incrementally across these categories.");
            firstBatchNarrative = sb.toString();
        }

        // Process each batch
        for (int i = 0; i < totalBatches; i++) {
            List<EpisodeSplitter.RunWithTests> batch = batches.get(i);

            String inputData = formatBatchAsJson(batch, diffCategories, patchesByRun, signalsByRun);
            String promptContent = promptLoader.loadAndFill(
                "semantic_enrichment_prompt.md",
                Map.of(
                    "assignment_name", assignmentName != null ? assignmentName : "Unknown",
                    "batch_number", String.valueOf(i + 1),
                    "total_batches", String.valueOf(totalBatches),
                    "narrative_so_far", currentNarrative.isEmpty() ? firstBatchNarrative : currentNarrative,
                    "test_status_summary", buildTestStatusSummary(batch),
                    "test_categories", testCategoriesSummary
                )
            );

            LlmResponse response = llmService.complete(
                "semantic_enrichment_prompt.md",
                promptContent,
                inputData,
                "semantic_enrichment batch=" + (i + 1) + "/" + totalBatches,
                i + 1,
                totalBatches + 1  // +1 for episode summary call
            );

            // Parse response
            BatchResult batchResult = parseBatchResponse(response.content());
            allEntries.addAll(batchResult.entries);
            if (batchResult.narrativeUpdate != null && !batchResult.narrativeUpdate.isEmpty()) {
                currentNarrative = batchResult.narrativeUpdate;
            }
            if (batchResult.detectedPatterns != null) {
                for (String p : batchResult.detectedPatterns) {
                    if (!allPatterns.contains(p)) {
                        allPatterns.add(p);
                    }
                }
            }
        }

        SemanticLog semanticLog = new SemanticLog(allEntries, currentNarrative, allPatterns);

        // Episode summarization
        Map<String, EpisodeSemantics> episodeSemantics = summarizeEpisodes(
            semanticLog, episodes, totalBatches + 1, testCategoriesSummary
        );

        return new SemanticEnrichmentResult(semanticLog, episodeSemantics);
    }

    /**
     * Pre-computed structural signals for a single run.
     */
    record RunSignals(int passCountDelta, int failCountDelta, List<String> newCategories) {}

    /**
     * Computes passCountDelta, failCountDelta, and newCategories for each run
     * by comparing against the previous run's test results.
     */
    private Map<Integer, RunSignals> computeRunSignals(
            List<EpisodeSplitter.RunWithTests> runs,
            TestCategoryMapping testCategories) {

        Map<Integer, RunSignals> signals = new LinkedHashMap<>();
        Set<String> previouslyPassingTests = new HashSet<>();
        Set<String> previouslyPassedCategories = new HashSet<>();

        for (int i = 0; i < runs.size(); i++) {
            EpisodeSplitter.RunWithTests run = runs.get(i);
            Set<String> currentPassing = new HashSet<>();
            for (EnrichedTestResult test : run.tests()) {
                if ("SUCCESSFUL".equals(test.status().name())) {
                    currentPassing.add(test.testId());
                }
            }

            if (i == 0) {
                // First run: everything is "new"
                int passCount = currentPassing.size();
                List<String> newCats = new ArrayList<>();
                if (testCategories != null) {
                    Set<String> catsInThisRun = new HashSet<>();
                    for (String testId : currentPassing) {
                        catsInThisRun.addAll(testCategories.getCategoriesForTest(testId));
                    }
                    newCats.addAll(catsInThisRun);
                    previouslyPassedCategories.addAll(catsInThisRun);
                }
                signals.put(run.runNumber(), new RunSignals(passCount, 0, newCats));
            } else {
                // Compute deltas vs previous run
                int newlyPassing = 0;
                int newlyFailing = 0;

                for (String testId : currentPassing) {
                    if (!previouslyPassingTests.contains(testId)) {
                        newlyPassing++;
                    }
                }
                for (String testId : previouslyPassingTests) {
                    if (!currentPassing.contains(testId)) {
                        newlyFailing++;
                    }
                }

                List<String> newCats = new ArrayList<>();
                if (testCategories != null) {
                    Set<String> catsInThisRun = new HashSet<>();
                    for (String testId : currentPassing) {
                        catsInThisRun.addAll(testCategories.getCategoriesForTest(testId));
                    }
                    for (String cat : catsInThisRun) {
                        if (!previouslyPassedCategories.contains(cat)) {
                            newCats.add(cat);
                        }
                    }
                    previouslyPassedCategories.addAll(catsInThisRun);
                }

                signals.put(run.runNumber(), new RunSignals(newlyPassing, newlyFailing, newCats));
            }

            previouslyPassingTests = currentPassing;
        }

        return signals;
    }

    /**
     * Builds a human-readable summary of test categories for prompt injection.
     */
    private String buildTestCategoriesSummary(TestCategoryMapping testCategories) {
        if (testCategories == null || testCategories.categories() == null || testCategories.categories().isEmpty()) {
            return "(no test category mapping available)";
        }

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, TestCategoryMapping.CategoryInfo> entry : testCategories.categories().entrySet()) {
            sb.append("- **").append(entry.getKey()).append("**");
            if (entry.getValue().description() != null) {
                sb.append(": ").append(entry.getValue().description());
            }
            if (entry.getValue().tests() != null && !entry.getValue().tests().isEmpty()) {
                sb.append(" (tests: ").append(String.join(", ", entry.getValue().tests())).append(")");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private List<List<EpisodeSplitter.RunWithTests>> formBatches(
            List<EpisodeSplitter.RunWithTests> runs,
            Map<Integer, String> patchesByRun,
            DiffCategoryMapping diffCategories) {
        List<List<EpisodeSplitter.RunWithTests>> batches = new ArrayList<>();
        List<EpisodeSplitter.RunWithTests> currentBatch = new ArrayList<>();
        int currentTokenEstimate = 0;

        for (EpisodeSplitter.RunWithTests run : runs) {
            int runTokens = estimateRunTokens(run, patchesByRun, diffCategories);
            if (!currentBatch.isEmpty() && currentTokenEstimate + runTokens > TOKEN_BUDGET) {
                batches.add(currentBatch);
                currentBatch = new ArrayList<>();
                currentTokenEstimate = 0;
            }
            currentBatch.add(run);
            currentTokenEstimate += runTokens;
        }
        if (!currentBatch.isEmpty()) {
            batches.add(currentBatch);
        }
        return batches;
    }

    private int estimateRunTokens(EpisodeSplitter.RunWithTests run,
                                   Map<Integer, String> patchesByRun,
                                   DiffCategoryMapping diffCategories) {
        int chars = 80; // run header overhead (run number, timestamp, structural signals, JSON structure)
        for (EnrichedTestResult test : run.tests()) {
            chars += 30; // test name
            if (test.cause() != null) chars += test.cause().length();
            if (test.exceptionType() != null) chars += test.exceptionType().length();
            if (test.message() != null) chars += test.message().length();
        }
        // Account for diff text (truncated to MAX_DIFF_CHARS)
        if (patchesByRun != null) {
            String diff = patchesByRun.get(run.runNumber());
            if (diff != null) {
                chars += Math.min(diff.length(), MAX_DIFF_CHARS);
            }
        }
        // Account for diff category labels
        if (diffCategories != null) {
            List<String> cats = diffCategories.getCategoriesForRun(run.runNumber());
            for (String cat : cats) {
                chars += cat.length() + 5; // label + JSON overhead (quotes, comma)
            }
        }
        return chars / 4; // ~4 chars per token
    }

    private String formatBatchAsJson(List<EpisodeSplitter.RunWithTests> batch,
                                      DiffCategoryMapping diffCategories,
                                      Map<Integer, String> patchesByRun,
                                      Map<Integer, RunSignals> signalsByRun) throws IOException {
        ArrayNode runsArray = Json.mapper().createArrayNode();
        for (EpisodeSplitter.RunWithTests run : batch) {
            ObjectNode runNode = Json.mapper().createObjectNode();
            runNode.put("run", run.runNumber());
            runNode.put("timestamp", run.timestamp());

            // Include structural signals
            RunSignals signals = signalsByRun.get(run.runNumber());
            if (signals != null) {
                runNode.put("passCountDelta", signals.passCountDelta());
                runNode.put("failCountDelta", signals.failCountDelta());
                if (!signals.newCategories().isEmpty()) {
                    ArrayNode newCatsArray = runNode.putArray("newCategories");
                    signals.newCategories().forEach(newCatsArray::add);
                }
            }

            // Include diff categories if available
            if (diffCategories != null) {
                List<String> cats = diffCategories.getCategoriesForRun(run.runNumber());
                if (!cats.isEmpty()) {
                    ArrayNode catsArray = runNode.putArray("diff_categories");
                    cats.forEach(catsArray::add);
                }
            }

            // Include code diff if available (truncated)
            if (patchesByRun != null) {
                String diff = patchesByRun.get(run.runNumber());
                if (diff != null && !diff.isEmpty()) {
                    if (diff.length() > MAX_DIFF_CHARS) {
                        diff = diff.substring(0, MAX_DIFF_CHARS) + "\n... (truncated)";
                    }
                    runNode.put("diff", diff);
                }
            }

            ArrayNode testsArray = runNode.putArray("tests");
            for (EnrichedTestResult test : run.tests()) {
                ObjectNode testNode = Json.mapper().createObjectNode();
                testNode.put("testId", test.testId());
                testNode.put("status", test.status().name());
                if (test.cause() != null) testNode.put("cause", test.cause());
                if (test.exceptionType() != null) testNode.put("exceptionType", test.exceptionType());
                if (test.message() != null) testNode.put("message", test.message());
                testsArray.add(testNode);
            }
            runsArray.add(runNode);
        }
        return Json.mapper().writeValueAsString(runsArray);
    }

    private String buildTestStatusSummary(List<EpisodeSplitter.RunWithTests> batch) {
        int totalTests = 0;
        int passing = 0;
        int failing = 0;
        Set<String> failingTests = new LinkedHashSet<>();

        for (EpisodeSplitter.RunWithTests run : batch) {
            for (EnrichedTestResult test : run.tests()) {
                totalTests++;
                if ("SUCCESSFUL".equals(test.status().name())) {
                    passing++;
                } else {
                    failing++;
                    failingTests.add(test.testId());
                }
            }
        }
        return String.format("%d total test executions, %d passing, %d failing. Failing tests: %s",
            totalTests, passing, failing, String.join(", ", failingTests));
    }

    private record BatchResult(
        List<SemanticRunEntry> entries,
        String narrativeUpdate,
        List<String> detectedPatterns
    ) {}

    private BatchResult parseBatchResponse(String responseContent) {
        List<SemanticRunEntry> entries = new ArrayList<>();
        String narrativeUpdate = "";
        List<String> detectedPatterns = new ArrayList<>();

        try {
            // Extract JSON from response (may be wrapped in markdown code blocks)
            String json = extractJson(responseContent);
            JsonNode root = Json.mapper().readTree(json);

            // Parse runs array
            JsonNode runsNode = root.get("runs");
            if (runsNode != null && runsNode.isArray()) {
                for (JsonNode runNode : runsNode) {
                    int run = runNode.get("run").asInt();

                    List<String> diffCategories = null;
                    if (runNode.has("diff_categories")) {
                        diffCategories = Json.mapper().convertValue(
                            runNode.get("diff_categories"), new TypeReference<>() {});
                    }

                    String semanticDescription = getTextOrNull(runNode, "semantic_description");
                    String narrativeContext = getTextOrNull(runNode, "narrative_context");
                    String intent = getTextOrNull(runNode, "intent");

                    entries.add(new SemanticRunEntry(
                        run, diffCategories, semanticDescription,
                        narrativeContext, intent
                    ));
                }
            }

            // Parse narrative_update
            if (root.has("narrative_update")) {
                narrativeUpdate = root.get("narrative_update").asText();
            }

            // Parse detected_patterns
            if (root.has("detected_patterns") && root.get("detected_patterns").isArray()) {
                detectedPatterns = Json.mapper().convertValue(
                    root.get("detected_patterns"), new TypeReference<>() {});
            }
        } catch (Exception e) {
            System.err.println("Warning: failed to parse semantic enrichment response: " + e.getMessage());
            // Return empty result rather than failing
        }

        return new BatchResult(entries, narrativeUpdate, detectedPatterns);
    }

    private Map<String, EpisodeSemantics> summarizeEpisodes(
            SemanticLog semanticLog, List<Episode> episodes,
            int requestNumber, String testCategoriesSummary) throws LlmException, IOException {

        // Build episode boundaries JSON
        ArrayNode episodeBoundaries = Json.mapper().createArrayNode();
        for (Episode ep : episodes) {
            ObjectNode epNode = Json.mapper().createObjectNode();
            epNode.put("id", ep.id());
            epNode.put("label", ep.label());
            epNode.put("startTime", ep.startTime());
            epNode.put("endTime", ep.endTime());
            epNode.put("dominantCategory", ep.dominantCategory());
            episodeBoundaries.add(epNode);
        }

        String semanticLogJson = Json.mapper().writeValueAsString(semanticLog);
        String episodeBoundariesJson = Json.mapper().writeValueAsString(episodeBoundaries);

        String promptContent = promptLoader.loadAndFill(
            "episode_summary_prompt.md",
            Map.of(
                "semantic_log_json", semanticLogJson,
                "episode_boundaries", episodeBoundariesJson,
                "test_categories_summary", testCategoriesSummary
            )
        );

        LlmResponse response = llmService.complete(
            "episode_summary_prompt.md",
            promptContent,
            episodeBoundariesJson,
            "episode_summary",
            requestNumber,
            requestNumber  // last request
        );

        return parseEpisodeSummaryResponse(response.content());
    }

    private Map<String, EpisodeSemantics> parseEpisodeSummaryResponse(String responseContent) {
        Map<String, EpisodeSemantics> result = new LinkedHashMap<>();

        try {
            String json = extractJson(responseContent);
            JsonNode root = Json.mapper().readTree(json);

            JsonNode episodesNode = root.has("episodes") ? root.get("episodes") : root;

            if (episodesNode.isArray()) {
                for (JsonNode epNode : episodesNode) {
                    String id = getTextOrNull(epNode, "id");
                    if (id == null) continue;

                    String summary = getTextOrNull(epNode, "summary");
                    String dominantIntent = getTextOrNull(epNode, "dominant_intent");

                    List<String> conceptsAddressed = null;
                    if (epNode.has("concepts_addressed")) {
                        conceptsAddressed = Json.mapper().convertValue(
                            epNode.get("concepts_addressed"), new TypeReference<>() {});
                    }

                    String progressAssessment = getTextOrNull(epNode, "progress_assessment");

                    result.put(id, new EpisodeSemantics(
                        summary, dominantIntent, conceptsAddressed, progressAssessment
                    ));
                }
            } else if (episodesNode.isObject()) {
                // Handle map-style response: { "episode-1": {...}, ... }
                var fields = episodesNode.fields();
                while (fields.hasNext()) {
                    var entry = fields.next();
                    String id = entry.getKey();
                    JsonNode epNode = entry.getValue();

                    String summary = getTextOrNull(epNode, "summary");
                    String dominantIntent = getTextOrNull(epNode, "dominant_intent");

                    List<String> conceptsAddressed = null;
                    if (epNode.has("concepts_addressed")) {
                        conceptsAddressed = Json.mapper().convertValue(
                            epNode.get("concepts_addressed"), new TypeReference<>() {});
                    }

                    String progressAssessment = getTextOrNull(epNode, "progress_assessment");

                    result.put(id, new EpisodeSemantics(
                        summary, dominantIntent, conceptsAddressed, progressAssessment
                    ));
                }
            }
        } catch (Exception e) {
            System.err.println("Warning: failed to parse episode summary response: " + e.getMessage());
        }

        return result;
    }

    private static String extractJson(String content) {
        // Strip markdown code fences if present
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline) {
                return trimmed.substring(firstNewline + 1, lastFence).trim();
            }
        }
        return trimmed;
    }

    private static String getTextOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
