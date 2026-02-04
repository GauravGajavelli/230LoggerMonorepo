package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.model.DiffCategoryMapping;
import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.IngestionManifest;
import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.model.TestCategoryMapping;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.prepare.*;
import edu.rosehulman.csse230feedback.util.Json;
import edu.rosehulman.csse230feedback.model.frontend.ErrorEvolution;
import edu.rosehulman.csse230feedback.model.frontend.StruggleProfile;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

public class PrepareService {

    public PrepareResult prepare(PrepareOptions opts) throws IOException {
        List<String> warnings = new ArrayList<>();

        // 1. Load runs.jsonl
        Path runsJsonl = opts.inputDir().resolve("runs.jsonl");
        if (!Files.exists(runsJsonl)) {
            throw new IOException("runs.jsonl not found at: " + runsJsonl);
        }
        List<RunRecord> runs = loadRunsJsonl(runsJsonl, warnings);
        if (runs.isEmpty()) {
            throw new IOException("runs.jsonl contains no valid runs");
        }

        // 2. Load enriched_runs/
        Path enrichedDir = opts.inputDir().resolve("enriched_runs");
        if (!Files.exists(enrichedDir) || !Files.isDirectory(enrichedDir)) {
            throw new IOException("enriched_runs/ directory not found at: " + enrichedDir);
        }
        Map<Integer, List<EnrichedTestResult>> enrichedData = loadEnrichedRuns(enrichedDir, warnings);
        if (enrichedData.isEmpty()) {
            throw new IOException("enriched_runs/ directory is empty");
        }

        // 3. Load manifest.json
        Path manifestPath = opts.inputDir().resolve("manifest.json");
        IngestionManifest manifest = null;
        if (Files.exists(manifestPath)) {
            manifest = Json.mapper().readValue(manifestPath.toFile(), IngestionManifest.class);
        }

        // 4. Load optional category mappings
        Path testCategoriesPath = opts.inputDir().resolve("test_categories.json");
        TestCategoryMapping testCategories = null;
        if (Files.exists(testCategoriesPath)) {
            testCategories = Json.mapper().readValue(testCategoriesPath.toFile(), TestCategoryMapping.class);
            System.out.println("Loaded test categories from test_categories.json");
        }

        Path diffCategoriesPath = opts.inputDir().resolve("diff_categories.json");
        DiffCategoryMapping diffCategories = null;
        if (Files.exists(diffCategoriesPath)) {
            diffCategories = Json.mapper().readValue(diffCategoriesPath.toFile(), DiffCategoryMapping.class);
            System.out.println("Loaded diff categories from diff_categories.json");
        }

        // 5. Build RunWithTests list
        List<EpisodeSplitter.RunWithTests> runsWithTests = new ArrayList<>();
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
        }

        // 6. Split into episodes
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

            episodes.add(new Episode(episodeId, startTime, endTime, label, dominantCategory));

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

        // 8. Generate test histories and failure highlights
        List<TestHistory> testHistories = tracker.buildTestHistories(testCategories);
        FailureHighlights failureHighlights = tracker.buildFailureHighlights(testHistories);

        // 8a. Enhance test histories with error evolution and struggle profiles
        testHistories = enhanceTestHistories(
            testHistories, tracker, testCategories, diffCategories
        );

        // 8b. Generate code snapshots (if enabled)
        List<CodeSnapshot> codeSnapshots = Collections.emptyList();
        if (opts.includeCodeSnapshots()) {
            Set<Integer> runNumbers = runsWithTests.stream()
                .map(EpisodeSplitter.RunWithTests::runNumber)
                .collect(Collectors.toSet());

            CodeSnapshotGenerator snapshotGen = new CodeSnapshotGenerator();
            codeSnapshots = snapshotGen.generateSnapshots(opts.inputDir(), runNumbers, warnings);
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

        // 10. Build output (empty feedback for MVP)
        FrontendOutput output = new FrontendOutput(
            context,
            episodes,
            episodeTestData,
            Collections.emptyList(), // Empty feedback for MVP
            testHistories,
            failureHighlights,
            codeSnapshots.isEmpty() ? null : codeSnapshots
        );

        // 11. Write output
        Files.createDirectories(opts.outputFile().getParent());
        Json.writeJson(opts.outputFile(), output);

        // 12. Calculate statistics
        int totalTests = (int) testHistories.size();

        return new PrepareResult(
            episodes.size(),
            runsWithTests.size(),
            totalTests,
            warnings
        );
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
        // Flatten all categories from all tests (a test can have multiple)
        Map<String, Long> categoryCounts = tests.stream()
            .flatMap(t -> mapping.getCategoriesForTest(t.testId()).stream())
            .collect(Collectors.groupingBy(c -> c, Collectors.counting()));

        return categoryCounts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("Unknown");
    }

    /**
     * Enhances test histories with error evolution and struggle profiles.
     */
    private List<TestHistory> enhanceTestHistories(
            List<TestHistory> histories,
            StatusChangeTracker tracker,
            TestCategoryMapping testCategories,
            DiffCategoryMapping diffCategories) {

        // Build error evolutions from tracker data
        ErrorEvolutionTracker errorTracker = new ErrorEvolutionTracker();
        Map<String, Map<Integer, String[]>> errorHistory = tracker.getErrorHistory();
        Map<String, Map<Integer, String>> statusHistory = tracker.getStatusHistory();

        // Populate error tracker from recorded data
        // errorInfo array: [0]=exceptionType, [1]=message, [2]=stackTrace
        for (Map.Entry<String, Map<Integer, String[]>> entry : errorHistory.entrySet()) {
            String testId = entry.getKey();
            Map<Integer, String> statuses = statusHistory.get(testId);
            for (Map.Entry<Integer, String[]> runEntry : entry.getValue().entrySet()) {
                int run = runEntry.getKey();
                String[] errorInfo = runEntry.getValue();
                String status = statuses != null ? statuses.get(run) : "fail";
                errorTracker.recordError(testId, run, status, errorInfo[0], errorInfo[1], errorInfo[2]);
            }
            // Also record the final status
            if (statuses != null && !statuses.isEmpty()) {
                int lastRun = Collections.max(statuses.keySet());
                String lastStatus = statuses.get(lastRun);
                errorTracker.recordError(testId, lastRun, lastStatus, null, null, null);
            }
        }

        Map<String, ErrorEvolution> evolutions = errorTracker.buildAllEvolutions();

        // Compute cross-test correlations
        CrossTestCorrelator correlator = new CrossTestCorrelator();
        Map<String, List<StruggleProfile.TestCorrelation>> correlations =
            correlator.computeCorrelations(statusHistory, tracker.getTestNames(), testCategories);

        // Generate struggle profiles
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

            // Add the enhanced data to the history
            enhanced.add(history.withStruggleData(evolution, profile));
        }

        return enhanced;
    }
}
