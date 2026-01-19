package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import edu.rosehulman.csse230feedback.model.CompileResult;
import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.PatchPointer;
import edu.rosehulman.csse230feedback.model.RunStatus;
import edu.rosehulman.csse230feedback.model.TestRunResult;
import edu.rosehulman.csse230feedback.runner.*;
import edu.rosehulman.csse230feedback.util.Json;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Main service for running test reruns on code snapshots.
 * Orchestrates workspace creation, snapshot materialization, compilation,
 * test execution, and evidence harvesting.
 */
public class WorkspaceRunnerService {

    private static final String PATCHES_INDEX_FILENAME = "patches_index.jsonl";
    private static final String ARCHIVES_DIRNAME = "archives";
    private static final String ENRICHED_DIRNAME = "enriched_runs";

    private final WorkspaceManager workspaceManager = new WorkspaceManager();
    private final SnapshotMaterializer snapshotMaterializer = new SnapshotMaterializer();
    private final TestSupportOverlay testSupportOverlay = new TestSupportOverlay();
    private final EvidenceHarvester evidenceHarvester = new EvidenceHarvester();

    /**
     * Runs the rerun process according to the provided options.
     *
     * @param options Configuration options for the rerun
     * @return RerunResult with processing outcomes
     * @throws IOException if I/O operations fail
     */
    public RerunResult run(RerunOptions options) throws IOException {
        RerunResult.Builder resultBuilder = RerunResult.builder();

        // Validate paths
        validateOptions(options, resultBuilder);
        if (!resultBuilder.build().errors().isEmpty()) {
            return resultBuilder.build();
        }

        // Load patches index
        List<PatchPointer> allPatches = loadPatchesIndex(options.inputDir(), resultBuilder);
        if (allPatches.isEmpty()) {
            resultBuilder.addError("No patches found in " + options.inputDir());
            return resultBuilder.build();
        }

        // Determine which runs to process
        List<Integer> runNumbers = determineRunNumbers(options, allPatches, resultBuilder);

        // Create output directories
        Path enrichedDir = options.outDir().resolve(ENRICHED_DIRNAME);
        Files.createDirectories(enrichedDir);
        Files.createDirectories(options.workDir());

        // Create cache directory for diff extraction
        Path cacheDir = options.workDir().resolve("diff_cache");
        Files.createDirectories(cacheDir);

        // Create runners with appropriate timeouts
        JavaCompilerRunner compiler = new JavaCompilerRunner(
            options.javaVersion(),
            options.compileTimeout(),
            options.javaHome()
        );
        JUnitPlatformRunner junitRunner = new JUnitPlatformRunner(
            options.testTimeout(),
            options.javaHome()
        );

        Path sharedWorkspace = workspaceManager.createWorkspace(options.workDir(), "shared");

        try {
            // Overlay testSupport once so run.tar can accumulate across runs.
            if (options.testSupportDir() != null && Files.exists(options.testSupportDir())) {
                testSupportOverlay.overlayTestSupport(sharedWorkspace, options.testSupportDir());
            } else {
                testSupportOverlay.createMinimalTestSupport(sharedWorkspace);
                resultBuilder.addWarning("Using minimal testSupport (source not provided)");
            }

            // Process each run in the same workspace
            for (int runNumber : runNumbers) {
                workspaceManager.clearSrcDirPreserveTestSupport(sharedWorkspace);
                workspaceManager.clearBinDir(sharedWorkspace);
                processRun(options, runNumber, allPatches, cacheDir, enrichedDir,
                    compiler, junitRunner, resultBuilder, sharedWorkspace);
            }

            summarizeRunCoverage(sharedWorkspace, runNumbers, enrichedDir, resultBuilder);
        } finally {
            if (!options.keepWorkDir()) {
                workspaceManager.deleteWorkspace(sharedWorkspace);
            }
        }

        return resultBuilder.build();
    }

