package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmResponse;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.AssessmentCalendar;
import edu.rosehulman.csse230feedback.model.CourseContext;
import edu.rosehulman.csse230feedback.model.DrillQuestion;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.CourseAppearance;
import edu.rosehulman.csse230feedback.model.frontend.Feedback;
import edu.rosehulman.csse230feedback.model.frontend.PracticeDrill;
import edu.rosehulman.csse230feedback.model.frontend.TestHistory;
import edu.rosehulman.csse230feedback.model.frontend.TestSource;
import edu.rosehulman.csse230feedback.util.Json;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Generates practice drills for highlighted feedback items.
 * Bank questions (curated from real exams/HW) are preferred for all modes — they require
 * implementing a new method, so trivial pass is impossible.
 * LLM generation is the fallback when no bank question matches a test's categories.
 */
public class PracticeDrillService {

    private final LlmService llmService;
    private final PromptLoader promptLoader;
    private final List<DrillQuestion> drillQuestions;

    public PracticeDrillService(LlmService llmService, PromptLoader promptLoader,
                                 List<DrillQuestion> drillQuestions) {
        this.llmService = llmService;
        this.promptLoader = promptLoader;
        this.drillQuestions = drillQuestions != null ? drillQuestions : List.of();
    }

    /**
     * Generates practice drills for each feedback item.
     * Returns the input list with drills attached; items without drills pass through unchanged.
     */
    public List<Feedback> generateDrills(
            List<Feedback> feedback,
            List<TestHistory> testHistories,
            Map<String, TestSource> testSources,
            TestCategoryMapping testCategories,
            String assignmentName,
            CourseContext courseContext,
            AssessmentCalendar assessmentCalendar) throws LlmException, IOException {

        if (feedback.isEmpty()) return feedback;

        Map<String, TestHistory> historyById = new HashMap<>();
        for (TestHistory th : testHistories) {
            historyById.put(th.testId(), th);
        }

        String testCategoriesSummary = buildTestCategoriesSummary(testCategories);

        String promptContent = promptLoader.loadAndFill(
            "practice_drill_prompt.md",
            Map.of(
                "assignment_name", assignmentName != null ? assignmentName : "Unknown",
                "test_categories", testCategoriesSummary
            )
        );

        // Compute drill→category mappings once for the whole run (cached by LLM service).
        Map<String, List<String>> drillCategoryMap = drillQuestions.isEmpty()
            ? Map.of()
            : computeDrillCategoryMappings(drillQuestions, testCategories);

        List<Feedback> result = new ArrayList<>(feedback.size());
        int total = feedback.size();
        // Track which bank question IDs have already been assigned this run so each
        // feedback item gets a distinct drill question.
        Set<String> usedDrillIds = new HashSet<>();

        for (int i = 0; i < total; i++) {
            Feedback fb = feedback.get(i);
            TestHistory th = historyById.get(fb.testId());
            if (th == null) {
                result.add(fb);
                continue;
            }

            try {
                TestSource testSource = testSources != null ? testSources.get(fb.testId()) : null;
                // Derive targetFile from the test source when available; fall back to the
                // class name in the testId (always correct in Java: ClassName → ClassName.java).
                // This covers named-package projects (WuaS, GraphSurfing) where the patch key
                // format differs from what TestSourceExtractor historically expected.
                String targetFile;
                if (testSource != null) {
                    targetFile = testSource.fileName();
                } else {
                    int hash = fb.testId().indexOf('#');
                    targetFile = hash > 0 ? fb.testId().substring(0, hash) + ".java" : null;
                }
                int pts = extractPoints(testSource);

                // Question bank is the preferred source for all students/modes.
                // A bank drill requires implementing a new method → always non-trivially passable.
                // LLM is the fallback when no bank question matches the test's categories.
                PracticeDrill drill = lookupQuestionBankDrill(th.categories(), pts, targetFile, usedDrillIds, drillCategoryMap, testSources, assessmentCalendar);
                if (drill == null) {
                    drill = generateLlmDrill(fb, th, testSources, targetFile, pts, promptContent, i, total);
                }

                if (drill != null) {
                    result.add(new Feedback(
                        fb.testId(), fb.pattern(), fb.confidence(), fb.explanation(),
                        fb.nextSteps(), fb.diffs(), fb.relatedTestIds(), fb.courseAppearances(),
                        List.of(drill)
                    ));
                } else {
                    result.add(fb);
                }
            } catch (Exception e) {
                System.err.println("Warning: practice drill generation failed for "
                    + fb.testId() + ": " + e.getMessage());
                result.add(fb);
            }
        }

        return result;
    }

