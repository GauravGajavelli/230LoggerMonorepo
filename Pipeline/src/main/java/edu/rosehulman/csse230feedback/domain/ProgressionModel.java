package edu.rosehulman.csse230feedback.domain;

import java.util.*;

/**
 * Models a student's trajectory through a BST assignment.
 * Determines which tests are visible and pass probabilities per run.
 */
public class ProgressionModel {

    /** Defines a test with its class and method name. */
    public record TestDef(String testClass, String testMethod, String category) {
        public String testId() {
            return testClass + "#" + testMethod;
        }
    }

    /** Result of querying the model for a specific run. */
    public record RunProfile(
        List<TestDef> activeTests,
        Map<String, Double> passProbabilities
    ) {}

    private final Random random;
    private final String difficulty;
    private final int totalRuns;
    private final List<TestDef> allTests;
    private final NarrativeSpec.ProgressionOverrides overrides;

    // Struggle patterns injected based on seed
    private final Set<String> reactiveDebugTests;     // same error 3+ runs
    private final Set<String> oscillatingTests;       // pass/fail/pass
    private final int breakthroughRun;                // multiple pass simultaneously; -1 = disabled
    private final int regressionRun;                  // previously-passing fails; -1 = disabled
    private final double regressionSeverity;
    private final String regressionTest;

    // Ordered phases: which categories become active at which run ranges
    private static final List<PhaseDefinition> PHASES = List.of(
        new PhaseDefinition(1, 3, List.of(), 0.0),    // compilation failure phase
        new PhaseDefinition(4, 8, List.of("basic_insert", "tree_properties"), 0.0),
        new PhaseDefinition(9, 12, List.of("search_contains", "conversion"), 0.0),
        new PhaseDefinition(13, 17, List.of("deletion"), 0.0),
        new PhaseDefinition(18, 22, List.of("iterators"), 0.0),
        new PhaseDefinition(23, 28, List.of("edge_cases", "efficiency"), 0.0),
        new PhaseDefinition(29, 30, List.of("concurrency"), 0.0)
    );

    private record PhaseDefinition(int startRun, int endRun, List<String> newCategories, double unused) {}

    public ProgressionModel(Random random, String difficulty, int totalRuns, List<TestDef> allTests) {
        this(random, difficulty, totalRuns, allTests, null);
    }

    public ProgressionModel(Random random, String difficulty, int totalRuns,
                             List<TestDef> allTests, NarrativeSpec.ProgressionOverrides overrides) {
        this.random = random;
        this.difficulty = difficulty;
        this.totalRuns = totalRuns;
        this.allTests = allTests;
        this.overrides = overrides;

        // Select struggle patterns based on seed
        List<TestDef> shuffled = new ArrayList<>(allTests);
        Collections.shuffle(shuffled, random);

        // Reactive debugging count: default 2, overridable
        int reactiveCount = (overrides != null && overrides.reactiveDebugCount() != null)
            ? overrides.reactiveDebugCount() : 2;
        reactiveDebugTests = new HashSet<>();
        for (int i = 0; i < Math.min(reactiveCount, shuffled.size()); i++) {
            reactiveDebugTests.add(shuffled.get(i).testId());
        }

        // Oscillating count: default 1, overridable
        int oscCount = (overrides != null && overrides.oscillatingCount() != null)
            ? overrides.oscillatingCount() : 1;
        oscillatingTests = new HashSet<>();
        int oscStart = Math.min(reactiveCount, shuffled.size());
        for (int i = oscStart; i < Math.min(oscStart + oscCount, shuffled.size()); i++) {
            oscillatingTests.add(shuffled.get(i).testId());
        }

        // Breakthrough run: overridable, null in overrides = disabled
        if (overrides != null && overrides.breakthroughRun() != null) {
            breakthroughRun = scaleRun(overrides.breakthroughRun());
        } else if (overrides != null) {
            // overrides present but breakthroughRun is null => disabled
            breakthroughRun = -1;
        } else {
            breakthroughRun = scaleRun(15);
        }

        // Regression: overridable, null in overrides = disabled
        if (overrides != null && overrides.regressionRun() != null) {
            regressionRun = scaleRun(overrides.regressionRun());
            regressionSeverity = (overrides.regressionSeverity() != null)
                ? overrides.regressionSeverity() : 0.1;
        } else if (overrides != null) {
            regressionRun = -1;
            regressionSeverity = 0.0;
        } else {
            regressionRun = scaleRun(20);
            regressionSeverity = 0.1;
        }

        int regrTestIdx = Math.min(oscStart + oscCount, shuffled.size() - 1);
        regressionTest = (regressionRun >= 0 && regrTestIdx >= 0 && regrTestIdx < shuffled.size())
            ? shuffled.get(regrTestIdx).testId() : null;
    }

    /**
     * Returns the run profile for the given run number.
     */
    public RunProfile getProfile(int runNumber) {
        int scaledRun = scaleRun(runNumber);
        int phase = getPhase(scaledRun);

        // Determine active categories up to current phase
        Set<String> activeCategories = new LinkedHashSet<>();
        for (int p = 0; p <= phase; p++) {
            if (p < PHASES.size()) {
                activeCategories.addAll(PHASES.get(p).newCategories);
            }
        }

        // Phase 0 (compilation): all tests fail with compilation error
        if (phase == 0) {
            Map<String, Double> probs = new HashMap<>();
            for (TestDef test : allTests) {
                probs.put(test.testId(), 0.0);
            }
            return new RunProfile(new ArrayList<>(allTests), probs);
        }

        // Filter tests by active categories
        List<TestDef> activeTests = new ArrayList<>();
        for (TestDef test : allTests) {
            if (activeCategories.contains(test.category)) {
                activeTests.add(test);
            }
        }

        // Compute pass probabilities
        Map<String, Double> probs = new HashMap<>();
        for (TestDef test : activeTests) {
            double prob = computePassProbability(test, runNumber, scaledRun, phase);
            probs.put(test.testId(), prob);
        }

        return new RunProfile(activeTests, probs);
    }