    /**
     * Processes a single run number.
     */
    private void processRun(RerunOptions options, int runNumber, List<PatchPointer> allPatches,
            Path cacheDir, Path enrichedDir, JavaCompilerRunner compiler,
            JUnitPlatformRunner junitRunner, RerunResult.Builder resultBuilder, Path workspace) {

        resultBuilder.incrementRunsProcessed();
        List<String> warnings = new ArrayList<>();

        try {
            // Materialize snapshot
            int filesWritten = snapshotMaterializer.materializeLatestSnapshot(
                workspace,
                options.inputDir().resolve(ARCHIVES_DIRNAME),
                cacheDir,
                runNumber,
                allPatches,
                warnings
            );

            if (filesWritten == 0) {
                resultBuilder.addError("Run " + runNumber + ": No files materialized");
                resultBuilder.addWarnings(warnings);
                writeRunStatus(enrichedDir, new RunStatus(
                    runNumber,
                    "materialize_failed",
                    List.of("No files materialized"),
                    List.copyOf(warnings)
                ));
                return;
            }

            updateStartTestRunInfo(workspace, runNumber, warnings);

            // Compile
            CompileResult compileResult = compiler.compile(workspace, options.depsDir());
            if (!compileResult.success()) {
                resultBuilder.addError("Run " + runNumber + ": Compilation failed - " +
                    String.join("; ", compileResult.errors()));
                resultBuilder.addWarnings(warnings);
                writeRunStatus(enrichedDir, new RunStatus(
                    runNumber,
                    "compile_failed",
                    List.copyOf(compileResult.errors()),
                    List.copyOf(warnings)
                ));
                return;
            }
            resultBuilder.incrementRunsCompiled();

            enableLoggingExtensionAutodetect(workspace, warnings);

            // Run tests
            String[] testSelector = options.parseTestSelector();
            TestRunResult testResult = junitRunner.runTests(
                workspace, options.depsDir(),
                testSelector[0], testSelector[1]
            );

            resultBuilder.incrementRunsExecuted();
            resultBuilder.addTestsFound(testResult.testsFound());
            resultBuilder.addTestsPassed(testResult.testsSucceeded());
            resultBuilder.addTestsFailed(testResult.testsFailed());

            warnIfRunTarPlaceholder(workspace, warnings);

            // Harvest evidence
            EvidenceHarvester.HarvestResult harvestResult = evidenceHarvester.harvestAndCopy(
                workspace, enrichedDir, String.valueOf(runNumber)
            );

            warnings.addAll(harvestResult.warnings());
            resultBuilder.addRunResult(runNumber, harvestResult.results());
            resultBuilder.addWarnings(warnings);

        } catch (Exception e) {
            resultBuilder.addError("Run " + runNumber + ": " + e.getMessage());
            resultBuilder.addWarnings(warnings);
            writeRunStatus(enrichedDir, new RunStatus(
                runNumber,
                "exception",
                List.of(e.getMessage()),
                List.copyOf(warnings)
            ));
        }
    }

    private void writeRunStatus(Path enrichedDir, RunStatus status) {
        try {
            Path out = enrichedDir.resolve("run_" + status.runNumber() + "_status.json");
            Json.writeJson(out, status);
        } catch (IOException e) {
            // Best-effort status file to keep partial results visible.
        }
    }

