package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmResponse;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.util.Json;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.util.*;

/**
 * Generates natural-language feedback for highlighted (struggling) tests
 * using an LLM call with rich structured context.
 */
public class FeedbackGenerationService {

    private final LlmService llmService;
    private final PromptLoader promptLoader;

    public FeedbackGenerationService(LlmService llmService, PromptLoader promptLoader) {
        this.llmService = llmService;
        this.promptLoader = promptLoader;
    }

    /**
     * Generates feedback for highlighted tests.
     *
     * @param failureHighlights the highlight lists (test IDs)
     * @param testHistories all test histories (we filter to highlighted ones)
     * @param semanticLog semantic enrichment data (nullable)
     * @param testCategories test category mapping (nullable)
     * @param assignmentName assignment name for prompt context
     * @param requestNumber current request number for LLM progress tracking
     * @param totalRequests total expected requests
     * @return list of Feedback records, one per highlighted test
     */
    public List<Feedback> generate(
            FailureHighlights failureHighlights,
            List<TestHistory> testHistories,
            SemanticLog semanticLog,
            TestCategoryMapping testCategories,
            String assignmentName,
            int requestNumber,
            int totalRequests) throws LlmException, IOException {

        // Collect all highlighted test IDs
        Set<String> highlightedIds = new LinkedHashSet<>();
        if (failureHighlights.stillFailing() != null) {
            highlightedIds.addAll(failureHighlights.stillFailing());
        }
        if (failureHighlights.regressions() != null) {
            highlightedIds.addAll(failureHighlights.regressions());
        }
        if (failureHighlights.costlyDetours() != null) {
            highlightedIds.addAll(failureHighlights.costlyDetours());
        }

        if (highlightedIds.isEmpty()) {
            return Collections.emptyList();
        }

        // Build a lookup of test histories by ID
        Map<String, TestHistory> historyMap = new LinkedHashMap<>();
        for (TestHistory th : testHistories) {
            historyMap.put(th.testId(), th);
        }

        // Build input JSON with context per highlighted test
        String inputData = buildInputJson(highlightedIds, historyMap, semanticLog, testCategories);

        // Build narrative context from semantic log
        String narrativeContext = "(no narrative context available)";
        if (semanticLog != null && semanticLog.currentNarrative() != null
                && !semanticLog.currentNarrative().isEmpty()) {
            narrativeContext = semanticLog.currentNarrative();
        }

        // Build test categories summary
        String testCategoriesSummary = buildTestCategoriesSummary(testCategories);

        // Load and fill prompt
        String promptContent = promptLoader.loadAndFill(
            "feedback_generation_prompt.md",
            Map.of(
                "assignment_name", assignmentName != null ? assignmentName : "Unknown",
                "narrative_context", narrativeContext,
                "test_categories", testCategoriesSummary
            )
        );

        // Single LLM call for all highlighted tests
        LlmResponse response = llmService.complete(
            "feedback_generation_prompt.md",
            promptContent,
            inputData,
            "feedback_generation (" + highlightedIds.size() + " tests)",
            requestNumber,
            totalRequests
        );

        // Parse response into Feedback records
        return parseFeedbackResponse(response.content());
    }