    /**
     * Returns what phase index (0-based) the scaled run falls into,
     * clamped by finalPhase override if set.
     */
    public int getPhase(int scaledRun) {
        int phase = 0;
        for (int i = PHASES.size() - 1; i >= 0; i--) {
            if (scaledRun >= PHASES.get(i).startRun) {
                phase = i;
                break;
            }
        }
        // Apply finalPhase cap from overrides
        if (overrides != null && overrides.finalPhase() != null) {
            phase = Math.min(phase, overrides.finalPhase());
        }
        return phase;
    }

    private double computePassProbability(TestDef test, int runNumber, int scaledRun, int phase) {
        String testId = test.testId();

        // Find when this test's category was introduced
        int introPhase = -1;
        for (int i = 0; i < PHASES.size(); i++) {
            if (PHASES.get(i).newCategories.contains(test.category)) {
                introPhase = i;
                break;
            }
        }

        if (introPhase < 0) return 0.0;

        // How many phases since introduction
        int phasesSinceIntro = phase - introPhase;

        // Base probability based on maturity
        double baseProb;
        if (phasesSinceIntro <= 0) {
            // Newly introduced category
            baseProb = difficultyAdjust(0.3, 0.2, 0.1);
        } else if (phasesSinceIntro == 1) {
            baseProb = difficultyAdjust(0.7, 0.5, 0.4);
        } else if (phasesSinceIntro == 2) {
            baseProb = difficultyAdjust(0.85, 0.75, 0.6);
        } else {
            baseProb = difficultyAdjust(0.95, 0.9, 0.8);
        }

        // Within-phase progression: increase probability as runs progress within phase
        PhaseDefinition currentPhase = PHASES.get(Math.min(phase, PHASES.size() - 1));
        double phaseProgress = 0.0;
        if (currentPhase.endRun > currentPhase.startRun) {
            phaseProgress = (double)(scaledRun - currentPhase.startRun) / (currentPhase.endRun - currentPhase.startRun);
        }

        // Apply plateau: during plateau range, suppress probability growth
        boolean inPlateau = false;
        if (overrides != null && overrides.plateauStartRun() != null && overrides.plateauEndRun() != null) {
            int plateauStart = scaleRun(overrides.plateauStartRun());
            int plateauEnd = scaleRun(overrides.plateauEndRun());
            if (scaledRun >= plateauStart && scaledRun <= plateauEnd) {
                inPlateau = true;
                phaseProgress = 0.0; // no growth during plateau
            }
        }

        baseProb += phaseProgress * 0.15;
        baseProb = Math.min(baseProb, 0.98);

        // Apply struggle patterns
        if (reactiveDebugTests.contains(testId) && phasesSinceIntro <= 1) {
            baseProb *= 0.5; // harder to fix
        }

        if (oscillatingTests.contains(testId) && phasesSinceIntro >= 1) {
            // Oscillate: odd runs more likely to pass
            if (runNumber % 2 == 0) {
                baseProb *= 0.6;
            }
        }

        // Breakthrough: at breakthrough run, boost new tests
        if (breakthroughRun >= 0 && scaledRun == breakthroughRun && phasesSinceIntro <= 1) {
            baseProb = Math.max(baseProb, 0.9);
        }

        // Regression: at regression run, a specific passing test fails
        if (regressionRun >= 0 && regressionTest != null && testId.equals(regressionTest)
            && scaledRun >= regressionRun && scaledRun <= regressionRun + 1) {
            baseProb = regressionSeverity;
        }

        // Plateau penalty: slightly reduce pass probability during plateau
        if (inPlateau) {
            baseProb *= 0.85;
        }

        // Final phase: nearly everything passes (skip if capped by finalPhase)
        if (overrides == null || overrides.finalPhase() == null) {
            if (phase >= PHASES.size() - 1) {
                baseProb = Math.max(baseProb, difficultyAdjust(0.98, 0.95, 0.9));
            }
        }

        return Math.max(0.0, Math.min(1.0, baseProb));
    }

    private double difficultyAdjust(double easy, double medium, double hard) {
        return switch (difficulty) {
            case "easy" -> easy;
            case "hard" -> hard;
            default -> medium;
        };
    }

    /**
     * Scales a run number from [1, totalRuns] to [1, 30] (the canonical range).
     * Applies phaseSpeedMultiplier from overrides if set.
     */
    private int scaleRun(int runNumber) {
        double multiplier = (overrides != null && overrides.phaseSpeedMultiplier() != null)
            ? overrides.phaseSpeedMultiplier() : 1.0;
        if (totalRuns <= 30) {
            return Math.min((int) Math.ceil(runNumber * multiplier), 30);
        }
        return Math.min((int) Math.ceil((double) runNumber / totalRuns * 30.0 * multiplier), 30);
    }
}
