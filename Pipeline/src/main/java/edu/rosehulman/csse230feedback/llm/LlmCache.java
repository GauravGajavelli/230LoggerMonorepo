package edu.rosehulman.csse230feedback.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

/**
 * File-based content-addressable cache for LLM responses.
 * <p>
 * Each cached response is a standalone JSON file named by the first 8 hex chars
 * of its SHA-256 cache key. A manifest file provides a human-readable index.
 * <p>
 * Cache key = SHA-256(promptFileContent + model + sorted(inputData)).
 * Editing a prompt template file automatically invalidates all entries that used it.
 */
public class LlmCache {

    private static final ObjectMapper MAPPER = new ObjectMapper()
        .enable(SerializationFeature.INDENT_OUTPUT)
        .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private final Path cacheDir;

    public LlmCache(Path cacheDir) {
        this.cacheDir = cacheDir;
    }

    public Path cacheDir() {
        return cacheDir;
    }

    /**
     * Computes a cache key from the prompt content, model, and input data.
     */
    public CacheKey computeKey(String promptFileName, String promptContent, String model, String inputData) {
        String hashInput = promptContent + "\0" + model + "\0" + inputData;
        String fullHash = sha256(hashInput);
        String shortHash = fullHash.substring(0, 8);
        String promptContentHash = sha256(promptContent).substring(0, 8);
        String inputPreview = inputData.length() > 80
            ? inputData.substring(0, 80) + "..."
            : inputData;

        return new CacheKey(fullHash, shortHash, promptFileName, promptContentHash, model, inputPreview);
    }

    /**
     * Looks up a cached response by key. Returns empty if not cached.
     */
    public Optional<CacheEntry> get(CacheKey key) {
        Path file = cacheDir.resolve(key.shortHash() + ".json");
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try {
            CacheEntry entry = MAPPER.readValue(file.toFile(), CacheEntry.class);
            // Verify the full hash matches (collision check)
            if (entry.cacheKey() != null && entry.cacheKey().hash().equals(key.hash())) {
                return Optional.of(entry);
            }
            // Hash collision — treat as miss
            return Optional.empty();
        } catch (IOException e) {
            // Corrupted cache file — treat as miss
            return Optional.empty();
        }
    }

    /**
     * Writes a response to the cache.
     */
    public void put(CacheKey key, LlmRequest request, LlmResponse response) throws IOException {
        Files.createDirectories(cacheDir);

        CacheEntry entry = new CacheEntry(
            key,
            new CacheEntry.RequestInfo(
                request.model(),
                request.messages().stream()
                    .map(m -> new CacheEntry.MessageInfo(m.role(), m.content()))
                    .toList(),
                Instant.now().toString()
            ),
            new CacheEntry.ResponseInfo(
                response.content(),
                response.usage() != null
                    ? new CacheEntry.UsageInfo(response.usage().promptTokens(), response.usage().completionTokens())
                    : null,
                response.costEstimateUsd(),
                Instant.now().toString()
            )
        );

        Path file = cacheDir.resolve(key.shortHash() + ".json");
        MAPPER.writeValue(file.toFile(), entry);

        updateManifest(key);
    }

    /**
     * Clears all cache files.
     */
    public void clear() throws IOException {
        if (!Files.exists(cacheDir)) return;
        try (Stream<Path> files = Files.list(cacheDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                .forEach(p -> {
                    try { Files.delete(p); } catch (IOException ignored) {}
                });
        }
    }

    /**
     * Returns the number of cached entries.
     */
    public int size() {
        if (!Files.exists(cacheDir)) return 0;
        try (Stream<Path> files = Files.list(cacheDir)) {
            return (int) files
                .filter(p -> {
                    String name = p.getFileName().toString();
                    return name.endsWith(".json") && !name.startsWith("_");
                })
                .count();
        } catch (IOException e) {
            return 0;
        }
    }

    private void updateManifest(CacheKey key) {
        Path manifestPath = cacheDir.resolve("_manifest.json");
        try {
            List<ManifestEntry> entries;
            if (Files.exists(manifestPath)) {
                ManifestEntry[] existing = MAPPER.readValue(manifestPath.toFile(), ManifestEntry[].class);
                entries = new ArrayList<>(Arrays.asList(existing));
                // Remove old entry with same short hash
                entries.removeIf(e -> e.shortHash().equals(key.shortHash()));
            } else {
                entries = new ArrayList<>();
            }
            entries.add(new ManifestEntry(
                key.shortHash(),
                key.promptFile(),
                key.model(),
                key.inputPreview(),
                Instant.now().toString()
            ));
            MAPPER.writeValue(manifestPath.toFile(), entries);
        } catch (IOException e) {
            // Non-fatal — manifest is for human inspection only
            System.err.println("Warning: could not update cache manifest: " + e.getMessage());
        }
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    // --- Data types ---

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CacheKey(
        String hash,
        String shortHash,
        String promptFile,
        String promptContentHash,
        String model,
        String inputPreview
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CacheEntry(
        CacheKey cacheKey,
        RequestInfo request,
        ResponseInfo response
    ) {
        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record RequestInfo(String model, List<MessageInfo> messages, String timestamp) {}

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record MessageInfo(String role, String content) {}

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record ResponseInfo(String content, UsageInfo usage, double costEstimateUsd, String timestamp) {}

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record UsageInfo(int promptTokens, int completionTokens) {
            public int totalTokens() { return promptTokens + completionTokens; }
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ManifestEntry(
        String shortHash,
        String promptFile,
        String model,
        String inputPreview,
        String cachedAt
    ) {}
}
