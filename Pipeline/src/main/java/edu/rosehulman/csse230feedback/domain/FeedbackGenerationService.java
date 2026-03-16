package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmResponse;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.CourseContext;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.prepare.StatusChangeTracker;
import edu.rosehulman.csse230feedback.util.Json;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.util.*;

/**
 * Generates natural-language feedback for highlighted (struggling) tests
 * using an LLM call with rich structured context, including code diffs.
 */
public class FeedbackGenerationService {

    private final LlmService llmService;
    private final PromptLoader promptLoader;
    private final boolean includeErrorMessages;

    public FeedbackGenerationService(LlmService llmService, PromptLoader promptLoader) {
        this(llmService, promptLoader, false);
    }

    public FeedbackGenerationService(LlmService llmService, PromptLoader promptLoader,
                                     boolean includeErrorMessages) {
        this.llmService = llmService;
        this.promptLoader = promptLoader;
        this.includeErrorMessages = includeErrorMessages;
    }

    /**
     * Generates feedback for highlighted tests.
     *
     * @param failureHighlights the highlight lists (test IDs)
     * @param testHistories all test histories (we filter to highlighted ones)
     * @param semanticLog semantic enrichment data (nullable)
     * @param testCategories test category mapping (nullable)
     * @param assignmentName assignment name for prompt context
     * @param courseContext course context for forward-looking nextSteps (nullable)
     * @param patchesByRunByFile runNumber → (fileKey → patchText) for code diff context
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
            CourseContext courseContext,
            Map<Integer, Map<String, String>> patchesByRunByFile,
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
        if (failureHighlights.sustainedStruggles() != null) {
            highlightedIds.addAll(failureHighlights.sustainedStruggles());
        }

        if (highlightedIds.isEmpty()) {
            return Collections.emptyList();
        }

        // Build a lookup of test histories by ID
        Map<String, TestHistory> historyMap = new LinkedHashMap<>();
        for (TestHistory th : testHistories) {
            historyMap.put(th.testId(), th);
        }

        // Build diffs per test (from patches)
        Map<String, List<DiffEntry>> diffsPerTest = buildDiffsPerTest(
            highlightedIds, historyMap, patchesByRunByFile, testHistories
        );

        // Pre-group: collapse related tests (≥2 shared diff runs) to one primary per group.
        // This happens BEFORE the LLM call so freed budget slots go to other candidates.
        PreGroupResult preGroup = preGroupHighlights(highlightedIds, diffsPerTest);
        Set<String> effectiveIds = preGroup.effectiveIds();
        Map<String, List<String>> primaryToRelated = preGroup.primaryToRelated();

        if (preGroup.hasGroups()) {
            System.out.println("Pre-grouping: " + highlightedIds.size() + " highlighted → "
                + effectiveIds.size() + " effective (after collapsing "
                + preGroup.groupCount() + " group(s))");
        }

        // Build input JSON with context per effective (primary) test
        String inputData = buildInputJson(effectiveIds, historyMap, semanticLog, testCategories,
            courseContext, diffsPerTest, primaryToRelated);

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

        // Single LLM call for all highlighted tests — use Opus for richer explanations
        LlmResponse response = llmService.complete(
            "feedback_generation_prompt.md",
            promptContent,
            inputData,
            "feedback_generation (" + highlightedIds.size() + " tests)",
            requestNumber,
            totalRequests,
            "claude-opus-4-6"
        );

        // Parse response into Feedback records (includes per-diff notes)
        ParseResult parseResult = parseFeedbackResponse(response.content());
        List<Feedback> feedbackList = parseResult.feedbackList();
        Map<String, List<String>> diffNotesByTestId = parseResult.diffNotes();

        // Attach pre-built diffs (annotated with LLM notes) and relatedTestIds to each Feedback item
        return feedbackList.stream()
            .map(fb -> {
                List<DiffEntry> rawDiffs = diffsPerTest.get(fb.testId());
                List<DiffEntry> annotated = annotateDiffs(rawDiffs, diffNotesByTestId.get(fb.testId()));
                List<String> related = primaryToRelated.get(fb.testId());
                return new Feedback(
                    fb.testId(), fb.pattern(), fb.confidence(), fb.explanation(), fb.nextSteps(),
                    (annotated != null && !annotated.isEmpty()) ? annotated : fb.diffs(),
                    (related != null && !related.isEmpty()) ? related : null,
                    null, null
                );
            })
            .toList();
    }

    /**
     * Backwards-compatible overload without patchesByRunByFile or courseContext.
     */
    public List<Feedback> generate(
            FailureHighlights failureHighlights,
            List<TestHistory> testHistories,
            SemanticLog semanticLog,
            TestCategoryMapping testCategories,
            String assignmentName,
            int requestNumber,
            int totalRequests) throws LlmException, IOException {
        return generate(failureHighlights, testHistories, semanticLog, testCategories,
                        assignmentName, null, Collections.emptyMap(), requestNumber, totalRequests);
    }