    private String buildInputJson(
            Set<String> highlightedIds,
            Map<String, TestHistory> historyMap,
            SemanticLog semanticLog,
            TestCategoryMapping testCategories) throws IOException {

        // Build a map of run -> semantic entry for quick lookup
        Map<Integer, SemanticRunEntry> semanticByRun = new LinkedHashMap<>();
        if (semanticLog != null && semanticLog.entries() != null) {
            for (SemanticRunEntry entry : semanticLog.entries()) {
                semanticByRun.put(entry.run(), entry);
            }
        }

        ArrayNode testsArray = Json.mapper().createArrayNode();

        for (String testId : highlightedIds) {
            TestHistory th = historyMap.get(testId);
            if (th == null) continue;

            ObjectNode testNode = Json.mapper().createObjectNode();
            testNode.put("testId", testId);
            testNode.put("testName", th.testName());
            testNode.put("highlightCategory", th.highlightCategory() != null ? th.highlightCategory() : "unknown");
            testNode.put("totalFailedRuns", th.totalFailedRuns());
            testNode.put("meaningfulnessScore", th.meaningfulnessScore());

            // Categories
            if (th.categories() != null && !th.categories().isEmpty()) {
                ArrayNode catsArray = testNode.putArray("categories");
                th.categories().forEach(catsArray::add);
            }

            // Error evolution
            if (th.errorEvolution() != null && th.errorEvolution().hasData()) {
                ObjectNode evoNode = testNode.putObject("errorEvolution");
                evoNode.put("progressionSummary", th.errorEvolution().progressionSummary());
                evoNode.put("stuckOnSameError", th.errorEvolution().stuckOnSameError());
                evoNode.put("npeCount", th.errorEvolution().npeCount());
                evoNode.put("hadStackOverflow", th.errorEvolution().hadStackOverflow());
                evoNode.put("distinctErrorTypes", th.errorEvolution().distinctErrorTypes());

                // Include last error snapshot
                List<ErrorEvolution.ErrorSnapshot> seq = th.errorEvolution().sequence();
                if (seq != null && !seq.isEmpty()) {
                    ErrorEvolution.ErrorSnapshot last = seq.get(seq.size() - 1);
                    ObjectNode lastError = evoNode.putObject("lastError");
                    lastError.put("run", last.run());
                    if (last.errorType() != null) lastError.put("errorType", last.errorType());
                    if (last.message() != null) {
                        String msg = last.message();
                        if (msg.length() > 200) msg = msg.substring(0, 200) + "...";
                        lastError.put("message", msg);
                    }
                }
            }

            // Struggle profile
            if (th.struggleProfile() != null) {
                ObjectNode struggleNode = testNode.putObject("struggleProfile");
                struggleNode.put("attemptsToFix", th.struggleProfile().attemptsToFix());
                struggleNode.put("distinctStrategies", th.struggleProfile().distinctStrategies());
                struggleNode.put("struggleScore", th.struggleProfile().struggleScore());
                struggleNode.put("wasFixed", th.struggleProfile().wasFixed());
            }

            // Relevant semantic context (runs where this test was failing)
            if (!semanticByRun.isEmpty() && th.statusByRun() != null) {
                ArrayNode semanticHints = testNode.putArray("semanticContext");
                int count = 0;
                for (Map.Entry<Integer, String> runEntry : th.statusByRun().entrySet()) {
                    if (!"pass".equalsIgnoreCase(runEntry.getValue())
                            && !"SUCCESSFUL".equalsIgnoreCase(runEntry.getValue())) {
                        SemanticRunEntry sem = semanticByRun.get(runEntry.getKey());
                        if (sem != null && sem.intent() != null) {
                            ObjectNode hint = Json.mapper().createObjectNode();
                            hint.put("run", runEntry.getKey());
                            hint.put("intent", sem.intent());
                            if (sem.semanticDescription() != null) {
                                String desc = sem.semanticDescription();
                                if (desc.length() > 150) desc = desc.substring(0, 150) + "...";
                                hint.put("description", desc);
                            }
                            semanticHints.add(hint);
                            if (++count >= 5) break; // Limit to avoid token bloat
                        }
                    }
                }
                if (semanticHints.isEmpty()) {
                    testNode.remove("semanticContext");
                }
            }

            testsArray.add(testNode);
        }

        return Json.mapper().writeValueAsString(testsArray);
    }

