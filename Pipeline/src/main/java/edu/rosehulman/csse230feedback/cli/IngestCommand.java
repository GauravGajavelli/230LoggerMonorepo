package edu.rosehulman.csse230feedback.cli;

import edu.rosehulman.csse230feedback.domain.IngestOptions;
import edu.rosehulman.csse230feedback.domain.IngestResult;
import edu.rosehulman.csse230feedback.domain.IngestService;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(
        name = "ingest",
        mixinStandardHelpOptions = true,
        description = "Extracts run.tar, normalizes run timeline, and indexes diff archives."
)
public class IngestCommand implements Callable<Integer> {

    @Option(names = {"-i", "--input"}, required = true, description = "Path to the repo root (containing run.tar).")
    private Path input;

    @Option(names = {"-o", "--out"}, required = true, description = "Output directory for normalized artifacts.")
    private Path out;

    @Option(names = {"--work"}, description = "Working directory (default: <out>/work).")
    private Path work;

    @Option(names = {"--keep-work"}, description = "Keep extracted working files (useful for debugging).")
    private boolean keepWork;

    @Option(names = {"--max-files"}, description = "Safety: max number of files extracted from run.tar (default: 5000).")
    private int maxFiles = 5000;

    @Option(names = {"--max-bytes"}, description = "Safety: max number of bytes extracted from run.tar (default: 50MB).")
    private long maxBytes = 50L * 1024 * 1024;

    @Override
    public Integer call() throws Exception {
        if (!Files.exists(input)) {
            System.err.println("Input does not exist: " + input);
            return 2;
        }
        Files.createDirectories(out);
        if (work == null) {
            work = out.resolve("work");
        }
        Files.createDirectories(work);

        IngestOptions opts = new IngestOptions(input, out, work, keepWork, maxFiles, maxBytes);
        IngestService service = new IngestService();
        IngestResult result = service.ingest(opts);

        System.out.println("Ingest complete.");
        System.out.println("  Output: " + out.toAbsolutePath());
        System.out.println("  Runs: " + result.runsParsed());
        System.out.println("  Diff archives: " + result.diffArchivesFound());
        if (!result.warnings().isEmpty()) {
            System.out.println("  Warnings:");
            for (String w : result.warnings()) {
                System.out.println("    - " + w);
            }
        }

        return 0;
    }
}
