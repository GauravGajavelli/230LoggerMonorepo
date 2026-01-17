package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExtractedFile(
        String path,
        long sizeBytes
) {
    public static ExtractedFile fromFile(Path p) throws IOException {
        return new ExtractedFile(p.toAbsolutePath().toString(), Files.size(p));
    }
}