    private String buildTestCategoriesSummary(TestCategoryMapping testCategories) {
        if (testCategories == null || testCategories.categories() == null
                || testCategories.categories().isEmpty()) {
            return "(no test category mapping available)";
        }

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, TestCategoryMapping.CategoryInfo> entry : testCategories.categories().entrySet()) {
            sb.append("- **").append(entry.getKey()).append("**");
            if (entry.getValue().description() != null) {
                sb.append(": ").append(entry.getValue().description());
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private List<Feedback> parseFeedbackResponse(String responseContent) {
        List<Feedback> feedbackList = new ArrayList<>();

        try {
            String json = extractJson(responseContent);
            JsonNode root = Json.mapper().readTree(json);

            JsonNode feedbackNode = root.has("feedback") ? root.get("feedback") : root;

            if (feedbackNode != null && feedbackNode.isArray()) {
                extractFeedbackItems(feedbackNode, feedbackList);
            }
        } catch (Exception e) {
            // JSON may be truncated — try to salvage complete objects via regex
            System.err.println("Warning: full JSON parse failed, attempting partial recovery: " + e.getMessage());
            extractFeedbackFromPartialJson(responseContent, feedbackList);
        }

        return feedbackList;
    }

    private void extractFeedbackItems(JsonNode feedbackNode, List<Feedback> feedbackList) {
        for (JsonNode item : feedbackNode) {
            String testId = getTextOrNull(item, "testId");
            if (testId == null) continue;

            String pattern = getTextOrNull(item, "pattern");
            String confidence = getTextOrNull(item, "confidence");
            String explanation = getTextOrNull(item, "explanation");

            List<String> nextSteps = new ArrayList<>();
            if (item.has("nextSteps") && item.get("nextSteps").isArray()) {
                for (JsonNode step : item.get("nextSteps")) {
                    nextSteps.add(step.asText());
                }
            }

            feedbackList.add(new Feedback(testId, pattern, confidence, explanation, nextSteps));
        }
    }

    /**
     * Recovers individual feedback objects from truncated JSON by finding
     * complete JSON objects that contain the required "testId" field.
     * Handles pretty-printed JSON where { and "testId" are on separate lines.
     */
    private void extractFeedbackFromPartialJson(String content, List<Feedback> feedbackList) {
        String json = extractJson(content);

        // Find each "testId" occurrence, then walk backwards to the opening brace
        int searchFrom = 0;
        while (searchFrom < json.length()) {
            int testIdPos = json.indexOf("\"testId\"", searchFrom);
            if (testIdPos < 0) break;

            // Walk backwards to find the opening { for this object
            int objStart = -1;
            for (int i = testIdPos - 1; i >= 0; i--) {
                char c = json.charAt(i);
                if (c == '{') { objStart = i; break; }
                if (c != ' ' && c != '\n' && c != '\r' && c != '\t') break;
            }
            if (objStart < 0) { searchFrom = testIdPos + 8; continue; }

            // Find the matching closing brace by counting braces
            int depth = 0;
            int objEnd = -1;
            boolean inString = false;
            boolean escaped = false;
            for (int i = objStart; i < json.length(); i++) {
                char c = json.charAt(i);
                if (escaped) { escaped = false; continue; }
                if (c == '\\') { escaped = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) { objEnd = i + 1; break; }
                }
            }

            if (objEnd < 0) break; // Incomplete object — stop

            try {
                String objStr = json.substring(objStart, objEnd);
                JsonNode item = Json.mapper().readTree(objStr);
                String testId = getTextOrNull(item, "testId");
                if (testId != null) {
                    String pattern = getTextOrNull(item, "pattern");
                    String confidence = getTextOrNull(item, "confidence");
                    String explanation = getTextOrNull(item, "explanation");

                    List<String> nextSteps = new ArrayList<>();
                    if (item.has("nextSteps") && item.get("nextSteps").isArray()) {
                        for (JsonNode step : item.get("nextSteps")) {
                            nextSteps.add(step.asText());
                        }
                    }

                    feedbackList.add(new Feedback(testId, pattern, confidence, explanation, nextSteps));
                }
            } catch (Exception ignored) {
                // Skip malformed object
            }

            searchFrom = objEnd;
        }

        if (!feedbackList.isEmpty()) {
            System.out.println("Recovered " + feedbackList.size() + " feedback items from truncated response");
        }
    }

    private static String extractJson(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline >= 0) {
                // Look for closing fence after the first line
                int lastFence = trimmed.lastIndexOf("```");
                if (lastFence > firstNewline) {
                    return trimmed.substring(firstNewline + 1, lastFence).trim();
                }
                // No closing fence (truncated response) — strip just the opening
                return trimmed.substring(firstNewline + 1).trim();
            }
        }
        return trimmed;
    }

    private static String getTextOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
