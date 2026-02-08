# Root-Cause Analysis Plan: Logger Issues via WarmupAndStretching Logs

## Overview

This plan outlines how to use WarmupAndStretching assignment logs to identify and fix any remaining logger issues before deploying to subsequent assignments (BST, StringHashSet, etc.).

## Timeline

```
Week 1-2: WarmupAndStretching Assignment
├── Day 1-3: Students work on assignment, logs accumulate
├── Day 4: First log collection checkpoint
├── Day 5-7: Analyze errors, develop fixes
└── Day 7: Deploy fixes if needed

Week 3+: BST and subsequent assignments
└── Deploy with validated, fixed logger
```

## Prerequisites

### 1. Deploy Updated Logger
Ensure all fixes are in place before WarmupAndStretching:
- [x] Defensive error handling in `close()` (safeExecute wrappers)
- [x] Hidden error logging (error-logs.txt only, no stderr visible to user)
- [x] Shutdown reason logging (tracks why logger stopped - size limits, strikes, skipLogging)
- [x] JUnit lifecycle fix (CloseableResource instead of shutdown hook)
- [x] In-memory baseline fix (iterate over captured files, not filesystem)
- [x] @SpeedTest annotation for speed tests

### 2. Prepare Analysis Tools
Scripts in `/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline/scripts/`:
- `check_tar_health.sh` - Categorize tars as CRITICAL/WARNING/OK
- `analyze_errors.sh` - Extract and aggregate error messages

---

## Phase 1: Initial Data Collection (Day 1-3)

### 1.1 Monitor Early Submissions
```bash
# After first submissions come in, run health check
cd /path/to/submitted/tars
/path/to/scripts/check_tar_health.sh *.tar
```

### 1.2 Expected Baseline Metrics
Based on previous data, expect approximately:
- CRITICAL: ~0% (if students run tests)
- WARNING: ~40-60% (if run 2+ bug persists)
- OK: ~40-60%

### 1.3 Red Flags to Watch For
| Metric | Concern Level | Action |
|--------|---------------|--------|
| CRITICAL > 10% | High | Check if students can compile/run tests |
| WARNING > 70% | Medium | Bug still present, analyze errors |
| All tars 0 bytes | Critical | Logger not initializing at all |

---

## Phase 2: Error Analysis (Day 4-5)

### 2.1 Run Error Analysis
```bash
cd /path/to/submitted/tars
/path/to/scripts/analyze_errors.sh *.tar
```

### 2.2 Expected Output Format
```
ERROR FREQUENCY:
By Operation:
  43x ERROR in unzipAndUntarDiffs:
  12x ERROR in writeDiffs:
   5x ERROR in tarAndZipDiffs:

By Exception Type:
  35x IOException
  15x NullPointerException
   5x UncheckedIOException

UNIQUE ERROR MESSAGES:
  ERROR in unzipAndUntarDiffs: java.io.IOException: File already exists
  ERROR in writeDiffs: java.lang.NullPointerException: Cannot invoke...
```

### 2.3 Interpretation Guide

| Error Pattern | Likely Cause | Fix Priority |
|---------------|--------------|--------------|
| IOException in unzipAndUntarDiffs | File extraction conflict | High |
| NullPointerException in writeDiffs | Missing baseline data | High |
| IOException: File already exists | Incomplete cleanup from prior run | Medium |
| UncheckedIOException: Stream closed | Premature resource closure | High |
| SHUTDOWN - skipLogging flag is set | Previous error triggered skip | Medium |
| SHUTDOWN - Too many timing strikes | Logger operations too slow | Medium |
| SHUTDOWN - Repo/Tar size exceeds | Student repo unusually large | Low |

---

## Phase 3: Root Cause Investigation (Day 5-6)

### 3.1 For Each Unique Error Type

#### Step 1: Identify the exact failure point
```java
// Error message format:
// ERROR in <operation>: <ExceptionType>: <message>

// Map to code location:
// unzipAndUntarDiffs -> LoggingExtension.java:657
// writeDiffs -> LoggingExtension.java:741
// tarAndZipDiffs -> LoggingExtension.java:700
// addPriorRebaslinedDiffs -> LoggingExtension.java:786
```

#### Step 2: Check for environment-specific issues
- Windows vs Mac path separators
- File locking behavior
- Temp directory permissions

#### Step 3: Reproduce locally
```bash
# Simulate multiple runs
cd /path/to/test/repo
# Run tests once (should succeed)
./gradlew test  # or IDE run
# Run tests again (may trigger bug)
./gradlew test
# Check error-logs.txt
cat src/testSupport/run.tar | tar -xOf - error-logs.txt
```

### 3.2 Common Root Causes and Fixes

#### A. File Already Exists
```java
// Problem: Extraction fails when file exists
// Fix: Add StandardOpenOption.REPLACE_EXISTING or delete first
Files.copy(source, dest, StandardCopyOption.REPLACE_EXISTING);
```

