# 230 Logger Monorepo — Claude Code Context

## Project Overview

A feedback pipeline for CSSE 230 (Data Structures) student submissions. It ingests a student's
test-run log (`run.tar`), re-runs their code snapshots to capture stack traces, then uses an LLM
to generate targeted, factual feedback that surfaces in a React frontend.

**Working directory for all commands:** repo root (`230LoggerMonorepo/`)

---

## Pipeline Command Order

### Full pipeline (real student submission)

```
1. BUILD
   mvn -f Pipeline/pom.xml package -q -DskipTests

2. INGEST  — extracts run.tar, indexes diff archives, writes runs.jsonl
   java -jar Pipeline/target/csse230-feedback.jar ingest \
     -i <path/to/repo-root-containing-run.tar> \
     -o Pipeline/output/<student-id>

3. RERUN  — compiles each snapshot, re-runs tests, writes enriched_runs/ with stack traces + durations
   java -jar Pipeline/target/csse230-feedback.jar rerun \
     -i Pipeline/output/<student-id> \
     -o Pipeline/output/<student-id> \
     --deps <path/to/junit-deps-dir>
   # enriched_runs/ is REQUIRED for feedback quality.
   # prepare will hard-fail if enriched_runs/ is absent unless --allow-basic-fallback is passed.

4. PREPARE  — transforms data into frontend JSON, calls LLM for feedback
   java -jar Pipeline/target/csse230-feedback.jar prepare \
     -i Pipeline/output/<student-id> \
     -o Frontend/public/data/frontend.json \
     --assignment-name "Binary Search Tree" \
     --student-id "<student-id>" \
     --no-code \
     --cache-dir Pipeline/cache/llm
```

### Demo pipeline (run-demo data; no enriched_runs/ available)

The demo data at `Pipeline/output/run-demo` has no `enriched_runs/` because it was created via
`ingest` only — use `--allow-basic-fallback` to acknowledge the degraded output.

```
mvn -f Pipeline/pom.xml package -q -DskipTests

java -jar Pipeline/target/csse230-feedback.jar prepare \
  -i Pipeline/output/run-demo \
  -o Frontend/public/data/frontend.json \
  --assignment-name "Binary Search Tree" \
  --student-id "demo-student" \
  --no-code \
  --cache-dir Pipeline/cache/llm \
  --allow-basic-fallback \
  --clear-cache
```

Or use the Makefile shortcut: `make demo`

---

## Key Concepts

### enriched_runs/
Produced by the `rerun` command. Contains `enriched_N.json` per run with:
- Stack traces and exception types
- Test durations
- Expected/actual values from assertion failures

`prepare` **hard-fails** by default if this directory is absent. Pass `--allow-basic-fallback`
to degrade gracefully (error evolution and struggle profiles will be empty).

### LLM / Cache
- API keys are read from `Pipeline/.env`
- LLM responses are cached in `Pipeline/cache/llm/`
- `--clear-cache` forces fresh LLM calls (costs ~$0.07 for demo)
- `--dry-run` builds prompts and estimates cost without calling the API

### Feedback quality guardrails (as of Phase 1)
- **Max feedback items:** 5 total (all categories combined)
- **sustainedStruggle threshold:** ≥2 failed runs (candidates), budget-capped by `5 − nonSustainedCount`
  sorted by `totalFailedRuns` descending
- **Refinement pass:** second LLM call strips intent narration from explanations
- **Grouping:** tests sharing ≥2 diff run numbers get `relatedTestIds` pointing to each other

### Highlight categories (priority order, high to low)
1. `stillFailing` — test still failing at final run
2. `regression` — test broke again after being fixed (multiple failure intervals)
3. `costlyDetour` — first-ever failure, was regression (had prior pass), took >3 runs to fix
4. `sustainedStruggle` — single failure interval, no prior pass, ≥2 failed runs; budget-capped

---

## Key Files

| File | Purpose |
|------|---------|
| `Pipeline/prompts/feedback_generation_prompt.md` | Main LLM prompt for feedback |
| `Pipeline/prompts/feedback_refinement_prompt.md` | Second-pass prompt to strip intent narration |
| `Pipeline/prompts/semantic_enrichment_prompt.md` | Prompt for episode/run semantic summaries |
| `Pipeline/src/.../domain/PrepareService.java` | Orchestrates the full prepare pipeline |
| `Pipeline/src/.../domain/FeedbackGenerationService.java` | LLM feedback + diff grouping |
| `Pipeline/src/.../domain/FeedbackRefinementService.java` | Second-pass intent narration removal |
| `Pipeline/src/.../prepare/StatusChangeTracker.java` | Highlight classification + budget cap |
| `Pipeline/src/.../model/frontend/FailureHighlights.java` | highlight categories record |
| `Pipeline/src/.../model/frontend/Feedback.java` | feedback record (includes relatedTestIds) |
| `Pipeline/output/run-demo` | Demo student data (ingest only, no enriched_runs/) |
| `Frontend/public/data/frontend.json` | Pipeline output consumed by the frontend |
| `Pipeline/.env` | API keys (not committed) |

---

## Build

```bash
mvn -f Pipeline/pom.xml package -q -DskipTests
```

The JAR is at `Pipeline/target/csse230-feedback.jar`.

---

## Makefile Targets

```bash
make build         # mvn package
make demo          # build + prepare with --allow-basic-fallback --clear-cache
make demo-cached   # prepare without --clear-cache (reuses cached LLM responses)
```
