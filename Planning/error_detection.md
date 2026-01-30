You’re right to worry about “highlighting the wrong thing.” Episodes are a **heuristic partition** of a continuous debugging session; they’re useful for navigation, but **not guaranteed to align with meaningful conceptual work**. So the algorithm that “shows meaningful failures” should **not depend on episodes being correct**. Instead:

* Build *meaningful failure intervals* directly from the **test outcome timeline**.
* Use episodes only for **chaptering/UI**, and for attributing “where the student spent time.”

Below is a concrete algorithm that does that, and avoids over-emphasizing failures that were resolved later and never mattered again.

---

## Core idea: highlight “failure intervals,” not “episode failures”

A **failure interval** = a contiguous span of time (runs) where a given test is failing (allowing small gaps where the test wasn’t run).

This lets you ask the important questions:

* Did this failure **persist to the end** (still failing at final run)?
* Was it a **regression** (it used to pass)?
* Did it **recur** after being fixed?
* Did it **consume effort** (many runs/time/reversions while failing)?
* Is it **evidence-rich** (stack trace + expected/actual)?

Those are what make a failure “meaningful.”

---

## Algorithm: Meaningful Failure Selector (Phase 1 friendly)

### Inputs

* Runs `r0..rN` sorted by time, each with:

  * `timestamp`
  * `code_hash`
  * `test_results` (pass/fail/aborted/disabled/not-run)
  * optional: stack traces / expected-actual / duration (from rerun-for-evidence if you have it)
* Episodes `e0..eM` (heuristic grouping)
* Test metadata:

  * `test_id`
  * `test_category` (your category mapping)
  * optional: “core-ness” weight (core API tests > peripheral)

### Step 1 — Normalize the timeline (important)

Build a per-test status timeline `S[T][i]` for each test `T` at each run index `i`:

* `P` pass
* `F` fail
* `N` not run (or disabled/aborted)

**Phase 1 recommendation:** For *highlight candidates only*, rerun the test to replace `N` with `P/F` when you need certainty (especially during bisect). This prevents “fake transitions” due to selective runs.

### Step 2 — Extract failure intervals for each test

For each test `T`, scan runs in order and build intervals:

* Treat `F` as failing.
* Allow a small gap of not-run states without ending the interval:

  * e.g., `max_gap_not_run = 2` runs (tunable)

An interval object might look like:

```json
{
  "test_id": "T",
  "start_run": 12,
  "end_run": 27,
  "start_time": "...",
  "end_time": "...",
  "ended_failing_at_final": false,
  "was_regression": true,
  "recurs_count": 2,
  "flips_within": 3,
  "effort": { "runs_while_failing": 16, "time_ms": 420000, "reversions": 1 },
  "evidence_strength": "high|med|low"
}
```

How to compute key flags:

* `was_regression`: did `T` have a `P` before `start_run`?
* `ended_failing_at_final`: does the final run have `F` for `T`?
* `recurs_count`: number of distinct failure intervals for `T`
* `flips_within`: count of `P↔F` toggles (useful for thrash/flakiness)

### Step 3 — Score “meaningfulness”

Define a score that prefers failures that matter to learning and final outcomes:

**Base components**

* **Lingering** (still failing at final run): +100
* **Regression** (introduced after being correct): +40
* **Recurring** (fixed then returned): +35
* **Effort cost** (time/runs while failing): +0..30
* **Evidence strength** (stack trace + expected/actual): +0..20
* **Core category boost**: +0..15

**Penalties**

* **Quick detour**: if resolved within 1–2 runs and never recurs: −50
* **Likely flakiness**: if it toggles without code change or reruns disagree: −80
* **Low episode coherence** (optional): downweight episode attribution if episode seems noisy (more below)

So:

```text
meaningfulness = 
  100*lingering
+ 40*regression
+ 35*recurring
+ effort_points
+ evidence_points
+ core_points
- 50*quick_detour
- 80*flaky
```

### Step 4 — Select what to surface (the key guardrail)

You want the MVP to show *meaningful failures* by default, and only show “resolved detours” when they were instructive.

Use this selection policy:

#### A) Always show (top priority)

1. **All tests failing at final run**
   For each: show its **most recent regression origin** (the last `P→F` before final), not the first time it ever failed.

2. **Top K recurring regressions (even if fixed at end)**
   These are valuable because they represent patterns the student repeatedly falls into.

#### B) Show only if “costly detour”

If a failure interval is **fully resolved by the end and never recurs**, only show it if it was costly:

* it lasted ≥ X runs *or* ≥ Y minutes
* or it involved reversions/thrash
* or it caused many regressions at once

Otherwise, suppress it from the “Highlights” summary.

**Crucially:** don’t erase it entirely—just keep it accessible when the student navigates to that episode/run.

### Step 5 — Attribute intervals to episodes (without trusting episodes)

For UI, you’ll still want “this happened in episode E7.”

Do it like this:

* An interval can overlap multiple episodes.
* Attribute it to the episode where it consumed the most effort:

  * max `(runs_while_failing in episode)` or `(time_while_failing in episode)`

If episode boundaries are wrong, this attribution still produces a reasonable “where time went” story.

### Step 6 — Find the origin point (bisect, but only where it helps)

For each *selected* meaningful interval, you want: “Here is where it was introduced.”

**Rule: bisect only on monotonic segments**
Bisect requires that there exists a “good” and “bad” boundary:

* A run where the test passes (`good`)
* A later run where it fails (`bad`)

Then:

* Prefer bisect **within the interval’s attributed episode** if both boundaries are inside it.
* Otherwise bisect in the smallest window that contains the transition:

  * last known passing run before start → first failing run at start

**Don’t do global bisect for everything.**
Global bisect is expensive and often points to irrelevant early failures.

### Step 7 — Decide what “interactive click” shows (Phase 1)

When the student clicks a failing test:

* Show the failure intervals timeline for that test (sparklines)
* Show the *selected interval* (lingering/recurring/costly)
* Provide:

  * “Jump to introduction run” (origin run via bisect)
  * “Show introducing diff” (good→bad diff)
  * “Evidence” (stack trace + expected/actual + category)
  * “Fix pattern” (LLM-generated from evidence pack + diff summary)

This feels alive without needing true counterexample minimization or full variable tracing.

---

## Episode “meaningfulness” (optional but helpful)

To address your worry directly: you can compute an **episode coherence score** and use it to avoid over-trusting noisy episodes.

Example coherence signals:

* Category stability: does one category dominate most runs?
* Intent stability: do diff categories stay consistent?
* Outcome structure: do runs show progress toward a set of tests vs random toggling?

If coherence is low:

* downweight episode attribution (show as “mixed episode”)
* rely more on the global failure-interval view

This keeps the system from confidently telling a story the data doesn’t support.

---

## What this buys you

* You **won’t** over-highlight “episode failures” that were quickly fixed and never mattered.
* You **will** highlight:

  * lingering final failures (most meaningful)
  * regressions (best learning moments)
  * recurring failures (strongest skill signal)
  * costly detours (only when they actually consumed time)

And you get a clear, interactive flow:
**click failing test → see interval → jump to introduction → see diff + evidence → fix pattern**, all Phase-1 feasible.

---

If you want, I can turn the above into concrete pseudocode (Python-like) for:

* extracting failure intervals with not-run gaps,
* scoring,
* selecting highlights,
* and choosing bisect windows.
