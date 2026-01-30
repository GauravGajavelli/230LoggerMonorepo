package edu.rosehulman.csse230feedback.prepare;

import com.github.difflib.algorithm.DiffException;
import com.github.difflib.patch.PatchFailedException;
import edu.rosehulman.csse230feedback.data.DiffFileReconstructor;
import edu.rosehulman.csse230feedback.model.PatchPointer;
import edu.rosehulman.csse230feedback.model.frontend.CodeSnapshot;
import edu.rosehulman.csse230feedback.model.frontend.FileContent;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates code snapshots for each run by reconstructing files from diff archives.
 */
public class CodeSnapshotGenerator {

    private final DiffFileReconstructor reconstructor = new DiffFileReconstructor();

    /**
     * Generates code snapshots for all runs that have test data.
     *
     * @param inputDir The ingestion output directory (contains archives/, patches_index.jsonl)
     * @param runNumbers The run numbers to generate snapshots for
     * @param warnings List to accumulate warnings
     * @return List of code snapshots, one per run
     */
    public List<CodeSnapshot> generateSnapshots(Path inputDir, Set<Integer> runNumbers,
                                                 List<String> warnings) throws IOException {
        Path archivesDir = inputDir.resolve("archives");
        Path patchesIndex = inputDir.resolve("patches_index.jsonl");
        Path cacheDir = inputDir.resolve(".cache");

        // Check if we have the required files
        if (!Files.exists(archivesDir)) {
            warnings.add("No archives/ directory found - code snapshots will be empty");
            return Collections.emptyList();
        }
        if (!Files.exists(patchesIndex)) {
            warnings.add("No patches_index.jsonl found - code snapshots will be empty");
            return Collections.emptyList();
        }

        // Create cache directory
        Files.createDirectories(cacheDir);

        // Load all patch pointers
        List<PatchPointer> allPatches = loadPatchesIndex(patchesIndex, warnings);
        if (allPatches.isEmpty()) {
            warnings.add("patches_index.jsonl is empty - code snapshots will be empty");
            return Collections.emptyList();
        }

        // Get unique file keys (these are the tracked files)
        Set<String> fileKeys = allPatches.stream()
            .map(PatchPointer::fileKey)
            .collect(Collectors.toSet());

        // For each run number, find the latest patch for each file at or before that run
        List<CodeSnapshot> snapshots = new ArrayList<>();

        for (int runNumber : runNumbers.stream().sorted().toList()) {
            List<FileContent> files = new ArrayList<>();

            for (String fileKey : fileKeys) {
                // Find the latest patch for this file at or before this run
                Optional<PatchPointer> latestPatch = allPatches.stream()
                    .filter(p -> p.fileKey().equals(fileKey) && p.runNumber() <= runNumber)
                    .max(Comparator.comparingInt(PatchPointer::runNumber));

                if (latestPatch.isPresent()) {
                    try {
                        List<String> content = reconstructor.reconstruct(
                            archivesDir, latestPatch.get(), cacheDir, warnings);

                        String fileName = fileKeyToFileName(fileKey);
                        String language = detectLanguage(fileName);

                        files.add(new FileContent(
                            fileName,
                            language,
                            String.join("\n", content)
                        ));
                    } catch (DiffException | PatchFailedException e) {
                        warnings.add("Failed to reconstruct " + fileKey + " for run " + runNumber +
                            ": " + e.getMessage());
                    } catch (IllegalStateException e) {
                        // File too large or other issues
                        warnings.add("Skipping " + fileKey + " for run " + runNumber +
                            ": " + e.getMessage());
                    }
                }
            }

            // Sort files by name for consistent ordering
            files.sort(Comparator.comparing(FileContent::name));

            if (!files.isEmpty()) {
                snapshots.add(new CodeSnapshot(runNumber, files));
            }
        }

        return snapshots;
    }

    /**
     * Converts a file key to a display file name.
     * e.g., "BinarySearchTree.java.BinarySearchTree" -> "BinarySearchTree.java"
     */
    private String fileKeyToFileName(String fileKey) {
        int javaIndex = fileKey.indexOf(".java.");
        if (javaIndex >= 0) {
            return fileKey.substring(0, javaIndex + 5); // +5 for ".java"
        }
        // Fallback: treat as package.ClassName and return ClassName.java
        String[] parts = fileKey.split("\\.");
        return parts[parts.length - 1] + ".java";
    }

    /**
     * Detects the language from a file name.
     */
    private String detectLanguage(String fileName) {
        if (fileName.endsWith(".java")) return "java";
        if (fileName.endsWith(".py")) return "python";
        if (fileName.endsWith(".js")) return "javascript";
        if (fileName.endsWith(".ts")) return "typescript";
        if (fileName.endsWith(".cpp") || fileName.endsWith(".cc")) return "cpp";
        if (fileName.endsWith(".c")) return "c";
        return "text";
    }

    /**
     * Loads patch pointers from patches_index.jsonl.
     */
    private List<PatchPointer> loadPatchesIndex(Path patchesIndex, List<String> warnings)
            throws IOException {
        List<PatchPointer> patches = new ArrayList<>();

        try (BufferedReader reader = Files.newBufferedReader(patchesIndex)) {
            String line;
            int lineNum = 0;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (!line.trim().isEmpty()) {
                    try {
                        PatchPointer patch = Json.mapper().readValue(line, PatchPointer.class);
                        patches.add(patch);
                    } catch (IOException e) {
                        warnings.add("Failed to parse line " + lineNum +
                            " in patches_index.jsonl: " + e.getMessage());
                    }
                }
            }
        }

        return patches;
    }
}
