# Logger Validation Plan: LauncherSessionListener Lifecycle + Cross-Platform Testing

## Context

The testSupport logger uses `LauncherSessionListener.launcherSessionClosed()` (via SPI discovery of `src/META-INF/services/org.junit.platform.launcher.LauncherSessionListener`) to execute the I/O pipeline exactly once per session. A shutdown hook provides a fallback if SPI discovery fails. This plan validates that:

1. `doSessionFlush()` fires exactly **once per full suite run**, not per-class or per-method
2. The `run.tar` it produces is structurally correct and ingestible by the Pipeline
3. It still saves on test failures (launcherSessionClosed happens regardless of outcome)
4. Performance is acceptable (0 strikes across 20+ runs)
5. It works on both Mac and Windows

## Tools

- **`Pipeline/scripts/verify_tar.sh`** -- single-tar validator with 8 structural checks + optional `--expect-runs N` assertion
- Usage: `./verify_tar.sh <path-to-run.tar> [--verbose] [--expect-runs N]`

---

## Assignment Status

| Assignment | testSupport? | Logger version | @ExtendWith ready? | Status |
|-----------|-------------|---------------|-------------------|--------|
| WarmupAndStretchingWithCompression | Yes | Current (Variant C) | Yes | ✅ Mac validated (Phase 1–2) |
| GraphSurfingSpring26 | Yes | Current (Variant B) | Yes | ✅ Mac validated (Phase 2) |
| BinaryHeapsSpring26 | Yes | Current (Variant B) | Yes | ✅ Mac validated (Phase 2) |
| BinarySearchTreeSpring26 | Yes | Current (Variant B) | Yes | ✅ Mac validated (Phase 2) |
| StringHashSetSpring26 | Yes | Current (Variant B) | Yes | ✅ Mac validated (Phase 2) |
| WarmupAndStretchingSpring26 | Yes | Current (Variant A) | Yes | ⚠️ Windows Phase 3 in progress (Bug 2 fixed at run 16; re-validation needed) |

---

## Phase 1: Validate Reference Implementation (Mac)

**Assignment: WarmupAndStretchingWithCompression**
**Time estimate: ~20 min**

### Step 1: Clean start
- Delete existing `src/testSupport/run.tar` to start fresh

### Step 1b: Verify SPI file is present after build
- Confirm `bin/META-INF/services/org.junit.platform.launcher.LauncherSessionListener` exists
- If missing: trigger a full rebuild (Project → Clean) and recheck before proceeding

### Step 2: LauncherSessionListener lifecycle proof (3 sub-checks)

#### 2a. "Flush once per run" check
1. Run the entire test suite once
2. Extract `prevRunNumber` from `testRunInfo.json` inside `run.tar` -- should be **1**
3. Run the entire suite again (no code changes needed)
4. Extract `prevRunNumber` again -- should be **2** (incremented by exactly +1, not by number of test classes)

**What this proves:** `launcherSessionClosed()` fires once per JUnit session, not per `@ExtendWith`-annotated class.

```bash
# Quick check after 2 runs:
tar -xOf src/testSupport/run.tar testRunInfo.json | python3 -c "import json,sys; print('prevRunNumber:', json.load(sys.stdin)['prevRunNumber'])"
# Expected: prevRunNumber: 2
```

#### 2b. Failure-path check (still closes and saves)
1. Intentionally break one test (e.g., add `throw new RuntimeException("test");` to a test method, or change an assertion to fail)
2. Run the suite -- tests should report failures
3. Verify `run.tar` is still written and non-trivial
4. Run `verify_tar.sh` -- all structural checks should still pass (the tar is valid even though tests failed)
5. Confirm `prevRunNumber` incremented by +1 (should now be **3**)

**What this proves:** `launcherSessionClosed()` fires even when tests fail — the LauncherSessionListener lifecycle is independent of test outcomes.

#### 2c. Revert the intentional failure
- Undo the test breakage from step 2b

