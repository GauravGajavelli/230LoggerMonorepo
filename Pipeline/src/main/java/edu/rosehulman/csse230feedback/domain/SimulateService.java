package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.difflib.DiffUtils;
import com.github.difflib.UnifiedDiffUtils;
import com.github.difflib.algorithm.DiffException;
import com.github.difflib.patch.Patch;
import edu.rosehulman.csse230feedback.model.*;
import edu.rosehulman.csse230feedback.util.Json;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Orchestrates test data simulation: builds a progression model, generates runs,
 * and writes output compatible with the prepare command.
 */
public class SimulateService {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter
        .ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .withZone(ZoneOffset.UTC);

    // Canonical BST test definitions from test_categories.json
    private static final List<TestCatDef> TEST_CATALOG = List.of(
        // basic_insert (4)
        new TestCatDef("BSTTesting", "testInsertInts", "basic_insert"),
        new TestCatDef("BSTTesting", "testInsertStrings", "basic_insert"),
        new TestCatDef("BSTTesting", "testInsertReturnValueInt", "basic_insert"),
        new TestCatDef("BSTTesting", "testInsertReturnValueString", "basic_insert"),
        // search_contains (2)
        new TestCatDef("BSTTesting", "testContainsInts", "search_contains"),
        new TestCatDef("BSTTesting", "testContainsStrings", "search_contains"),
        // deletion (3)
        new TestCatDef("BSTTesting", "testRemove", "deletion"),
        new TestCatDef("BSTTesting", "testRemoveReturnValue", "deletion"),
        new TestCatDef("BSTTesting", "testRemoveAdvanced", "deletion"),
        // tree_properties (5)
        new TestCatDef("BSTTesting", "testHeight", "tree_properties"),
        new TestCatDef("BSTTesting", "testSize", "tree_properties"),
        new TestCatDef("BSTTesting", "testIsEmpty", "tree_properties"),
        new TestCatDef("BSTManualTesting", "testSize", "tree_properties"),
        new TestCatDef("BSTManualTesting", "testHeight", "tree_properties"),
        // conversion (4)
        new TestCatDef("BSTTesting", "testToArrayList", "conversion"),
        new TestCatDef("BSTTesting", "testToArrayInts", "conversion"),
        new TestCatDef("BSTTesting", "testToArrayStrings", "conversion"),
        new TestCatDef("BSTTesting", "testToString", "conversion"),
        // iterators (3)
        new TestCatDef("BSTTesting", "testInefficientIterator", "iterators"),
        new TestCatDef("BSTTesting", "testPreOrderIterator", "iterators"),
        new TestCatDef("BSTTesting", "testIterator", "iterators"),
        // edge_cases (2)
        new TestCatDef("BSTTesting", "testInsertExceptions", "edge_cases"),
        new TestCatDef("BSTTesting", "testRemoveIllegalArgumentException", "edge_cases"),
        // efficiency (1)
        new TestCatDef("BSTTesting", "testEfficiency", "efficiency"),
        // concurrency (5)
        new TestCatDef("BSTConcurrencyTesting", "testPreOrderIteratorConcurrentModificationException", "concurrency"),
        new TestCatDef("BSTConcurrencyTesting", "testIterator", "concurrency"),
        new TestCatDef("BSTConcurrencyTesting", "testRemoveConcurrentModifcationException", "concurrency"),
        new TestCatDef("BSTConcurrencyTesting", "testRemoveInPreOrderIterator", "concurrency"),
        new TestCatDef("BSTConcurrencyTesting", "testRemoveInInOrderIterator", "concurrency")
    );

    private record TestCatDef(String testClass, String testMethod, String category) {}

