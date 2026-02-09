# Simulation Architecture

## 1. Overview

The `simulate` command generates realistic test run data that models a student's progression through a BST assignment. Its primary purpose is **ground-truth generation** for evaluating the semantic enrichment pipeline: because we control the narrative arc programmatically, we know exactly what story the LLM *should* detect.

### Output Formats

| Format | Flag | Output | Use Case |
|--------|------|--------|----------|
| `prepare` | `--format prepare` | `runs.jsonl`, `enriched_runs/`, `manifest.json`, `test_categories.json` | Direct input to the `prepare` command |
| `tar` | `--format tar` | `run.tar` (containing `testRunInfo.json`) | Input to the `ingest` command (mimics real logger output) |
| `both` | `--format both` | All of the above | Full pipeline testing |

### CLI Options

```
simulate --output <dir> [--seed 42] [--runs 30] [--difficulty medium]
         [--student-id sim-student-001] [--assignment BinarySearchTree]
         [--format prepare] [--include-categories]
         [--narrative scenarios/steady-learner.json]
```

When `--narrative` is provided, the scenario JSON's `simulation` block supplies defaults for all CLI flags (seed, runs, difficulty, etc.). Explicit CLI flags always override narrative defaults. The scenario's `progression` block configures the `ProgressionModel` with overrides (see §8).

---

## 2. `.tar` File Creation

### Step 1: Build the JSON Structure

`SimulateService.buildTestRunInfo()` (line 208) constructs a Jackson `ObjectNode` with the following shape:

```json
{
  "schema_version": 1.0,
  "prevRunNumber": 0,
  "redactDiffs": false,
  "rebaselining": false,
  "prevBaselineRunNumber": 0,
  "skipLogging": false,
  "randomSeed": 42,

  "runTimes": {
    "1": "2025-01-15T09:00:00.000Z",
    "2": "2025-01-15T09:03:00.000Z"
  },

  "strikes": {},
  "toIgnore": [],

  "BSTTesting": {
    "testInsertInts()": {
      "1": "FAILED: java.lang.Error: Unresolved compilation problems",
      "2": "FAILED: java.lang.Error: Unresolved compilation problems",
      "4": "SUCCESSFUL",
      "5": "FAILED: org.opentest4j.AssertionFailedError: expected: <[1, 2, 3, 4, 5]> but was: <[1, 2, 3]>"
    },
    "testContainsInts()": {
      "9": "SUCCESSFUL",
      "10": "FAILED: java.lang.NullPointerException: Cannot invoke method on null reference"
    }
  },
  "BSTConcurrencyTesting": {
    "testIterator()": {
      "29": "FAILED: java.util.ConcurrentModificationException",
      "30": "SUCCESSFUL"
    }
  }
}
```

The nesting is: `TestClass` -> `testDisplayName()` -> `runNumber (string)` -> `"STATUS"` or `"STATUS: cause"`.

Tests only appear in runs where they are *active* (determined by `ProgressionModel` phase gating), so early runs have fewer keys.

### Step 2: Serialize to `.tar`

`SimulateService.writeTarArchive()` (line 253):

1. Serializes the `ObjectNode` to `byte[]` via Jackson
2. Opens a `TarArchiveOutputStream` (commons-compress) wrapping a `BufferedOutputStream` → `FileOutputStream`
3. Creates a single `TarArchiveEntry("testRunInfo.json")` with `size = jsonBytes.length`
4. Writes the bytes and closes the entry
5. Calls `tar.finish()` to write the tar trailer

The result is a valid `.tar` archive containing exactly one file: `testRunInfo.json`. This matches the format the `ingest` command expects from the real logger.

---

## 3. The Deterministic Narrative Engine

The core insight: a meaningful learning narrative doesn't require an LLM to *produce* — only to *articulate*. Two components work together to encode a student story arc purely through probability distributions and error-type selection.

### ProgressionModel (`domain/ProgressionModel.java`)

Models a student's trajectory through 7 phases, each unlocking new test categories:

