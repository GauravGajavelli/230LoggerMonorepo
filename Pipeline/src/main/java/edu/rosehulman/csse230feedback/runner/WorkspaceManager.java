package edu.rosehulman.csse230feedback.runner;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Comparator;

/**
 * Manages temporary workspace directories for test reruns.
 * Creates isolated workspaces with src/ and bin/ directories,
 * and handles cleanup after test execution.
 */
public class WorkspaceManager {

    private static final String SRC_DIR = "src";
    private static final String BIN_DIR = "bin";

    /**
     * Creates a new workspace directory with src/ and bin/ subdirectories.
     *
     * @param baseTmpDir Base directory for temp workspaces
     * @param runId Identifier for the run (used in directory name)
     * @return Path to the created workspace root
     * @throws IOException if workspace creation fails
     */
    public Path createWorkspace(Path baseTmpDir, String runId) throws IOException {
        Path workspace = baseTmpDir.resolve("workspace_" + runId);

        // Create workspace structure
        Files.createDirectories(workspace.resolve(SRC_DIR));
        Files.createDirectories(workspace.resolve(BIN_DIR));

        return workspace;
    }

    /**
     * Creates a workspace with a randomly generated unique name.
     *
     * @param baseTmpDir Base directory for temp workspaces
     * @return Path to the created workspace root
     * @throws IOException if workspace creation fails
     */
    public Path createWorkspace(Path baseTmpDir) throws IOException {
        Path workspace = Files.createTempDirectory(baseTmpDir, "workspace_");

        // Create workspace structure
        Files.createDirectories(workspace.resolve(SRC_DIR));
        Files.createDirectories(workspace.resolve(BIN_DIR));

        return workspace;
    }

    /**
     * Deletes a workspace directory and all its contents.
     *
     * @param workspace Path to workspace to delete
     */
    public void deleteWorkspace(Path workspace) {
        if (workspace == null || !Files.exists(workspace)) {
            return;
        }

        try {
            Files.walk(workspace)
                .sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        // Suppress deletion errors
                    }
                });
        } catch (IOException e) {
            // Suppress directory traversal errors
        }
    }

    /**
     * Gets the source directory path within a workspace.
     *
     * @param workspace Workspace root path
     * @return Path to src/ directory
     */
    public Path getSrcDir(Path workspace) {
        return workspace.resolve(SRC_DIR);
    }

    /**
     * Gets the binary output directory path within a workspace.
     *
     * @param workspace Workspace root path
     * @return Path to bin/ directory
     */
    public Path getBinDir(Path workspace) {
        return workspace.resolve(BIN_DIR);
    }

    /**
     * Clears all contents from the src/ directory.
     *
     * @param workspace Workspace root path
     * @throws IOException if clearing fails
     */
    public void clearSrcDir(Path workspace) throws IOException {
        Path srcDir = getSrcDir(workspace);
        if (Files.exists(srcDir)) {
            Files.walkFileTree(srcDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    if (!dir.equals(srcDir)) {
                        Files.delete(dir);
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        }
    }

    /**
     * Clears all contents from the bin/ directory.
     *
     * @param workspace Workspace root path
     * @throws IOException if clearing fails
     */
    public void clearBinDir(Path workspace) throws IOException {
        Path binDir = getBinDir(workspace);
        if (Files.exists(binDir)) {
            Files.walkFileTree(binDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    if (!dir.equals(binDir)) {
                        Files.delete(dir);
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        }
    }
}
