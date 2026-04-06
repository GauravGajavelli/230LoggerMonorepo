package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.model.DiffArchiveInfo;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class DiffArchiveIndexerTest {

    @TempDir
    Path tempDir;

    /**
     * Creates a diffs_N_.tar.zip: a ZIP with a single entry "diffs" whose bytes are a TAR
     * containing the given entries (tar path → UTF-8 content).
     */
    private Path makeDiffArchive(String filename, Map<String, String> tarEntries) throws IOException {
        ByteArrayOutputStream tarBuf = new ByteArrayOutputStream();
        try (TarArchiveOutputStream tos = new TarArchiveOutputStream(tarBuf)) {
            for (Map.Entry<String, String> e : tarEntries.entrySet()) {
                byte[] data = e.getValue().getBytes(StandardCharsets.UTF_8);
                TarArchiveEntry te = new TarArchiveEntry(e.getKey());
                te.setSize(data.length);
                tos.putArchiveEntry(te);
                tos.write(data);
                tos.closeArchiveEntry();
            }
        }
        Path zipPath = tempDir.resolve(filename);
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            zos.putNextEntry(new ZipEntry("diffs"));
            zos.write(tarBuf.toByteArray());
            zos.closeEntry();
        }
        return zipPath;
    }

    @Test
    void indexAll_wellFormedArchive_correctBaselineAndPatchCounts() throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.BST", "public class BST {}");
        entries.put("patches/com.foo.BST_1", "patch content for run 1");
        entries.put("patches/com.foo.BST_3", "patch content for run 3");
        Path archive = makeDiffArchive("diffs_0_.tar.zip", entries);

        List<String> warnings = new ArrayList<>();
        Path indexOut = tempDir.resolve("diff_index.json");
        List<DiffArchiveInfo> infos = new DiffArchiveIndexer().indexAll(List.of(archive), indexOut, warnings);

        assertEquals(1, infos.size());
        DiffArchiveInfo info = infos.get(0);
        assertEquals(1, info.baselineCount());
        assertEquals(2, info.patchCount());
        assertEquals(1, info.minPatchRunNumber());
        assertEquals(3, info.maxPatchRunNumber());
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }

    @Test
    void indexAll_emptyZip_emitsWarningAndReturnsZeroCounts() throws IOException {
        Path zipPath = tempDir.resolve("diffs_0_.tar.zip");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            // intentionally empty
        }
        List<String> warnings = new ArrayList<>();
        Path indexOut = tempDir.resolve("diff_index.json");

        List<DiffArchiveInfo> infos = new DiffArchiveIndexer().indexAll(List.of(zipPath), indexOut, warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("Empty diff archive")),
                "Expected empty-archive warning, got: " + warnings);
        assertEquals(0, infos.get(0).baselineCount());
        assertEquals(0, infos.get(0).patchCount());
    }

    @Test
    void indexAll_patchEntryMissingRunSuffix_emitsWarningAndSkipsPointer() throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.BST", "public class BST {}");
        entries.put("patches/com.foo.BST", "missing underscore-run suffix");
        Path archive = makeDiffArchive("diffs_0_.tar.zip", entries);

        List<String> warnings = new ArrayList<>();
        Path indexOut = tempDir.resolve("diff_index.json");
        new DiffArchiveIndexer().indexAll(List.of(archive), indexOut, warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("Could not parse patch entry")),
                "Expected warning about missing run suffix, got: " + warnings);
    }

    @Test
    void indexAll_patchEntryNonIntegerRunNumber_emitsWarningAndSkipsPointer() throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.BST", "public class BST {}");
        entries.put("patches/com.foo.BST_runX", "non-integer run number");
        Path archive = makeDiffArchive("diffs_0_.tar.zip", entries);

        List<String> warnings = new ArrayList<>();
        Path indexOut = tempDir.resolve("diff_index.json");
        new DiffArchiveIndexer().indexAll(List.of(archive), indexOut, warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("Could not parse run number")),
                "Expected warning about non-integer run, got: " + warnings);
    }

    @Test
    void indexAll_writesIndexAndPatchesJsonlToDisk() throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.BST", "content");
        entries.put("patches/com.foo.BST_5", "patch");
        Path archive = makeDiffArchive("diffs_0_.tar.zip", entries);

        Path indexOut = tempDir.resolve("diff_index.json");
        new DiffArchiveIndexer().indexAll(List.of(archive), indexOut, new ArrayList<>());

        assertTrue(Files.exists(indexOut), "diff_index.json should be written");
        assertTrue(Files.exists(tempDir.resolve("patches_index.jsonl")),
                "patches_index.jsonl should be written alongside diff_index.json");
    }

    @Test
    void isDiffsTarZipFilename_correctlyClassifiesFilenames() {
        assertTrue(DiffArchiveIndexer.isDiffsTarZipFilename("diffs_0_.tar.zip"));
        assertTrue(DiffArchiveIndexer.isDiffsTarZipFilename("diffs_42_.tar.zip"));
        assertFalse(DiffArchiveIndexer.isDiffsTarZipFilename("run.tar"));
        assertFalse(DiffArchiveIndexer.isDiffsTarZipFilename("testRunInfo.json"));
        assertFalse(DiffArchiveIndexer.isDiffsTarZipFilename("error-logs.txt"));
        assertFalse(DiffArchiveIndexer.isDiffsTarZipFilename(null));
    }

    @Test
    void indexAll_multipleArchives_sortedByFilename() throws IOException {
        Path archive3 = makeDiffArchive("diffs_3_.tar.zip",
                Map.of("baselines/com.foo.A", "a", "patches/com.foo.A_3", "p"));
        // Need separate tempdir-like structure since both go to same dir
        Path archive0 = makeDiffArchive("diffs_0_.tar.zip",
                Map.of("baselines/com.foo.B", "b", "patches/com.foo.B_0", "p"));

        Path indexOut = tempDir.resolve("diff_index.json");
        List<DiffArchiveInfo> infos = new DiffArchiveIndexer()
                .indexAll(List.of(archive3, archive0), indexOut, new ArrayList<>());

        // Should be sorted by filename
        assertEquals("diffs_0_.tar.zip", infos.get(0).filename());
        assertEquals("diffs_3_.tar.zip", infos.get(1).filename());
    }
}
