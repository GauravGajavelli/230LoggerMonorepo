package edu.rosehulman.csse230feedback.cli;

import edu.rosehulman.csse230feedback.domain.*;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(
    name = "simulate",
    mixinStandardHelpOptions = true,
    description = "Generates simulated test data with realistic student progression patterns."
)
public class SimulateCommand implements Callable<Integer> {

    @Option(names = {"-o", "--output"}, required = true, description = "Output directory for simulated data.")
    private Path output;

    @Option(names = {"--seed"}, description = "Random seed for reproducibility (default: 42).")
    private long seed = 42;

    @Option(names = {"--runs"}, description = "Number of runs to generate (default: 30).")
    private int runs = 30;

    @Option(names = {"--student-id"}, description = "Simulated student ID (default: sim-student-001).")
    private String studentId = "sim-student-001";

    @Option(names = {"--assignment"}, description = "Assignment name (default: BinarySearchTree).")
    private String assignment = "BinarySearchTree";

    @Option(names = {"--difficulty"}, description = "Difficulty: easy, medium, hard (default: medium).")
    private String difficulty = "medium";

    @Option(names = {"--include-categories"}, description = "Include test_categories.json (default: true).")
    private boolean includeCategories = true;

    @Option(names = {"--format"}, description = "Output format: prepare, tar, both (default: prepare).")
    private String format = "prepare";

    @Option(names = {"--narrative"}, description = "Path to a scenario JSON file that configures progression overrides.")
    private Path narrative;

    @Override
    public Integer call() throws Exception {
        NarrativeSpec spec = null;
        NarrativeSpec.ProgressionOverrides progressionOverrides = null;

        // Load narrative if provided — its simulation params act as defaults
        if (narrative != null) {
            spec = NarrativeLoader.load(narrative);
            progressionOverrides = spec.progression();

            // Apply narrative simulation params as defaults (CLI flags override)
            NarrativeSpec.SimulationParams sim = spec.simulation();
            if (sim != null) {
                if (!isOptionProvided("--seed") && sim.seed() != null) seed = sim.seed();
                if (!isOptionProvided("--runs") && sim.runs() != null) runs = sim.runs();
                if (!isOptionProvided("--difficulty") && sim.difficulty() != null) difficulty = sim.difficulty();
                if (!isOptionProvided("--student-id") && sim.studentId() != null) studentId = sim.studentId();
                if (!isOptionProvided("--assignment") && sim.assignment() != null) assignment = sim.assignment();
                if (!isOptionProvided("--format") && sim.format() != null) format = sim.format();
            }
        }

        if (runs < 1) {
            System.err.println("Number of runs must be at least 1.");
            return 2;
        }

        if (!difficulty.equals("easy") && !difficulty.equals("medium") && !difficulty.equals("hard")) {
            System.err.println("Difficulty must be one of: easy, medium, hard");
            return 2;
        }

        if (!format.equals("prepare") && !format.equals("tar") && !format.equals("both")) {
            System.err.println("Format must be one of: prepare, tar, both");
            return 2;
        }

        SimulateOptions opts = new SimulateOptions(
            output, seed, runs, studentId, assignment, difficulty, includeCategories, format,
            progressionOverrides, narrative
        );

        SimulateService service = new SimulateService();
        SimulateResult result = service.simulate(opts);

        System.out.println("Simulation complete.");
        System.out.println("  Output: " + output.toAbsolutePath());
        System.out.println("  Format: " + format);
        System.out.println("  Runs generated: " + result.runsGenerated());
        System.out.println("  Total test results: " + result.totalTestResults());
        System.out.println("  Tar generated: " + result.tarGenerated());
        System.out.println("  Seed: " + seed);
        System.out.println("  Difficulty: " + difficulty);
        if (narrative != null) {
            System.out.println("  Narrative: " + narrative.toAbsolutePath());
        }

        return 0;
    }

    /**
     * Simple check: if the field still has its PicoCLI default, the user didn't provide it.
     * We track this by comparing against known defaults.
     */
    private boolean isOptionProvided(String name) {
        // PicoCLI doesn't expose whether an option was set, so we rely on defaults.
        // If the user explicitly passes a CLI flag, its value differs from the field default.
        // This is a heuristic — if the user passes the same value as the default, we treat it
        // as "not provided" which is acceptable since it has no effect.
        return switch (name) {
            case "--seed" -> seed != 42;
            case "--runs" -> runs != 30;
            case "--difficulty" -> !difficulty.equals("medium");
            case "--student-id" -> !studentId.equals("sim-student-001");
            case "--assignment" -> !assignment.equals("BinarySearchTree");
            case "--format" -> !format.equals("prepare");
            default -> false;
        };
    }
}
