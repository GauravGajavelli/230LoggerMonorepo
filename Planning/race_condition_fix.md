# In-Memory Baseline Fix (Race Condition Prevention)

**Status:** Implemented — all 6 Spring 2026 assignments
**Date:** 2026-02-23

## Problem

The original `writeDiffs()` walked the live filesystem and read source files at `close()`/`doSessionFlush()` time. If a student modified a file between running tests and the session flush completing, the diff would be computed against the modified (post-test) version rather than the version that was actually tested. This produces incorrect diffs that can't be reproduced from the session's test run.

## Solution

Capture all source files into memory at `beforeAll()` time (before tests execute). Use the in-memory snapshots for diff computation in `doSessionFlush()`.

---

## Changes Made

### 1. New Imports (LoggingExtension.java)

```java
import java.util.HashMap;
```

### 2. New Fields (LoggingExtension.java)

```java
static private Map<Path, List<String>> inMemoryBaselines;     // lines for diff computation
static private Map<Path, String> inMemoryBaselineBytes;        // raw bytes for baseline creation
```

Both are populated once during `beforeAll()` init and used throughout `doSessionFlush()`.

### 3. Call in beforeAll() (after initDirectories())

```java
// Capture source files into memory before tests run
// This ensures code snapshots match the actual tested code
captureSourceFilesInMemory();
```

### 4. captureSourceFilesInMemory() Method

```java
private void captureSourceFilesInMemory() {
    inMemoryBaselines = new HashMap<>();
    inMemoryBaselineBytes = new HashMap<>();
    Path sourceFolder = Paths.get(sourceFolderName);
    try {
        Files.walkFileTree(sourceFolder, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                if (dir.getFileName().toString().equals(testSupportPackageName)) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return FileVisitResult.CONTINUE;
            }
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                if (file.toString().endsWith(".java")) {
                    if (!fileLargerThan(file, MAX_DIFFED_FILE_SIZE)) {  // skip files > 1MB
                        inMemoryBaselines.put(file, Files.readAllLines(file, StandardCharsets.UTF_8));
                        inMemoryBaselineBytes.put(file, new String(Files.readAllBytes(file)));
                    }
                }
                return FileVisitResult.CONTINUE;
            }
        });
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    }
}
```

**Notes from initial design:** Early design used `baseDir().resolve(sourceFolderName)` — this was simplified to `Paths.get(sourceFolderName)` to match the rest of the codebase. The `fileLargerThan()` guard and `inMemoryBaselineBytes` were added during implementation (not in the original plan) to handle large files and to correctly capture the raw bytes used for baseline creation.

### 5. writeDiffs() — Iterate in-memory captures

Instead of walking the filesystem at flush time, iterate over `inMemoryBaselines.entrySet()`:

```java
private void writeDiffs(int testRunNumber, int seed, boolean redactDiffs) throws IOException {
    Path tempDiffsFolder = filepathResolve(tempDirectory).resolve(diffsFolderName);
    Path srcRoot = Paths.get(sourceFolderName);

    for (Map.Entry<Path, List<String>> entry : inMemoryBaselines.entrySet()) {
        Path file = entry.getKey();
        List<String> capturedLines = entry.getValue();
        // ... derive fileName, packageName, baselineFilePath from file path ...

        if (Files.exists(baselineFilePath)) {
            addDiffedFile(fileNameNoJava, packageName, capturedLines,
                    baselineFilePath, testRunNumber, seed, redactDiffs);
        } else {
            // New baseline — use captured bytes (not lines) for correct byte-level output
            String sourceContents = inMemoryBaselineBytes.get(file);
            // ... write baseline and creation patch ...
        }
    }
    // ... rebaselining logic unchanged ...
}
```

### 6. addDiffedFile() Signature

```java
// Old (filesystem-based):
private long addDiffedFile(String fileName, String packageName,
                            Path revisedPath, Path sourcePath, ...)

// New (in-memory):
private long addDiffedFile(String fileName, String packageName,
                            List<String> capturedLines, Path sourcePath, ...)
```

**Note:** An intermediate design included a separate `originalFilePath` parameter that was dropped — the final signature uses only `capturedLines` (from memory) and `sourcePath` (the baseline on disk in temp).

Inside the method, the size check for `sourcePath` is retained since that's the baseline file from temp, which could theoretically be large from a prior run.

---

## Why Two Maps?

- `inMemoryBaselines` (`Map<Path, List<String>>`): lines for `DiffUtils.diff()` and `addDiffedFile()`
- `inMemoryBaselineBytes` (`Map<Path, String>`): raw bytes for writing new baseline files

Using `String.join(...)` from the lines map to reconstruct bytes would introduce line-ending inconsistencies. Capturing bytes separately preserves the original file content exactly.

---

## Files Modified

Applied to all 6 Spring 2026 assignments (`src/testSupport/LoggingExtension.java`):
- Added `inMemoryBaselines` + `inMemoryBaselineBytes` fields
- Added `captureSourceFilesInMemory()` call in `beforeAll()` (inside `!loggerInitialized` block)
- Added `captureSourceFilesInMemory()` method
- Updated `writeDiffs()` to iterate in-memory captures
- Updated `addDiffedFile()` signature

See `spring26_timing_fix.md` for full context of all Spring 2026 changes.
