package edu.rosehulman.csse230feedback.cli;

import edu.rosehulman.csse230feedback.domain.RerunOptions;
import edu.rosehulman.csse230feedback.domain.RerunResult;
import edu.rosehulman.csse230feedback.domain.WorkspaceRunnerService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(
        name = "rerun",
        mixinStandardHelpOptions = true,
        description = "Re-runs JUnit tests on code snapshots to capture enriched evidence (stack traces, expected/actual, duration)."
)
public class RerunCommand implements Callable<Integer> {

    @Option(names = {"-i", "--input"}, required = true,
            description = "Path to ingested output directory (contains archives/, runs.jsonl, patches_index.jsonl).")
    private Path input;

    @Option(names = {"-o", "--out"}, required = true,
            description = "Output directory for enriched results.")
    private Path out;

    @Option(names = {"--work"},
            description = "Working directory for temp workspaces (default: <out>/work).")
    private Path work;

    @Option(names = {"--deps"}, required = true,
            description = "Path to dependencies directory (JARs including junit-platform-console-standalone).")
    private Path deps;

    @Option(names = {"--test-support"},
            description = "Path to testSupport source files to overlay.")
    private Path testSupport;

    @Option(names = {"--run"},
            description = "Specific run number to rerun (default: all runs).")
    private int runNumber = -1;

    @Option(names = {"--test"},
            description = "Specific test to rerun (format: TestClass#testMethod).")
    private String test;

    @Option(names = {"--java-home"},
            description = "Java home path (default: system JAVA_HOME or 'java' on PATH).")
    private Path javaHome;

    @Option(names = {"--java-version"},
            description = "Java version to compile for (default: 17).")
    private int javaVersion = RerunOptions.DEFAULT_JAVA_VERSION;

    @Option(names = {"--keep-work"},
            description = "Preserve working directories after completion (useful for debugging).")
    private boolean keepWork;

    @Option(names = {"--compile-timeout"},
            description = "Compilation timeout in seconds (default: 120).")
    private int compileTimeout = RerunOptions.DEFAULT_COMPILE_TIMEOUT;

    @Option(names = {"--test-timeout"},
            description = "Test execution timeout in seconds (default: 300).")
    private int testTimeout = RerunOptions.DEFAULT_TEST_TIMEOUT;

    @Override
    public Integer call() throws Exception {
        // Validate input
        if (!Files.exists(input)) {
            System.err.println("Input directory does not exist: " + input);
            return 2;
        }
        if (!Files.exists(deps)) {
            System.err.println("Dependencies directory does not exist: " + deps);
            return 2;
        }

        // Create output directories
        Files.createDirectories(out);
        if (work == null) {
            work = out.resolve("work");
        }
        Files.createDirectories(work);

        // Build options
        RerunOptions options = RerunOptions.builder()
                .inputDir(input)
                .outDir(out)
                .workDir(work)
                .depsDir(deps)
                .testSupportDir(testSupport)
                .javaHome(javaHome)
                .javaVersion(javaVersion)
                .runNumber(runNumber)
                .testSelector(test)
                .keepWorkDir(keepWork)
                .compileTimeout(compileTimeout)
                .testTimeout(testTimeout)
                .build();

        // Run the service
        WorkspaceRunnerService service = new WorkspaceRunnerService();
        RerunResult result = service.run(options);

        // Print results
        System.out.println("Rerun complete.");
        System.out.println("  Output: " + out.toAbsolutePath());
        System.out.println("  Runs processed: " + result.runsProcessed());
        System.out.println("  Runs compiled: " + result.runsCompiled());
        System.out.println("  Runs executed: " + result.runsExecuted());
        System.out.println("  Tests found: " + result.totalTestsFound());
        System.out.println("  Tests passed: " + result.totalTestsPassed());
        System.out.println("  Tests failed: " + result.totalTestsFailed());

        if (!result.warnings().isEmpty()) {
            System.out.println("  Warnings:");
            for (String w : result.warnings()) {
                System.out.println("    - " + w);
            }
        }

        if (!result.errors().isEmpty()) {
            System.err.println("  Errors:");
            for (String e : result.errors()) {
                System.err.println("    - " + e);
            }
            return 1;
        }

        return 0;
    }
}
