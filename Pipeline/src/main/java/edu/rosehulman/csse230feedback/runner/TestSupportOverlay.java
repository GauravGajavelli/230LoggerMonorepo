package edu.rosehulman.csse230feedback.runner;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;

/**
 * Overlays the testSupport package files onto a workspace.
 * This includes the LoggingExtension, TestEvidence, and other
 * instrumentation files needed for test execution.
 */
public class TestSupportOverlay {

    private static final String TEST_SUPPORT_PACKAGE = "testSupport";
    private static final String START_TEST_RUN_INFO_FILENAME = "startTestRunInfo.json";

    // Default startTestRunInfo.json content for a fresh test run
    private static final String DEFAULT_START_TEST_RUN_INFO = """
        {
          "prevRunNumber": 0,
          "redactDiffs": false,
          "rebaselining": false,
          "skipLogging": false,
          "prevBaselineRunNumber": 0
        }
        """;

    /**
     * Overlays testSupport files from source directory to workspace.
     * Replaces any existing testSupport directory in the workspace.
     *
     * @param workspace Path to workspace root
     * @param testSupportSourceDir Path to directory containing testSupport files
     * @throws IOException if file operations fail
     */
    public void overlayTestSupport(Path workspace, Path testSupportSourceDir) throws IOException {
        Path targetDir = workspace.resolve("src").resolve(TEST_SUPPORT_PACKAGE);

        // Remove existing testSupport directory if present
        if (Files.exists(targetDir)) {
            deleteDirectory(targetDir);
        }

        // Create target directory
        Files.createDirectories(targetDir);

        // Copy all files from source
        if (Files.exists(testSupportSourceDir)) {
            copyDirectory(testSupportSourceDir, targetDir);
        }

        // Ensure startTestRunInfo.json exists
        Path startInfoPath = targetDir.resolve(START_TEST_RUN_INFO_FILENAME);
        if (!Files.exists(startInfoPath)) {
            Files.writeString(startInfoPath, DEFAULT_START_TEST_RUN_INFO, StandardCharsets.UTF_8);
        }
    }

    /**
     * Overlays testSupport files with a custom startTestRunInfo.json.
     *
     * @param workspace Path to workspace root
     * @param testSupportSourceDir Path to directory containing testSupport files
     * @param startTestRunInfo Custom JSON content for startTestRunInfo.json
     * @throws IOException if file operations fail
     */
    public void overlayTestSupport(Path workspace, Path testSupportSourceDir, String startTestRunInfo)
            throws IOException {
        overlayTestSupport(workspace, testSupportSourceDir);

        // Overwrite startTestRunInfo.json with custom content
        Path startInfoPath = workspace.resolve("src").resolve(TEST_SUPPORT_PACKAGE)
            .resolve(START_TEST_RUN_INFO_FILENAME);
        Files.writeString(startInfoPath, startTestRunInfo, StandardCharsets.UTF_8);
    }

    /**
     * Creates a minimal testSupport overlay with only essential files.
     * Useful when testSupportSourceDir is not available.
     *
     * @param workspace Path to workspace root
     * @throws IOException if file operations fail
     */
    public void createMinimalTestSupport(Path workspace) throws IOException {
        Path targetDir = workspace.resolve("src").resolve(TEST_SUPPORT_PACKAGE);

        // Remove existing testSupport directory if present
        if (Files.exists(targetDir)) {
            deleteDirectory(targetDir);
        }

        Files.createDirectories(targetDir);

        // Create startTestRunInfo.json
        Path startInfoPath = targetDir.resolve(START_TEST_RUN_INFO_FILENAME);
        Files.writeString(startInfoPath, DEFAULT_START_TEST_RUN_INFO, StandardCharsets.UTF_8);
    }

    /**
     * Gets the path to the testSupport directory within a workspace.
     *
     * @param workspace Workspace root path
     * @return Path to testSupport directory
     */
    public Path getTestSupportDir(Path workspace) {
        return workspace.resolve("src").resolve(TEST_SUPPORT_PACKAGE);
    }

    /**
     * Gets the path to run.tar within the testSupport directory.
     *
     * @param workspace Workspace root path
     * @return Path to run.tar
     */
    public Path getRunTarPath(Path workspace) {
        return getTestSupportDir(workspace).resolve("run.tar");
    }

    /**
     * Copies a directory recursively.
     */
    private void copyDirectory(Path source, Path target) throws IOException {
        Files.walkFileTree(source, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs)
                    throws IOException {
                Path targetPath = target.resolve(source.relativize(dir));
                Files.createDirectories(targetPath);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                    throws IOException {
                Path targetPath = target.resolve(source.relativize(file));
                Files.copy(file, targetPath, StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    /**
     * Deletes a directory recursively.
     */
    private void deleteDirectory(Path dir) throws IOException {
        if (!Files.exists(dir)) {
            return;
        }

        Files.walkFileTree(dir, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                    throws IOException {
                Files.delete(file);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc)
                    throws IOException {
                Files.delete(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }
}
