# Full Pipeline Runbook — Running from Scratch

## Overview

The pipeline has three stages: **ingest → rerun → prepare**. Each stage writes to the same output
directory, building up the data incrementally. Skipping `rerun` degrades output quality (no stack
traces, no error evolution, no struggle profiles).

---

## Prerequisites

### 1. Build the JAR

```bash
cd /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo
mvn -f Pipeline/pom.xml package -q -DskipTests
# Output: Pipeline/target/csse230-feedback.jar
```

### 2. Locate the testSupport directory

**IMPORTANT:** Do NOT use `Pipeline/src/testSupport` — it contains empty placeholder subdirectories.

Use the working testSupport from a prior successful rerun:

```
Pipeline/testOutputs/rerunOutputs/work/workspace_shared/src/testSupport
```

Verify it has content:

```bash
ls Pipeline/testOutputs/rerunOutputs/work/workspace_shared/src/testSupport/
# Expected: BinarySearchTreeTesting.java, GradingPolicy.java, etc.
```

### 3. Locate the test dependencies

```
Pipeline/target/classes/testDependencies
```

```bash
ls Pipeline/target/classes/testDependencies/
# Expected: junit jars, hamcrest, etc.
```

---

## Stage 1: Ingest

Unpacks the `run.tar` archive, indexes diff archives, and writes `runs.jsonl`.

```bash
# Stage the tar (ingest reads from a directory, not directly from the tar)
mkdir -p /tmp/demo-full-input
cp Pipeline/testInputs/run-demo.tar /tmp/demo-full-input/run.tar

java -jar Pipeline/target/csse230-feedback.jar ingest \
  -i /tmp/demo-full-input \
  -o Pipeline/output/run-demo-full
```

**Output:** `Pipeline/output/run-demo-full/runs.jsonl` (one JSON object per run)

---

## Stage 2: Rerun

Compiles each snapshot, re-runs all tests, and writes `enriched_runs/` with stack traces,
assertion failure details, and test durations.

```bash
java -jar Pipeline/target/csse230-feedback.jar rerun \
  -i Pipeline/output/run-demo-full \
  -o Pipeline/output/run-demo-full \
  --deps Pipeline/target/classes/testDependencies \
  --test-support Pipeline/testOutputs/rerunOutputs/work/workspace_shared/src/testSupport
```

**Output:** `Pipeline/output/run-demo-full/enriched_runs/enriched_N.json` per run

**Common failure:** "Using minimal testSupport (source not provided)" — this means the
`--test-support` path is empty. Use the path above, not `Pipeline/src/testSupport`.

---

## Stage 3: Prepare

Runs LLM analysis on the enriched data and writes `frontend.json`.

```bash
java -jar Pipeline/target/csse230-feedback.jar prepare \
  -i Pipeline/output/run-demo-full \
  -o Frontend/public/data/frontend.json \
  --assignment-name "Binary Search Tree" \
  --student-id "demo-student" \
  --assignment-config Pipeline/assignments/bst.json \
  --cache-dir Pipeline/cache/llm \
  --no-code \
  --clear-cache
```

**Note:** `--clear-cache` forces fresh LLM calls (~$0.07 for the BST demo). Omit it to reuse
cached responses. Do NOT pass `--allow-basic-fallback` when `enriched_runs/` exists — that flag
is only for the demo shortcut that skips `rerun`.

---

## Full Sequence (copy-paste)

```bash
cd /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo

# 0. Build
mvn -f Pipeline/pom.xml package -q -DskipTests

# 1. Ingest
mkdir -p /tmp/demo-full-input
cp Pipeline/testInputs/run-demo.tar /tmp/demo-full-input/run.tar
java -jar Pipeline/target/csse230-feedback.jar ingest \
  -i /tmp/demo-full-input \
  -o Pipeline/output/run-demo-full

# 2. Rerun
java -jar Pipeline/target/csse230-feedback.jar rerun \
  -i Pipeline/output/run-demo-full \
  -o Pipeline/output/run-demo-full \
  --deps Pipeline/target/classes/testDependencies \
  --test-support Pipeline/testOutputs/rerunOutputs/work/workspace_shared/src/testSupport

# 3. Prepare (fresh LLM calls)
java -jar Pipeline/target/csse230-feedback.jar prepare \
  -i Pipeline/output/run-demo-full \
  -o Frontend/public/data/frontend.json \
  --assignment-name "Binary Search Tree" \
  --student-id "demo-student" \
  --assignment-config Pipeline/assignments/bst.json \
  --cache-dir Pipeline/cache/llm \
  --no-code \
  --clear-cache
```

---

## Makefile Shortcuts

The `make demo` and `make demo-cached` targets use `Pipeline/output/run-demo` (ingest-only data)
and pass `--allow-basic-fallback`. They are for quick iteration on the prepare step only —
they do NOT run ingest or rerun.

| Target | When to use |
|--------|------------|
| `make demo` | Quick prepare test, no LLM cache |
| `make demo-cached` | Quick prepare test, reuse LLM cache |
| Full sequence above | When you need enriched stack traces and full feedback quality |

---

## What Each Stage Produces

| Stage | Key output | Required by |
|-------|-----------|------------|
| ingest | `runs.jsonl` | rerun, prepare |
| rerun | `enriched_runs/enriched_N.json` | prepare (without `--allow-basic-fallback`) |
| prepare | `Frontend/public/data/frontend.json` | Frontend |

---

## Question Bank (Drill Questions)

Practice drills are sourced from `Pipeline/assignments/bst_drill_questions.json` (loaded by
convention: `<stem>_drill_questions.json` next to the assignment config). The bank is matched
to test categories automatically via a single LLM call at the start of `prepare` — this is
cached so repeated runs don't cost extra.

Log line to look for: `Loaded 7 drill questions from bst_drill_questions.json`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `prepare` fails with "enriched_runs not found" | rerun was skipped | Run rerun first, or add `--allow-basic-fallback` |
| "Using minimal testSupport" in rerun logs | Wrong `--test-support` path | Use `Pipeline/testOutputs/rerunOutputs/work/workspace_shared/src/testSupport` |
| Drill points show as null | Test file has no `points +=` (ungraded) | Fixed in pipeline: standalone point shown instead |
| 0 drills generated | Bank questions have no overlapping categories | Check LLM category mapping log output |
| LLM costs unexpected | `--clear-cache` was passed | Omit `--clear-cache` to reuse cache |