#### B. Null Pointer in Baseline Access
```java
// Problem: inMemoryBaselines doesn't contain expected file
// Fix: Add null check before access
List<String> lines = inMemoryBaselines.get(file);
if (lines == null) {
    // Handle gracefully - skip this file or log warning
    continue;
}
```

#### C. Stream Already Closed
```java
// Problem: Try-with-resources closes stream prematurely
// Fix: Ensure stream lifecycle matches usage scope
```

#### D. Path Mismatch Between Runs
```java
// Problem: Relative vs absolute paths differ between runs
// Fix: Normalize all paths consistently
Path normalized = path.toAbsolutePath().normalize();
```

---

## Phase 4: Fix Development and Testing (Day 6-7)

### 4.1 Development Checklist
- [ ] Identify root cause from error logs
- [ ] Develop minimal fix
- [ ] Test fix locally with multiple runs
- [ ] Test on both Windows and Mac if possible
- [ ] Verify fix doesn't break existing functionality

### 4.2 Testing Protocol
```bash
# Test sequence (run all sequentially)
1. Fresh clone of repo
2. Run tests once - verify run.tar created with data
3. Modify a source file
4. Run tests again - verify diffs captured
5. Modify again
6. Run tests third time - verify no errors
7. Check error-logs.txt is empty
8. Check testRunInfo.json shows correct run count
```

### 4.3 Validation Criteria
| Criterion | Requirement |
|-----------|-------------|
| Run 1 | Creates valid run.tar with baseline |
| Run 2 | Captures diffs, no errors |
| Run 3+ | Continues working, no degradation |
| Error logs | Empty after successful runs |
| skipLogging | Remains false |
| strikes | Remains empty {} |

---

## Phase 5: Deployment Decision (Day 7)

### 5.1 Decision Matrix

| Scenario | Action |
|----------|--------|
| No errors found | Proceed to BST with current logger |
| Errors found and fixed | Deploy fix, monitor BST closely |
| Errors found, fix complex | Deploy defensive version, plan fix for next term |
| Widespread failures | Pause deployment, prioritize fix |

### 5.2 Deployment Steps
```bash
# After fix is validated
# 1. Update main development repo
cd /path/to/WarmupAndStretchingWithCompression
# Apply fixes to LoggingExtension.java

# 2. Copy to all assignment repos
cp src/testSupport/LoggingExtension.java /path/to/BinarySearchTreeWinter26/src/testSupport/
cp src/testSupport/LoggingExtension.java /path/to/StringHashSetWinter26/src/testSupport/
# etc.

# 3. Verify deployment
for repo in BST StringHashSet ...; do
    grep -c "FIX_MARKER" /path/to/$repo/src/testSupport/LoggingExtension.java
done
```

---

## Appendix: Quick Reference

### A. Key File Locations
```
Logger Source:
  /path/to/WarmupAndStretchingWithCompression/src/testSupport/LoggingExtension.java

Analysis Scripts:
  /path/to/230LoggerMonorepo/Pipeline/scripts/check_tar_health.sh
  /path/to/230LoggerMonorepo/Pipeline/scripts/analyze_errors.sh

Output Files:
  /path/to/230LoggerMonorepo/Pipeline/scripts/scriptOutputs/health_summary.txt
  /path/to/230LoggerMonorepo/Pipeline/scripts/scriptOutputs/error_summary.txt
```

### B. Key Code Locations in LoggingExtension.java
| Operation | Line | Method |
|-----------|------|--------|
| Initialization | ~94 | beforeAll() |
| Cleanup | ~226 | close() |
| Unzip diffs | ~657 | unzipAndUntarDiffs() |
| Write diffs | ~741 | writeDiffs() |
| Tar diffs | ~700 | tarAndZipDiffs() |
| Error handling | ~1018 | logError() |

### C. Expected Error Log Format
```
ERROR in <operation>: <ExceptionClass>: <message>
FATAL: <ExceptionClass>: <message>
SHUTDOWN - <time>: <reason>
<run_number>
```

- **ERROR/FATAL**: Operation failures with exception details
- **SHUTDOWN**: Why the logger stopped (size limits, strikes, skipLogging flag)
- **Run numbers**: Bare integers on their own lines indicate successful runs

Example error-logs.txt:
```
5
6
SHUTDOWN - 14:32:05: Too many timing strikes accumulated
```
This shows runs 5 and 6 succeeded, but run 7 had timing issues.

Shutdown reasons include:
- `Repo size (X bytes) exceeds MAX_REPO_SIZE (Y bytes)`
- `Tar size exceeds MAX_TAR_SIZE (Y bytes)`
- `skipLogging flag is set`
- `Too many timing strikes accumulated`

### D. Contact/Escalation
If issues cannot be resolved:
1. Document all findings in this repo
2. Consider disabling logger for affected assignment
3. Plan comprehensive rewrite for next term

---

## Document History
- Created: 2026-02-08
- Last Updated: 2026-02-08
- Author: [Your Name]
- Status: Ready for execution next quarter

### Change Log
- 2026-02-08: Added shutdown reason logging, switched to hidden error logging (no stderr)
- 2026-02-08: Added successful run number logging to error-logs.txt (gaps indicate failures)