| Phase | Scaled Runs | New Categories | What It Represents |
|-------|-------------|---------------|--------------------|
| 0 | 1-3 | *(none — all tests active but 0% pass)* | Compilation failures |
| 1 | 4-8 | `basic_insert`, `tree_properties` | First working code |
| 2 | 9-12 | `search_contains`, `conversion` | Core operations |
| 3 | 13-17 | `deletion` | Recursive tree surgery |
| 4 | 18-22 | `iterators` | Iterator implementation |
| 5 | 23-28 | `edge_cases`, `efficiency` | Hardening |
| 6 | 29-30 | `concurrency` | Optional advanced work |

#### Pass Probability Formula

For each test in each run, the probability of passing is computed as:

```
base = difficultyAdjust(easy, medium, hard)    // based on phases since category introduction
     + withinPhaseProgress * 0.15              // progress within current phase
     + struggleModifiers                       // see below
```

**Base probability by maturity** (medium difficulty):

| Phases Since Introduction | Easy | Medium | Hard |
|--------------------------|------|--------|------|
| 0 (newly introduced) | 0.30 | 0.20 | 0.10 |
| 1 | 0.70 | 0.50 | 0.40 |
| 2 | 0.85 | 0.75 | 0.60 |
| 3+ | 0.95 | 0.90 | 0.80 |

This creates a maturity curve: tests that have been active longer are more likely to pass, simulating a student learning from earlier failures.

#### Struggle Patterns

Four struggle patterns are injected, with the specific tests affected selected deterministically by the seeded `Random`. All defaults are overridable via `ProgressionOverrides` (see §8):

| Pattern | Default | Override Field | Effect | When |
|---------|---------|----------------|--------|------|
| **Reactive debugging** | 2 tests | `reactiveDebugCount` | `prob *= 0.5` | During first 2 phases |
| **Oscillation** | 1 test | `oscillatingCount` | `prob *= 0.6` on even runs | After first phase |
| **Breakthrough** | Scaled run 15 | `breakthroughRun` | Recently-introduced tests jump to `>= 0.9` | At specified run (`null` = disabled) |
| **Regression** | Scaled run 20, severity 0.1 | `regressionRun`, `regressionSeverity` | 1 test drops to severity value | At specified run for 2 runs (`null` = disabled) |
| **Plateau** | *(none)* | `plateauStartRun`, `plateauEndRun` | Suppresses probability growth, applies 0.85 penalty | During specified range |
| **Phase cap** | *(none)* | `finalPhase` | Clamps `getPhase()` return value | All runs |
| **Speed multiplier** | 1.0 | `phaseSpeedMultiplier` | Multiplied into `scaleRun()` | All runs |

These patterns create the recognizable signatures that LLMs detect: a test that keeps flip-flopping, a cluster of tests suddenly passing together, a mysterious regression that gets fixed two runs later, or a student who stalls completely.

#### Run Scaling

For simulations with more than 30 runs, run numbers are scaled to the canonical range [1, 30]:

```java
scaledRun = min(ceil(runNumber / totalRuns * 30.0 * phaseSpeedMultiplier), 30)
```

When `phaseSpeedMultiplier > 1.0`, phases are reached earlier (student progresses faster). When `< 1.0`, the student progresses slower. This preserves the 7-phase structure regardless of total run count.

### ErrorGenerator (`domain/ErrorGenerator.java`)

Produces Java exceptions appropriate to the test category and phase:

#### Phase Gating

- **Phases 0-1**: All failures produce `java.lang.Error: Unresolved compilation problems` (the student's code doesn't compile yet)
- **Phase 2+**: Error type selected from a category-specific pool

#### Category-to-Error Mapping

| Category | Possible Error Types |
|----------|---------------------|
| `basic_insert` | AssertionFailedError (wrong output), NullPointerException |
| `tree_properties` | AssertionFailedError (wrong size), AssertionFailedError (wrong output) |
| `search_contains` | AssertionFailedError (wrong output), NullPointerException |
| `conversion` | AssertionFailedError (wrong output), NullPointerException, IndexOutOfBoundsException |
| `deletion` | NullPointerException, AssertionFailedError (wrong output), StackOverflowError |
| `iterators` | UnsupportedOperationException, NullPointerException, ConcurrentModificationException |
| `edge_cases` | IllegalArgumentException, NullPointerException |
| `efficiency` | AssertionFailedError (wrong output), StackOverflowError |
| `concurrency` | ConcurrentModificationException, UnsupportedOperationException |

