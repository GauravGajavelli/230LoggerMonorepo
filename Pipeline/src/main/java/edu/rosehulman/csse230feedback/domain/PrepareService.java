package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.IngestionManifest;
import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.model.frontend.*;
import edu.rosehulman.csse230feedback.prepare.*;
import edu.rosehulman.csse230feedback.util.Json;

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

        // 4. Build RunWithTests list
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

        // 5. Split into episodes
        EpisodeSplitter splitter = new EpisodeSplitter(
            opts.idleThresholdMs(),
            opts.categoryShiftWindow()
        );
        List<EpisodeSplitter.EpisodeBoundary> episodeBoundaries = splitter.splitIntoEpisodes(runsWithTests);

        // 6. Transform data
        StatusChangeTracker tracker = new StatusChangeTracker();
        DataTransformer transformer = new DataTransformer();
        TestCategoryAnalyzer categoryAnalyzer = new TestCategoryAnalyzer();

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

            // Extract dominant category
            List<EnrichedTestResult> allTestsInEpisode = episodeRuns.stream()
                .flatMap(r -> r.tests().stream())
                .toList();
            String dominantCategory = categoryAnalyzer.extractDominantCategory(allTestsInEpisode);

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
                    tracker
                );
                testRuns.add(testRun);
            }

            episodeTestData.add(new EpisodeTestData(episodeId, testRuns));
        }

        // 7. Generate test histories and failure highlights
        List<TestHistory> testHistories = tracker.buildTestHistories();
        FailureHighlights failureHighlights = tracker.buildFailureHighlights(testHistories);

        // 7b. Generate code snapshots (if enabled)
        List<CodeSnapshot> codeSnapshots = Collections.emptyList();
        if (opts.includeCodeSnapshots()) {
            Set<Integer> runNumbers = runsWithTests.stream()
                .map(EpisodeSplitter.RunWithTests::runNumber)
                .collect(Collectors.toSet());

            CodeSnapshotGenerator snapshotGen = new CodeSnapshotGenerator();
            codeSnapshots = snapshotGen.generateSnapshots(opts.inputDir(), runNumbers, warnings);
        }

        // 8. Build submission context
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

        // 9. Build output (empty feedback for MVP)
        FrontendOutput output = new FrontendOutput(
            context,
            episodes,
            episodeTestData,
            Collections.emptyList(), // Empty feedback for MVP
            testHistories,
            failureHighlights,
            codeSnapshots.isEmpty() ? null : codeSnapshots
        );

        // 10. Write output
        Files.createDirectories(opts.outputFile().getParent());
        Json.writeJson(opts.outputFile(), output);

        // 11. Calculate statistics
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
}