### Step 3: Stability loop (20 runs)
1. Run the full test suite 20 times, making a small code edit between each run (add/remove a comment in a student file like `Anagram.java`)
2. After 20 runs (total `prevRunNumber` should be ~23 counting the 3 from step 2):

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --verbose --expect-runs 23
```

### Step 4: Pass criteria
- All 8 structural checks PASS
- `--expect-runs 23` check PASSES (prevRunNumber == total suite executions, not total test classes)
- 0 strikes, `skipLogging=false`
- `prevRunNumber` equals the number of full suite executions performed

---

## Phase 2: Roll Out to Remaining Assignments (Mac)

**Time estimate: ~30 min total (can run in parallel terminal windows)**

### For BinaryHeapsSpring26, BinarySearchTreeSpring26, StringHashSetSpring26:

*(testSupport already copied and updated — setup complete)*

1. Run the suite twice, confirm `prevRunNumber` increments by +1 each time (flush-once-per-run proof)
2. Run tests 10 times total with code edits between runs
3. Validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

### For GraphSurfingSpring26:

*(testSupport already updated — setup complete)*

1. Run the suite twice, confirm `prevRunNumber` increments by +1 each time
2. Run tests 10 times total with code edits, validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

### For WarmupAndStretchingSpring26:

*(testSupport already updated — setup complete)*

1. Run the suite twice, confirm `prevRunNumber` increments by +1 each time
2. Run tests 10 times total, validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

---

## Phase 3: Windows Validation

**Status: In progress.** WarmupAndStretchingSpring26 hit Bug 2 (beforeAll timing strikes) at run 16 before the fix was applied. Fix applied 2026-02-23. Re-run from a clean `run.tar` needed to confirm stability.

**Time estimate: ~30 min**

### Step 1: Primary assignment

1. Pick **WarmupAndStretchingSpring26** (8 test classes — highest Windows stress; Bug 2 was observed here)
2. Confirm `run.tar` has been deleted (it was deleted after the Bug 2 fix to clear the stuck `skipLogging=true`)
3. Verify `bin/META-INF/services/org.junit.platform.launcher.LauncherSessionListener` exists after build
4. Run suite twice, confirm `prevRunNumber` increments by +1 each time (flush-once-per-run proof on Windows)
5. Intentionally break one test, run suite, confirm tar still saves (failure-path proof on Windows)
6. Revert the breakage
7. Run tests 20 times total with code edits between runs (previously failed at run 16; need 20+ clean runs)
8. Validate (either in Git Bash if Python3 available, or copy `run.tar` back to Mac):

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 23
# 23 = 2 (flush-once check) + 1 (failure check) + 20 (stability loop)
```

### Step 2: Secondary assignment

1. Repeat with **WarmupAndStretchingWithCompression** (simpler structure; confirms no regression)
2. Run suite twice (close-once check), 10 more runs with edits
3. Validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 12
```

### Windows-specific risks to watch for

| Risk | Mitigation |
|------|-----------|
| SPI not discovered (`bin/META-INF/` missing) | Verify `bin/META-INF/services/` exists after build; if missing, Project → Clean and rebuild |
| `AtomicMoveNotSupportedException` on NTFS | Logger already has fallback in `atomicallySaveTempFiles()` |
| Path separator differences in diff archive entries | Check diff archive entry names in verbose mode |
| File locking by antivirus or IDE on `run.tar` | Close Eclipse before running `verify_tar.sh` if needed |
| Slower I/O on HDD triggering strikes | Check `strikes` field — if any `true` values appear, investigate `closeTiming` in `testRunInfo.json` |

---

## Minimum Manual Verification Set (per platform)

Per the LauncherSessionListener lifecycle proof strategy, you need exactly these checks per platform/runner combination:

| # | Check | What it proves | Runs |
|---|-------|---------------|------|
| 0 | `bin/META-INF/services/` exists after build | SPI file is on classpath; `launcherSessionClosed()` will be discovered | 0 |
| 1 | 2 back-to-back full suite runs | `doSessionFlush()` fires once per run (prevRunNumber += 1 each time, not += N classes) | 2 |
| 2 | 1 failing run | `doSessionFlush()` still fires on test failures (tar is saved, prevRunNumber increments) | 1 |
| 3 | 10-20 run stability loop + `verify_tar.sh --expect-runs` | Stable over time, no strikes, correct structure | 10-20 |

**Total per environment:** 2 platforms x 1 runner each = **2 full manual validations**

---

## verify_tar.sh Check Reference

| # | Check | PASS criteria |
|---|-------|--------------|
| 1 | Tar exists & non-trivial | File exists, > 100 bytes |
| 2 | Tar structure | Contains `testRunInfo.json`; only expected entries |
| 3 | Valid JSON | `testRunInfo.json` parses as JSON |
| 4 | Schema | Has all 8 required fields |
| 5 | Run consistency | `prevRunNumber` == count of `runTimes` entries; keys consecutive |
| 6 | Performance | `skipLogging` == false; 0 `true` values in `strikes` |
| 7 | Test results | Non-reserved keys are test classes with method->run->status structure |
| 8 | Diff archives | Each `diffs_*_.tar.zip` is a valid ZIP containing a valid TAR |
| 9 | Run count (optional) | `prevRunNumber` == `--expect-runs N` value |

---

## Quick Reference Commands

```bash
# Basic validation (8 checks):
./Pipeline/scripts/verify_tar.sh path/to/run.tar

# With run count assertion (9 checks):
./Pipeline/scripts/verify_tar.sh path/to/run.tar --expect-runs 20

# Verbose output:
./Pipeline/scripts/verify_tar.sh path/to/run.tar --verbose --expect-runs 20

# Quick prevRunNumber peek (no script needed):
tar -xOf path/to/run.tar testRunInfo.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'prevRunNumber={d[\"prevRunNumber\"]}, runTimes={len(d[\"runTimes\"])}')"
```
