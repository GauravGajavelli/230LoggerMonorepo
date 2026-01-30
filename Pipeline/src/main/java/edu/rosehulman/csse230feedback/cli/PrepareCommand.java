package edu.rosehulman.csse230feedback.cli;

import edu.rosehulman.csse230feedback.domain.PrepareOptions;
import edu.rosehulman.csse230feedback.domain.PrepareResult;
import edu.rosehulman.csse230feedback.domain.PrepareService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(
    name = "prepare",
    mixinStandardHelpOptions = true,
    description = "Transforms enriched test runs into frontend-compatible JSON with episodes."
)
public class PrepareCommand implements Callable<Integer> {

    @Option(names = {"-i", "--input"}, required = true, description = "Input directory (contains runs.jsonl, enriched_runs/, manifest.json).")
    private Path input;

    @Option(names = {"-o", "--output"}, required = true, description = "Output file path for frontend.json.")
    private Path output;

    @Option(names = {"--idle-threshold"}, description = "Idle gap threshold in minutes (default: 10).")
    private long idleThreshold = 10;

    @Option(names = {"--category-shift-window"}, description = "Consecutive runs required to confirm category shift (default: 2).")
    private int categoryShiftWindow = 2;

    @Option(names = {"--student-id"}, description = "Override student ID from manifest.")
    private String studentId;

    @Option(names = {"--assignment-name"}, description = "Override assignment name from manifest.")
    private String assignmentName;

    @Option(names = {"--include-code"}, description = "Include code snapshots in output (default: true).")
    private boolean includeCode = true;

    @Option(names = {"--no-code"}, description = "Exclude code snapshots from output.")
    private boolean noCode = false;

    @Override
    public Integer call() throws Exception {
        if (!Files.exists(input)) {
            System.err.println("Input directory does not exist: " + input);
            return 2;
        }

        if (!Files.isDirectory(input)) {
            System.err.println("Input must be a directory: " + input);
            return 2;
        }

        PrepareOptions opts = new PrepareOptions(
            input,
            output,
            idleThreshold,
            categoryShiftWindow,
            studentId,
            assignmentName,
            includeCode && !noCode
        );

        PrepareService service = new PrepareService();
        PrepareResult result = service.prepare(opts);

        System.out.println("Prepare complete.");
        System.out.println("  Output: " + output.toAbsolutePath());
        System.out.println("  Episodes: " + result.episodeCount());
        System.out.println("  Total runs: " + result.totalRuns());
        System.out.println("  Total tests: " + result.totalTests());

        if (!result.warnings().isEmpty()) {
            System.out.println("  Warnings:");
            for (String w : result.warnings()) {
                System.out.println("    - " + w);
            }
        }

        return 0;
    }
}
