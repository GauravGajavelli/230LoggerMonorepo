package edu.rosehulman.csse230feedback.prepare;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Loads patch (diff) files from an input directory.
 * Reads patches_index.jsonl to find which runs have associated diffs,
 * then loads the actual diff content from the patch files.
 */
public class PatchLoader {

    /**
     * Loads patches from the input directory.
     *
     * @param inputDir the directory containing patches_index.jsonl and patches/
     * @return map of runNumber -> unified diff text (only for runs with changes)
     */
    public static Map<Integer, String> loadPatches(Path inputDir) throws IOException {
        Map<Integer, String> result = new LinkedHashMap<>();

        Path indexPath = inputDir.resolve("patches_index.jsonl");
        if (!Files.exists(indexPath)) {
            return result;
        }

        try (BufferedReader reader = Files.newBufferedReader(indexPath)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;

                JsonNode node = Json.mapper().readTree(line);
                int runNumber = node.get("runNumber").asInt();
                boolean hasChanges = node.has("hasChanges") && node.get("hasChanges").asBoolean();

                if (hasChanges && node.has("patchFile") && !node.get("patchFile").isNull()) {
                    String patchFile = node.get("patchFile").asText();
                    Path patchPath = inputDir.resolve(patchFile);
                    if (Files.exists(patchPath)) {
                        String diffText = Files.readString(patchPath);
                        result.put(runNumber, diffText);
                    }
                }
            }
        }

        return result;
    }
}
