package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.llm.LlmConfig;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.AssessmentCalendar;
import edu.rosehulman.csse230feedback.model.AssignmentConfig;
import edu.rosehulman.csse230feedback.model.CourseContext;
import edu.rosehulman.csse230feedback.model.DiffCategoryMapping;
import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.IngestionManifest;
import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.model.DrillQuestion;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.TestStatus;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.model.frontend.CourseAppearance;
import edu.rosehulman.csse230feedback.prepare.*;
import edu.rosehulman.csse230feedback.model.frontend.TestSource;
import edu.rosehulman.csse230feedback.util.Json;
import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.*;
import java.util.stream.Collectors;

public class PrepareService {

    /** Flexible parser that accepts 1–9 fractional second digits. */
    private static final DateTimeFormatter TS_PARSER =
        new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd HH:mm:ss")
            .optionalStart()
            .appendFraction(ChronoField.NANO_OF_SECOND, 1, 9, true)
            .optionalEnd()
            .toFormatter();
    private static final DateTimeFormatter TIME_FMT =
        DateTimeFormatter.ofPattern("h:mm a");

    public PrepareResult prepare(PrepareOptions opts) throws IOException {
        List<String> warnings = new ArrayList<>();

        // 1. Load runs.jsonl (from ingest output)
        Path runsJsonl = opts.resolvedIngestDir().resolve("runs.jsonl");
        if (!Files.exists(runsJsonl)) {
            throw new IOException("runs.jsonl not found at: " + runsJsonl);
        }
        List<RunRecord> runs = loadRunsJsonl(runsJsonl, warnings);
        if (runs.isEmpty()) {
            throw new IOException("runs.jsonl contains no valid runs");
        }

        // 2. Load enriched_runs/ per-run, with per-run fallback to basic data
        Path enrichedDir = opts.inputDir().resolve("enriched_runs");
        Map<Integer, List<EnrichedTestResult>> enrichedData = new LinkedHashMap<>();
        if (Files.exists(enrichedDir) && Files.isDirectory(enrichedDir)) {
            enrichedData = loadEnrichedRuns(enrichedDir, warnings);
        } else if (!opts.allowBasicFallback()) {
            throw new IOException(
                "enriched_runs/ not found at: " + enrichedDir + "\n" +
                "Stack traces and test durations are required for feedback quality.\n" +
                "Run the 'rerun' command first to generate enriched_runs/, then re-run prepare.\n" +
                "To proceed without this data (degraded output), add: --allow-basic-fallback"
            );
        } else {
            System.out.println("DEGRADED: enriched_runs/ not found — proceeding without stack traces or durations (--allow-basic-fallback set)");
        }
        int enrichedCount = enrichedData.size();
        // Fill in any missing runs from basic data
        Map<Integer, List<EnrichedTestResult>> basicData = buildEnrichedFromRuns(runs, warnings);
        // Validate enriched data against original runs.jsonl; discard runs where rerun disagrees
        enrichedData = validateAndCleanEnriched(enrichedData, basicData, runs, warnings);
        for (RunRecord run : runs) {
            enrichedData.computeIfAbsent(run.runNumber(), k -> basicData.get(k));
        }
        System.out.println("Enriched data: " + enrichedCount + "/" + runs.size()
            + " runs have stack traces/durations; " + (runs.size() - enrichedCount) + " using basic fallback");

        // Apply per-assignment exclusions (filter excluded test classes from enrichedData and basicData)
        AssignmentConfig assignmentConfig = opts.assignmentConfig() != null
            ? opts.assignmentConfig() : AssignmentConfig.empty();
        if (!assignmentConfig.excludeTestClasses().isEmpty()) {
            filterExcludedTestClasses(enrichedData, assignmentConfig);
            filterExcludedTestClasses(basicData, assignmentConfig);
            System.out.println("Assignment config: excluding test classes: "
                + assignmentConfig.excludeTestClasses());
        }

        // 3. Load manifest.json (from ingest output)
        Path manifestPath = opts.resolvedIngestDir().resolve("manifest.json");
        IngestionManifest manifest = null;
        if (Files.exists(manifestPath)) {
            manifest = Json.mapper().readValue(manifestPath.toFile(), IngestionManifest.class);
        }

        // 4. Load optional category mappings (from ingest output, or sibling of assignment config)
        Path testCategoriesPath = opts.resolvedIngestDir().resolve("test_categories.json");
        TestCategoryMapping testCategories = null;
        if (Files.exists(testCategoriesPath)) {
            testCategories = Json.mapper().readValue(testCategoriesPath.toFile(), TestCategoryMapping.class);
            System.out.println("Loaded test categories from test_categories.json");
        } else if (opts.assignmentConfigPath() != null) {
            // Fallback: look for <stem>_test_categories.json alongside the assignment config
            Path cfgPath = opts.assignmentConfigPath();
            String stem = cfgPath.getFileName().toString().replaceFirst("\\.json$", "");
            Path siblingPath = cfgPath.getParent().resolve(stem + "_test_categories.json");
            if (Files.exists(siblingPath)) {
                testCategories = Json.mapper().readValue(siblingPath.toFile(), TestCategoryMapping.class);
                System.out.println("Loaded test categories from " + siblingPath);
            }
        }

        // 4b-pre. Load optional question bank (convention: bst.json → bst_drill_questions.json)
        List<DrillQuestion> drillQuestions = List.of();
        if (opts.assignmentConfigPath() != null) {
            String stem = opts.assignmentConfigPath().getFileName().toString()
                .replaceAll("\\.json$", "");
            Path qPath = opts.assignmentConfigPath()
                .resolveSibling(stem + "_drill_questions.json");
            if (qPath.toFile().exists()) {
                drillQuestions = Json.mapper().readValue(qPath.toFile(),
                    Json.mapper().getTypeFactory()
                        .constructCollectionType(List.class, DrillQuestion.class));
                System.out.println("Loaded " + drillQuestions.size()
                    + " drill questions from " + qPath.getFileName());
            }
        }

        Path diffCategoriesPath = opts.resolvedIngestDir().resolve("diff_categories.json");
        DiffCategoryMapping diffCategories = null;
        if (Files.exists(diffCategoriesPath)) {
            diffCategories = Json.mapper().readValue(diffCategoriesPath.toFile(), DiffCategoryMapping.class);
            System.out.println("Loaded diff categories from diff_categories.json");
        }

        // 4b. Load patches (code diffs) — try archive-based loader first, fall back to flat files
        Map<Integer, Map<String, String>> patchesByRunByFile = Collections.emptyMap();
        try {
            ArchivePatchExtractor archiveExtractor = new ArchivePatchExtractor();
            patchesByRunByFile = archiveExtractor.loadPatches(opts.resolvedIngestDir());
            if (!patchesByRunByFile.isEmpty()) {
                System.out.println("Loaded archive patches for " + patchesByRunByFile.size() + " runs");
            }
        } catch (IOException e) {
            warnings.add("Archive patch loading failed: " + e.getMessage());
        }

        // Also keep flat-file patches for SemanticEnrichmentService (uses old Map<Integer,String>)
        Map<Integer, String> patchesByRun = PatchLoader.loadPatches(opts.resolvedIngestDir());
        if (!patchesByRun.isEmpty()) {
            System.out.println("Loaded " + patchesByRun.size() + " flat code patches from patches_index.jsonl");
        }

        // 4a. Initialize LLM service (if LLM options are present)
        LlmService llmService = null;
        try {
            Path dotEnv = resolveDotEnv(opts.resolvedCacheDir());

            LlmConfig llmConfig = LlmConfig.load(
                dotEnv,
                opts.llmProvider(),
                opts.llmModel(),
                opts.llmApiKey()
            );

            llmService = LlmService.create(
                llmConfig,
                opts.resolvedCacheDir(),
                opts.noCache(),
                opts.clearCache(),
                opts.dryRun()
            );
            System.out.println("LLM service initialized: " + llmConfig);
        } catch (LlmException e) {
            // LLM is not required for basic prepare — warn and continue
            warnings.add("LLM service not available: " + e.getMessage());
        }

        // 5. Build RunWithTests list
        List<EpisodeSplitter.RunWithTests> runsWithTests = new ArrayList<>();
        Map<Integer, String> runTimestamps = new LinkedHashMap<>();
        for (RunRecord run : runs) {
            List<EnrichedTestResult> enrichedTests = enrichedData.get(run.runNumber());
            if (enrichedTests == null) {
                warnings.add("Missing enriched data for run " + run.runNumber());
                continue;
            }
            if (run.timestampMs() == null) {
                warnings.add("Run " + run.runNumber() + " has no timestamp, skipping");
                continue;
            }
            runsWithTests.add(new EpisodeSplitter.RunWithTests(
                run.runNumber(),
                run.timestampMs(),
                run.timestamp(),
                enrichedTests
            ));
            if (run.timestamp() != null) {
                runTimestamps.put(run.runNumber(), run.timestamp());
            }
        }

        // 6. Split into episodes using test-outcome-boundary algorithm
        EpisodeSplitter splitter = new EpisodeSplitter(
            opts.idleThresholdMs(),
            opts.categoryShiftWindow()
        );
        List<EpisodeSplitter.EpisodeBoundary> episodeBoundaries = splitter.splitIntoEpisodes(runsWithTests);

        // 7. Transform data
        StatusChangeTracker tracker = new StatusChangeTracker();
        DataTransformer transformer = new DataTransformer();
        TestCategoryAnalyzer categoryAnalyzer = new TestCategoryAnalyzer();

        // Make testCategories effectively final for use in lambda
        final TestCategoryMapping finalTestCategories = testCategories;
        final Map<Integer, Map<String, String>> finalPatchesByRunByFile = patchesByRunByFile;

        List<Episode> episodes = new ArrayList<>();
        List<EpisodeTestData> episodeTestData = new ArrayList<>();

        for (int i = 0; i < episodeBoundaries.size(); i++) {
            EpisodeSplitter.EpisodeBoundary boundary = episodeBoundaries.get(i);
            String episodeId = "episode-" + (i + 1);

            // Find runs in this episode
            List<EpisodeSplitter.RunWithTests> episodeRuns = runsWithTests.stream()
                .filter(r -> r.runNumber() >= boundary.startRunNumber() && r.runNumber() <= boundary.endRunNumber())
                .toList();

            if (episodeRuns.isEmpty()) {
                continue;
            }

            // Extract dominant category - prefer loaded categories
            List<EnrichedTestResult> allTestsInEpisode = episodeRuns.stream()
                .flatMap(r -> r.tests().stream())
                .toList();
            String dominantCategory;
            if (finalTestCategories != null) {
                dominantCategory = findDominantCategoryFromMapping(allTestsInEpisode, finalTestCategories);
            } else {
                dominantCategory = categoryAnalyzer.extractDominantCategory(allTestsInEpisode);
            }

            // Create episode metadata
            String startTime = episodeRuns.get(0).timestamp();
            String endTime = episodeRuns.get(episodeRuns.size() - 1).timestamp();
            String label = "Episode " + (i + 1);

            // New fields: timeRange, edits, area, outcome, outcomeType, linkedTestId
            String timeRange = formatTimeRange(startTime, endTime);

            int edits = (int) episodeRuns.stream()
                .filter(r -> finalPatchesByRunByFile.containsKey(r.runNumber()))
                .count();

            String area = deriveArea(episodeRuns, finalPatchesByRunByFile);

            String outcome = null;
            String outcomeType = boundary.outcomeType();
            String linkedTestId = boundary.triggeringTestId();
            if (linkedTestId != null && boundary.statusBefore() != null && boundary.statusAfter() != null) {
                String shortName = shortTestName(linkedTestId);
                String fromStatus = "pass".equals(boundary.statusBefore()) ? "passing" : "failing";
                String toStatus = "pass".equals(boundary.statusAfter()) ? "passing" : "failing";
                outcome = shortName + " went from " + fromStatus + " to " + toStatus;
            }

            List<Integer> runNumbers = episodeRuns.stream()
                .map(EpisodeSplitter.RunWithTests::runNumber)
                .toList();

            Episode episode = new Episode(episodeId, startTime, endTime, label, dominantCategory)
                .withDetails(timeRange, edits, area, outcome, outcomeType, linkedTestId, runNumbers);
            episodes.add(episode);

            // Transform runs
            List<TestRun> testRuns = new ArrayList<>();
            for (EpisodeSplitter.RunWithTests run : episodeRuns) {
                TestRun testRun = transformer.createTestRun(
                    run.runNumber(),
                    run.timestamp(),
                    run.tests(),
                    tracker,
                    diffCategories
                );
                testRuns.add(testRun);
            }

            episodeTestData.add(new EpisodeTestData(episodeId, testRuns));
        }

        // 7a. Semantic enrichment (if LLM service available)
        SemanticLog semanticLog = null;
        if (llmService != null) {
            try {
                PromptLoader promptLoader = resolvePromptLoader(opts.inputDir());

                SemanticEnrichmentService enricher = new SemanticEnrichmentService(llmService, promptLoader);
                SemanticEnrichmentService.SemanticEnrichmentResult semResult = enricher.enrich(
                    runsWithTests, episodes, opts.assignmentNameOverride(),
                    diffCategories, patchesByRun.isEmpty() ? null : patchesByRun,
                    testCategories
                );
                semanticLog = semResult.semanticLog();

                // 7b. Attach episode semantics
                episodes = episodes.stream()
                    .map(ep -> ep.withSemantics(semResult.episodeSemantics().get(ep.id())))
                    .toList();

                System.out.println("Semantic enrichment complete: " +
                    semResult.semanticLog().entries().size() + " run entries, " +
                    semResult.episodeSemantics().size() + " episode summaries");
            } catch (LlmException e) {
                warnings.add("Semantic enrichment failed: " + e.getMessage());
            }
        }

        // 8. Generate test histories and failure highlights
        List<TestHistory> testHistories = tracker.buildTestHistories(testCategories);
        // All highlights (uncapped sustained-struggle candidates) — used for feedback generation
        // so freed slots from group-collapsing can go to other candidates.
        FailureHighlights allHighlights = tracker.buildAllHighlights(testHistories);
        // Budget-capped highlights — used as fallback when no LLM is available.
        FailureHighlights failureHighlights = tracker.buildFailureHighlights(testHistories);

        // 8-rerank. If an assessment calendar is provided, re-sort sustained-struggle candidates
        // by composite relevance score (concept_weight × grade_weight × urgency_factor) so that
        // tests most important to upcoming high-stakes assessments are prioritised for feedback.
        if (opts.assessmentCalendar() != null) {
            Map<String, TestHistory> historyById = testHistories.stream()
                .collect(Collectors.toMap(TestHistory::testId, th -> th, (a, b) -> a));
            LocalDate today = LocalDate.now();

            // Re-rank allHighlights (uncapped) — this is what feedbackService.generate() uses.
            List<String> rerankedAll = rerankedByRelevance(
                allHighlights.sustainedStruggles(), historyById, opts.assessmentCalendar(), today,
                Integer.MAX_VALUE);
            allHighlights = new FailureHighlights(
                allHighlights.stillFailing(), allHighlights.regressions(),
                allHighlights.costlyDetours(),
                rerankedAll.isEmpty() ? null : rerankedAll);

            // Re-rank failureHighlights (budget-capped) — used as LLM-unavailable fallback.
            int budget = Math.max(0,
                StatusChangeTracker.MAX_FEEDBACK_ITEMS
                - size(failureHighlights.stillFailing())
                - size(failureHighlights.regressions())
                - size(failureHighlights.costlyDetours()));
            List<String> rerankedCapped = rerankedByRelevance(
                allHighlights.sustainedStruggles(), historyById, opts.assessmentCalendar(), today, budget);
            failureHighlights = new FailureHighlights(
                failureHighlights.stillFailing(), failureHighlights.regressions(),
                failureHighlights.costlyDetours(),
                rerankedCapped.isEmpty() ? null : rerankedCapped);
        }

        // 8a. Enhance test histories with error evolution and struggle profiles
        testHistories = enhanceTestHistories(
            testHistories, tracker, testCategories, diffCategories
        );

        // 8b-concept. Compute concept readiness scores per category
        testHistories = computeConceptScores(testHistories);

        // 8b. Generate code snapshots (if enabled)
        List<CodeSnapshot> codeSnapshots = Collections.emptyList();
        if (opts.includeCodeSnapshots()) {
            Set<Integer> runNumbers = runsWithTests.stream()
                .map(EpisodeSplitter.RunWithTests::runNumber)
                .collect(Collectors.toSet());

            CodeSnapshotGenerator snapshotGen = new CodeSnapshotGenerator();
            codeSnapshots = snapshotGen.generateSnapshots(opts.resolvedIngestDir(), runNumbers, warnings);
        }

        // 8c. Generate timeline data
        TimelineGenerator timelineGen = new TimelineGenerator();
        List<TimelinePoint> timeline = timelineGen.generate(runsWithTests);
        System.out.println("Generated " + timeline.size() + " timeline points");

        // 8d. Extract test source snippets from diff archives
        Map<String, TestSource> testSources = Collections.emptyMap();
        try {
            TestSourceExtractor testSourceExtractor = new TestSourceExtractor();
            List<String> allTestIds = testHistories.stream().map(TestHistory::testId).toList();
            testSources = testSourceExtractor.extract(opts.resolvedIngestDir(), allTestIds, warnings);
            if (!testSources.isEmpty()) {
                System.out.println("Extracted test sources for " + testSources.size() + " tests");
            }
        } catch (IOException e) {
            warnings.add("Failed to extract test sources: " + e.getMessage());
        }

        // 9. Build submission context
        String studentId = opts.studentIdOverride();
        String assignmentName = opts.assignmentNameOverride();
        String repoRoot = manifest != null ? manifest.repoRoot() : "";
        String submittedAt = manifest != null ? manifest.createdAtUtc() : "";

        SubmissionContext context = new SubmissionContext(
            studentId,
            assignmentName,
            submittedAt,
            episodes.size(),
            repoRoot
        );

        // 9a. Generate AI feedback for highlighted tests (if LLM available)
        List<Feedback> feedback = Collections.emptyList();
        if (llmService != null) {
            try {
                PromptLoader feedbackPromptLoader = resolvePromptLoader(opts.inputDir());
                FeedbackGenerationService feedbackService = new FeedbackGenerationService(
                    llmService, feedbackPromptLoader, opts.includeErrorMessages()
                );
                PromptLoader feedbackRefinementLoader = resolvePromptLoader(opts.inputDir());
                FeedbackRefinementService refiner = new FeedbackRefinementService(llmService, feedbackRefinementLoader);
                FeedbackFactChecker factChecker = new FeedbackFactChecker();

                List<FeedbackFactChecker.Violation> violations = Collections.emptyList();
                final int MAX_ATTEMPTS = 2;
                for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    int feedbackRequestNum = llmService.stats().totalRequests() + 1;
                    int totalRequestsEstimate = feedbackRequestNum + 1; // generation + refinement

                    feedback = feedbackService.generate(
                        allHighlights,
                        testHistories,
                        semanticLog,
                        testCategories,
                        assignmentName,
                        assignmentConfig.resolvedCourseContext(),
                        patchesByRunByFile,
                        feedbackRequestNum,
                        totalRequestsEstimate
                    );
                    System.out.println("Generated feedback for " + feedback.size()
                        + " highlighted tests" + (attempt > 1 ? " (attempt " + attempt + ")" : ""));

                    if (!feedback.isEmpty()) {
                        feedback = refiner.refine(feedback,
                            llmService.stats().totalRequests() + 1, totalRequestsEstimate);
                        System.out.println("Refinement pass complete"
                            + (attempt > 1 ? " (attempt " + attempt + ")" : ""));
                    }

                    violations = factChecker.check(feedback, testHistories);
                    if (violations.isEmpty()) break;

                    if (attempt < MAX_ATTEMPTS) {
                        System.err.println("Fact-check: " + violations.size()
                            + " violation(s) on attempt " + attempt + " — retrying...");
                    }
                }

                if (violations.isEmpty()) {
                    System.out.println("Fact-check: all " + feedback.size() + " feedback items passed");
                } else {
                    System.err.println("FACT-CHECK VIOLATIONS after " + MAX_ATTEMPTS
                        + " attempt(s) — requires operator review:");
                    for (FeedbackFactChecker.Violation v : violations) {
                        System.err.println("  [" + v.rule() + "] " + v.testId() + ": " + v.detail());
                        warnings.add("fact-check [" + v.rule() + "] " + v.testId() + ": " + v.detail());
                    }
                }
            } catch (LlmException e) {
                warnings.add("Feedback generation failed: " + e.getMessage());
            }

            // Resolve courseAppearances deterministically (independent of LLM output)
            if (!feedback.isEmpty()) {
                CourseContext courseCtx = assignmentConfig.resolvedCourseContext();
                if (!courseCtx.concepts().isEmpty()) {
                    Map<String, TestHistory> historyById = testHistories.stream()
                        .collect(Collectors.toMap(TestHistory::testId, th -> th, (a, b) -> a));
                    feedback = feedback.stream().map(fb -> {
                        TestHistory th = historyById.get(fb.testId());
                        if (th == null) return fb;
                        List<CourseContext.FutureAppearance> fas =
                            FeedbackGenerationService.resolveFutureAppearances(th, courseCtx);
                        if (fas.isEmpty()) return fb;
                        List<CourseAppearance> appearances = fas.stream()
                            .map(fa -> new CourseAppearance(fa.label(), fa.description()))
                            .toList();
                        return new Feedback(fb.testId(), fb.pattern(), fb.confidence(),
                            fb.explanation(), fb.nextSteps(), fb.diffs(), fb.relatedTestIds(),
                            appearances, null);
                    }).toList();
                }
            }

            // Post-process: filter highlights and clear dots for secondary (grouped) tests.
            // The LLM only generated feedback for primaries, so only primaries get highlight dots.
            if (!feedback.isEmpty()) {
                Set<String> primaryIds = feedback.stream()
                    .map(Feedback::testId)
                    .collect(Collectors.toSet());
                failureHighlights = rebuildHighlightsFromPrimaries(allHighlights, primaryIds);
                // Clear highlightCategory on tests that had a dot but aren't primaries
                testHistories = testHistories.stream()
                    .map(th -> th.highlightCategory() != null && !primaryIds.contains(th.testId())
                        ? th.withHighlightCategory(null) : th)
                    .toList();
            }

            // 9b. Generate practice drills for highlighted tests
            if (!feedback.isEmpty()) {
                try {
                    String resolvedDrillModel = opts.drillModel() != null
                        ? opts.drillModel() : "claude-opus-4-6";
                    LlmConfig drillLlmConfig = LlmConfig.load(
                        resolveDotEnv(opts.resolvedCacheDir()),
                        opts.llmProvider(), resolvedDrillModel, opts.llmApiKey()
                    );
                    LlmService drillLlmService = LlmService.create(
                        drillLlmConfig, opts.resolvedCacheDir(),
                        opts.noCache(), false, opts.dryRun()
                    );
                    PromptLoader drillPromptLoader = resolvePromptLoader(opts.inputDir());
                    PracticeDrillService drillService = new PracticeDrillService(drillLlmService, drillPromptLoader, drillQuestions);
                    feedback = drillService.generateDrills(
                        feedback, testHistories, testSources, testCategories, assignmentName,
                        assignmentConfig.resolvedCourseContext(),
                        opts.assessmentCalendar()
                    );
                    System.out.println("Practice drills generated for " + feedback.stream()
                        .filter(fb -> fb.drills() != null).count() + " tests");
                    drillLlmService.finish();
                } catch (LlmException e) {
                    warnings.add("Practice drill generation failed: " + e.getMessage());
                }
            }
        }

