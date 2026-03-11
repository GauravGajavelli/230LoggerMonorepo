package edu.rosehulman.csse230feedback.util;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public final class Json {
    // Pretty-printed mapper for regular JSON files
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
            .enable(SerializationFeature.INDENT_OUTPUT)
            .configure(JsonGenerator.Feature.AUTO_CLOSE_TARGET, true);

    // Compact mapper for JSONL files (one JSON object per line)
    private static final ObjectMapper COMPACT_MAPPER = new ObjectMapper()
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
            .disable(SerializationFeature.INDENT_OUTPUT)
            .configure(JsonGenerator.Feature.AUTO_CLOSE_TARGET, true);

    private Json() {}

    public static ObjectMapper mapper() {
        return MAPPER;
    }

    public static ObjectMapper compactMapper() {
        return COMPACT_MAPPER;
    }

    public static void writeJson(Path out, Object value) throws IOException {
        Files.createDirectories(out.getParent());
        MAPPER.writeValue(out.toFile(), value);
    }

    public static <T> void writeJsonl(Path out, List<T> records) throws IOException {
        Files.createDirectories(out.getParent());
        try (BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            for (T r : records) {
                w.write(COMPACT_MAPPER.writeValueAsString(r));
                w.newLine();
            }
        }
    }

    /**
     * Extracts JSON from an LLM response that may be wrapped in markdown fences.
     * Also sanitizes a common haiku artifact: doubled closing quotes before delimiters.
     */
    public static String extractLlmJson(String content) {
        String s = content.trim();
        // Strip markdown fences
        if (s.startsWith("```")) {
            int firstNewline = s.indexOf('\n');
            if (firstNewline >= 0) {
                int lastFence = s.lastIndexOf("```");
                if (lastFence > firstNewline) {
                    s = s.substring(firstNewline + 1, lastFence).trim();
                } else {
                    s = s.substring(firstNewline + 1).trim();  // no closing fence
                }
            }
        }
        // Fix doubled closing quote: "text"", → "text",  (haiku artifact)
        s = s.replaceAll("\"\"([,}\\]])", "\"$1");
        return s;
    }
}
