# Spring 2026 Logger Fix: Timing Reset, SpeedTest Removal, and Close Observability

## Overview

This document describes the changes applied to the GraphSurfingSpring26 logger to fix the accumulated-timing/strike bug (root cause of 67 WARNING tars from prior assignments), remove the `@SpeedTest` annotation infrastructure, and add timing observability to `close()` and `beforeAll()`.

**Applied to:** `GraphSurfingSpring26/src/testSupport/` and `GraphSurfingSpring26/src/graphs/`
**Date:** 2026-02-23

---

## Root Cause Analysis

### The WARNING Problem (67 / 166 tars)

All 67 WARNING tars shared an identical signature: `skipLogging=true, strikes=0`.

**Root cause:** `accumulatedTime` is a static field in `LoggingSingleton` that was never reset between tests within a single JVM run. Every `BeforeEachCallback`, `TestWatcher.testSuccessful`, etc. added its own elapsed time on top of the previous total. After ~15-20 callbacks, the cumulative time exceeded `SYNC_MAX_TIME` (500ms), triggering the strike mechanism:

```
Callback 1:  accumulatedTime = 5ms    (OK)
Callback 10: accumulatedTime = 80ms   (OK)
Callback 20: accumulatedTime = 350ms  (OK)
Callback 25: accumulatedTime = 520ms  (> 500ms threshold -> addStrike!)
```

**Strike saturation mechanism:**
- `addStrike()` writes `strikes[runNumber % 3] = true`
- `addSecondStrike()` writes `strikes[(runNumber+1) % 3] = true`
- `removeOldStrike()` clears `strikes[(runNumber+2) % 3] = false`

Each run writes 2 indices but only clears 1. By run 2, all 3 indices are true:

| Run | addStrike index | addSecondStrike index | removeOldStrike index | Result |
|-----|----------------|----------------------|----------------------|--------|
| 0   | 0              | 1                    | 2                    | [T, T, F] |
| 1   | 1              | 2                    | 0                    | [F, T, T] |
| 2   | 2              | 0                    | 1                    | [T, F, T] + carry from run 1 index 2 = [T, T, T] |

Once `tooManyStrikes()` returns true, `setSkipLogging(true)` is a one-way latch with no recovery. The logger is permanently dead.

### The CRITICAL Problem (68 / 166 tars)

- 67 of 68: NO_ENGAGEMENT (students never modified code beyond the template)
- 1 of 68: Genuine LOGGER_BUG (BST run39, empty tar despite code changes -- likely initialization crash before any tar was written, now addressed by `safeExecute()` wrappers)

---

## Changes Made

### 1. LoggingSingleton.java -- New Methods

Added after `restartTiming()`:

```java
static void resetAccumulatedTime() {
    LoggingSingleton.accumulatedTime = 0;
}

static void setCloseDurationMs(long ms) {
    ObjectNode node = (ObjectNode) LoggingSingleton.testRunInfo;
    node.put("closeDurationMs", ms);
    LoggingSingleton.testRunInfo = (JsonNode) node;
}

static void setBeforeAllInitDurationMs(long ms) {
    ObjectNode node = (ObjectNode) LoggingSingleton.testRunInfo;
    node.put("beforeAllInitDurationMs", ms);
    LoggingSingleton.testRunInfo = (JsonNode) node;
}

static void addCloseTiming(String operation, long ms) {
    ObjectNode node = (ObjectNode) LoggingSingleton.testRunInfo;
    ObjectNode timingNode = getOrCreateObjectNode(node, "closeTiming");
    timingNode.put(operation, ms);
    LoggingSingleton.testRunInfo = (JsonNode) node;
}
```

### 2. LoggingExtension.java -- Timing Fix

**`beforeEach()`:** Replaced the SpeedTest annotation check with:
```java
LoggingSingleton.resetAccumulatedTime();
```

This resets `accumulatedTime` to 0 before each test. Individual callback overhead (~5-20ms) never approaches the 500ms threshold, so no strikes accumulate.

**`accumulateAndCheckTiming()`:** Simplified to just `accumulateTime()` + `checkTiming()` (removed SpeedTest guard).

**`checkTiming()`:** Removed early return for SpeedTest.

### 3. LoggingExtension.java -- Close Observability

**`beforeAll()`:** Added initialization timing around the init block:
```java
if (!loggerInitialized) {
    long initStart = System.nanoTime();
    // ... existing init code ...
    loggerInitialized = true;
    LoggingSingleton.setBeforeAllInitDurationMs(
            TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - initStart));
}
```