    /**
     * Uses a single LLM call to determine which assignment test-category keys each drill question
     * reinforces. The result is cached by the LLM service, so repeated runs with the same bank and
     * categories are free. Falls back to the question's own {@code categories} field (if present)
     * for any drill ID the LLM doesn't return.
     */
    private Map<String, List<String>> computeDrillCategoryMappings(
            List<DrillQuestion> drills, TestCategoryMapping testCategories) {
        try {
            ObjectNode input = Json.mapper().createObjectNode();

            ArrayNode catsArr = input.putArray("categories");
            if (testCategories != null && testCategories.categories() != null) {
                for (Map.Entry<String, TestCategoryMapping.CategoryInfo> e
                        : testCategories.categories().entrySet()) {
                    ObjectNode cat = Json.mapper().createObjectNode();
                    cat.put("key", e.getKey());
                    if (e.getValue().description() != null) {
                        cat.put("description", e.getValue().description());
                    }
                    catsArr.add(cat);
                }
            }

            ArrayNode drillsArr = input.putArray("drillQuestions");
            for (DrillQuestion dq : drills) {
                ObjectNode d = Json.mapper().createObjectNode();
                d.put("id", dq.id());
                d.put("source", dq.source());
                d.put("intro", dq.intro());
                drillsArr.add(d);
            }

            String systemPrompt =
                "You are a course content expert for a Data Structures course.\n" +
                "Given a list of test categories (each with a key and description) and a list of " +
                "practice drill questions (each with an id, source, and intro summary), determine " +
                "which category keys each drill reinforces.\n\n" +
                "A drill reinforces a category when completing it exercises the same underlying " +
                "algorithmic pattern — even from a different angle. For example, a drill that counts " +
                "nodes at a given depth reinforces iterator/traversal categories because both require " +
                "systematically visiting tree nodes; a drill about sum-of-heights reinforces height " +
                "categories because it applies the same bottom-up height aggregation.\n\n" +
                "Return ONLY a JSON array, one object per drill, with no prose:\n" +
                "[{\"id\": \"<drill id>\", \"categories\": [\"<key1>\", \"<key2>\"]}, ...]\n" +
                "Include only category keys that are genuinely reinforced. It is fine to include " +
                "multiple keys per drill or to leave the list short if the drill is narrowly focused.";

            LlmResponse response = llmService.complete(
                "drill_category_match",
                systemPrompt,
                Json.mapper().writeValueAsString(input),
                "drill_category_match (" + drills.size() + " questions)",
                0, 0
            );

            Map<String, List<String>> result = new HashMap<>();
            String json = Json.extractLlmJson(response.content());
            JsonNode root = Json.mapper().readTree(json);
            if (root.isArray()) {
                for (JsonNode entry : root) {
                    String id = entry.has("id") ? entry.get("id").asText() : null;
                    if (id == null) continue;
                    List<String> keys = new ArrayList<>();
                    if (entry.has("categories") && entry.get("categories").isArray()) {
                        for (JsonNode k : entry.get("categories")) keys.add(k.asText());
                    }
                    result.put(id, keys);
                }
            }

            System.out.println("Drill category mapping computed for " + result.size()
                + "/" + drills.size() + " questions");
            return result;
        } catch (Exception e) {
            System.err.println("Warning: drill category mapping failed (" + e.getMessage()
                + "), falling back to JSON categories");
            return Map.of();
        }
    }