    private void updateStartTestRunInfo(Path workspace, int runNumber, List<String> warnings) {
        Path startInfoPath = workspace.resolve("src").resolve("testSupport").resolve("startTestRunInfo.json");
        if (!Files.exists(startInfoPath)) {
            warnings.add("startTestRunInfo.json not found at " + startInfoPath);
            return;
        }

        try {
            var mapper = Json.mapper();
            var root = mapper.readTree(startInfoPath.toFile());
            if (root != null && root.isObject()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) root)
                    .put("prevRunNumber", Math.max(0, runNumber - 1));
                mapper.writerWithDefaultPrettyPrinter().writeValue(startInfoPath.toFile(), root);
            }
        } catch (IOException e) {
            warnings.add("Failed to update startTestRunInfo.json: " + e.getMessage());
        }
    }

    private void summarizeRunCoverage(Path workspace, List<Integer> runNumbers, Path enrichedDir,
            RerunResult.Builder resultBuilder) {
        Set<Integer> failedRuns = new HashSet<>();
        try (Stream<Path> stream = Files.list(enrichedDir)) {
            stream.filter(p -> p.getFileName().toString().endsWith("_status.json"))
                .forEach(p -> {
                    try {
                        var node = Json.mapper().readTree(p.toFile());
                        if (node != null && node.has("runNumber")) {
                            failedRuns.add(node.get("runNumber").asInt());
                        } else {
                            String name = p.getFileName().toString();
                            int us = name.indexOf('_');
                            int end = name.indexOf("_status.json");
                            if (us >= 0 && end > us) {
                                failedRuns.add(Integer.parseInt(name.substring(us + 1, end)));
                            }
                        }
                    } catch (Exception ignored) {
                        // Best-effort; missing run numbers simply won't be excluded.
                    }
                });
        } catch (IOException e) {
            resultBuilder.addWarning("Failed to read run status files: " + e.getMessage());
        }

        Set<Integer> executedRuns = new TreeSet<>(runNumbers);
        executedRuns.removeAll(failedRuns);

        Set<Integer> loggedRuns = readLoggedRuns(workspace.resolve("src")
            .resolve("testSupport").resolve("run.tar"), resultBuilder);

        if (!failedRuns.isEmpty()) {
            resultBuilder.addWarning("Runs with status files (failed to complete): " + new TreeSet<>(failedRuns));
        }
    }

    private Set<Integer> readLoggedRuns(Path runTar, RerunResult.Builder resultBuilder) {
        Set<Integer> runs = new TreeSet<>();
        if (!Files.exists(runTar)) {
            resultBuilder.addWarning("run.tar not found for run coverage summary: " + runTar);
            return runs;
        }

        try (InputStream fin = Files.newInputStream(runTar);
             BufferedInputStream bin = new BufferedInputStream(fin);
             TarArchiveInputStream tin = new TarArchiveInputStream(bin)) {
            TarArchiveEntry entry;
            while ((entry = tin.getNextTarEntry()) != null) {
                if (!entry.isDirectory() && entry.getName().endsWith("testRunInfo.json")) {
                    var node = Json.mapper().readTree(tin);
                    var runTimes = node.get("runTimes");
                    if (runTimes != null && runTimes.isObject()) {
                        runTimes.fieldNames().forEachRemaining(k -> {
                            try {
                                runs.add(Integer.parseInt(k));
                            } catch (NumberFormatException ignored) {
                                // ignore non-integer keys
                            }
                        });
                    }
                    break;
                }
            }
        } catch (IOException e) {
            resultBuilder.addWarning("Failed to read testRunInfo.json for run coverage: " + e.getMessage());
        }

        return runs;
    }


    private void enableLoggingExtensionAutodetect(Path workspace, List<String> warnings) {
        try {
            Path classFile = workspace.resolve("bin")
                .resolve("testSupport")
                .resolve("LoggingExtension.class");
            if (!Files.exists(classFile)) {
                warnings.add("LoggingExtension not found in compiled output; run.tar may be empty");
                return;
            }

            Path servicesDir = workspace.resolve("bin")
                .resolve("META-INF")
                .resolve("services");
            Files.createDirectories(servicesDir);
            Path serviceFile = servicesDir.resolve("org.junit.jupiter.api.extension.Extension");
            Files.writeString(serviceFile, "testSupport.LoggingExtension\n");
        } catch (IOException e) {
            warnings.add("Failed to enable LoggingExtension autodetection: " + e.getMessage());
        }
    }

    private void warnIfRunTarPlaceholder(Path workspace, List<String> warnings) {
        try {
            Path runTar = workspace.resolve("src").resolve("testSupport").resolve("run.tar");
            if (!Files.exists(runTar)) {
                warnings.add("run.tar not found at " + runTar + " (LoggingExtension may not have run)");
                return;
            }

            long size = Files.size(runTar);
            if (size <= 4) {
                warnings.add("run.tar looks empty (" + size + " bytes) at " + runTar);
            }
        } catch (IOException e) {
            warnings.add("Failed to inspect run.tar: " + e.getMessage());
        }
    }

    /**
     * Validates options and adds errors if invalid.
     */
    private void validateOptions(RerunOptions options, RerunResult.Builder resultBuilder) {
        if (options.inputDir() == null || !Files.exists(options.inputDir())) {
            resultBuilder.addError("Input directory does not exist: " + options.inputDir());
        }
        if (options.outDir() == null) {
            resultBuilder.addError("Output directory not specified");
        }
        if (options.depsDir() == null || !Files.exists(options.depsDir())) {
            resultBuilder.addError("Dependencies directory does not exist: " + options.depsDir());
        }
    }

    /**
     * Loads patch pointers from patches_index.jsonl.
     */
    private List<PatchPointer> loadPatchesIndex(Path inputDir, RerunResult.Builder resultBuilder) {
        Path indexPath = inputDir.resolve(PATCHES_INDEX_FILENAME);
        if (!Files.exists(indexPath)) {
            resultBuilder.addError("Patches index not found: " + indexPath);
            return List.of();
        }

        List<PatchPointer> patches = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(indexPath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    PatchPointer patch = Json.mapper().readValue(line, PatchPointer.class);
                    patches.add(patch);
                }
            }
        } catch (IOException e) {
            resultBuilder.addError("Failed to read patches index: " + e.getMessage());
        }

        return patches;
    }

    /**
     * Determines which run numbers to process based on options.
     */
    private List<Integer> determineRunNumbers(RerunOptions options, List<PatchPointer> patches,
            RerunResult.Builder resultBuilder) {
        List<Integer> availableRuns = snapshotMaterializer.getAvailableRunNumbers(patches);

        if (options.hasSpecificRun()) {
            int targetRun = options.runNumber();
            if (!availableRuns.contains(targetRun)) {
                // Find nearest available run at or before target
                int nearest = availableRuns.stream()
                    .filter(r -> r <= targetRun)
                    .max(Integer::compareTo)
                    .orElse(-1);

                if (nearest < 0) {
                    resultBuilder.addWarning("Run " + targetRun + " not found, no earlier runs available");
                    return List.of();
                }

                resultBuilder.addWarning("Run " + targetRun + " not found, using nearest: " + nearest);
                return List.of(nearest);
            }
            return List.of(targetRun);
        }

        // Return all available runs
        return availableRuns;
    }
}
