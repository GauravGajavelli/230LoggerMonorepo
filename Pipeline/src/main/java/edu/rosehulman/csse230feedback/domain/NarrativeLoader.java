package edu.rosehulman.csse230feedback.domain;

import edu.rosehulman.csse230feedback.util.Json;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Loads NarrativeSpec from scenario JSON files and companion markdown narratives.
 */
public class NarrativeLoader {

    public static NarrativeSpec load(Path jsonPath) throws IOException {
        return Json.mapper().readValue(jsonPath.toFile(), NarrativeSpec.class);
    }

    public static String loadNarrativeText(Path jsonPath) throws IOException {
        Path mdPath = jsonPath.resolveSibling(
            jsonPath.getFileName().toString().replace(".json", ".md"));
        if (Files.exists(mdPath)) {
            return Files.readString(mdPath);
        }
        return null;
    }

    public static List<NarrativeSpec> loadAll(Path scenariosDir) throws IOException {
        List<NarrativeSpec> specs = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(scenariosDir, "*.json")) {
            for (Path path : stream) {
                specs.add(load(path));
            }
        }
        return specs;
    }
}