    private PracticeDrill lookupQuestionBankDrill(List<String> categories, int pts,
                                                   String targetFile, Set<String> usedIds,
                                                   Map<String, List<String>> drillCategoryMap,
                                                   Map<String, TestSource> testSources,
                                                   AssessmentCalendar assessmentCalendar) {
        if (drillQuestions.isEmpty() || categories == null || categories.isEmpty()) return null;

        // Find the unused question whose effective categories best address the most urgent
        // upcoming assessments. Score = sum over assessments of
        //   concept_weight × grade_weight × urgency_factor(days_until).
        // Falls back to list order when two drills score identically (preserving bank ordering).
        // When no assessment calendar is available, any category-matching drill scores 1.0
        // so the first match wins (original behaviour).
        LocalDate today = LocalDate.now();
        DrillQuestion match = drillQuestions.stream()
            .filter(q -> !usedIds.contains(q.id()))
            .filter(q -> {
                List<String> effective = drillCategoryMap.getOrDefault(
                    q.id(), q.categories() != null ? q.categories() : List.of());
                return effective.stream().anyMatch(categories::contains);
            })
            .max(Comparator.comparingDouble(q ->
                scoreDrill(q, drillCategoryMap, assessmentCalendar, today)))
            .orElse(null);

        if (match == null) return null;
        usedIds.add(match.id());

        String testCode = adaptDrillToStudentApi(match.testCode(), testSources);
        Integer drillPoints;
        if (pts > 0) {
            int scaled = Math.max(1, Math.round(pts * 0.25f));
            drillPoints = scaled;
            testCode = testCode.replaceAll("points\\s*\\+=\\s*\\d+;", "points += " + scaled + ";");
        } else {
            // No points scaffolding in the test file — use the drill's own points += 1 as-is.
            drillPoints = 1;
        }

        // Bank-sourced drills extend the concept rather than repair a specific bug —
        // probe framing is always correct for them.
        String intro = fixIntroTargetFile(match.intro(), targetFile);
        return new PracticeDrill(
            "probe", match.timeEstimate(), intro, testCode,
            match.hints(), targetFile,
            pts > 0 ? pts : null,
            drillPoints,
            match.source()
        );
    }

    private PracticeDrill generateLlmDrill(Feedback fb, TestHistory th,
                                            Map<String, TestSource> testSources,
                                            String targetFile, int pts,
                                            String promptContent, int i, int total)
            throws IOException, LlmException {
        PracticeDrill drill = null;
        TestSource testSource = testSources != null ? testSources.get(fb.testId()) : null;
        for (int attempt = 0; attempt < 3 && drill == null; attempt++) {
            String retryHint = attempt > 0
                ? "The previous drill would likely pass immediately against the student's current code. Generate a harder variant that specifically targets the bug they had."
                : null;
            String inputData = buildInputJson(fb, th, testSources, targetFile, pts, retryHint);
            LlmResponse response = llmService.complete(
                "practice_drill_prompt.md",
                promptContent,
                inputData,
                "practice_drill (" + fb.testId() + ")" + (attempt > 0 ? " retry" + attempt : ""),
                i + 1,
                total
            );
            PracticeDrill candidate = parseDrillResponse(response.content(), targetFile, pts);
            if (candidate != null && drillLikelyFails(candidate, testSource, th)) {
                drill = candidate;
            }
        }
        return drill;
    }

    private String buildInputJson(Feedback fb, TestHistory th,
                                   Map<String, TestSource> testSources,
                                   String targetFile, int pointsAvailable,
                                   String retryHint) throws IOException {
        ObjectNode node = Json.mapper().createObjectNode();
        node.put("testId", fb.testId());
        node.put("testName", th.testName());
        node.put("mode", th.isLingeringFailure() ? "repair" : "probe");
        node.put("totalFailedRuns", th.totalFailedRuns());

        if (fb.pattern() != null) {
            node.put("pattern", fb.pattern());
        }

        if (th.categories() != null && !th.categories().isEmpty()) {
            ArrayNode catsArr = node.putArray("categories");
            th.categories().forEach(catsArr::add);
        }

        if (targetFile != null) node.put("targetFile", targetFile);
        if (pointsAvailable > 0) node.put("pointsAvailable", pointsAvailable);
        if (retryHint != null) node.put("retryHint", retryHint);

        TestSource testSource = testSources != null ? testSources.get(fb.testId()) : null;
        if (testSource != null && testSource.content() != null) {
            node.put("existingTestSource", testSource.content());
        }

        if (th.errorEvolution() != null && th.errorEvolution().hasData()) {
            ObjectNode evoNode = node.putObject("errorEvolution");
            if (th.errorEvolution().progressionSummary() != null) {
                evoNode.put("progressionSummary", th.errorEvolution().progressionSummary());
            }
            evoNode.put("stuckOnSameError", th.errorEvolution().stuckOnSameError());
        }

        if (th.struggleProfile() != null) {
            ObjectNode spNode = node.putObject("struggleProfile");
            spNode.put("attemptsToFix", th.struggleProfile().attemptsToFix());
            spNode.put("distinctStrategies", th.struggleProfile().distinctStrategies());
        }

        if (fb.courseAppearances() != null && !fb.courseAppearances().isEmpty()) {
            ArrayNode ccArr = node.putArray("courseContext");
            for (CourseAppearance ca : fb.courseAppearances()) {
                ObjectNode caNode = Json.mapper().createObjectNode();
                caNode.put("label", ca.label());
                if (ca.description() != null) caNode.put("description", ca.description());
                ccArr.add(caNode);
            }
        }

        return Json.mapper().writeValueAsString(node);
    }