#### Generated Evidence

Each `GeneratedError` includes full diagnostic fields:

- `exceptionType` — fully-qualified class name (e.g., `java.lang.NullPointerException`)
- `message` — human-readable message (e.g., `"Cannot invoke method on null reference"`)
- `stackTrace` — 2-frame trace pointing at BST implementation + test method
- `expected` / `actual` — for assertion failures only (e.g., `"[1, 2, 3, 4, 5]"` vs `"[1, 2, 3]"`)
- `cause` — the full error string used in the `.tar` format

---

## 4. Why the LLM Can Read the Story

The simulated data contains structured signals that the semantic enrichment LLM detects and articulates:

### Signal: Error Type Evolution

```
Runs 1-3:  java.lang.Error (compilation)
Runs 4-8:  AssertionFailedError, NullPointerException
Runs 13+:  StackOverflowError (deletion recursion issues)
Runs 18+:  UnsupportedOperationException (iterator stubs)
Runs 29+:  ConcurrentModificationException
```

The progression from compilation errors to runtime errors to concurrency issues mirrors a real student's implementation journey. The LLM identifies this as "student moved from getting the code to compile to implementing and debugging specific features."

### Signal: Pass-Rate Slopes

The maturity curve creates a visible trend: tests in a category start at ~20% pass rate and climb to ~90%+ over several phases. When the LLM sees `testInsertInts` going from FAILED to SUCCESSFUL across runs 4-8, it identifies a learning arc.

### Signal: Breakthrough Events

At scaled run 15, recently-introduced tests suddenly jump to 90%+ pass probability. This creates a visible cluster of newly-passing tests — the LLM reads this as "student had a conceptual breakthrough."

### Signal: Regression Events

At scaled runs 20-21, a previously-passing test drops to 10%. Two runs later it recovers. The LLM reads this as "student introduced a bug while working on another feature, then fixed it."

### Signal: Phase Boundaries

New test categories appear in groups (e.g., `testContainsInts` and `testContainsStrings` first appear together around run 9). The LLM identifies these as "student started working on search functionality."

### The Key Insight

The LLM is **articulating** a narrative that is already structurally encoded in the probability distributions and error-type mappings — it is not inventing one. This is what makes simulated data useful as ground truth: we know the intended narrative (7 phases, 4 struggle patterns), and we can evaluate whether the LLM correctly identifies it.

---

## 5. Determinism & Reproducibility

All randomness flows from a single `long seed`:

```java
Random random = new Random(opts.seed());                    // timestamps, test outcomes
ProgressionModel model = new ProgressionModel(
    new Random(opts.seed()), ...);                          // phase/probability model
ErrorGenerator errorGen = new ErrorGenerator(
    new Random(opts.seed() + 1));                           // error selection
```

**Same seed = identical output.** This means:

- **Regression testing**: re-run simulate with the same seed and compare outputs
- **Seed-specific analysis**: struggle patterns (which tests oscillate, which test regresses) vary by seed, but the structural narrative (7 phases, maturity curve, error-type evolution) is invariant
- **Difficulty comparison**: same seed with different `--difficulty` flags produces the same test activation sequence but different pass rates

---

## 6. Data Flow

```
                    NarrativeLoader
                         |
                    NarrativeSpec
                    (.json + .md)
                         |
                    SimulateCommand -----> merges simulation params
                         |                 + progression overrides
                    SimulateService.simulate()
                         |
               +---------+---------+
               |                   |
         ProgressionModel    ErrorGenerator
         (phase gating,      (error types,
          pass probs,         stack traces,
          struggles,          assertions)
          overrides)               |
               |                   |
               +---------+---------+
                         |
                RunRecord + EnrichedTestResult
                         |
          +--------------+-----------+---------------+
          |              |           |               |
     writeOutput()   writeTar()   (both)   copyNarrativeFiles()
          |              |                       |
+----+----+----+   buildTestRunInfo()    narrative.json
|    |         |        |                narrative.md
runs enriched manifest writeTarArchive()
.jsonl _runs/  .json      |
        +              run.tar
  test_categories    (testRunInfo.json)
       .json
          |
          v
     PrepareCommand (semantic enrichment)
          |
          v
     frontend.json
          |
          v
     ValidateCommand
     (--input frontend.json
      --narrative scenario.json)
          |
          v
     ValidationReport
     (PASS / FAIL / WARN)
```

