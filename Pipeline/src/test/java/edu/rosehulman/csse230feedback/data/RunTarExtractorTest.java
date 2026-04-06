package edu.rosehulman.csse230feedback.data;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RunTarExtractorTest {

    @TempDir
    Path tempDir;

    private record TarEntry(String name, String content) {}

    private Path makeTar(String tarFilename, List<TarEntry> entries) throws IOException {
        Path tarPath = tempDir.resolve(tarFilename);
        try (OutputStream fos = Files.newOutputStream(tarPath);
             TarArchiveOutputStream tos = new TarArchiveOutputStream(fos)) {
            for (TarEntry e : entries) {
                byte[] data = e.content().getBytes(StandardCharsets.UTF_8);
                TarArchiveEntry te = new TarArchiveEntry(e.name());
                te.setSize(data.length);
                tos.putArchiveEntry(te);
                tos.write(data);
                tos.closeArchiveEntry();
            }
        }
        return tarPath;
    }

    @Test
    void extract_normalTar_extractsFilesAndPreservesNames() throws IOException {
        Path tar = makeTar("run.tar", List.of(
                new TarEntry("testRunInfo.json", "{\"runTimes\":{}}"),
                new TarEntry("error-logs.txt", "no errors")
        ));
        Path target = tempDir.resolve("out");
        Files.createDirectories(target);
        List<String> warnings = new ArrayList<>();

        RunTarExtractor.ExtractResult result =
                new RunTarExtractor(5000, 50_000_000L).extract(tar, target, warnings);

        assertTrue(Files.exists(target.resolve("testRunInfo.json")));
        assertTrue(Files.exists(target.resolve("error-logs.txt")));
        assertEquals(2, result.extractedFiles().size());
        assertEquals(0, result.diffArchivePaths().size());
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }

    @Test
    void extract_diffArchiveInTar_appearsInDiffZipList() throws IOException {
        Path tar = makeTar("run.tar", List.of(
                new TarEntry("testRunInfo.json", "{\"runTimes\":{}}"),
                new TarEntry("diffs_0_.tar.zip", "not-a-real-zip-but-indexed-by-name")
        ));
        Path target = tempDir.resolve("out");
        Files.createDirectories(target);
        List<String> warnings = new ArrayList<>();

        RunTarExtractor.ExtractResult result =
                new RunTarExtractor(5000, 50_000_000L).extract(tar, target, warnings);

        assertEquals(1, result.diffArchivePaths().size());
        assertEquals("diffs_0_.tar.zip", result.diffArchivePaths().get(0).getFileName().toString());
    }

    @Test
    void extract_pathTraversalAttempt_throwsIOException() throws IOException {
        // Manually write a tar with a path traversal entry (commons-compress won't do it for us)
        Path tarPath = tempDir.resolve("evil.tar");
        try (OutputStream fos = Files.newOutputStream(tarPath);
             TarArchiveOutputStream tos = new TarArchiveOutputStream(fos)) {
            byte[] data = "evil content".getBytes(StandardCharsets.UTF_8);
            // Use the raw TarArchiveEntry constructor to bypass name sanitization
            TarArchiveEntry te = new TarArchiveEntry("../../passwd");
            te.setSize(data.length);
            tos.putArchiveEntry(te);
            tos.write(data);
            tos.closeArchiveEntry();
        }
        Path target = tempDir.resolve("safe");
        Files.createDirectories(target);

        assertThrows(IOException.class, () ->
                new RunTarExtractor(5000, 50_000_000L).extract(tarPath, target, new ArrayList<>()));
    }

    @Test
    void extract_maxFilesExceeded_emitsWarningAndHalts() throws IOException {
        Path tar = makeTar("run.tar", List.of(
                new TarEntry("file1.txt", "a"),
                new TarEntry("file2.txt", "b"),
                new TarEntry("file3.txt", "c")
        ));
        Path target = tempDir.resolve("out");
        Files.createDirectories(target);
        List<String> warnings = new ArrayList<>();

        new RunTarExtractor(2, 50_000_000L).extract(tar, target, warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("max files")),
                "Expected max-files warning, got: " + warnings);
        // Only first 2 files should be extracted
        assertFalse(Files.exists(target.resolve("file3.txt")));
    }

    @Test
    void extract_maxBytesExceeded_emitsWarningAndHalts() throws IOException {
        Path tar = makeTar("run.tar", List.of(
                new TarEntry("big1.txt", "x".repeat(100)),
                new TarEntry("big2.txt", "y".repeat(100))
        ));
        Path target = tempDir.resolve("out");
        Files.createDirectories(target);
        List<String> warnings = new ArrayList<>();

        // Limit to 150 bytes — second file (200 cumulative) should trigger halt
        new RunTarExtractor(5000, 150L).extract(tar, target, warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("max bytes")),
                "Expected max-bytes warning, got: " + warnings);
        assertFalse(Files.exists(target.resolve("big2.txt")));
    }

    @Test
    void extract_directoriesInTar_areSkipped() throws IOException {
        Path tarPath = tempDir.resolve("with-dir.tar");
        try (OutputStream fos = Files.newOutputStream(tarPath);
             TarArchiveOutputStream tos = new TarArchiveOutputStream(fos)) {
            // Add a directory entry
            TarArchiveEntry dir = new TarArchiveEntry("subdir/");
            tos.putArchiveEntry(dir);
            tos.closeArchiveEntry();
            // Add a file under it
            byte[] data = "hello".getBytes(StandardCharsets.UTF_8);
            TarArchiveEntry file = new TarArchiveEntry("subdir/note.txt");
            file.setSize(data.length);
            tos.putArchiveEntry(file);
            tos.write(data);
            tos.closeArchiveEntry();
        }
        Path target = tempDir.resolve("out");
        Files.createDirectories(target);
        List<String> warnings = new ArrayList<>();

        RunTarExtractor.ExtractResult result =
                new RunTarExtractor(5000, 50_000_000L).extract(tarPath, target, warnings);

        // Directory entries should not appear in extractedFiles
        assertEquals(1, result.extractedFiles().size());
        assertTrue(Files.exists(target.resolve("subdir/note.txt")));
    }
}