    /**
     * Ensures the "paste into X.java" reference in the intro matches the actual targetFile.
     * The LLM (and even bank drill intros adapted to a new student) sometimes names a different
     * file as the paste destination. This post-processing step replaces the paste-destination
     * filename with targetFile while leaving any implementation-file references untouched.
     *
     * Pattern matched: "paste [this/the] test into X.java" (case-insensitive).
     */
    private String fixIntroTargetFile(String intro, String targetFile) {
        if (intro == null || targetFile == null) return intro;
        // Match "paste [this/the/a] test into SomeFile.java" and replace the filename only
        return intro.replaceAll(
            "(?i)(paste\\s+(?:this|the|a)?\\s*test\\s+into\\s+)`?([\\w]+\\.java)`?",
            "$1" + targetFile
        );
    }

    private PracticeDrill parseDrillResponse(String content, String targetFile, int pointsAvailable) {
        try {
            String json = Json.extractLlmJson(content);
            JsonNode root = Json.mapper().readTree(json);

            String mode = root.has("mode") ? root.get("mode").asText() : null;
            String timeEstimate = root.has("timeEstimate") ? root.get("timeEstimate").asText() : null;
            String intro = root.has("intro") ? root.get("intro").asText() : null;
            String testCode = root.has("testCode") ? root.get("testCode").asText() : null;

            List<String> hints = new ArrayList<>();
            if (root.has("hints") && root.get("hints").isArray()) {
                for (JsonNode h : root.get("hints")) {
                    if (!h.isNull()) hints.add(h.asText());
                }
            }

            if (testCode == null || testCode.isBlank()) {
                System.err.println("Warning: drill response missing testCode");
                return null;
            }

            Integer drillPoints;
            if (pointsAvailable > 0) {
                int scaled = Math.max(1, Math.round(pointsAvailable * 0.25f));
                drillPoints = scaled;
                testCode = testCode.replaceAll("points\\s*\\+=\\s*\\d+;", "points += " + scaled + ";");
            } else {
                // No points scaffolding — keep the drill's own points += 1 as-is.
                drillPoints = 1;
            }

            intro = fixIntroTargetFile(intro, targetFile);

            return new PracticeDrill(mode, timeEstimate, intro, testCode,
                hints.isEmpty() ? null : hints,
                targetFile,
                pointsAvailable > 0 ? pointsAvailable : null,
                drillPoints,
                null); // LLM-generated: no bank source
        } catch (Exception e) {
            System.err.println("Warning: failed to parse drill response: " + e.getMessage());
            return null;
        }
    }

    private boolean drillLikelyFails(PracticeDrill drill, TestSource testSource, TestHistory th) {
        try {
            ObjectNode node = Json.mapper().createObjectNode();
            node.put("testCode", drill.testCode());
            if (testSource != null && testSource.content() != null) {
                String snippet = testSource.content();
                node.put("originalTestSnippet", snippet.substring(0, Math.min(500, snippet.length())));
            }
            if (th.errorEvolution() != null && th.errorEvolution().progressionSummary() != null) {
                node.put("errorHistorySummary", th.errorEvolution().progressionSummary());
            }
            if (th.errorEvolution() != null) {
                node.put("stuckOnSameError", th.errorEvolution().stuckOnSameError());
            }

            String systemPrompt = "You are a Java test outcome predictor. " +
                "Given a student's error history and a practice drill test, " +
                "predict whether the student's current buggy code would FAIL or PASS the drill. " +
                "Reply with only: FAILS or PASSES";
            String inputData = Json.mapper().writeValueAsString(node);

            LlmResponse response = llmService.complete(
                "drill_verify",
                systemPrompt,
                inputData,
                "drill_verify (" + drill.testCode().substring(0, Math.min(40, drill.testCode().length())).replace('\n', ' ') + ")",
                0,
                0
            );
            return !response.content().contains("PASSES");
        } catch (Exception e) {
            return true; // conservative: don't reject the drill
        }
    }

