package helpers;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.github.difflib.DiffUtils;
import com.github.difflib.algorithm.DiffException;
import com.github.difflib.patch.*;

/**
 * Utility to reconstruct file versions from a baseline and your
 * custom-serialized diff (patch) files produced by LoggingExtension.
 *
 * Assumptions:
 *  - Diff file format is exactly as produced by buildDiffOutputString(...)
 *    with the added "srcPos,tgtPos" line per delta.
 *  - Baseline file content matches what was used to generate the diff.
 */
public class DiffReplayer {

    /**
     * Reconstructs a single version of a file, using:
     *  - a baseline file, and
     *  - a single patch file (for some test run).
     *
     * @param baselinePath Path to the baseline file
     * @param patchPath    Path to the patch file, e.g. ".../patches/com.foo.Bar_7"
     * @return Lines of the reconstructed file
     */
    public static List<String> replay(Path baselinePath, Path patchPath)
            throws IOException, DiffException, PatchFailedException {

        List<String> baseline = Files.readAllLines(baselinePath, StandardCharsets.UTF_8);
        List<String> patchLines = Files.readAllLines(patchPath, StandardCharsets.UTF_8);

        // Handle the special sentinel cases used by the logger
        if (patchLines.isEmpty()) {
            // No deltas: just return baseline as-is
            return new ArrayList<>(baseline);
        }

        String first = patchLines.get(0).trim();
        if ("File created!".equals(first)) {
            // For "File created!", baseline already holds the content; no patch needed.
            return new ArrayList<>(baseline);
        }

        if ("File too large!".equals(first)) {
            // This patch never contained actual deltas; cannot reconstruct changed content.
            throw new IllegalStateException("Cannot replay patch: file was logged as too large.");
        }

        Patch<String> patch = parsePatch(patchLines);
        return DiffUtils.patch(baseline, patch);
    }

    /**
     * Parses the custom diff format back into a Patch<String>.
     *
     * Format:
     *   N;                       // number of deltas
     *   TYPE                     // INSERT, DELETE or CHANGE
     *   srcPos,tgtPos            // positions (line indices)
     *   srcCount,                // number of source lines (with trailing comma)
     *   <src line 1>
     *   ...
     *   <src line srcCount>
     *   tgtCount,                // number of target lines (with trailing comma)
     *   <tgt line 1>
     *   ...
     *   <tgt line tgtCount>
     *   ... repeated N times ...
     */
    private static Patch<String> parsePatch(List<String> lines) {
        Patch<String> patch = new Patch<>();

        int index = 0;

        // Header: "N;" where N is number of deltas
        String header = lines.get(index++).trim();
        if (header.endsWith(";")) {
            header = header.substring(0, header.length() - 1);
        }
        int numDeltas = Integer.parseInt(header);

        for (int d = 0; d < numDeltas; d++) {
            if (index >= lines.size()) {
                throw new IllegalArgumentException("Malformed patch file: not enough lines for all deltas");
            }

            // Delta type line
            String typeLine = lines.get(index++).trim();
            DeltaType deltaType = DeltaType.valueOf(typeLine); // INSERT, DELETE, CHANGE

            // Positions line: "srcPos,tgtPos"
            if (index >= lines.size()) {
                throw new IllegalArgumentException("Malformed patch file: missing positions line");
            }
            String positionsLine = lines.get(index++).trim();
            String[] posParts = positionsLine.split(",");
            if (posParts.length != 2) {
                throw new IllegalArgumentException("Malformed positions line: " + positionsLine);
            }
            int srcPos = Integer.parseInt(posParts[0].trim());
            int tgtPos = Integer.parseInt(posParts[1].trim());

            // Source count line: "<srcCount>,"
            if (index >= lines.size()) {
                throw new IllegalArgumentException("Malformed patch file: missing source count");
            }
            String srcCountLine = lines.get(index++).trim();
            int srcCount = parseCount(srcCountLine);

            List<String> srcLines = new ArrayList<>(srcCount);
            for (int i = 0; i < srcCount; i++) {
                if (index >= lines.size()) {
                    throw new IllegalArgumentException("Malformed patch file: not enough source lines");
                }
                srcLines.add(lines.get(index++));
            }

            // Target count line: "<tgtCount>,"
            if (index >= lines.size()) {
                throw new IllegalArgumentException("Malformed patch file: missing target count");
            }
            String tgtCountLine = lines.get(index++).trim();
            int tgtCount = parseCount(tgtCountLine);

            List<String> tgtLines = new ArrayList<>(tgtCount);
            for (int i = 0; i < tgtCount; i++) {
                if (index >= lines.size()) {
                    throw new IllegalArgumentException("Malformed patch file: not enough target lines");
                }
                tgtLines.add(lines.get(index++));
            }

            Chunk<String> srcChunk = new Chunk<>(srcPos, srcLines);
            Chunk<String> tgtChunk = new Chunk<>(tgtPos, tgtLines);

            AbstractDelta<String> delta;
            switch (deltaType) {
                case INSERT:
                    delta = new InsertDelta<>(srcChunk, tgtChunk);
                    break;
                case DELETE:
                    delta = new DeleteDelta<>(srcChunk, tgtChunk);
                    break;
                case CHANGE:
                    delta = new ChangeDelta<>(srcChunk, tgtChunk);
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported delta type: " + deltaType);
            }

            patch.addDelta(delta);
        }

        return patch;
    }

    /**
     * Parses lines like "5," to integer 5.
     */
    private static int parseCount(String countLine) {
        // buildDiffOutputString does: toRet.append(size).append(",\n");
        // so we strip anything after the comma.
        String[] parts = countLine.split(",");
        return Integer.parseInt(parts[0].trim());
    }

    /**
     * Simple CLI entry point (optional).
     *
     * Usage:
     *   java testSupport.DiffReplayer <baselineFile> <patchFile> <outputFile>
     */
    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            System.err.println("Usage: DiffReplayer <baselineFile> <patchFile> <outputFile>");
            System.exit(1);
        }

        Path baseline = Path.of(args[0]);
        Path patchFile = Path.of(args[1]);
        Path output = Path.of(args[2]);

        List<String> result = replay(baseline, patchFile);
        Files.write(output, result, StandardCharsets.UTF_8);
    }
}
