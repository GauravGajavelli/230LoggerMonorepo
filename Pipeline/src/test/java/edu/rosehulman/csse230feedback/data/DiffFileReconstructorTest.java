package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.model.PatchPointer;
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

class DiffFileReconstructorTest {

    @TempDir
    Path tempDir;

    /**
     * Creates a diffs_N_.tar.zip in tempDir with the given TAR entries (path → UTF-8 content).
     */
    private void makeDiffArchive(String filename, Map<String, String> tarEntries) throws IOException {
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
        try (ZipOutputStream zos = new ZipOutputStream(
                Files.newOutputStream(tempDir.resolve(filename)))) {
            zos.putNextEntry(new ZipEntry("diffs"));
            zos.write(tarBuf.toByteArray());
            zos.closeEntry();
        }
    }

    // ── detectPatchKind ─────────────────────────────────────────────────────────

    @Test
    void detectPatchKind_emptyFile_returnsEmpty() throws IOException {
        Path f = tempDir.resolve("empty.patch");
        Files.writeString(f, "", StandardCharsets.UTF_8);
        assertEquals("EMPTY", DiffFileReconstructor.detectPatchKind(f));
    }

    @Test
    void detectPatchKind_fileCreatedMarker_returnsFileCreated() throws IOException {
        Path f = tempDir.resolve("created.patch");
        Files.writeString(f, "File created!\n", StandardCharsets.UTF_8);
        assertEquals("FILE_CREATED", DiffFileReconstructor.detectPatchKind(f));
    }

    @Test
    void detectPatchKind_fileTooLargeMarker_returnsFileTooLarge() throws IOException {
        Path f = tempDir.resolve("large.patch");
        Files.writeString(f, "File too large!\n", StandardCharsets.UTF_8);
        assertEquals("FILE_TOO_LARGE", DiffFileReconstructor.detectPatchKind(f));
    }

    @Test
    void detectPatchKind_deltaPatch_returnsDeltaPatch() throws IOException {
        Path f = tempDir.resolve("delta.patch");
        // A valid 1-delta patch header
        Files.writeString(f, "1;\nCHANGE\n0,0\n1,\nold\n1,\nnew\n", StandardCharsets.UTF_8);
        assertEquals("DELTA_PATCH", DiffFileReconstructor.detectPatchKind(f));
    }

    // ── reconstruct ─────────────────────────────────────────────────────────────

    @Test
    void reconstruct_validDeltaPatch_appliesPatchCorrectly() throws Exception {
        // Baseline: three lines. Patch: change "line2" (index 1) to "modified".
        // DiffReplayer patch format:
        //   <numDeltas>;
        //   <DeltaType>
        //   <srcPos>,<tgtPos>
        //   <srcCount>,
        //   <src lines...>
        //   <tgtCount>,
        //   <tgt lines...>
        String baseline = "line1\nline2\nline3\n";
        String patch = "1;\nCHANGE\n1,1\n1,\nline2\n1,\nmodified\n";

        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.Foo", baseline);
        entries.put("patches/com.foo.Foo_5", patch);
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Foo", 5,
                "baselines/com.foo.Foo", "patches/com.foo.Foo_5", null);
        Path cacheDir = tempDir.resolve("cache");

        List<String> warnings = new ArrayList<>();
        List<String> result = new DiffFileReconstructor()
                .reconstruct(tempDir, ptr, cacheDir, warnings);

        assertEquals(List.of("line1", "modified", "line3"), result);
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }

    @Test
    void reconstruct_emptyDeltaPatch_returnsBaselineUnchanged() throws Exception {
        // A patch with 0 deltas means the file was unchanged.
        String baseline = "public class Foo {\n  int x = 1;\n}\n";
        String patch = "0;\n";

        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.Foo", baseline);
        entries.put("patches/com.foo.Foo_2", patch);
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Foo", 2,
                "baselines/com.foo.Foo", "patches/com.foo.Foo_2", null);
        Path cacheDir = tempDir.resolve("cache");

        List<String> result = new DiffFileReconstructor()
                .reconstruct(tempDir, ptr, cacheDir, new ArrayList<>());

        assertEquals(List.of("public class Foo {", "  int x = 1;", "}"), result);
    }

    @Test
    void reconstruct_fileCreatedPatch_returnsBaselineContent() throws Exception {
        // "File created!" is treated by DiffReplayer as "return baseline as-is".
        String baseline = "public class NewFile {}";
        String patch = "File created!\n";

        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.NewFile", baseline);
        entries.put("patches/com.foo.NewFile_2", patch);
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.NewFile", 2,
                "baselines/com.foo.NewFile", "patches/com.foo.NewFile_2", null);
        Path cacheDir = tempDir.resolve("cache");

        List<String> result = new DiffFileReconstructor()
                .reconstruct(tempDir, ptr, cacheDir, new ArrayList<>());

        assertEquals(List.of("public class NewFile {}"), result);
    }

    @Test
    void reconstruct_fileTooLargePatch_throwsIllegalStateException() throws Exception {
        // "File too large!" cannot be replayed — DiffReplayer throws IllegalStateException.
        String baseline = "line1\n";
        String patch = "File too large!\n";

        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.Big", baseline);
        entries.put("patches/com.foo.Big_7", patch);
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Big", 7,
                "baselines/com.foo.Big", "patches/com.foo.Big_7", null);
        Path cacheDir = tempDir.resolve("cache");

        assertThrows(IllegalStateException.class, () ->
                new DiffFileReconstructor().reconstruct(tempDir, ptr, cacheDir, new ArrayList<>()));
    }

    @Test
    void reconstruct_missingPatchEntry_throwsIOException() throws Exception {
        // Archive has the baseline but no patch for run 99.
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.Foo", "content");
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Foo", 99,
                "baselines/com.foo.Foo", "patches/com.foo.Foo_99", null);
        Path cacheDir = tempDir.resolve("cache");

        assertThrows(IOException.class, () ->
                new DiffFileReconstructor().reconstruct(tempDir, ptr, cacheDir, new ArrayList<>()));
    }

    // ── reconstructBaseline ─────────────────────────────────────────────────────

    @Test
    void reconstructBaseline_returnsRawBaselineIgnoringPatch() throws Exception {
        String baseline = "public class Foo {\n  int x;\n}\n";

        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("baselines/com.foo.Foo", baseline);
        entries.put("patches/com.foo.Foo_1", "1;\nCHANGE\n1,1\n1,\n  int x;\n1,\n  int x = 42;\n");
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Foo", 1,
                "baselines/com.foo.Foo", "patches/com.foo.Foo_1", null);
        Path cacheDir = tempDir.resolve("cache");

        List<String> result = new DiffFileReconstructor()
                .reconstructBaseline(tempDir, ptr, cacheDir, new ArrayList<>());

        // Should return original baseline, not the patched version
        assertEquals(List.of("public class Foo {", "  int x;", "}"), result);
    }

    @Test
    void reconstructBaseline_missingBaselineEntry_throwsIOException() throws Exception {
        // Archive has patches but no baseline entry for the requested file.
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("patches/com.foo.Foo_1", "some patch");
        makeDiffArchive("diffs_0_.tar.zip", entries);

        PatchPointer ptr = new PatchPointer(
                "diffs_0_.tar.zip", "com.foo.Foo", 1,
                "baselines/com.foo.Foo", "patches/com.foo.Foo_1", null);
        Path cacheDir = tempDir.resolve("cache");

        assertThrows(IOException.class, () ->
                new DiffFileReconstructor().reconstructBaseline(tempDir, ptr, cacheDir, new ArrayList<>()));
    }
}
