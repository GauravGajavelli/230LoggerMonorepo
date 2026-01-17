package edu.rosehulman.csse230feedback.cli;

import picocli.CommandLine.Command;

@Command(
        name = "csse230-feedback",
        mixinStandardHelpOptions = true,
        version = "csse230-feedback-ingestor 0.1.0",
        description = "Ingest CSSE230 logger artifacts (run.tar) into normalized Phase-1 artifacts.",
        subcommands = { IngestCommand.class }
)
public class RootCommand implements Runnable {
    @Override
    public void run() {
        System.out.println("Use a subcommand. Try: csse230-feedback ingest --help");
    }
}