---

## 7. Source Files

| File | Path | Role |
|------|------|------|
| SimulateCommand | `cli/SimulateCommand.java` | CLI interface, option parsing, `--narrative` loading |
| SimulateService | `domain/SimulateService.java` | Orchestration, output writing, narrative file copying |
| SimulateOptions | `domain/SimulateOptions.java` | Configuration record (incl. `progressionOverrides`, `narrativePath`) |
| SimulateResult | `domain/SimulateResult.java` | Execution summary record |
| ProgressionModel | `domain/ProgressionModel.java` | Phase gating, pass probabilities, struggle patterns, overrides |
| ErrorGenerator | `domain/ErrorGenerator.java` | Category-aware error generation |
| NarrativeSpec | `domain/NarrativeSpec.java` | Record hierarchy for scenario specs |
| NarrativeLoader | `domain/NarrativeLoader.java` | Reads scenario `.json` + companion `.md` files |
| ValidationService | `domain/ValidationService.java` | Compares LLM output against narrative expectations |
| ValidationReport | `domain/ValidationReport.java` | Report records with PASS/FAIL/WARN checks |
| ValidateCommand | `cli/ValidateCommand.java` | CLI interface for validation |

All under `Pipeline/src/main/java/edu/rosehulman/csse230feedback/`.

---

## 8. Narrative-Driven Simulation

### Overview

The narrative system closes the loop on ground-truth evaluation. Instead of manually configuring CLI flags, you define a **scenario file** that describes a student archetype — what simulation parameters to use, how the progression model should behave, and what the LLM's output should look like. This enables systematic testing of the semantic enrichment pipeline.

### Scenario File Format

Each scenario is a pair of files in `Pipeline/scenarios/`:

- `<id>.json` — Machine-readable configuration (parsed by `NarrativeLoader`)
- `<id>.md` — Human-readable narrative (copied to output, not parsed)

### JSON Structure (`NarrativeSpec`)

```json
{
  "id": "steady-learner",
  "name": "The Steady Learner",
  "description": "A methodical student who progresses smoothly",

  "simulation": {
    "seed": 42,
    "runs": 20,
    "difficulty": "easy",
    "studentId": "sim-steady-001",
    "assignment": "BinarySearchTree",
    "format": "prepare"
  },

  "progression": {
    "breakthroughRun": 15,
    "regressionRun": null,
    "regressionSeverity": 0.0,
    "reactiveDebugCount": 0,
    "oscillatingCount": 0,
    "plateauStartRun": null,
    "plateauEndRun": null,
    "finalPhase": null,
    "phaseSpeedMultiplier": 1.2
  },

  "expectations": {
    "detectedPatterns": {
      "mustInclude": ["incremental development"],
      "mustNotInclude": ["compilation struggles"],
      "mayInclude": ["test-driven progression"]
    },
    "episodeAssessments": {
      "dominant": "productive",
      "maxStuckCount": 0,
      "maxRegressingCount": 1,
      "minBreakthroughCount": 1,
      "minProductiveCount": 3
    },
    "intents": {
      "dominant": "extending",
      "minExtendingRatio": 0.4,
      "maxDebuggingRatio": 0.4
    },
    "narrativeKeywords": ["smooth progression", "steady improvement"],
    "conceptsCovered": ["insertion", "tree traversal", "node deletion"]
  }
}
```

### Sections Explained

**`simulation`**: Defaults for CLI flags. Any explicit CLI flag overrides the corresponding value here. This means you can run `simulate --narrative scenarios/steady-learner.json -o out` and get seed=42, runs=20, difficulty=easy without typing them.

**`progression`**: Configures the `ProgressionModel` overrides (see §3 struggle patterns table). Setting a field to `null` disables that feature (e.g., `"regressionRun": null` means no regression occurs).

**`expectations`**: Defines what the `validate` command checks against the LLM's semantic output. See §9.

### `simulation` → CLI Flag Mapping

