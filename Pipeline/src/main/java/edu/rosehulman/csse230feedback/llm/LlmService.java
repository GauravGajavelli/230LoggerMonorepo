package edu.rosehulman.csse230feedback.llm;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Orchestrates LLM interactions: cache check -> API call -> cache write -> logging.
 * <p>
 * Supports dry-run mode (no API calls), no-cache mode (skip reads), and
 * provides session-level observability via stats and session log.
 */
public class LlmService {

    private final LlmConfig config;
    private final LlmCache cache;
    private final LlmProvider provider;
    private final RateLimiter rateLimiter;
    private final LlmSessionLogger logger;
    private final LlmStats stats;
    private final boolean noCache;
    private final boolean dryRun;

    private LlmService(LlmConfig config, LlmCache cache, LlmProvider provider,
                        RateLimiter rateLimiter, LlmSessionLogger logger,
                        LlmStats stats, boolean noCache, boolean dryRun) {
        this.config = config;
        this.cache = cache;
        this.provider = provider;
        this.rateLimiter = rateLimiter;
        this.logger = logger;
        this.stats = stats;
        this.noCache = noCache;
        this.dryRun = dryRun;
    }

    /**
     * Creates and initializes an LlmService from configuration.
     *
     * @param config LLM configuration (provider, model, API key)
     * @param cacheDir directory for cache files
     * @param noCache if true, skip cache reads (still write)
     * @param clearCache if true, clear all cache files before starting
     * @param dryRun if true, don't make API calls
     */
    public static LlmService create(LlmConfig config, Path cacheDir,
                                     boolean noCache, boolean clearCache, boolean dryRun) throws IOException, LlmException {
        LlmCache cache = new LlmCache(cacheDir);
        if (clearCache) {
            cache.clear();
            System.out.println("Cleared LLM cache at " + cacheDir);
        }

        LlmSessionLogger logger = new LlmSessionLogger(cacheDir);
        logger.open();

        LlmStats stats = new LlmStats();
        RateLimiter rateLimiter = new RateLimiter(logger);

        LlmProvider provider = null;
        if (!dryRun) {
            config.validate();
            provider = createProvider(config);
        }

        return new LlmService(config, cache, provider, rateLimiter, logger, stats, noCache, dryRun);
    }

    /**
     * Sends a prompt to the LLM, with caching and retry logic.
     *
     * @param promptFileName name of the prompt template file (for cache key)
     * @param promptContent full text of the prompt (system message)
     * @param inputData user input data (will be the user message)
     * @param requestLabel short label for logging (e.g., "diff_label student=alice batch=1/5")
     * @param requestNumber current request number
     * @param totalRequests total expected requests
     * @return the LLM response content
     */
    public LlmResponse complete(String promptFileName, String promptContent,
                                 String inputData, String requestLabel,
                                 int requestNumber, int totalRequests) throws LlmException {
        LlmCache.CacheKey cacheKey = cache.computeKey(
            promptFileName, promptContent, config.model(), inputData
        );

        // Estimate tokens (~4 chars per token)
        int estimatedTokens = (promptContent.length() + inputData.length()) / 4;

        // Dry-run mode: log but don't call API
        if (dryRun) {
            logger.logDryRun(requestNumber, totalRequests, requestLabel,
                config.model(), estimatedTokens);
            stats.recordCacheHit(); // Count as "handled" for progress
            return new LlmResponse(
                "[DRY RUN - no API call made]",
                new LlmResponse.Usage(estimatedTokens, 0),
                0.0, config.model(), "dry_run"
            );
        }

        // Check cache (unless --no-cache)
        if (!noCache) {
            Optional<LlmCache.CacheEntry> cached = cache.get(cacheKey);
            if (cached.isPresent()) {
                LlmCache.CacheEntry entry = cached.get();
                String cacheDate = entry.response() != null ? entry.response().timestamp() : null;
                logger.logRequest(requestNumber, totalRequests, requestLabel,
                    config.model(), estimatedTokens, true, cacheDate);
                stats.recordCacheHit();

                // Reconstruct response from cache
                LlmCache.CacheEntry.ResponseInfo resp = entry.response();
                LlmResponse.Usage usage = resp.usage() != null
                    ? new LlmResponse.Usage(resp.usage().promptTokens(), resp.usage().completionTokens())
                    : null;
                return new LlmResponse(resp.content(), usage, resp.costEstimateUsd(),
                    config.model(), "cached");
            }
        }

        // Cache miss — make API call
        logger.logRequest(requestNumber, totalRequests, requestLabel,
            config.model(), estimatedTokens, false, null);

        LlmRequest request = LlmRequest.of(config.model(), promptContent, inputData);

        long startMs = System.currentTimeMillis();
        LlmResponse response = rateLimiter.executeWithRetry(
            provider, request, requestNumber, totalRequests
        );
        double latencySeconds = (System.currentTimeMillis() - startMs) / 1000.0;

        // Log response
        int tokensOut = response.usage() != null ? response.usage().completionTokens() : 0;
        logger.logResponse(requestNumber, totalRequests, tokensOut,
            response.costEstimateUsd(), latencySeconds);

        // Update stats
        stats.recordApiCall(response);

        // Write to cache
        try {
            cache.put(cacheKey, request, response);
        } catch (IOException e) {
            System.err.println("Warning: failed to cache response: " + e.getMessage());
        }

        // Print progress to console
        System.out.print("\r" + stats.formatProgress(requestNumber, totalRequests));

        return response;
    }

    /**
     * Finishes the session: writes summary and closes logger.
     */
    public void finish() {
        stats.finish();
        logger.logSummary(stats);
        logger.close();
        System.out.println(); // newline after progress
        System.out.println(stats.formatSummary());
    }

    public LlmStats stats() {
        return stats;
    }

    public LlmConfig config() {
        return config;
    }

    public LlmCache cache() {
        return cache;
    }

    private static LlmProvider createProvider(LlmConfig config) throws LlmException {
        return switch (config.provider()) {
            case "openai" -> new OpenAiProvider(config.resolvedApiKey());
            default -> throw new LlmException(
                "Unsupported LLM provider: " + config.provider() +
                ". Supported: openai"
            );
        };
    }
}
