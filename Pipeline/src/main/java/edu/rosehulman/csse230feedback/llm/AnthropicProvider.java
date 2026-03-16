package edu.rosehulman.csse230feedback.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Anthropic Messages API provider using java.net.http.HttpClient.
 */
public class AnthropicProvider implements LlmProvider {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String API_VERSION = "2023-06-01";
    private static final Duration TIMEOUT = Duration.ofSeconds(120);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_TOKENS = 8192;

    // Pricing per 1M tokens
    private static final Map<String, double[]> PRICING = Map.of(
        "claude-opus-4-6", new double[]{15.00, 75.00},
        "claude-sonnet-4-5-20250929", new double[]{3.00, 15.00},
        "claude-haiku-4-5-20251001", new double[]{1.00, 5.00},
        "claude-3-5-sonnet-20241022", new double[]{3.00, 15.00},
        "claude-3-5-haiku-20241022", new double[]{0.80, 4.00},
        "claude-3-haiku-20240307", new double[]{0.25, 1.25}
    );

    private final String apiKey;
    private final HttpClient httpClient;

    public AnthropicProvider(String apiKey) {
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    @Override
    public LlmResponse complete(LlmRequest request) throws LlmException {
        try {
            String requestBody = buildRequestBody(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", API_VERSION)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            int status = httpResponse.statusCode();
            if (status != 200) {
                boolean retryable = status == 429 || status == 500 || status == 502 || status == 503 || status == 529;
                String retryAfter = httpResponse.headers().firstValue("retry-after").orElse(null);
                String errorMsg = parseErrorMessage(httpResponse.body());
                LlmException ex = new LlmException(
                    "Anthropic API error " + status + ": " + errorMsg,
                    status, retryable
                );
                if (retryAfter != null) {
                    ex.addSuppressed(new RuntimeException("Retry-After: " + retryAfter));
                }
                throw ex;
            }

            return parseResponse(httpResponse.body(), request.model());

        } catch (LlmException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LlmException("Request interrupted", e);
        } catch (IOException e) {
            throw new LlmException("Network error: " + e.getMessage(), 0, true, e);
        } catch (Exception e) {
            throw new LlmException("Unexpected error: " + e.getMessage(), e);
        }
    }

    @Override
    public String providerName() {
        return "anthropic";
    }

    private String buildRequestBody(LlmRequest request) throws IOException {
        ObjectNode root = JSON.createObjectNode();
        root.put("model", request.model());
        root.put("max_tokens", MAX_TOKENS);
        root.put("temperature", request.temperature());

        // Anthropic API: system message is a top-level field, not in messages array
        ArrayNode messages = root.putArray("messages");
        for (LlmRequest.Message msg : request.messages()) {
            if ("system".equals(msg.role())) {
                root.put("system", msg.content());
            } else {
                ObjectNode msgNode = messages.addObject();
                msgNode.put("role", msg.role());
                msgNode.put("content", msg.content());
            }
        }

        return JSON.writeValueAsString(root);
    }

    private LlmResponse parseResponse(String body, String model) throws LlmException {
        try {
            JsonNode root = JSON.readTree(body);

            JsonNode content = root.get("content");
            if (content == null || content.isEmpty()) {
                throw new LlmException("No content in Anthropic response");
            }

            // Anthropic returns content as an array of blocks; extract text from first text block
            StringBuilder textContent = new StringBuilder();
            for (JsonNode block : content) {
                if ("text".equals(block.get("type").asText())) {
                    textContent.append(block.get("text").asText());
                }
            }

            String stopReason = root.has("stop_reason") ? root.get("stop_reason").asText() : null;

            int promptTokens = 0;
            int completionTokens = 0;
            JsonNode usage = root.get("usage");
            if (usage != null) {
                promptTokens = usage.has("input_tokens") ? usage.get("input_tokens").asInt() : 0;
                completionTokens = usage.has("output_tokens") ? usage.get("output_tokens").asInt() : 0;
            }

            double cost = estimateCost(model, promptTokens, completionTokens);

            return new LlmResponse(
                textContent.toString(),
                new LlmResponse.Usage(promptTokens, completionTokens),
                cost,
                model,
                stopReason
            );
        } catch (LlmException e) {
            throw e;
        } catch (Exception e) {
            throw new LlmException("Failed to parse Anthropic response: " + e.getMessage(), e);
        }
    }

    private String parseErrorMessage(String body) {
        try {
            JsonNode root = JSON.readTree(body);
            JsonNode error = root.get("error");
            if (error != null && error.has("message")) {
                return error.get("message").asText();
            }
        } catch (Exception ignored) {}
        return body.length() > 200 ? body.substring(0, 200) + "..." : body;
    }

    static double estimateCost(String model, int promptTokens, int completionTokens) {
        double[] prices = PRICING.get(model);
        if (prices == null) {
            // Unknown model — use haiku pricing as floor estimate
            prices = PRICING.getOrDefault("claude-3-5-haiku-20241022", new double[]{0.80, 4.00});
        }
        return (promptTokens * prices[0] + completionTokens * prices[1]) / 1_000_000.0;
    }
}