| JSON Field | CLI Flag | Default |
|-----------|----------|---------|
| `seed` | `--seed` | 42 |
| `runs` | `--runs` | 30 |
| `difficulty` | `--difficulty` | medium |
| `studentId` | `--student-id` | sim-student-001 |
| `assignment` | `--assignment` | BinarySearchTree |
| `format` | `--format` | prepare |

### `progression` → ProgressionModel Mapping

| JSON Field | ProgressionModel Effect |
|-----------|------------------------|
| `reactiveDebugCount` | Number of tests that get reactive-debug struggle (default: 2) |
| `oscillatingCount` | Number of tests that oscillate pass/fail (default: 1) |
| `breakthroughRun` | Run number when breakthrough occurs (`null` = disabled) |
| `regressionRun` | Run number when regression starts (`null` = disabled) |
| `regressionSeverity` | Pass probability during regression (0.0-1.0; default: 0.1) |
| `plateauStartRun` | Start of stall period — probability growth suppressed, 0.85 penalty |
| `plateauEndRun` | End of stall period |
| `finalPhase` | Maximum phase index the student reaches (0-6; `null` = uncapped) |
| `phaseSpeedMultiplier` | Multiplier on `scaleRun()` — >1.0 = faster, <1.0 = slower (default: 1.0) |

---

## 9. Validation System

### Overview

The `validate` command compares LLM-generated semantic output (`frontend.json`) against the expectations defined in a scenario's JSON file. It produces a report of PASS/FAIL/WARN checks.

### CLI

```
validate --input <frontend.json> --narrative <scenario.json>
         [--report <report.json>] [--strict]
```

- `--input`: The `frontend.json` produced by the `prepare` command
- `--narrative`: The scenario JSON file with `expectations`
- `--report`: Optional path to write a JSON validation report
- `--strict`: If set, WARN checks count as failures for the exit code

**Exit codes**: 0 = all PASS (or WARN in non-strict mode), 1 = at least one FAIL (or WARN in strict mode)

### Validation Checks

The `ValidationService` runs 5 categories of checks:

#### 1. Pattern Checks (category: `patterns`)

Compares `expectations.detectedPatterns` against `semanticLog.detectedPatterns`:

| Rule | Status if matched | Status if not |
|------|-------------------|---------------|
| `mustInclude` | PASS | FAIL |
| `mustNotInclude` | FAIL | PASS |
| `mayInclude` | PASS | WARN |

Matching is case-insensitive substring (e.g., `"incremental"` matches `"Incremental development pattern"`).

#### 2. Episode Assessment Checks (category: `episodes`)

Counts episode assessments from `EpisodeSemantics.progressAssessment` (or falls back to episode labels if no semantics):

| Check | Condition |
|-------|-----------|
| `dominant` | Most frequent assessment matches expected (WARN if not) |
| `maxStuckCount` | Count of "stuck" assessments ≤ threshold (WARN if not) |
| `maxRegressingCount` | Count of "regressing" assessments ≤ threshold (WARN if not) |
| `minBreakthroughCount` | Count of "breakthrough" assessments ≥ threshold (WARN if not) |
| `minProductiveCount` | Count of "productive" assessments ≥ threshold (WARN if not) |

#### 3. Intent Checks (category: `intents`)

Computes intent ratios from `SemanticRunEntry.intent` across all entries:

| Check | Condition |
|-------|-----------|
| `dominant` | Most frequent intent matches expected (WARN if not) |
| `minExtendingRatio` | Ratio of "extending" intents ≥ threshold (WARN if not) |
| `maxDebuggingRatio` | Ratio of "debugging" intents ≤ threshold (WARN if not) |

#### 4. Keyword Checks (category: `keywords`)

Case-insensitive substring search across `semanticLog.currentNarrative` + all `SemanticRunEntry.narrativeContext` + `semanticDescription` fields. PASS if found, WARN if not.

#### 5. Concept Checks (category: `concepts`)

Fuzzy substring match against all `EpisodeSemantics.conceptsAddressed` values across episodes. PASS if found, WARN if not.

### Graceful Degradation

When semantic enrichment hasn't run (no LLM API key), `semanticLog` is `null`. The validate command:

- Reports a single WARN for missing semantic data
- Skips pattern, intent, and keyword checks (they require semantic data)
- Still runs episode and concept checks using episode labels/semantics if available

