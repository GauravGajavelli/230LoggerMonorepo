package edu.rosehulman.csse230feedback.prepare;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.data.DiffArchiveEntryExtractor;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Extracts patch text from .tar.zip archives for use in diff visualization.
 *
 * Reads patches_index.jsonl entries (fields: archiveFilename, fileKey, runNumber, patchEntry)
 * and returns a map of runNumber → (fileKey → patchText).
 *
 * The patch text is in the custom DiffReplayer format produced by LoggingExtension.
 */
public class ArchivePatchExtractor {

    private final DiffArchiveEntryExtractor entryExtractor = new DiffArchiveEntryExtractor();

    /**
     * Loads all patches from the input directory.
     *
     * @param inputDir directory containing patches_index.jsonl and archives/
     * @return map of runNumber → (fileKey → patchText); empty if no archives found
     */
    public Map<Integer, Map<String, String>> loadPatches(Path inputDir) throws IOException {
        Path indexPath = inputDir.resolve("patches_index.jsonl");
        if (!Files.exists(indexPath)) {
            return Collections.emptyMap();
        }

        Path archivesDir = inputDir.resolve("archives");
        Path cacheDir = inputDir.resolve(".cache").resolve("patch_extracts");
        Files.createDirectories(cacheDir);

        // Build lookup: runNumber → (fileKey → PatchRef)
        Map<Integer, Map<String, PatchRef>> index = new LinkedHashMap<>();

        try (BufferedReader reader = Files.newBufferedReader(indexPath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;

                JsonNode node = Json.mapper().readTree(line);
                String archiveFilename = node.get("archiveFilename").asText();
                String fileKey = node.get("fileKey").asText();
                int runNumber = node.get("runNumber").asInt();
                String patchEntry = node.get("patchEntry").asText();

                index.computeIfAbsent(runNumber, k -> new LinkedHashMap<>())
                     .put(fileKey, new PatchRef(archiveFilename, patchEntry));
            }
        }

        // Extract patch text for each (runNumber, fileKey) entry
        Map<Integer, Map<String, String>> result = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();

        for (Map.Entry<Integer, Map<String, PatchRef>> runEntry : index.entrySet()) {
            int runNumber = runEntry.getKey();
            Map<String, String> patchesForRun = new LinkedHashMap<>();

            for (Map.Entry<String, PatchRef> fileEntry : runEntry.getValue().entrySet()) {
                String fileKey = fileEntry.getKey();
                PatchRef ref = fileEntry.getValue();

                Path archiveZip = archivesDir.resolve(ref.archiveFilename());
                if (!Files.exists(archiveZip)) continue;

                try {
                    Path extracted = entryExtractor.materializeEntry(
                        archiveZip, ref.patchEntry(), cacheDir, warnings
                    );
                    String patchText = Files.readString(extracted, StandardCharsets.UTF_8);
                    patchesForRun.put(fileKey, patchText);
                } catch (IOException e) {
                    // Skip missing or unreadable patch entries
                }
            }

            if (!patchesForRun.isEmpty()) {
                result.put(runNumber, patchesForRun);
            }
        }

        if (!warnings.isEmpty()) {
            System.err.println("ArchivePatchExtractor warnings: " + warnings.size());
        }

        return result;
    }

    private record PatchRef(String archiveFilename, String patchEntry) {}
}