    /**
     * Builds DiffEntry objects per test by parsing the custom patch format
     * for runs where each test's status changed.
     */
    private Map<String, List<DiffEntry>> buildDiffsPerTest(
            Set<String> highlightedIds,
            Map<String, TestHistory> historyMap,
            Map<Integer, Map<String, String>> patchesByRunByFile,
            List<TestHistory> allHistories) {

        Map<String, List<DiffEntry>> result = new LinkedHashMap<>();
        if (patchesByRunByFile == null || patchesByRunByFile.isEmpty()) return result;

        // Build a map of runNumber → timestamp from all histories
        // (we can derive timestamps from the run numbers if we have RunRecord data)
        // Since we don't have timestamps here, we'll derive labels from run numbers
        Map<Integer, String> runTimestamps = new LinkedHashMap<>();

        for (String testId : highlightedIds) {
            TestHistory th = historyMap.get(testId);
            if (th == null || th.statusByRun() == null) continue;

            // Find runs where this test's status changed
            Map<Integer, String> statusByRun = th.statusByRun();
            List<Integer> sortedRuns = new ArrayList<>(statusByRun.keySet());
            Collections.sort(sortedRuns);

            List<DiffEntry> diffs = new ArrayList<>();
            String prevStatus = null;

            for (int runNumber : sortedRuns) {
                String currentStatus = statusByRun.get(runNumber);

                if (prevStatus != null && !prevStatus.equals(currentStatus)) {
                    // Status changed at this run — look for implementation patches
                    Map<String, String> runPatches = patchesByRunByFile.get(runNumber);
                    if (runPatches != null) {
                        for (Map.Entry<String, String> patchEntry : runPatches.entrySet()) {
                            String fileKey = patchEntry.getKey();
                            // Only include implementation files, not test files
                            if (!isTestFile(fileKey)) {
                                String patchText = patchEntry.getValue();
                                String fileName = extractFileName(fileKey);
                                String label = "Run " + runNumber + " — " + fileName;
                                DiffEntry entry = parsePatchToDiffEntry(label, patchText);
                                if (entry != null) {
                                    diffs.add(entry);
                                }
                            }
                        }
                    }
                }

                prevStatus = currentStatus;
            }

            if (!diffs.isEmpty()) {
                result.put(testId, diffs);
            }
        }

        return result;
    }

    /**
     * Returns true if the fileKey belongs to a test file (not the implementation).
     */
    private boolean isTestFile(String fileKey) {
        return fileKey.contains("Testing") || fileKey.contains("Test.java");
    }

    /**
     * Extracts the filename from a fileKey like "BinarySearchTree.java.BinarySearchTree".
     */
    private String extractFileName(String fileKey) {
        int dotJava = fileKey.indexOf(".java");
        if (dotJava >= 0) {
            return fileKey.substring(0, dotJava + 5); // include ".java"
        }
        return fileKey;
    }