**`close()`:** Added overall and per-operation timing:
- `long closeStart = System.nanoTime()` at the top
- Switched main operations to `timedSafeExecute()` (unzipAndUntarDiffs, writeDiffs, tarAndZipDiffs, addPriorRebaslinedDiffs, copyErrorLogs)
- Moved `setCloseDurationMs()` BEFORE `saveTestRunInfo()` so the value appears in the tar

**New method `timedSafeExecute()`:**
```java
private List<String> timedSafeExecute(String operationName, ThrowingRunnable operation) {
    long opStart = System.nanoTime();
    List<String> errors = safeExecute(operationName, operation);
    long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - opStart);
    try {
        LoggingSingleton.addCloseTiming(operationName, durationMs);
    } catch (Throwable ignored) {}
    return errors;
}
```

### 4. SpeedTest.java -- Deleted

The `@SpeedTest` custom annotation (`@Retention(RUNTIME) @Target(METHOD)`) was deleted entirely. It is no longer needed since timing is now reset per-test unconditionally.

### 5. Test Files -- @SpeedTest Annotations Removed

| File | Annotations Removed |
|------|-------------------|
| `GraphSurfingMilestone1AMTest.java` | 2 (`testSuccessorIteratorIsLazy`, `testPredecessorIteratorIsLazy`) |
| `GraphSurfingMilestone1ALTest.java` | 2 (`testSuccessorIteratorIsLazy`, `testPredecessorIteratorIsLazy`) |
| `GraphSurfingMilestone1TestCore.java` | 2 (`helperTestSuccessorIteratorIsLazy`, `helperTestPredecessorIteratorIsLazy`) |
| `GraphSurfingMilestone2TestCore.java` | 3 (`testWikiSurfingFindPath`, `testWikiSurfingFindChallengePair`, `testWikiSurfingSpeedTest`) |

`import testSupport.SpeedTest;` was also removed from all four files.

---

## New testRunInfo.json Fields

After these changes, `testRunInfo.json` inside `run.tar` will contain:

```json
{
  "beforeAllInitDurationMs": 45,
  "closeDurationMs": 230,
  "closeTiming": {
    "unzipAndUntarDiffs": 12,
    "writeDiffs": 85,
    "tarAndZipDiffs": 40,
    "addPriorRebaslinedDiffs": 5,
    "copyErrorLogs": 2
  }
}
```

These fields enable root-cause analysis of any future close-time failures without needing to reproduce the issue. If a tar is malformed or incomplete, `closeTiming` shows exactly which operation was slow or failed.

---

## Why This Fixes the WARNING Issue

| Before | After |
|--------|-------|
| `accumulatedTime` grows across all callbacks in a JVM run | `accumulatedTime` resets to 0 before each test |
| After ~25 callbacks, cumulative time > 500ms | Per-test callbacks measure ~5-20ms each, never approaching 500ms |
| Strikes accumulate, saturate by run 2 | No strikes accumulate |
| `skipLogging=true` permanently | `skipLogging` remains `false` |

---

## Validation Checklist

- [ ] Run test suite once -- verify `run.tar` created, `testRunInfo.json` contains `beforeAllInitDurationMs`, `closeDurationMs`, and `closeTiming`
- [ ] Run test suite 3+ times -- verify `skipLogging` remains `false` and strikes remain empty
- [ ] Run `verify_tar.sh` -- all 8 structural checks pass
- [ ] Confirm `prevRunNumber` increments by exactly 1 per full suite execution
- [ ] Spot-check that `closeTiming` values are reasonable (each operation < 500ms individually)

---

## Files Modified

```
GraphSurfingSpring26/
  src/testSupport/
    LoggingSingleton.java        -- Added 4 new methods
    LoggingExtension.java        -- Timing fix, close observability, removed SpeedTest guards
    SpeedTest.java               -- DELETED
  src/graphs/
    GraphSurfingMilestone1AMTest.java    -- Removed @SpeedTest + import
    GraphSurfingMilestone1ALTest.java    -- Removed @SpeedTest + import
    GraphSurfingMilestone1TestCore.java  -- Removed @SpeedTest + import
    GraphSurfingMilestone2TestCore.java  -- Removed @SpeedTest + import
```

---

## Document History
- Created: 2026-02-23
- Status: Implementation complete, pending validation
