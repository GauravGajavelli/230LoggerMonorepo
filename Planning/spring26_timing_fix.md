# Spring 2026 Logger Fix: Complete Overhaul

## Overview

This document records all changes applied to the Spring 2026 logger codebase. Changes were applied across three phases:

1. **Timing reset + SpeedTest removal + close observability** — initially applied to GraphSurfingSpring26, then propagated to all 6 assignments
2. **Bug 2 fix (beforeAll() timing strikes on Windows)** — applied to WarmupAndStretchingSpring26, then propagated
3. **Session I/O migration to LauncherSessionListener** — applied to all 6 assignments

**Applied to:** All 6 Spring 2026 assignments:
- `GraphSurfingSpring26` — Variant B; SpeedTest removal also applies here
- `WarmupAndStretchingSpring26` — Variant A (has `BEFORE_ALL_MAX_TIME`, `cachedRepoSize`, `cachedTarTooBig`)
- `BinaryHeapsSpring26` — Variant B
- `BinarySearchTreeSpring26` — Variant B
- `StringHashSetSpring26` — Variant B
- `WarmupAndStretchingWithCompression` — Variant C (reference; Mac-only validation)

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

### Bug 2: beforeAll() Timing Strikes on Windows

**Assignment:** WarmupAndStretchingSpring26 (8 test classes, all with `@ExtendWith`)
**Symptom:** `skipLogging=true` after run 16; `strikes={1:true,2:true,0:false}`; `beforeAllInitDurationMs=375ms`

Root cause had three components:
1. `getCurrentTotalElapsedTime()` after `accumulateTime()` double-counts the interval (= old_accumulated + 2×interval), halving the effective threshold to ~250ms
2. `getRepoFilesSize()` runs inside the timing window on every `beforeAll()` call (8× per run)
3. Windows HDD + antivirus makes filesystem walks intermittently >250ms

**Sticky loop:** when `tooManyStrikes()` fires in close, `skipLogging=true` is written to the tar. The next run reads it and bails early without writing, staying stuck.

---

## Changes Made

### 1. LoggingSingleton.java — New Methods (all 6 assignments)

```java
static void resetAccumulatedTime() {
    LoggingSingleton.accumulatedTime = 0;
}

static void setCloseDurationMs(long ms) { ... }

static void setBeforeAllInitDurationMs(long ms) { ... }

static void setBeforeAllTotalDurationMs(long ms) { ... }  // Variant A only

static void addCloseTiming(String operation, long ms) { ... }
```

### 2. LoggingExtension.java — Timing Fix (all 6 assignments)

**`beforeEach()`:** Added at the top:
```java
LoggingSingleton.resetAccumulatedTime();
```
This resets `accumulatedTime` to 0 before each test. Individual callback overhead (~5-20ms) never approaches the 500ms threshold.

### 3. LoggingExtension.java — beforeAll() Fix (Variant A — WarmupAndStretchingSpring26)

Added to address Bug 2 (Windows timing strikes):

```java
@Override
public void beforeAll(ExtensionContext ctx) {
    try {
        LoggingSingleton.resetAccumulatedTime();        // reset before any timing
        long beforeAllStart = System.nanoTime();
        LoggingSingleton.restartTiming();
        // ...
        LoggingSingleton.setBeforeAllTotalDurationMs(
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - beforeAllStart));
        accumulateAndCheckTiming(BEFORE_ALL_MAX_TIME);  // was ASYNC_MAX_TIME; 2000ms threshold
```

Also added `BEFORE_ALL_MAX_TIME = 2000` and caching for `cachedRepoSize` / `cachedTarTooBig` so filesystem walks only run once per JVM session.

### 4. LoggingExtension.java — doSessionFlush() Observability (all 6 assignments)

**`doSessionFlush()`** (formerly `close()`, then `afterAll()` — see section 5 below):
- `long closeStart = System.nanoTime()` at the top
- Main operations wrapped in `timedSafeExecute()`: unzipAndUntarDiffs, writeDiffs, tarAndZipDiffs, addPriorRebaslinedDiffs, copyErrorLogs
- `setCloseDurationMs()` called BEFORE `saveTestRunInfo()` so the value appears in the tar

**New method `timedSafeExecute()`:**
```java
private List<String> timedSafeExecute(String operationName, ThrowingRunnable operation) {
    long opStart = System.nanoTime();
    List<String> errors = safeExecute(operationName, operation);
    long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - opStart);
    try { LoggingSingleton.addCloseTiming(operationName, durationMs); } catch (Throwable ignored) {}
    return errors;
}
```

### 5. Session I/O: LauncherSessionListener Migration (all 6 assignments)

**Problem with AfterAllCallback:** `afterAll()` ran once per test class (9× for WarmupAndStretchingSpring26), executing the full I/O pipeline each time. On Windows with antivirus, 9× file I/O per session accumulates timing strikes — same class of bug as Bug 2.

**Solution:** `LauncherSessionListener.launcherSessionClosed()` fires exactly once after all test classes in a session complete.

**New files (×6 assignments):**

`src/testSupport/LoggingSessionListener.java`:
```java
package testSupport;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;

public class LoggingSessionListener implements LauncherSessionListener {
    @Override
    public void launcherSessionClosed(LauncherSession session) {
        LoggingExtension.launcherSessionListenerFired = true;
        LoggingExtension ext = LoggingExtension.instance;
        if (ext == null) return;
        ext.doSessionFlush();
    }
}
```