    /**
     * Parses the custom DiffReplayer patch format into a DiffEntry.
     * Format: N; (delta count), then for each delta: TYPE, srcPos,tgtPos,
     * srcCount, src lines, tgtCount, tgt lines.
     *
     * Returns null if the patch is empty, "File created!", or "File too large!".
     */
    private DiffEntry parsePatchToDiffEntry(String label, String patchText) {
        if (patchText == null || patchText.trim().isEmpty()) return null;

        String[] lines = patchText.split("\n", -1);
        if (lines.length == 0) return null;

        String firstLine = lines[0].trim();
        if ("File created!".equals(firstLine) || "File too large!".equals(firstLine)) {
            return null;
        }

        List<String> before = new ArrayList<>();
        List<String> after = new ArrayList<>();

        try {
            // Parse delta count from "N;" header
            String header = firstLine.endsWith(";")
                ? firstLine.substring(0, firstLine.length() - 1) : firstLine;
            int numDeltas = Integer.parseInt(header);
            if (numDeltas == 0) return null;

            int idx = 1;
            for (int d = 0; d < numDeltas && idx < lines.length; d++) {
                // Type line: INSERT, DELETE, or CHANGE
                String typeLine = lines[idx++].trim();

                // Positions line: "srcPos,tgtPos"
                if (idx >= lines.length) break;
                idx++; // skip positions line

                // Source lines
                if (idx >= lines.length) break;
                String srcCountLine = lines[idx++].trim().replace(",", "");
                int srcCount = Integer.parseInt(srcCountLine.split(",")[0]);
                for (int j = 0; j < srcCount && idx < lines.length; j++) {
                    if ("DELETE".equals(typeLine) || "CHANGE".equals(typeLine)) {
                        before.add(lines[idx]);
                    }
                    idx++;
                }

                // Target lines
                if (idx >= lines.length) break;
                String tgtCountLine = lines[idx++].trim().replace(",", "");
                int tgtCount = Integer.parseInt(tgtCountLine.split(",")[0]);
                for (int j = 0; j < tgtCount && idx < lines.length; j++) {
                    if ("INSERT".equals(typeLine) || "CHANGE".equals(typeLine)) {
                        after.add(lines[idx]);
                    }
                    idx++;
                }
            }
        } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {
            // Malformed patch — skip
            return null;
        }

        if (before.isEmpty() && after.isEmpty()) return null;
        return new DiffEntry(label, before.isEmpty() ? null : before, after.isEmpty() ? null : after);
    }

    /** Parsed LLM response: feedback items + per-test diff notes (testId → ordered note list). */
    private record ParseResult(
        List<Feedback> feedbackList,
        Map<String, List<String>> diffNotes
    ) {}

    /** Result of pre-grouping: effective primaries, their related tests, and metadata. */
    private record PreGroupResult(
        Set<String> effectiveIds,
        Map<String, List<String>> primaryToRelated,
        int groupCount
    ) {
        boolean hasGroups() { return groupCount > 0; }
    }