### Report Output

The `ValidationReport` can be printed to stdout or written as JSON:

```json
{
  "scenarioId": "steady-learner",
  "scenarioName": "The Steady Learner",
  "checks": [
    {
      "category": "patterns",
      "name": "mustInclude: incremental development",
      "status": "PASS",
      "expected": "present in detectedPatterns",
      "actual": "incremental development, test-driven progression"
    }
  ],
  "passCount": 8,
  "failCount": 0,
  "warnCount": 2
}
```

---

## 10. Predefined Scenarios

Four student archetypes are defined in `Pipeline/scenarios/`:

### steady-learner (easy, 20 runs, seed=42)

**Archetype**: A methodical student who progresses smoothly without setbacks.

| Override | Value | Effect |
|----------|-------|--------|
| `reactiveDebugCount` | 0 | No reactive debugging struggles |
| `oscillatingCount` | 0 | No oscillating tests |
| `regressionRun` | null | No regression |
| `phaseSpeedMultiplier` | 1.2 | Faster phase transitions |
| `breakthroughRun` | 15 | Breakthrough at run 15 |

**Expected**: Mostly "productive" episodes, "incremental development" pattern, high extending ratio.

### struggling-student (hard, 40 runs, seed=99)

**Archetype**: Persistent difficulties, extended plateau, late breakthrough.

| Override | Value | Effect |
|----------|-------|--------|
| `reactiveDebugCount` | 3 | Many stuck-in-a-rut tests |
| `oscillatingCount` | 2 | Multiple flip-flopping tests |
| `regressionRun` | 20 (severity 0.3) | Mid-assignment regression |
| `plateauStartRun` / `End` | 12-22 | 10-run stall period |
| `breakthroughRun` | 30 | Very late breakthrough |
| `phaseSpeedMultiplier` | 0.8 | Slower phase transitions |

**Expected**: Dominant "stuck" episodes, "trial-and-error debugging" pattern, high debugging ratio.

### sprinter (medium, 15 runs, seed=77)

**Archetype**: Fast but sloppy — rapid progress, then significant regression, then recovery.

| Override | Value | Effect |
|----------|-------|--------|
| `breakthroughRun` | 8 | Early breakthrough |
| `regressionRun` | 12 (severity 0.5) | Late, severe regression |
| `phaseSpeedMultiplier` | 1.5 | Very fast phase transitions |

**Expected**: Productive start, regression episode, then recovery. Mixed extending/debugging intent.

### abandoner (hard, 25 runs, seed=123)

**Archetype**: Makes initial progress but gives up before completing advanced topics.

| Override | Value | Effect |
|----------|-------|--------|
| `breakthroughRun` | null | No breakthrough ever |
| `regressionRun` | null | No regression (nothing to regress) |
| `plateauStartRun` / `End` | 15-25 | Stalls for final 10 runs |
| `finalPhase` | 3 | Never gets past deletion |

**Expected**: Early productive, then prolonged stuck. "Trial-and-error debugging" pattern. No breakthrough.

---

## 11. End-to-End Workflow

For each scenario, the full evaluation pipeline is:

```bash
# 1. Simulate — generates test data from narrative spec
java -jar target/csse230-feedback.jar simulate \
  --narrative scenarios/steady-learner.json \
  --output target/scenarios/steady-learner

# 2. Prepare — runs LLM semantic enrichment on the data
java -jar target/csse230-feedback.jar prepare \
  --input target/scenarios/steady-learner \
  --output target/scenarios/steady-learner/frontend.json \
  --assignment-name BinarySearchTree \
  --student-id sim-steady-001

# 3. Validate — checks LLM output against expectations
java -jar target/csse230-feedback.jar validate \
  --input target/scenarios/steady-learner/frontend.json \
  --narrative scenarios/steady-learner.json \
  --report target/scenarios/steady-learner/validation-report.json
```

This workflow enables:

- **LLM quality evaluation**: Does the LLM correctly identify the encoded narrative?
- **Prompt engineering**: Adjust prompts, re-run prepare + validate, see if checks improve
- **Regression testing**: Same seed produces identical data; validate catches LLM regressions
- **New scenario development**: Define a new archetype, generate data, see if the LLM reads it correctly
