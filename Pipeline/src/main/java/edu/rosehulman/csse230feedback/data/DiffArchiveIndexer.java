package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.model.DiffArchiveInfo;
import edu.rosehulman.csse230feedback.model.PatchPointer;
import edu.rosehulman.csse230feedback.util.Hashing;
import edu.rosehulman.csse230feedback.util.Json;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Indexes logger-produced diffs_*.tar.zip archives WITHOUT expanding them to full directories.
 *
 * Each archive is:
 *   Zip file with a single entry named "diffs" whose bytes are a TAR.
 * The TAR contains entries under:
 *   baselines/<package.Class>
 *   patches/<package.Class>_<runNum>
 */
public class DiffArchiveIndexer {

    private static final String DIFFS_PREFIX = "diffs";
    private static final String TAR_ZIP_SUFFIX = ".tar.zip";

    private static final Pattern BASELINE_FILENAME = Pattern.compile("^diffs_(\\d+)_\\.tar\\.zip$");

    public static boolean isDiffsTarZipFilename(String filename) {
        return filename != null && filename.startsWith(DIFFS_PREFIX) && filename.endsWith(TAR_ZIP_SUFFIX);
    }

    public List<DiffArchiveInfo> indexAll(List<Path> archives, Path diffIndexJsonOut, List<String> warnings) throws IOException {
        List<DiffArchiveInfo> infos = new ArrayList<>();
        List<PatchPointer> allPointers = new ArrayList<>();

        for (Path archive : archives) {
            ArchiveIndex idx = indexOne(archive, warnings);
            infos.add(idx.info);
            allPointers.addAll(idx.pointers);
        }

        // Deterministic ordering
        infos.sort(Comparator.comparing(DiffArchiveInfo::filename));
        allPointers.sort(Comparator
                .comparing(PatchPointer::archiveFilename)
                .thenComparing(PatchPointer::fileKey)
                .thenComparingInt(PatchPointer::runNumber));

        Json.writeJson(diffIndexJsonOut, Map.of(
                "schemaVersion", 1,
                "archives", infos
        ));

        // Also write a patches index for on-demand reconstruction.
        Path patchesJsonl = diffIndexJsonOut.getParent().resolve("patches_index.jsonl");
        Json.writeJsonl(patchesJsonl, allPointers);

        return infos;
    }

    private record ArchiveIndex(DiffArchiveInfo info, List<PatchPointer> pointers) {}

    private ArchiveIndex indexOne(Path archiveZip, List<String> warnings) throws IOException {
        String filename = archiveZip.getFileName().toString();
        Integer baselineRunNumber = parseBaselineRunNumber(filename);
        String sha = Hashing.sha256(archiveZip);

        int baselineCount = 0;
        int patchCount = 0;
        Integer minRun = null;
        Integer maxRun = null;

        List<PatchPointer> pointers = new ArrayList<>();

        try (InputStream fin = Files.newInputStream(archiveZip);
             ZipInputStream zis = new ZipInputStream(new BufferedInputStream(fin))) {

            ZipEntry ze = zis.getNextEntry();
            if (ze == null) {
                warnings.add("Empty diff archive zip: " + filename);
                return new ArchiveIndex(new DiffArchiveInfo(filename, baselineRunNumber, sha, 0, 0, null, null), List.of());
            }

            // The zip entry contents are a TAR
            try (TarArchiveInputStream tis = new TarArchiveInputStream(new BufferedInputStream(zis))) {
                TarArchiveEntry te;
                while ((te = tis.getNextTarEntry()) != null) {
                    if (te.isDirectory()) continue;
                    String name = te.getName();

                    if (name.startsWith("baselines/")) {
                        baselineCount++;
                    } else if (name.startsWith("patches/")) {
                        patchCount++;
                        PatchPointer ptr = parsePatchPointer(filename, name, warnings);
                        if (ptr != null) {
                            pointers.add(ptr);
                            int r = ptr.runNumber();
                            minRun = (minRun == null) ? r : Math.min(minRun, r);
                            maxRun = (maxRun == null) ? r : Math.max(maxRun, r);
                        }
                    }
                }
            }
        } catch (Exception e) {
            warnings.add("Failed to index diff archive " + filename + ": " + e.getMessage());
        }

        DiffArchiveInfo info = new DiffArchiveInfo(
                filename,
                baselineRunNumber,
                sha,
                baselineCount,
                patchCount,
                minRun,
                maxRun
        );

        return new ArchiveIndex(info, pointers);
    }

    private Integer parseBaselineRunNumber(String filename) {
        Matcher m = BASELINE_FILENAME.matcher(filename);
        if (!m.matches()) return null;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private PatchPointer parsePatchPointer(String archiveFilename, String tarEntryName, List<String> warnings) {
        // tarEntryName is like "patches/com.foo.Bar_42"
        String base = tarEntryName.substring("patches/".length());

        int us = base.lastIndexOf('_');
        if (us < 0 || us == base.length() - 1) {
            warnings.add("Could not parse patch entry (missing _<run>): " + tarEntryName);
            return null;
        }

        String fileKey = base.substring(0, us);
        String runStr = base.substring(us + 1);
        int run;
        try {
            run = Integer.parseInt(runStr);
        } catch (NumberFormatException e) {
            warnings.add("Could not parse run number in patch entry: " + tarEntryName);
            return null;
        }

        String baselineEntry = "baselines/" + fileKey;
        String patchEntry = tarEntryName;

        // patch kind will be determined when extracted (File created!/File too large!/delta)
        return new PatchPointer(archiveFilename, fileKey, run, baselineEntry, patchEntry, null);
    }
}
