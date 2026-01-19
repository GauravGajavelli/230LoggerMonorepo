package edu.rosehulman.csse230feedback.runner;

import com.github.difflib.algorithm.DiffException;
import com.github.difflib.patch.PatchFailedException;
import edu.rosehulman.csse230feedback.data.DiffFileReconstructor;
import edu.rosehulman.csse230feedback.model.PatchPointer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Materializes code snapshots from diff archives into a workspace.
 * Reconstructs the full source tree at a specific run number by
 * applying patches to baselines.
 */
public class SnapshotMaterializer {

    private final DiffFileReconstructor reconstructor = new DiffFileReconstructor();

    /**
     * Materializes all files for a specific run into the workspace src/ directory.
     *
     * @param workspace Path to workspace root
     * @param archivesDir Path to directory containing diff archives
     * @param cacheDir Path to cache directory for extracted entries
     * @param runNumber The run number to materialize
     * @param patches List of all patch pointers from patches_index.jsonl
     * @param warnings List to accumulate warning messages
     * @return Number of files successfully materialized
     * @throws IOException if file operations fail
     */
    public int materializeSnapshot(Path workspace, Path archivesDir, Path cacheDir,
            int runNumber, List<PatchPointer> patches, List<String> warnings)
            throws IOException {

        Path srcDir = workspace.resolve("src");

        // Filter patches for this run number
        List<PatchPointer> runPatches = patches.stream()
            .filter(p -> p.runNumber() == runNumber)
            .collect(Collectors.toList());

        if (runPatches.isEmpty()) {
            warnings.add("No patches found for run " + runNumber);
            return 0;
        }

        int filesWritten = 0;

        for (PatchPointer patch : runPatches) {
            try {
                List<String> content = reconstructor.reconstruct(archivesDir, patch, cacheDir, warnings);

                // Convert fileKey (e.g., "com.foo.Bar") to file path
                Path targetPath = fileKeyToPath(srcDir, patch.fileKey());

                // Create parent directories
                Files.createDirectories(targetPath.getParent());

                // Write reconstructed content
                Files.write(targetPath, content, StandardCharsets.UTF_8);
                filesWritten++;

            } catch (DiffException | PatchFailedException e) {
                warnings.add("Failed to reconstruct " + patch.fileKey() + " for run " + runNumber +
                    ": " + e.getMessage());
            } catch (IllegalStateException e) {
                // File too large or other reconstruction issues
                warnings.add("Skipping " + patch.fileKey() + ": " + e.getMessage());
            }
        }

        return filesWritten;
    }

    /**
     * Materializes files for the most recent run at or before the given run number.
     * This finds the latest patch for each file that exists at or before runNumber.
     *
     * @param workspace Path to workspace root
     * @param archivesDir Path to directory containing diff archives
     * @param cacheDir Path to cache directory
     * @param runNumber The target run number
     * @param allPatches All available patch pointers
     * @param warnings List to accumulate warnings
     * @return Number of files materialized
     * @throws IOException if file operations fail
     */
    public int materializeLatestSnapshot(Path workspace, Path archivesDir, Path cacheDir,
            int runNumber, List<PatchPointer> allPatches, List<String> warnings)
            throws IOException {

        Path srcDir = workspace.resolve("src");

        // Group patches by fileKey and find the latest one <= runNumber
        Map<String, PatchPointer> latestPatches = allPatches.stream()
            .filter(p -> p.runNumber() <= runNumber)
            .collect(Collectors.toMap(
                PatchPointer::fileKey,
                p -> p,
                (existing, replacement) ->
                    existing.runNumber() >= replacement.runNumber() ? existing : replacement
            ));

        if (latestPatches.isEmpty()) {
            warnings.add("No patches found at or before run " + runNumber);
            return 0;
        }

        int filesWritten = 0;

        for (PatchPointer patch : latestPatches.values()) {
            try {
                List<String> content = reconstructor.reconstruct(archivesDir, patch, cacheDir, warnings);

                Path targetPath = fileKeyToPath(srcDir, patch.fileKey());
                Files.createDirectories(targetPath.getParent());
                Files.write(targetPath, content, StandardCharsets.UTF_8);
                filesWritten++;

            } catch (DiffException | PatchFailedException e) {
                warnings.add("Failed to reconstruct " + patch.fileKey() + ": " + e.getMessage());
            } catch (IllegalStateException e) {
                warnings.add("Skipping " + patch.fileKey() + ": " + e.getMessage());
            }
        }

        return filesWritten;
    }

    /**
     * Converts a file key to a source file path.
     *
     * The logger creates fileKeys in format: "<relativePath>.<className>"
     * where relativePath may include ".java" (e.g., "BinarySearchTree.java.BinarySearchTree")
     * or be a package path (e.g., "com.foo.Bar.Bar").
     *
     * @param srcDir Source directory root
     * @param fileKey The file key from the diff archive
     * @return Path to the Java file
     */
    private Path fileKeyToPath(Path srcDir, String fileKey) {
        // Handle the common case where fileKey is "<filename>.java.<classname>"
        // e.g., "BinarySearchTree.java.BinarySearchTree" -> src/BinarySearchTree.java
        int javaIndex = fileKey.indexOf(".java.");
        if (javaIndex >= 0) {
            // Default-package files are encoded as "<file>.java.<Class>"
            String filename = fileKey.substring(0, javaIndex + 5); // +5 for ".java"
            return srcDir.resolve(filename);
        }

        // Fallback: treat as package.ClassName format
        String[] parts = fileKey.split("\\.");

        if (parts.length == 1) {
            // Default package, single name
            return srcDir.resolve(fileKey + ".java");
        }

        // Last part is class name, rest is package
        Path packagePath = srcDir;
        for (int i = 0; i < parts.length - 1; i++) {
            packagePath = packagePath.resolve(parts[i]);
        }

        return packagePath.resolve(parts[parts.length - 1] + ".java");
    }

    /**
     * Gets the list of unique file keys available in patches.
     *
     * @param patches List of all patches
     * @return List of unique file keys
     */
    public List<String> getAvailableFileKeys(List<PatchPointer> patches) {
        return patches.stream()
            .map(PatchPointer::fileKey)
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }

    /**
     * Gets all run numbers that have patches.
     *
     * @param patches List of all patches
     * @return Sorted list of run numbers
     */
    public List<Integer> getAvailableRunNumbers(List<PatchPointer> patches) {
        return patches.stream()
            .map(PatchPointer::runNumber)
            .distinct()
            .sorted()
            .collect(Collectors.toList());
    }
}
