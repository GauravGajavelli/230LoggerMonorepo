## Phase 1 intermediate outputs (computed artifacts)

### 1) Canonical data records

* **Run record (per test run)**

  * timestamp, code hash (+ ideally normalized hash), test results (per test), suite summary
  * deltas: newly passing/failing vs previous run; vs episode start; vs first run
  * link to diff-from-previous

* **TestResult record (per test per run)**

  * status (pass/fail/aborted/disabled/not-run)
  * failure kind classification (compile/runtime/assertion/timeout) when available
  * evidence fields (Phase 1 best-effort): exception type, message/throwable string
  * (strong Phase 1 add) rerun-for-evidence fields: stack trace, expected/actual, duration_ms (captured selectively)

* **DiffSummary (between adjacent runs)**

  * files changed, LOC +/- (and optionally methods touched)
  * diff category label + confidence (LLM-based in your plan)

### 2) Test metadata maps

* **Test case category mapping** (LLM-first then manually adjusted)

  * `test_id → category` (+ optional “core-ness” weight if you add it)

### 3) Episode artifacts (navigation layer, not “truth”)

* **Episode boundaries** (time-gap + focus-window category shift)
* **Episode aggregates**

  * top test categories, top diff categories
  * net test delta vs episode start
  * representative failing tests (e.g., fluctuated but ended failing)

### 4) Meaningful failure selection (the “what to highlight” engine)

(Independent of episodes)

* For each test: pass/fail timeline → **failure intervals**
* Scores / flags:

  * lingering to final run, regression, recurrence, effort cost, evidence strength, flakiness
* Selected highlights:

  * all final lingering failures
  * top recurring regressions
  * only “costly detours” among resolved failures

### 5) Origin-finding helpers (for interactivity)

* **Introduction point** (per selected failure interval)

  * “last known good → first bad” via targeted bisect / reruns (single test reruns)
  * returns: origin run index + introducing diff window

### 6) Root-cause labeling (coarse, evidence-grounded)

* Hybrid:

  * rules first (exception types/timeouts)
  * LLM for refinement on an “evidence pack”
* Output per selected failure:

  * label bucket + confidence (High/Med/Low/Unknown) + evidence pointers (stack frame/diff)

### 7) Fix-pattern mapping inputs

* (bug type × category × diff category) → recommended fix checklist/drills template
* LLM can generate the wording, but it’s anchored to the above artifacts

---

## Phase 1 final outputs (student-facing features)

### A) Interactive replay timeline

* Run-by-run playback with:

  * diffs + test outcome deltas (improved/worsened)
  * clickable tests
* Episode “chapters” to collapse/expand and navigate (simple session grouping)

### B) Failure “exhibit” panel (what makes it feel alive)

For any failing test you click:

* pass/fail history sparkline across runs
* “jump to introduction” (origin run)
* “show introducing diff”
* evidence: stack trace top frames, assertion expected/actual (if captured), failure kind
* root-cause label + confidence
* recommended fix pattern (short checklist)

### C) Highlights view (“meaningful failures”)

* Section 1: **Still failing at final run** (highest priority)
* Section 2: **Recurring regressions** (fixed then returned)
* Section 3: **Costly detours** (resolved but expensive)
  Each highlight links into the timeline at the introduction point.

### D) Personalized rebound plan (simple Phase 1)

* top recurring bug types (based on labeled failures, weighted by cost/recurrence)
* 2–3 micro-drills tailored to those types
* short pre-test checklist