    public SimulateResult simulate(SimulateOptions opts) throws IOException {
        Random random = new Random(opts.seed());

        // Build test definitions
        List<ProgressionModel.TestDef> testDefs = TEST_CATALOG.stream()
            .map(t -> new ProgressionModel.TestDef(t.testClass, t.testMethod, t.category))
            .toList();

        ProgressionModel model = new ProgressionModel(
            new Random(opts.seed()), opts.difficulty(), opts.numRuns(), testDefs,
            opts.progressionOverrides());
        ErrorGenerator errorGen = new ErrorGenerator(new Random(opts.seed() + 1));
        BstTemplateGenerator templateGen = new BstTemplateGenerator();

        // Generate timestamps with sessions
        List<Long> timestamps = generateTimestamps(random, opts.numRuns());

        List<RunRecord> runRecords = new ArrayList<>();
        List<List<EnrichedTestResult>> enrichedRuns = new ArrayList<>();
        List<Integer> runPhases = new ArrayList<>();
        int totalTestResults = 0;

        for (int run = 1; run <= opts.numRuns(); run++) {
            ProgressionModel.RunProfile profile = model.getProfile(run);
            int phase = model.getPhase(scaleRun(run, opts.numRuns()));
            runPhases.add(phase);

            List<TestResultRecord> testResults = new ArrayList<>();
            List<EnrichedTestResult> enrichedResults = new ArrayList<>();

            for (ProgressionModel.TestDef test : profile.activeTests()) {
                double passProb = profile.passProbabilities().getOrDefault(test.testId(), 0.0);
                boolean passes = random.nextDouble() < passProb;

                TestStatus status;
                String cause = null;
                EnrichedTestResult enriched;

                if (passes) {
                    status = TestStatus.SUCCESSFUL;
                    long duration = 5 + random.nextInt(200);
                    enriched = EnrichedTestResult.create(
                        test.testClass(), test.testMethod() + "()",
                        status, null, duration, null, null, null, null, null,
                        "[engine:junit-jupiter]/[class:" + test.testClass() + "]/[method:" + test.testMethod() + "()]"
                    );
                } else {
                    status = TestStatus.FAILED;
                    ErrorGenerator.ErrorType errorType = errorGen.pickErrorType(test.category(), phase);
                    ErrorGenerator.GeneratedError err = errorGen.generate(errorType, test.testClass(), test.testMethod());

                    cause = err.cause();
                    long duration = (phase == 0) ? 0 : (10 + random.nextInt(500));
                    enriched = EnrichedTestResult.create(
                        test.testClass(), test.testMethod() + "()",
                        status, cause, duration,
                        err.stackTrace(), err.exceptionType(), err.message(),
                        err.expected(), err.actual(),
                        "[engine:junit-jupiter]/[class:" + test.testClass() + "]/[method:" + test.testMethod() + "()]"
                    );
                }

                testResults.add(new TestResultRecord(
                    test.testClass(), test.testMethod() + "()",
                    test.testId(), status, cause
                ));
                enrichedResults.add(enriched);
                totalTestResults++;
            }

            long timestampMs = timestamps.get(run - 1);
            String timestamp = TS_FORMAT.format(Instant.ofEpochMilli(timestampMs));

            runRecords.add(new RunRecord(run, timestamp, timestampMs, testResults));
            enrichedRuns.add(enrichedResults);
        }

        // Generate code snapshots and diffs for each run
        Map<Integer, String> codeSnapshots = new LinkedHashMap<>();
        Map<Integer, String> patches = new LinkedHashMap<>();
        Map<Integer, List<String>> diffCategoryLabels = new LinkedHashMap<>();

        for (int i = 0; i < runPhases.size(); i++) {
            int run = i + 1;
            int phase = runPhases.get(i);
            String code = templateGen.getTemplate(phase);
            codeSnapshots.put(run, code);

            if (i == 0) {
                // First run: diff against empty
                patches.put(run, "");
                diffCategoryLabels.put(run, List.of());
            } else {
                int prevPhase = runPhases.get(i - 1);
                String prevCode = codeSnapshots.get(run - 1);
                if (phase != prevPhase) {
                    // Phase transition: compute real diff
                    String diff = computeUnifiedDiff(prevCode, code, "BinarySearchTree.java");
                    patches.put(run, diff);
                    diffCategoryLabels.put(run, templateGen.getDiffCategories(prevPhase, phase));
                } else {
                    // Same phase: no code change
                    patches.put(run, "");
                    diffCategoryLabels.put(run, List.of());
                }
            }
        }

        // Write output based on format
        String fmt = opts.format();
        boolean writePrepare = fmt.equals("prepare") || fmt.equals("both");
        boolean writeTar = fmt.equals("tar") || fmt.equals("both");

        if (writePrepare) {
            writeOutput(opts, runRecords, enrichedRuns, codeSnapshots, patches, diffCategoryLabels);
        }
        if (writeTar) {
            writeTar(opts, runRecords, timestamps, codeSnapshots);
        }

        // Copy narrative files to output directory if present
        if (opts.narrativePath() != null) {
            copyNarrativeFiles(opts.narrativePath(), opts.outputDir());
        }

        return new SimulateResult(opts.numRuns(), totalTestResults, writeTar);
    }

