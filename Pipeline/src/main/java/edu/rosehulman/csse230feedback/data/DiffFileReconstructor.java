package edu.rosehulman.csse230feedback.data;

import com.github.difflib.patch.PatchFailedException;
import edu.rosehulman.csse230feedback.model.PatchPointer;
import testSupport.DiffReplayer;

import com.github.difflib.algorithm.DiffException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class DiffFileReconstructor {

    private final DiffArchiveEntryExtractor extractor = new DiffArchiveEntryExtractor();

    /**
     * Reconstructs file content for a given (fileKey, runNumber) patch.
     *
     * This does NOT require sequential replay: each patch is baseline->revised for that run.
     */
    public List<String> reconstruct(Path archivesDir, PatchPointer ptr, Path cacheDir, List<String> warnings)
            throws IOException, DiffException, PatchFailedException {

        Path archiveZip = archivesDir.resolve(ptr.archiveFilename());
        Path baselineFile = extractor.materializeEntry(archiveZip, ptr.baselineEntry(), cacheDir, warnings);
        Path patchFile = extractor.materializeEntry(archiveZip, ptr.patchEntry(), cacheDir, warnings);

        // DiffReplayer expects UTF-8 baseline and patch files. The TAR entries are written as UTF-8.
        return DiffReplayer.replay(baselineFile, patchFile);
    }

    /**
     * Convenience: determine the patch kind by reading the first line.
     */
    public static String detectPatchKind(Path patchFile) throws IOException {
        List<String> lines = Files.readAllLines(patchFile, StandardCharsets.UTF_8);
        if (lines.isEmpty()) return "EMPTY";
        String first = lines.get(0).trim();
        if ("File created!".equals(first)) return "FILE_CREATED";
        if ("File too large!".equals(first)) return "FILE_TOO_LARGE";
        return "DELTA_PATCH";
    }
}
