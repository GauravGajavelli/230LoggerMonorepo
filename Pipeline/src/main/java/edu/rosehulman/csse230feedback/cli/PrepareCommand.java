package edu.rosehulman.csse230feedback.cli;

import edu.rosehulman.csse230feedback.domain.PrepareOptions;
import edu.rosehulman.csse230feedback.domain.PrepareResult;
import edu.rosehulman.csse230feedback.domain.PrepareService;
import edu.rosehulman.csse230feedback.model.AssignmentConfig;
import edu.rosehulman.csse230feedback.util.Json;
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

    // --- LLM options ---

    @Option(names = {"--llm-provider"}, description = "LLM provider: openai, anthropic, google (default: from env or 'openai').")
    private String llmProvider;

    @Option(names = {"--llm-model"}, description = "LLM model name (default: from env or 'gpt-4o-mini').")
    private String llmModel;

    @Option(names = {"--llm-api-key"}, description = "LLM API key (overrides env var).")
    private String llmApiKey;

    @Option(names = {"--no-cache"}, description = "Skip cache reads, still write results for future use.")
    private boolean noLlmCache = false;

    @Option(names = {"--clear-cache"}, description = "Delete all cached LLM responses before running.")
    private boolean clearCache = false;

    @Option(names = {"--cache-dir"}, description = "Override LLM cache directory (default: cache/llm/).")
    private Path cacheDir;

    @Option(names = {"--dry-run"}, description = "Build prompts and estimate cost, but make no API calls.")
    private boolean dryRun = false;

    @Option(names = {"--ingest-dir"}, description = "Ingest output directory (contains runs.jsonl, manifest.json, archives/). If not set, reads from --input.")
    private Path ingestDir;

    @Option(names = {"--allow-basic-fallback"}, description = "Allow prepare to proceed without enriched_runs/ (no stack traces or durations). Default: fail if enriched_runs/ is absent.")
    private boolean allowBasicFallback = false;

    @Option(names = {"--include-error-messages"}, description = "Include raw lastError.message text in LLM input (default: off; for debugging only).")
    private boolean includeErrorMessages = false;

    @Option(names = {"--assignment-config"}, description = "Path to per-assignment JSON config (e.g. Pipeline/assignments/bst.json) to exclude test classes.")
    private Path assignmentConfigPath;

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

        if (ingestDir != null) {
            if (!Files.exists(ingestDir)) {
                System.err.println("Ingest directory does not exist: " + ingestDir);
                return 2;
            }
            if (!Files.isDirectory(ingestDir)) {
                System.err.println("Ingest dir must be a directory: " + ingestDir);
                return 2;
            }
        }

        AssignmentConfig assignmentConfig = null;
        if (assignmentConfigPath != null) {
            if (!Files.exists(assignmentConfigPath)) {
                System.err.println("Assignment config file does not exist: " + assignmentConfigPath);
                return 2;
            }
            assignmentConfig = Json.mapper().readValue(assignmentConfigPath.toFile(), AssignmentConfig.class);
        }

        PrepareOptions opts = new PrepareOptions(
            input,
            output,
            idleThreshold,
            categoryShiftWindow,
            studentId,
            assignmentName,
            includeCode && !noCode,
            llmProvider,
            llmModel,
            llmApiKey,
            noLlmCache,
            clearCache,
            cacheDir,
            dryRun,
            ingestDir,
            allowBasicFallback,
            includeErrorMessages,
            assignmentConfig,
            assignmentConfigPath
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
