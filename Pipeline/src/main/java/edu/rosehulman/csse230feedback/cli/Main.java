package edu.rosehulman.csse230feedback.cli;

import picocli.CommandLine;

public final class Main {
    public static void main(String[] args) {
        int exitCode = new CommandLine(new RootCommand())
                .setCaseInsensitiveEnumValuesAllowed(true)
                .execute(args);
        System.exit(exitCode);
    }
}
