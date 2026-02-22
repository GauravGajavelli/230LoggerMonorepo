# Logger Validation Plan: CloseableResource Lifecycle + Cross-Platform Testing

## Context

The testSupport logger was transitioned from a JVM shutdown hook to JUnit's `ExtensionContext.Store.CloseableResource` lifecycle (via `ctx.getRoot().getStore(NAMESPACE).put("logger", this)` in `beforeAll()`). This plan validates that:

1. The `close()` fires exactly **once per full suite run**, not per-class or per-method
2. The `run.tar` it produces is structurally correct and ingestible by the Pipeline
3. It still saves on test failures (close happens regardless of outcome)
4. Performance is acceptable (0 strikes across 20+ runs)
5. It works on both Mac and Windows

## Tools

- **`Pipeline/scripts/verify_tar.sh`** -- single-tar validator with 8 structural checks + optional `--expect-runs N` assertion
- Usage: `./verify_tar.sh <path-to-run.tar> [--verbose] [--expect-runs N]`

---

## Assignment Status

| Assignment | testSupport? | Logger version | @ExtendWith ready? | Action needed |
|-----------|-------------|---------------|-------------------|---------------|
| WarmupAndStretchingWithCompression | Yes | Advanced (1345 lines, CloseableResource) | Yes | **Test first** (reference) |
| GraphSurfingSpring26 | Yes | Advanced (1207 lines) | Yes | Diff against reference; may need update |
| BinaryHeapsSpring26 | No | None | Yes (annotation exists, class missing) | Copy testSupport + JARs |
| BinarySearchTreeSpring26 | No | None | Yes (annotation exists, class missing) | Copy testSupport + JARs |
| StringHashSetSpring26 | No | None | No annotation | Copy testSupport + JARs + add @ExtendWith |
| WarmupAndStretchingSpring26 | Yes | Basic (33 lines, 3 extensions) | Different pattern | Replace with advanced version |

---

## Phase 1: Validate Reference Implementation (Mac)

**Assignment: WarmupAndStretchingWithCompression**
**Time estimate: ~20 min**

### Step 1: Clean start
- Delete existing `src/testSupport/run.tar` to start fresh

### Step 2: CloseableResource lifecycle proof (3 sub-checks)

#### 2a. "Close once per run" check
1. Run the entire test suite once
2. Extract `prevRunNumber` from `testRunInfo.json` inside `run.tar` -- should be **1**
3. Run the entire suite again (no code changes needed)
4. Extract `prevRunNumber` again -- should be **2** (incremented by exactly +1, not by number of test classes)

**What this proves:** `close()` fires once per JUnit session, not per `@ExtendWith`-annotated class.

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

**What this proves:** `close()` fires even when tests fail -- the CloseableResource lifecycle is independent of test outcomes.

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

1. Copy `src/testSupport/` directory from WarmupAndStretchingWithCompression
2. Verify JARs exist in project root (jackson, commons-compress, diff-utils) -- they should already be there
3. **StringHashSetSpring26 only:** add `@ExtendWith(LoggingExtension.class)` to `StringHashSetTest.java`
4. Run the suite twice, confirm `prevRunNumber` increments by +1 each time (close-once-per-run proof)
5. Run tests 10 times total with code edits between runs
6. Validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

### For GraphSurfingSpring26:

1. Diff `src/testSupport/LoggingExtension.java` against the WarmupAndStretchingWithCompression reference
2. If the CloseableResource lifecycle change is missing, replace with the reference version
3. Run the suite twice, confirm `prevRunNumber` increments by +1 each time
4. Run tests 10 times total with code edits, validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

### For WarmupAndStretchingSpring26:

1. Replace the basic 33-line `LoggingExtension.java` + `BeforeLoggingExtension.java` + `AfterLoggingExtension.java` with the full advanced package from the reference
2. Update test annotations from 3 extensions to single `@ExtendWith(LoggingExtension.class)`
3. Add missing JARs (jackson, commons-compress, diff-utils) -- this repo has none
4. Run the suite twice, confirm `prevRunNumber` increments by +1 each time
5. Run tests 10 times total, validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 10
```

---

## Phase 3: Windows Validation

**Time estimate: ~30 min**

### Step 1: Primary assignment

1. Pick **WarmupAndStretchingWithCompression** (highest confidence from Mac testing)
2. Clone/copy to the Windows PC
3. Open in Eclipse
4. Run suite twice, confirm `prevRunNumber` increments by +1 each time (close-once-per-run proof on Windows)
5. Intentionally break one test, run suite, confirm tar still saves (failure-path proof on Windows)
6. Revert the breakage
7. Run tests 15 times total with code edits between runs
8. Validate (either in Git Bash if Python3 available, or copy `run.tar` back to Mac):

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 18
# 18 = 2 (close-once check) + 1 (failure check) + 15 (stability loop)
```

### Step 2: Secondary assignment

1. Repeat with **BinarySearchTreeSpring26** (different test structure)
2. Run suite twice (close-once check), 10 more runs with edits
3. Validate:

```bash
./Pipeline/scripts/verify_tar.sh src/testSupport/run.tar --expect-runs 12
```

### Windows-specific risks to watch for

| Risk | Mitigation |
|------|-----------|
| `AtomicMoveNotSupportedException` on NTFS | Logger already has fallback at `LoggingExtension.java` ~line 1070 |
| Path separator differences in diff archive entries | Check diff archive entry names in verbose mode |
| File locking by antivirus or IDE on `run.tar` | Close Eclipse before running `verify_tar.sh` if needed |
| Slower I/O on HDD triggering strikes | Check `strikes` field -- if any `true` values appear, investigate timing |

---

## Minimum Manual Verification Set (per platform)

Per the CloseableResource lifecycle proof strategy, you need exactly these checks per platform/runner combination:

| # | Check | What it proves | Runs |
|---|-------|---------------|------|
| 1 | 2 back-to-back full suite runs | `close()` fires once per run (prevRunNumber += 1 each time, not += N classes) | 2 |
| 2 | 1 failing run | `close()` still fires on test failures (tar is saved, prevRunNumber increments) | 1 |
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