        // 10. Build output
        FrontendOutput output = new FrontendOutput(
            context,
            episodes,
            episodeTestData,
            feedback,
            testHistories,
            failureHighlights,
            codeSnapshots.isEmpty() ? null : codeSnapshots,
            semanticLog,
            timeline.isEmpty() ? null : timeline,
            testSources.isEmpty() ? null : testSources
        );

        // 11. Write output
        Files.createDirectories(opts.outputFile().getParent());
        Json.writeJson(opts.outputFile(), output);

        // 11a. Print validation summary
        printValidationSummary(episodes, timeline, feedback, testHistories);

        // 12. Finish LLM session (if active)
        if (llmService != null) {
            llmService.finish();
        }

        // 13. Calculate statistics
        int totalTests = (int) testHistories.size();

        return new PrepareResult(
            episodes.size(),
            runsWithTests.size(),
            totalTests,
            warnings
        );
    }

    /**
     * Prints a validation summary to stdout for quick verification.
     */
    private void printValidationSummary(List<Episode> episodes, List<TimelinePoint> timeline,
                                         List<Feedback> feedback, List<TestHistory> testHistories) {
        System.out.println("\n=== VALIDATION SUMMARY ===");
        System.out.println("Episodes (" + episodes.size() + "):");
        for (Episode ep : episodes) {
            System.out.printf("  %s | %s | edits=%d | area=%s | outcome=%s | type=%s%n",
                ep.id(), ep.timeRange() != null ? ep.timeRange() : "(no timeRange)",
                ep.edits(), ep.area() != null ? ep.area() : "(none)",
                ep.outcome() != null ? ep.outcome() : "(final)",
                ep.outcomeType() != null ? ep.outcomeType() : "null");
        }

        System.out.println("\nTimeline (" + timeline.size() + " points, first 5):");
        timeline.stream().limit(5).forEach(pt ->
            System.out.printf("  %s | passing=%d failing=%d | event=%s%n",
                pt.time(), pt.passing(), pt.failing(),
                pt.event() != null ? pt.event() : "-"));

        System.out.println("\nFeedback (" + feedback.size() + " items):");
        feedback.stream().limit(2).forEach(fb -> {
            System.out.printf("  %s | pattern=%s | diffs=%d%n",
                fb.testId(), fb.pattern(),
                fb.diffs() != null ? fb.diffs().size() : 0);
            if (fb.explanation() != null) {
                String exp = fb.explanation();
                System.out.println("    explanation: " + exp.substring(0, Math.min(120, exp.length())) + "...");
            }
            if (fb.nextSteps() != null && !fb.nextSteps().isEmpty()) {
                System.out.println("    nextSteps[0]: " + fb.nextSteps().get(0).substring(0, Math.min(120, fb.nextSteps().get(0).length())) + "...");
            }
        });
        System.out.println("==========================\n");
    }

    /**
     * Formats a time range from two timestamp strings.
     * Input: "2026-03-07 23:40:34.663" → Output: "11:40 PM – 11:52 PM"
     */
    private String formatTimeRange(String startTimestamp, String endTimestamp) {
        String startFormatted = formatTime(startTimestamp);
        String endFormatted = formatTime(endTimestamp);
        if (startFormatted == null || endFormatted == null) return null;
        return startFormatted + " \u2013 " + endFormatted;
    }

    private String formatTime(String timestamp) {
        if (timestamp == null) return null;
        try {
            LocalDateTime dt = LocalDateTime.parse(timestamp, TS_PARSER);
            return dt.format(TIME_FMT);
        } catch (DateTimeParseException e) {
            return timestamp;
        }
    }

    /**
     * Derives the area (implementation file name) from patches in this episode's runs.
     * Prefers non-test files; falls back to any file.
     */
    private String deriveArea(List<EpisodeSplitter.RunWithTests> episodeRuns,
                               Map<Integer, Map<String, String>> patchesByRunByFile) {
        for (EpisodeSplitter.RunWithTests run : episodeRuns) {
            Map<String, String> runPatches = patchesByRunByFile.get(run.runNumber());
            if (runPatches == null) continue;
            for (String fileKey : runPatches.keySet()) {
                if (!fileKey.contains("Testing") && !fileKey.contains("Test.java")) {
                    return extractFileName(fileKey);
                }
            }
        }
        // Fall back to any file
        for (EpisodeSplitter.RunWithTests run : episodeRuns) {
            Map<String, String> runPatches = patchesByRunByFile.get(run.runNumber());
            if (runPatches != null && !runPatches.isEmpty()) {
                return extractFileName(runPatches.keySet().iterator().next());
            }
        }
        return null;
    }

    /** Extracts filename from fileKey like "BinarySearchTree.java.BinarySearchTree". */
    private String extractFileName(String fileKey) {
        int dotJava = fileKey.indexOf(".java");
        if (dotJava >= 0) return fileKey.substring(0, dotJava + 5);
        return fileKey;
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

    /**
     * Resolves the .env file path from the cache directory location.
     * The .env file lives at the Pipeline root (two levels above the llm/ cache subdirectory).
     */
    private Path resolveDotEnv(Path cacheDir) {
        Path cacheParent = cacheDir.getParent();
        Path dotEnvPath;
        if (cacheParent != null && cacheParent.getParent() != null) {
            dotEnvPath = cacheParent.getParent();
        } else {
            dotEnvPath = Path.of(".");
        }
        return dotEnvPath.resolve(".env");
    }

    /**
     * Resolves the prompt loader by trying multiple candidate directories in priority order.
     */
    private PromptLoader resolvePromptLoader(Path inputDir) {
        List<Path> candidates = new ArrayList<>();
        if (inputDir.getParent() != null) {
            candidates.add(inputDir.getParent().resolve("prompts"));
        }
        candidates.add(Path.of("Pipeline", "prompts"));
        candidates.add(Path.of("prompts"));
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return new PromptLoader(candidate);
            }
        }
        return new PromptLoader(Path.of("Pipeline", "prompts"));
    }

    /**
     * Validates enriched data against the canonical runs.jsonl.
     * If any test's pass/fail in the rerun disagrees with the original, the entire run's
     * enriched data is discarded and replaced with basic fallback data.
     */
    private Map<Integer, List<EnrichedTestResult>> validateAndCleanEnriched(
            Map<Integer, List<EnrichedTestResult>> enrichedData,
            Map<Integer, List<EnrichedTestResult>> basicData,
            List<RunRecord> runs,
            List<String> warnings) {
        Map<Integer, List<EnrichedTestResult>> result = new LinkedHashMap<>(enrichedData);
        for (RunRecord runRecord : runs) {
            int runNumber = runRecord.runNumber();
            List<EnrichedTestResult> enrichedList = result.get(runNumber);
            if (enrichedList == null || runRecord.tests() == null) continue;

            // Build pass/fail map from rerun results
            Map<String, Boolean> enrichedPassFail = new HashMap<>();
            for (EnrichedTestResult e : enrichedList) {
                enrichedPassFail.put(e.testId(), e.status() == TestStatus.SUCCESSFUL);
            }

            // Build pass/fail map from original runs.jsonl (treat non-SUCCESSFUL as non-pass)
            Map<String, Boolean> originalPassFail = new HashMap<>();
            for (var r : runRecord.tests()) {
                originalPassFail.put(r.testId(), r.status() == TestStatus.SUCCESSFUL);
            }

            // Check for any disagreement between rerun and original
            boolean discard = false;
            for (Map.Entry<String, Boolean> origEntry : originalPassFail.entrySet()) {
                if (discard) break;
                String testId = origEntry.getKey();
                Boolean origPass = origEntry.getValue();
                Boolean enrichedPass = enrichedPassFail.get(testId);
                if (enrichedPass != null && !enrichedPass.equals(origPass)) {
                    warnings.add("Run " + runNumber + ": rerun disagrees with original for "
                        + testId + " (original=" + (origPass ? "pass" : "fail")
                        + ", rerun=" + (enrichedPass ? "pass" : "fail")
                        + "), discarding enriched data for this run");
                    discard = true;
                } else if (enrichedPass == null && !origPass) {
                    // A test that was failing in the original is absent from the enriched run —
                    // the rerun used a different code snapshot. Fall back to original data.
                    warnings.add("Run " + runNumber + ": enriched data missing originally-failing test "
                        + testId + ", discarding enriched data for this run");
                    discard = true;
                }
            }

            if (discard) {
                List<EnrichedTestResult> basic = basicData.get(runNumber);
                if (basic != null) {
                    result.put(runNumber, basic);
                }
            }
        }
        return result;
    }

    /**
     * Removes excluded test class results from all runs in the given map (in-place).
     */
    private void filterExcludedTestClasses(Map<Integer, List<EnrichedTestResult>> data,
                                            AssignmentConfig config) {
        for (Map.Entry<Integer, List<EnrichedTestResult>> entry : data.entrySet()) {
            List<EnrichedTestResult> filtered = entry.getValue().stream()
                .filter(e -> !config.isExcluded(e.testClassSimple()))
                .collect(Collectors.toList());
            entry.setValue(filtered);
        }
    }

    /**
     * Returns up to {@code limit} test IDs from {@code candidates}, sorted by composite relevance
     * score (concept_weight × grade_weight × urgency_factor) descending, with totalFailedRuns as
     * a secondary tiebreaker. Candidates absent from {@code historyById} are silently dropped.
     */
    private List<String> rerankedByRelevance(
            List<String> candidates,
            Map<String, TestHistory> historyById,
            AssessmentCalendar calendar,
            LocalDate today,
            int limit) {
        if (candidates == null || candidates.isEmpty()) return List.of();
        return candidates.stream()
            .filter(historyById::containsKey)
            .sorted(Comparator
                .<String>comparingDouble(id -> relevanceScore(historyById.get(id), calendar, today))
                .reversed()
                .thenComparingInt(id -> historyById.get(id).totalFailedRuns())
                .reversed())
            .limit(limit == Integer.MAX_VALUE ? Long.MAX_VALUE : (long) limit)
            .toList();
    }

    /** Composite relevance score: sum of concept_weight × grade_weight × urgency_factor over all assessments. */
    private double relevanceScore(TestHistory history, AssessmentCalendar calendar, LocalDate today) {
        List<String> categories = history.categories() != null ? history.categories() : List.of();
        double score = 0.0;
        for (AssessmentCalendar.AssessmentEntry entry : calendar.assessments()) {
            if (entry.conceptWeights() == null) continue;
            double conceptWeight = categories.stream()
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

    private static int size(List<?> list) {
        return list == null ? 0 : list.size();
    }

    /**
     * Rebuilds FailureHighlights keeping only test IDs present in primaryIds.
     * Secondary tests (merged into a primary group) are removed so they don't get a highlight dot.
     */
    private FailureHighlights rebuildHighlightsFromPrimaries(FailureHighlights all, Set<String> primaryIds) {
        List<String> stillFailing = filterToSet(all.stillFailing(), primaryIds);
        List<String> regressions = filterToSet(all.regressions(), primaryIds);
        List<String> costlyDetours = filterToSet(all.costlyDetours(), primaryIds);
        List<String> sustainedStruggles = filterToSet(all.sustainedStruggles(), primaryIds);
        return new FailureHighlights(
            stillFailing.isEmpty() ? null : stillFailing,
            regressions.isEmpty() ? null : regressions,
            costlyDetours.isEmpty() ? null : costlyDetours,
            sustainedStruggles.isEmpty() ? null : sustainedStruggles
        );
    }

    private List<String> filterToSet(List<String> list, Set<String> keep) {
        if (list == null) return Collections.emptyList();
        return list.stream().filter(keep::contains).toList();
    }

    private Map<Integer, List<EnrichedTestResult>> buildEnrichedFromRuns(List<RunRecord> runs, List<String> warnings) {
        Map<Integer, List<EnrichedTestResult>> enrichedData = new HashMap<>();
        for (RunRecord run : runs) {
            if (run.tests() != null) {
                List<EnrichedTestResult> enriched = run.tests().stream()
                    .map(EnrichedTestResult::fromBasic)
                    .toList();
                enrichedData.put(run.runNumber(), enriched);
            }
        }
        return enrichedData;
    }

    private List<RunRecord> loadRunsJsonl(Path runsJsonl, List<String> warnings) throws IOException {
        List<RunRecord> runs = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(runsJsonl)) {
            String line;
            int lineNum = 0;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (!line.trim().isEmpty()) {
                    try {
                        RunRecord run = Json.mapper().readValue(line, RunRecord.class);
                        runs.add(run);
                    } catch (IOException e) {
                        warnings.add("Failed to parse line " + lineNum + " in runs.jsonl: " + e.getMessage());
                    }
                }
            }
        }
        return runs;
    }

    private Map<Integer, List<EnrichedTestResult>> loadEnrichedRuns(Path enrichedDir, List<String> warnings) throws IOException {
        Map<Integer, List<EnrichedTestResult>> enrichedData = new HashMap<>();

        try (var stream = Files.list(enrichedDir)) {
            stream.filter(p -> p.getFileName().toString().matches("enriched_\\d+\\.json"))
                .forEach(path -> {
                    try {
                        String filename = path.getFileName().toString();
                        int runNumber = Integer.parseInt(filename.substring(9, filename.length() - 5));

                        EnrichedTestResult[] results = Json.mapper().readValue(
                            path.toFile(),
                            EnrichedTestResult[].class
                        );
                        enrichedData.put(runNumber, Arrays.asList(results));
                    } catch (Exception e) {
                        warnings.add("Failed to load " + path.getFileName() + ": " + e.getMessage());
                    }
                });
        }

        return enrichedData;
    }

    private String findDominantCategoryFromMapping(List<EnrichedTestResult> tests,
                                                    TestCategoryMapping mapping) {
        Map<String, Long> categoryCounts = tests.stream()
            .flatMap(t -> mapping.getCategoriesForTest(t.testId()).stream())
            .collect(Collectors.groupingBy(c -> c, Collectors.counting()));

        return categoryCounts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("Unknown");
    }

    /**
     * Computes per-category readiness scores for each test and attaches them as conceptScores.
     *
     * journeyScore = isLingeringFailure ? 0 : max(20, 100 - totalFailedRuns * 5)
     * categoryScore = round(avg journeyScore across all tests in category)
     * potential     = min(100, round((catTotal - thisJourney + 100) / catCount))
     */
    private static List<TestHistory> computeConceptScores(List<TestHistory> histories) {
        // 1. Compute per-test journey scores
        Map<String, Integer> journeyByTestId = new HashMap<>();
        for (TestHistory th : histories) {
            int journey = th.isLingeringFailure()
                ? 0
                : Math.max(20, 100 - th.totalFailedRuns() * 5);
            journeyByTestId.put(th.testId(), journey);
        }

        // 2. Accumulate per-category totals
        Map<String, int[]> accum = new HashMap<>();   // int[]{total, count}
        for (TestHistory th : histories) {
            if (th.categories() == null) continue;
            int journey = journeyByTestId.get(th.testId());
            for (String cat : th.categories()) {
                accum.computeIfAbsent(cat, k -> new int[]{0, 0});
                accum.get(cat)[0] += journey;
                accum.get(cat)[1] += 1;
            }
        }

        // 3. Attach conceptScores to each TestHistory
        List<TestHistory> result = new ArrayList<>(histories.size());
        for (TestHistory th : histories) {
            if (th.categories() == null || th.categories().isEmpty()) {
                result.add(th);
                continue;
            }
            int thisJourney = journeyByTestId.get(th.testId());
            List<ConceptScore> scores = new ArrayList<>();
            for (String cat : th.categories()) {
                int[] a = accum.get(cat);
                if (a == null) continue;
                int categoryScore = (int) Math.round((double) a[0] / a[1]);
                int potential = Math.min(100, (int) Math.round((a[0] - thisJourney + 100.0) / a[1]));
                scores.add(new ConceptScore(cat, categoryScore, potential));
            }
            result.add(th.withConceptScores(scores));
        }
        return result;
    }

    /**
     * Enhances test histories with error evolution and struggle profiles.
     */
    private List<TestHistory> enhanceTestHistories(
            List<TestHistory> histories,
            StatusChangeTracker tracker,
            TestCategoryMapping testCategories,
            DiffCategoryMapping diffCategories) {

        ErrorEvolutionTracker errorTracker = new ErrorEvolutionTracker();
        Map<String, Map<Integer, String[]>> errorHistory = tracker.getErrorHistory();
        Map<String, Map<Integer, String>> statusHistory = tracker.getStatusHistory();

        for (Map.Entry<String, Map<Integer, String[]>> entry : errorHistory.entrySet()) {
            String testId = entry.getKey();
            Map<Integer, String> statuses = statusHistory.get(testId);
            for (Map.Entry<Integer, String[]> runEntry : entry.getValue().entrySet()) {
                int run = runEntry.getKey();
                String[] errorInfo = runEntry.getValue();
                String status = statuses != null ? statuses.get(run) : "fail";
                errorTracker.recordError(testId, run, status, errorInfo[0], errorInfo[1], errorInfo[2]);
            }
            if (statuses != null && !statuses.isEmpty()) {
                int lastRun = Collections.max(statuses.keySet());
                String lastStatus = statuses.get(lastRun);
                errorTracker.recordError(testId, lastRun, lastStatus, null, null, null);
            }
        }

        Map<String, ErrorEvolution> evolutions = errorTracker.buildAllEvolutions();

        CrossTestCorrelator correlator = new CrossTestCorrelator();
        Map<String, List<StruggleProfile.TestCorrelation>> correlations =
            correlator.computeCorrelations(statusHistory, tracker.getTestNames(), testCategories);

        StruggleProfileGenerator profileGen = new StruggleProfileGenerator();

        List<TestHistory> enhanced = new ArrayList<>();
        for (TestHistory history : histories) {
            String testId = history.testId();

            ErrorEvolution evolution = evolutions.get(testId);
            List<StruggleProfile.TestCorrelation> relatedTests = correlations.get(testId);

            StruggleProfile profile = profileGen.generate(
                testId,
                history.statusByRun(),
                history.failureIntervals(),
                evolution,
                relatedTests,
                diffCategories,
                history.meaningfulnessScore()
            );

            enhanced.add(history.withStruggleData(evolution, profile));
        }

        return enhanced;
    }
}