    private void copyNarrativeFiles(Path narrativePath, Path outputDir) throws IOException {
        Files.createDirectories(outputDir);
        Files.copy(narrativePath, outputDir.resolve("narrative.json"),
            java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        Path mdPath = narrativePath.resolveSibling(
            narrativePath.getFileName().toString().replace(".json", ".md"));
        if (Files.exists(mdPath)) {
            Files.copy(mdPath, outputDir.resolve("narrative.md"),
                java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private String computeUnifiedDiff(String oldCode, String newCode, String fileName) {
        try {
            List<String> oldLines = Arrays.asList(oldCode.split("\n", -1));
            List<String> newLines = Arrays.asList(newCode.split("\n", -1));
            Patch<String> patch = DiffUtils.diff(oldLines, newLines);
            List<String> unifiedDiff = UnifiedDiffUtils.generateUnifiedDiff(
                "a/" + fileName, "b/" + fileName, oldLines, patch, 3
            );
            return String.join("\n", unifiedDiff);
        } catch (DiffException e) {
            return ""; // Fallback to empty diff on error
        }
    }

    private void writeOutput(SimulateOptions opts, List<RunRecord> runs,
                             List<List<EnrichedTestResult>> enrichedRuns,
                             Map<Integer, String> codeSnapshots,
                             Map<Integer, String> patches,
                             Map<Integer, List<String>> diffCategoryLabels) throws IOException {
        Path outDir = opts.outputDir();
        Files.createDirectories(outDir);

        // runs.jsonl
        Json.writeJsonl(outDir.resolve("runs.jsonl"), runs);

        // enriched_runs/
        Path enrichedDir = outDir.resolve("enriched_runs");
        Files.createDirectories(enrichedDir);
        for (int i = 0; i < enrichedRuns.size(); i++) {
            Json.writeJson(enrichedDir.resolve("enriched_" + (i + 1) + ".json"), enrichedRuns.get(i));
        }

        // manifest.json
        IngestionManifest manifest = new IngestionManifest(
            1,
            Instant.now().toString(),
            "simulated",
            "simulated/run.tar",
            "0000000000000000000000000000000000000000000000000000000000000000",
            List.of(),
            List.of(),
            List.of("Simulated data generated with seed=" + opts.seed())
        );
        Json.writeJson(outDir.resolve("manifest.json"), manifest);

        // test_categories.json (optional)
        if (opts.includeCategories()) {
            Path srcCategories = Path.of("testInputs", "test_diff_categories",
                opts.assignment(), "test_categories.json");
            if (Files.exists(srcCategories)) {
                Files.copy(srcCategories, outDir.resolve("test_categories.json"),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            } else {
                // Generate from our catalog
                writeGeneratedCategories(outDir);
            }
        }

        // source_snapshots/
        Path snapshotsDir = outDir.resolve("source_snapshots");
        for (var entry : codeSnapshots.entrySet()) {
            Path runDir = snapshotsDir.resolve("run_" + entry.getKey());
            Files.createDirectories(runDir);
            Files.writeString(runDir.resolve("BinarySearchTree.java"), entry.getValue());
        }

        // patches/
        Path patchesDir = outDir.resolve("patches");
        Files.createDirectories(patchesDir);
        for (var entry : patches.entrySet()) {
            int run = entry.getKey();
            String diff = entry.getValue();
            if (!diff.isEmpty()) {
                Files.writeString(patchesDir.resolve("patch_" + run + ".diff"), diff);
            }
        }

        // patches_index.jsonl
        writePatchesIndex(outDir, patches);

        // diff_categories.json
        writeDiffCategories(outDir, diffCategoryLabels, opts.assignment());
    }

    private void writeTar(SimulateOptions opts, List<RunRecord> runs,
                          List<Long> timestamps, Map<Integer, String> codeSnapshots) throws IOException {
        Files.createDirectories(opts.outputDir());
        ObjectNode testRunInfo = buildTestRunInfo(runs, timestamps, opts.seed());
        writeTarArchive(opts.outputDir().resolve("run.tar"), testRunInfo, codeSnapshots);
    }

    private ObjectNode buildTestRunInfo(List<RunRecord> runs, List<Long> timestamps, long seed) {
        ObjectNode root = Json.mapper().createObjectNode();
        root.put("schema_version", 1.0);
        root.put("prevRunNumber", 0);
        root.put("redactDiffs", false);
        root.put("rebaselining", false);
        root.put("prevBaselineRunNumber", 0);
        root.put("skipLogging", false);
        root.put("randomSeed", seed);

        // runTimes: "runNumber" -> ISO timestamp
        ObjectNode runTimes = root.putObject("runTimes");
        for (int i = 0; i < runs.size(); i++) {
            RunRecord run = runs.get(i);
            runTimes.put(String.valueOf(run.runNumber()), run.timestamp());
        }

        // strikes and toIgnore (empty)
        root.putObject("strikes");
        root.putArray("toIgnore");

        // Nest test results: TestClass -> testDisplayName -> runNumber -> "STATUS[: cause]"
        for (RunRecord run : runs) {
            for (TestResultRecord test : run.tests()) {
                String className = test.testClassSimple();
                ObjectNode classNode = (ObjectNode) root.get(className);
                if (classNode == null) {
                    classNode = root.putObject(className);
                }
                String methodName = test.testDisplayName();
                ObjectNode methodNode = (ObjectNode) classNode.get(methodName);
                if (methodNode == null) {
                    methodNode = classNode.putObject(methodName);
                }
                String value = test.status().name();
                if (test.cause() != null) {
                    value += ": " + test.cause();
                }
                methodNode.put(String.valueOf(run.runNumber()), value);
            }
        }

        return root;
    }

    private void writeTarArchive(Path tarPath, ObjectNode testRunInfo,
                                  Map<Integer, String> codeSnapshots) throws IOException {
        byte[] jsonBytes = Json.mapper().writeValueAsBytes(testRunInfo);

        try (FileOutputStream fos = new FileOutputStream(tarPath.toFile());
             BufferedOutputStream bos = new BufferedOutputStream(fos);
             TarArchiveOutputStream tar = new TarArchiveOutputStream(bos)) {
            tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);

            TarArchiveEntry entry = new TarArchiveEntry("testRunInfo.json");
            entry.setSize(jsonBytes.length);
            tar.putArchiveEntry(entry);
            tar.write(jsonBytes);
            tar.closeArchiveEntry();

            // Include source snapshots
            for (var snapEntry : codeSnapshots.entrySet()) {
                byte[] srcBytes = snapEntry.getValue().getBytes(StandardCharsets.UTF_8);
                TarArchiveEntry srcEntry = new TarArchiveEntry(
                    "src/run_" + snapEntry.getKey() + "/BinarySearchTree.java"
                );
                srcEntry.setSize(srcBytes.length);
                tar.putArchiveEntry(srcEntry);
                tar.write(srcBytes);
                tar.closeArchiveEntry();
            }

            tar.finish();
        }
    }

    private void writePatchesIndex(Path outDir, Map<Integer, String> patches) throws IOException {
        Path indexPath = outDir.resolve("patches_index.jsonl");
        try (BufferedWriter writer = Files.newBufferedWriter(indexPath)) {
            for (var entry : patches.entrySet()) {
                int run = entry.getKey();
                String diff = entry.getValue();
                ObjectNode node = Json.mapper().createObjectNode();
                node.put("runNumber", run);
                if (!diff.isEmpty()) {
                    node.put("patchFile", "patches/patch_" + run + ".diff");
                    node.put("hasChanges", true);
                } else {
                    node.putNull("patchFile");
                    node.put("hasChanges", false);
                }
                writer.write(Json.compactMapper().writeValueAsString(node));
                writer.newLine();
            }
        }
    }

    private void writeDiffCategories(Path outDir, Map<Integer, List<String>> diffCategoryLabels,
                                     String assignment) throws IOException {
        List<DiffCategoryMapping.DiffLabel> labels = new ArrayList<>();
        for (var entry : diffCategoryLabels.entrySet()) {
            int run = entry.getKey();
            List<String> cats = entry.getValue();
            if (!cats.isEmpty()) {
                labels.add(new DiffCategoryMapping.DiffLabel(
                    run,
                    "phase_transition",
                    cats,
                    "high",
                    "Simulated phase transition",
                    List.of("BinarySearchTree.java")
                ));
            }
        }
        DiffCategoryMapping mapping = new DiffCategoryMapping(
            assignment != null ? assignment : "BinarySearchTree",
            Instant.now().toString(),
            "simulated",
            labels
        );
        Json.writeJson(outDir.resolve("diff_categories.json"), mapping);
    }

    private void writeGeneratedCategories(Path outDir) throws IOException {
        // Build category map
        Map<String, TestCategoryMapping.CategoryInfo> categories = new LinkedHashMap<>();
        Map<String, List<String>> testToCategories = new LinkedHashMap<>();

        Map<String, List<String>> catToTests = new LinkedHashMap<>();
        Map<String, String> catDescriptions = Map.of(
            "basic_insert", "Core insert functionality - adding elements to the tree",
            "search_contains", "Finding elements in the tree using contains()",
            "deletion", "Removing elements while maintaining BST property",
            "tree_properties", "Tree structure queries - size, height, isEmpty",
            "conversion", "Converting tree to other representations",
            "iterators", "Tree traversal via iterators",
            "edge_cases", "Exception handling and null checks",
            "efficiency", "Performance and algorithmic efficiency",
            "concurrency", "Optional: Concurrent modification handling (not graded)"
        );

        for (TestCatDef t : TEST_CATALOG) {
            String testId = t.testClass + "#" + t.testMethod;
            catToTests.computeIfAbsent(t.category, k -> new ArrayList<>()).add(testId);
            testToCategories.put(testId, List.of(t.category));
        }

        for (var entry : catToTests.entrySet()) {
            String cat = entry.getKey();
            categories.put(cat, new TestCategoryMapping.CategoryInfo(
                catDescriptions.getOrDefault(cat, cat),
                entry.getValue()
            ));
        }

        TestCategoryMapping mapping = new TestCategoryMapping(categories, testToCategories);
        Json.writeJson(outDir.resolve("test_categories.json"), mapping);
    }

    /**
     * Generates timestamps simulating sessions of 4-8 runs with 1-5 min between
     * runs within a session and 30-120 min gaps between sessions.
     */
    private List<Long> generateTimestamps(Random random, int numRuns) {
        List<Long> timestamps = new ArrayList<>();
        // Start at a realistic time
        long currentMs = Instant.parse("2025-01-15T09:00:00Z").toEpochMilli();

        int runsInCurrentSession = 0;
        int sessionLength = 4 + random.nextInt(5); // 4-8

        for (int i = 0; i < numRuns; i++) {
            timestamps.add(currentMs);

            runsInCurrentSession++;
            if (runsInCurrentSession >= sessionLength) {
                // Between-session gap: 30-120 min
                currentMs += (30 + random.nextInt(91)) * 60 * 1000L;
                runsInCurrentSession = 0;
                sessionLength = 4 + random.nextInt(5);
            } else {
                // Within-session gap: 1-5 min
                currentMs += (1 + random.nextInt(5)) * 60 * 1000L;
            }
        }

        return timestamps;
    }

    private int scaleRun(int runNumber, int totalRuns) {
        if (totalRuns <= 30) return runNumber;
        return (int) Math.ceil((double) runNumber / totalRuns * 30.0);
    }
}