    /**
     * Pre-groups all highlighted tests by shared diff runs (≥2 overlap) using union-find.
     * Returns the set of primaries (one per group, highest-priority member) capped at
     * MAX_FEEDBACK_ITEMS, plus a map from primary → related secondaries.
     * Priority order is preserved from the input set (LinkedHashSet insertion order).
     */
    private PreGroupResult preGroupHighlights(Set<String> highlightedIds,
                                               Map<String, List<DiffEntry>> diffsPerTest) {
        List<String> orderedIds = new ArrayList<>(highlightedIds);

        // Build run-number sets from diffs for each test
        Map<String, Set<Integer>> runsByTest = new LinkedHashMap<>();
        for (String testId : orderedIds) {
            Set<Integer> runs = new LinkedHashSet<>();
            List<DiffEntry> diffs = diffsPerTest.get(testId);
            if (diffs != null) {
                for (DiffEntry diff : diffs) {
                    Integer runNum = extractRunNumber(diff.label());
                    if (runNum != null) runs.add(runNum);
                }
            }
            runsByTest.put(testId, runs);
        }

        // Union-Find: lower index = higher priority → make it the root when merging
        Map<String, Integer> indexMap = new LinkedHashMap<>();
        for (int i = 0; i < orderedIds.size(); i++) indexMap.put(orderedIds.get(i), i);
        Map<String, String> parent = new LinkedHashMap<>();
        for (String id : orderedIds) parent.put(id, id);

        for (int i = 0; i < orderedIds.size(); i++) {
            for (int j = i + 1; j < orderedIds.size(); j++) {
                String a = orderedIds.get(i), b = orderedIds.get(j);
                Set<Integer> runsA = runsByTest.getOrDefault(a, Collections.emptySet());
                Set<Integer> runsB = runsByTest.getOrDefault(b, Collections.emptySet());
                long overlap = runsA.stream().filter(runsB::contains).count();
                if (overlap >= 2) {
                    String rootA = find(parent, a);
                    String rootB = find(parent, b);
                    if (!rootA.equals(rootB)) {
                        // Higher priority (lower index) wins = becomes root
                        if (indexMap.getOrDefault(rootA, Integer.MAX_VALUE)
                                <= indexMap.getOrDefault(rootB, Integer.MAX_VALUE)) {
                            parent.put(rootB, rootA);
                        } else {
                            parent.put(rootA, rootB);
                        }
                    }
                }
            }
        }

        // Build groups: root → all members (in priority order)
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String id : orderedIds) {
            groups.computeIfAbsent(find(parent, id), k -> new ArrayList<>()).add(id);
        }

        // Collect primaries (roots) in priority order, capped at MAX_FEEDBACK_ITEMS
        Set<String> effectiveIds = new LinkedHashSet<>();
        Map<String, List<String>> primaryToRelated = new LinkedHashMap<>();
        int groupsCollapsed = 0;
        for (String id : orderedIds) {
            if (find(parent, id).equals(id)) { // id is its own root = primary
                if (effectiveIds.size() >= StatusChangeTracker.MAX_FEEDBACK_ITEMS) break;
                effectiveIds.add(id);
                List<String> related = groups.get(id).stream()
                    .filter(m -> !m.equals(id))
                    .toList();
                primaryToRelated.put(id, related);
                if (!related.isEmpty()) groupsCollapsed++;
            }
        }