`src/META-INF/services/org.junit.platform.launcher.LauncherSessionListener`:
```
testSupport.LoggingSessionListener
```

Eclipse copies this to `bin/META-INF/services/` automatically during build. IntelliJ does the same via default resource patterns.

**Changes to `LoggingExtension.java` (all 6):**
- Removed `AfterAllCallback` import and from `implements` clause
- Removed `static private boolean diffsInitialized`
- Added: `static LoggingExtension instance;` and `static boolean launcherSessionListenerFired = false;`
- After `loggerInitialized = true;`: added `instance = this;`
- Shutdown hook updated to call `instance.doSessionFlush()` as fallback if `!launcherSessionListenerFired`
- `afterAll()` removed; replaced by `void doSessionFlush()` with identical body minus the `diffsInitialized` guard (unconditional call)
- Log messages updated: `"in afterAll"` → `"in launcherSessionClosed"`

**`GraphSurfingSpring26/GraphSurfing.iml`:** Added `junit-platform-launcher-1.14.0.jar` to JUnit5 library (required for IntelliJ users who import via `.iml` directly).

### 6. SpeedTest.java — Deleted (GraphSurfingSpring26 only)

The `@SpeedTest` custom annotation was deleted entirely. Timing is now reset per-test unconditionally.

**Test files with `@SpeedTest` removed:**

| File | Annotations Removed |
|------|-------------------|
| `GraphSurfingMilestone1AMTest.java` | 2 |
| `GraphSurfingMilestone1ALTest.java` | 2 |
| `GraphSurfingMilestone1TestCore.java` | 2 |
| `GraphSurfingMilestone2TestCore.java` | 3 |

---

## New testRunInfo.json Fields

```json
{
  "beforeAllInitDurationMs": 45,
  "beforeAllTotalDurationMs": 52,
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

`beforeAllTotalDurationMs` is present in Variant A only.

---

## Why This Fixes the WARNING Issue

| Before | After |
|--------|-------|
| `accumulatedTime` grows across all callbacks in a JVM run | `accumulatedTime` resets to 0 before each test |
| After ~25 callbacks, cumulative time > 500ms | Per-test callbacks measure ~5-20ms each |
| Strikes accumulate, saturate by run 2 | No strikes accumulate |
| `skipLogging=true` permanently | `skipLogging` remains `false` |
| I/O pipeline runs N times per session (once per test class) | I/O pipeline runs exactly once via `launcherSessionClosed()` |

---

## Validation Checklist

- [ ] Build in Eclipse → confirm `bin/META-INF/services/org.junit.platform.launcher.LauncherSessionListener` exists
- [ ] Delete existing `run.tar`. Run all test classes together (right-click project → Run As → JUnit Test)
- [ ] Extract `run.tar`, inspect `testRunInfo.json`: all test classes present; `prevRunNumber = 1`; no timing strikes
- [ ] Run again → `prevRunNumber = 2`; patches folder populated; `closeTiming` values reasonable (each < 500ms)
- [ ] Run `verify_tar.sh` — all structural checks pass
- [ ] Run 3+ times — verify `skipLogging` remains `false` and strikes remain empty
- [ ] Run in IntelliJ to confirm SPI is discovered (no fallback to shutdown hook)
- [ ] Windows: run 20+ times — verify no strike accumulation in beforeAll

---

## Files Modified

```
All 6 assignments (src/testSupport/):
    LoggingSingleton.java           — resetAccumulatedTime(), setCloseDurationMs(),
                                      setBeforeAllInitDurationMs(), addCloseTiming()
                                      + setBeforeAllTotalDurationMs() (Variant A only)
    LoggingExtension.java           — timing fix, doSessionFlush() observability,
                                      LauncherSessionListener migration
    LoggingSessionListener.java     — NEW: SPI impl (launcherSessionClosed → doSessionFlush)

All 6 assignments (src/META-INF/services/):
    org.junit.platform.launcher.LauncherSessionListener  — NEW: SPI registration

GraphSurfingSpring26/ (additional):
    src/testSupport/SpeedTest.java              — DELETED
    src/graphs/GraphSurfingMilestone1AMTest.java — Removed @SpeedTest + import
    src/graphs/GraphSurfingMilestone1ALTest.java — Removed @SpeedTest + import
    src/graphs/GraphSurfingMilestone1TestCore.java — Removed @SpeedTest + import
    src/graphs/GraphSurfingMilestone2TestCore.java — Removed @SpeedTest + import
    GraphSurfing.iml                            — Added junit-platform-launcher-1.14.0.jar
```

---

## Document History

| Date | Change |
|------|--------|
| 2026-02-23 | Phase 1: Timing reset fix + SpeedTest removal + close observability applied to GraphSurfingSpring26 |
| 2026-02-23 | Phase 2: Bug 2 (beforeAll Windows timing) fixed in WarmupAndStretchingSpring26; all fixes propagated to all 6 assignments |
| 2026-02-23 | Phase 3: Session I/O migrated to LauncherSessionListener; afterAll() replaced by doSessionFlush(); LoggingSessionListener.java + SPI service file created for all 6 assignments |
