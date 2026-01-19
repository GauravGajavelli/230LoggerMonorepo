package edu.rosehulman.csse230feedback.cli;

import picocli.CommandLine.Command;

@Command(
        name = "csse230-feedback",
        mixinStandardHelpOptions = true,
        version = "csse230-feedback-ingestor 0.1.0",
        description = "Ingest CSSE230 logger artifacts and rerun tests for enriched feedback.",
        subcommands = { IngestCommand.class, RerunCommand.class }
)
public class RootCommand implements Runnable {
    @Override
    public void run() {
        System.out.println("Use a subcommand. Try: csse230-feedback ingest --help or csse230-feedback rerun --help");
    }
}