        return new PreGroupResult(effectiveIds, primaryToRelated, groupsCollapsed);
    }

    private String buildInputJson(
            Set<String> highlightedIds,
            Map<String, TestHistory> historyMap,
            SemanticLog semanticLog,
            TestCategoryMapping testCategories,
            CourseContext courseContext,
            Map<String, List<DiffEntry>> diffsPerTest,
            Map<String, List<String>> primaryToRelated) throws IOException {

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
            testNode.put("isLingeringFailure", th.isLingeringFailure());
            testNode.put("totalFailedRuns", th.totalFailedRuns());

            // Related tests in the same group (share same underlying bug)
            List<String> related = primaryToRelated.get(testId);
            if (related != null && !related.isEmpty()) {
                ArrayNode relatedArr = testNode.putArray("relatedTests");
                related.forEach(relatedArr::add);
            }

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

                // Include last error snapshot (errorType only; message excluded by default)
                List<ErrorEvolution.ErrorSnapshot> seq = th.errorEvolution().sequence();
                if (seq != null && !seq.isEmpty()) {
                    ErrorEvolution.ErrorSnapshot last = seq.get(seq.size() - 1);
                    ObjectNode lastError = evoNode.putObject("lastError");
                    lastError.put("run", last.run());
                    if (last.errorType() != null) lastError.put("errorType", last.errorType());
                    if (includeErrorMessages && last.message() != null) {
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
                            if (++count >= 5) break;
                        }
                    }
                }
                if (semanticHints.isEmpty()) {
                    testNode.remove("semanticContext");
                }
            }

            // Code diffs: include label, line counts, and up to 8 lines each of before/after
            // so the LLM can write meaningful per-diff notes.
            List<DiffEntry> diffs = diffsPerTest.get(testId);
            if (diffs != null && !diffs.isEmpty()) {
                ArrayNode diffsNode = testNode.putArray("codeDiffs");
                for (DiffEntry diff : diffs) {
                    ObjectNode diffNode = Json.mapper().createObjectNode();
                    diffNode.put("label", diff.label());
                    int beforeCount = diff.before() != null ? diff.before().size() : 0;
                    int afterCount = diff.after() != null ? diff.after().size() : 0;
                    diffNode.put("removedLines", beforeCount);
                    diffNode.put("addedLines", afterCount);
                    if (diff.before() != null && !diff.before().isEmpty()) {
                        ArrayNode beforeArr = diffNode.putArray("before");
                        diff.before().stream().limit(8).forEach(beforeArr::add);
                    }
                    if (diff.after() != null && !diff.after().isEmpty()) {
                        ArrayNode afterArr = diffNode.putArray("after");
                        diff.after().stream().limit(8).forEach(afterArr::add);
                    }
                    diffsNode.add(diffNode);
                }
            }

            // Course context: inject matched future appearances for the LLM to frame nextSteps
            if (courseContext != null && !courseContext.concepts().isEmpty()) {
                List<CourseContext.FutureAppearance> appearances =
                    resolveFutureAppearances(th, courseContext);
                if (!appearances.isEmpty()) {
                    ArrayNode ccArray = testNode.putArray("courseContext");
                    for (CourseContext.FutureAppearance fa : appearances) {
                        ObjectNode faNode = Json.mapper().createObjectNode();
                        faNode.put("label", fa.label());
                        faNode.put("description", fa.description());
                        ccArray.add(faNode);
                    }
                }
            }

            // Pre-LLM consistency check: if the pipeline's own fields contradict each other,
            // that indicates a pipeline bug (wrong data fed to the LLM), not an LLM issue.
            // Log clearly so it's distinguishable from a post-generation fact-check violation.
            if (th.struggleProfile() != null) {
                boolean profileSaysFixed = th.struggleProfile().wasFixed();
                boolean historySaysFixed = !th.isLingeringFailure();
                if (profileSaysFixed != historySaysFixed) {
                    System.err.println("PIPELINE DATA INCONSISTENCY [" + testId + "]: "
                        + "struggleProfile.wasFixed=" + profileSaysFixed
                        + " contradicts isLingeringFailure=" + th.isLingeringFailure()
                        + " — groundTruth block will override");
                }
            }

            // Ground-truth facts block — explicitly computed from structured data.
            // The LLM must not contradict these; they override any inference from
            // other fields (e.g., highlightCategory, totalFailedRuns).
            ObjectNode gt = testNode.putObject("groundTruth");
            gt.put("currentlyPassing", !th.isLingeringFailure());
            if (th.statusByRun() != null && !th.statusByRun().isEmpty()) {
                List<Integer> sortedRuns = new ArrayList<>(th.statusByRun().keySet());
                Collections.sort(sortedRuns);
                gt.put("lastRunWithResult", sortedRuns.get(sortedRuns.size() - 1));
                for (int r : sortedRuns) {
                    String s = th.statusByRun().get(r);
                    if ("fail".equals(s) || "error".equals(s)) { gt.put("firstFailRun", r); break; }
                }
                for (int r : sortedRuns) {
                    if ("pass".equals(th.statusByRun().get(r))) { gt.put("firstPassRun", r); break; }
                }
            }

            testsArray.add(testNode);
        }

        return Json.mapper().writeValueAsString(testsArray);
    }

    /**
     * Resolves future appearances for a test by matching its categories (or test name fallback)
     * against courseContext concept entries.
     */
    static List<CourseContext.FutureAppearance> resolveFutureAppearances(
            TestHistory th, CourseContext courseContext) {
        if (courseContext == null || courseContext.concepts().isEmpty()) return List.of();

        // Primary: match against test categories
        if (th.categories() != null && !th.categories().isEmpty()) {
            List<CourseContext.FutureAppearance> matches = courseContext.forCategories(th.categories());
            if (!matches.isEmpty()) return matches;
        }

        // Fallback: substring match on lowercased test method name (strip "test" prefix)
        String methodName = extractMethodNameFromId(th.testId()).toLowerCase(java.util.Locale.ROOT);
        String keyword = methodName.startsWith("test") ? methodName.substring(4) : methodName;
        if (!keyword.isEmpty()) {
            String kw = keyword;
            return courseContext.concepts().stream()
                .filter(e -> e.testCategories().stream()
                    .anyMatch(cat -> cat.toLowerCase(java.util.Locale.ROOT).contains(kw)))
                .flatMap(e -> e.futureAppearances().stream())
                .distinct().toList();
        }

        return List.of();
    }

    private static String extractMethodNameFromId(String testId) {
        if (testId == null) return "";
        int hash = testId.indexOf('#');
        if (hash < 0) return testId;
        String method = testId.substring(hash + 1);
        if (method.endsWith("()")) method = method.substring(0, method.length() - 2);
        return method;
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

    private ParseResult parseFeedbackResponse(String responseContent) {
        List<Feedback> feedbackList = new ArrayList<>();
        Map<String, List<String>> diffNotes = new LinkedHashMap<>();

        try {
            String json = extractJson(responseContent);
            JsonNode root = Json.mapper().readTree(json);

            JsonNode feedbackNode = root.has("feedback") ? root.get("feedback") : root;

            if (feedbackNode != null && feedbackNode.isArray()) {
                extractFeedbackItems(feedbackNode, feedbackList, diffNotes);
            }
        } catch (Exception e) {
            // JSON may be truncated — try to salvage complete objects via regex
            System.err.println("Warning: full JSON parse failed, attempting partial recovery: " + e.getMessage());
            extractFeedbackFromPartialJson(responseContent, feedbackList, diffNotes);
        }

        return new ParseResult(feedbackList, diffNotes);
    }

    private void extractFeedbackItems(JsonNode feedbackNode, List<Feedback> feedbackList,
                                       Map<String, List<String>> diffNotes) {
        for (JsonNode item : feedbackNode) {
            String testId = getTextOrNull(item, "testId");
            if (testId == null) continue;

            String pattern = getTextOrNull(item, "pattern");
            String confidence = getTextOrNull(item, "confidence");
            String explanation = getTextOrNull(item, "explanation");
            List<String> nextSteps = getStringListOrEmpty(item, "nextSteps");
            List<String> notes = getStringListOrEmpty(item, "diffNotes");
            if (!notes.isEmpty()) diffNotes.put(testId, notes);

            feedbackList.add(new Feedback(testId, pattern, confidence, explanation, nextSteps, null, null, null, null));
        }
    }

    /**
     * Recovers individual feedback objects from truncated JSON by finding
     * complete JSON objects that contain the required "testId" field.
     */
    private void extractFeedbackFromPartialJson(String content, List<Feedback> feedbackList,
                                                  Map<String, List<String>> diffNotes) {
        String json = extractJson(content);

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

            // Find the matching closing brace
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

            if (objEnd < 0) break;

            try {
                String objStr = json.substring(objStart, objEnd);
                JsonNode item = Json.mapper().readTree(objStr);
                String testId = getTextOrNull(item, "testId");
                if (testId != null) {
                    String pattern = getTextOrNull(item, "pattern");
                    String confidence = getTextOrNull(item, "confidence");
                    String explanation = getTextOrNull(item, "explanation");
                    List<String> nextSteps = getStringListOrEmpty(item, "nextSteps");
                    List<String> notes = getStringListOrEmpty(item, "diffNotes");
                    if (!notes.isEmpty()) diffNotes.put(testId, notes);

                    feedbackList.add(new Feedback(testId, pattern, confidence, explanation, nextSteps, null, null, null, null));
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
        return Json.extractLlmJson(content);
    }

    private static String getTextOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }

    private static List<String> getStringListOrEmpty(JsonNode node, String field) {
        if (!node.has(field) || node.get(field).isNull() || !node.get(field).isArray()) {
            return Collections.emptyList();
        }
        List<String> result = new ArrayList<>();
        for (JsonNode element : node.get(field)) {
            if (!element.isNull()) result.add(element.asText());
        }
        return result;
    }

    /**
     * Returns a copy of the diffs list with LLM-generated notes attached (by index).
     * Diffs beyond the notes list keep a null note. Returns the original list unchanged
     * if notes is null/empty.
     */
    private List<DiffEntry> annotateDiffs(List<DiffEntry> diffs, List<String> notes) {
        if (diffs == null || diffs.isEmpty() || notes == null || notes.isEmpty()) return diffs;
        List<DiffEntry> result = new ArrayList<>(diffs.size());
        for (int i = 0; i < diffs.size(); i++) {
            DiffEntry d = diffs.get(i);
            String note = i < notes.size() ? notes.get(i) : null;
            result.add(note != null && !note.isBlank()
                ? new DiffEntry(d.label(), d.before(), d.after(), note)
                : d);
        }
        return result;
    }

    /**
     * Groups related feedbacks by shared diffs: two tests are in the same group
     * if their diff entries share ≥2 run numbers.
     * Each grouped Feedback gets relatedTestIds listing the other group members.
     */
    private List<Feedback> groupRelatedFeedbacks(List<Feedback> feedbacks,
                                                   Map<String, List<DiffEntry>> diffsPerTest) {
        // Build map: testId → Set<Integer> of diff run numbers
        Map<String, Set<Integer>> runsByTest = new LinkedHashMap<>();
        for (Feedback fb : feedbacks) {
            Set<Integer> runs = new LinkedHashSet<>();
            List<DiffEntry> diffs = diffsPerTest.get(fb.testId());
            if (diffs != null) {
                for (DiffEntry diff : diffs) {
                    Integer runNum = extractRunNumber(diff.label());
                    if (runNum != null) runs.add(runNum);
                }
            }
            runsByTest.put(fb.testId(), runs);
        }

        // Union-Find grouping: for each pair, if overlap ≥ 2, merge into same group
        List<String> ids = feedbacks.stream().map(Feedback::testId).toList();
        Map<String, String> parent = new LinkedHashMap<>();
        for (String id : ids) parent.put(id, id);

        for (int i = 0; i < ids.size(); i++) {
            for (int j = i + 1; j < ids.size(); j++) {
                String a = ids.get(i), b = ids.get(j);
                Set<Integer> runsA = runsByTest.getOrDefault(a, Collections.emptySet());
                Set<Integer> runsB = runsByTest.getOrDefault(b, Collections.emptySet());
                long overlap = runsA.stream().filter(runsB::contains).count();
                if (overlap >= 2) {
                    // Union: point b's root to a's root
                    String rootA = find(parent, a);
                    String rootB = find(parent, b);
                    if (!rootA.equals(rootB)) {
                        parent.put(rootB, rootA);
                    }
                }
            }
        }

        // Build groups: root → list of members
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String id : ids) {
            String root = find(parent, id);
            groups.computeIfAbsent(root, k -> new ArrayList<>()).add(id);
        }

        // Annotate each Feedback with its group members (excluding itself), null if singleton
        Map<String, List<String>> relatedMap = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : groups.entrySet()) {
            List<String> members = entry.getValue();
            if (members.size() > 1) {
                for (String id : members) {
                    List<String> others = members.stream().filter(m -> !m.equals(id)).toList();
                    relatedMap.put(id, others);
                }
            }
        }

        return feedbacks.stream()
            .map(fb -> {
                List<String> related = relatedMap.get(fb.testId());
                if (related != null) {
                    return new Feedback(fb.testId(), fb.pattern(), fb.confidence(),
                        fb.explanation(), fb.nextSteps(), fb.diffs(), related, fb.courseAppearances(), null);
                }
                return fb;
            })
            .toList();
    }

    /** Extracts run number from a DiffEntry label like "Run 51 — BinarySearchTree.java". */
    private static Integer extractRunNumber(String label) {
        if (label == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("Run (\\d+)").matcher(label);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    /** Union-Find path-compressed find. */
    private static String find(Map<String, String> parent, String id) {
        if (!parent.get(id).equals(id)) {
            parent.put(id, find(parent, parent.get(id)));
        }
        return parent.get(id);
    }
}