    /**
     * Adapts bank-question testCode to use the student's actual BST class name and insert
     * method by scanning all available test sources for constructor and insert-call patterns.
     *
     * Bank questions are authored with {@code BST<>} and {@code .add()} as canonical placeholders.
     * If the student's tests use a different class name (e.g. {@code BinarySearchTree}) or a
     * different insert method (e.g. {@code .insert()}), this method rewrites the testCode so
     * the drill compiles against the student's actual submission.
     */
    private String adaptDrillToStudentApi(String testCode, Map<String, TestSource> testSources) {
        if (testSources == null || testSources.isEmpty() || testCode == null) return testCode;

        String detectedClass = null;
        String detectedInsert = null;

        // Scan all test sources to infer the class name and insert method actually used.
        for (TestSource ts : testSources.values()) {
            String content = ts.content();
            if (content == null) continue;

            // Class name: match "new ClassName<" pattern
            if (detectedClass == null) {
                Matcher m = Pattern.compile("new\\s+([A-Z][A-Za-z0-9_]*)<").matcher(content);
                if (m.find()) {
                    detectedClass = m.group(1);
                }
            }

            // Insert method: prefer .insert( but accept .add( if that's what's used
            if (detectedInsert == null) {
                if (content.contains(".insert(")) {
                    detectedInsert = "insert";
                } else if (content.contains(".add(")) {
                    detectedInsert = "add";
                }
            }

            if (detectedClass != null && detectedInsert != null) break;
        }

        // Apply substitutions only when the detected API differs from the bank defaults.
        if (detectedClass != null && !detectedClass.equals("BST")) {
            // Replace the type param usage: "BST<" → "ClassName<"
            testCode = testCode.replace("BST<", detectedClass + "<");
            // Replace constructor: "new BST<>()" → "new ClassName<>()"
            testCode = testCode.replace("new BST<>()", "new " + detectedClass + "<>()");
        }
        if (detectedInsert != null && !detectedInsert.equals("add")) {
            // Replace method calls: ".add(" → ".insert(" (word-boundary aware)
            testCode = testCode.replaceAll("\\.add\\(", "." + detectedInsert + "(");
        }

        return testCode;
    }

    private int extractPoints(TestSource ts) {
        if (ts == null || ts.content() == null) return 0;
        // Matches assignment-specific point field names:
        //   points   (BST, WuaS)
        //   sPoints  (StringHashSet)
        //   m1points / m2points  (GraphSurfing milestones)
        // Only counts literal integer increments; expressions like "3*m1weight" are skipped.
        java.util.regex.Matcher m =
            java.util.regex.Pattern.compile("\\w*[Pp]oints\\s*\\+=\\s*(\\d+)").matcher(ts.content());
        int total = 0;
        while (m.find()) total += Integer.parseInt(m.group(1));
        return total;
    }

    /**
     * Composite relevance score for a drill question against the assessment calendar.
     * For each assessment: sum concept_weight × grade_weight × urgency_factor(days_until).
     * Returns 1.0 when no calendar is available so all category-matching drills are equal
     * and the first match in bank order wins.
     */
    private double scoreDrill(DrillQuestion q,
                              Map<String, List<String>> drillCategoryMap,
                              AssessmentCalendar calendar,
                              LocalDate today) {
        if (calendar == null || calendar.assessments() == null || calendar.assessments().isEmpty()) {
            return 1.0;
        }
        List<String> drillCats = drillCategoryMap.getOrDefault(
            q.id(), q.categories() != null ? q.categories() : List.of());
        if (drillCats.isEmpty()) return 0.0;

        double score = 0.0;
        for (AssessmentCalendar.AssessmentEntry entry : calendar.assessments()) {
            if (entry.conceptWeights() == null) continue;
            double conceptWeight = drillCats.stream()
                .mapToDouble(cat -> entry.conceptWeights().getOrDefault(cat, 0.0))
                .sum();
            if (conceptWeight == 0.0) continue;
            double gradeWeight = entry.gradeWeight() != null
                ? entry.gradeWeight()
                : ("exam".equals(entry.type()) ? 0.10 : 0.035);
            long daysUntil = ChronoUnit.DAYS.between(today, LocalDate.parse(entry.date()));
            score += conceptWeight * gradeWeight * urgencyFactor(daysUntil);
        }
        return score;
    }

    private static double urgencyFactor(long days) {
        if (days <= 3)  return 1.0;
        if (days <= 7)  return 0.8;
        if (days <= 14) return 0.6;
        if (days <= 30) return 0.4;
        return 0.2;
    }

    private String buildTestCategoriesSummary(TestCategoryMapping testCategories) {
        if (testCategories == null || testCategories.categories() == null
                || testCategories.categories().isEmpty()) {
            return "(no test category mapping available)";
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, TestCategoryMapping.CategoryInfo> entry
                : testCategories.categories().entrySet()) {
            sb.append("- **").append(entry.getKey()).append("**");
            if (entry.getValue().description() != null) {
                sb.append(": ").append(entry.getValue().description());
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }
}
