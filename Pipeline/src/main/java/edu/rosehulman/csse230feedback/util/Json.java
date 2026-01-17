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
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
            .enable(SerializationFeature.INDENT_OUTPUT)
            .configure(JsonGenerator.Feature.AUTO_CLOSE_TARGET, true);

    private Json() {}

    public static ObjectMapper mapper() {
        return MAPPER;
    }

    public static void writeJson(Path out, Object value) throws IOException {
        Files.createDirectories(out.getParent());
        MAPPER.writeValue(out.toFile(), value);
    }

    public static <T> void writeJsonl(Path out, List<T> records) throws IOException {
        Files.createDirectories(out.getParent());
        try (BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            for (T r : records) {
                w.write(MAPPER.writeValueAsString(r));
                w.newLine();
            }
        }
    }
}
