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
 * OpenAI Chat Completions API provider using java.net.http.HttpClient.
 */
public class OpenAiProvider implements LlmProvider {

    private static final String API_URL = "https://api.openai.com/v1/chat/completions";
    private static final Duration TIMEOUT = Duration.ofSeconds(120);
    private static final ObjectMapper JSON = new ObjectMapper();

    // Pricing per 1M tokens (as of 2025 for common models)
    private static final Map<String, double[]> PRICING = Map.of(
        "gpt-4o-mini", new double[]{0.15, 0.60},      // input, output per 1M tokens
        "gpt-4o", new double[]{2.50, 10.00},
        "gpt-4-turbo", new double[]{10.00, 30.00},
        "gpt-3.5-turbo", new double[]{0.50, 1.50}
    );

    private final String apiKey;
    private final HttpClient httpClient;

    public OpenAiProvider(String apiKey) {
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
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            int status = httpResponse.statusCode();
            if (status != 200) {
                boolean retryable = status == 429 || status == 500 || status == 502 || status == 503;
                String retryAfter = httpResponse.headers().firstValue("retry-after").orElse(null);
                String errorMsg = parseErrorMessage(httpResponse.body());
                LlmException ex = new LlmException(
                    "OpenAI API error " + status + ": " + errorMsg,
                    status, retryable
                );
                if (retryAfter != null) {
                    // Store retry-after as a suppressed exception message for RateLimiter to read
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
        return "openai";
    }

    private String buildRequestBody(LlmRequest request) throws IOException {
        ObjectNode root = JSON.createObjectNode();
        root.put("model", request.model());
        root.put("temperature", request.temperature());

        ArrayNode messages = root.putArray("messages");
        for (LlmRequest.Message msg : request.messages()) {
            ObjectNode msgNode = messages.addObject();
            msgNode.put("role", msg.role());
            msgNode.put("content", msg.content());
        }

        return JSON.writeValueAsString(root);
    }

    private LlmResponse parseResponse(String body, String model) throws LlmException {
        try {
            JsonNode root = JSON.readTree(body);

            JsonNode choices = root.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new LlmException("No choices in OpenAI response");
            }

            JsonNode firstChoice = choices.get(0);
            String content = firstChoice.get("message").get("content").asText();
            String finishReason = firstChoice.has("finish_reason")
                ? firstChoice.get("finish_reason").asText() : null;

            int promptTokens = 0;
            int completionTokens = 0;
            JsonNode usage = root.get("usage");
            if (usage != null) {
                promptTokens = usage.get("prompt_tokens").asInt();
                completionTokens = usage.get("completion_tokens").asInt();
            }

            double cost = estimateCost(model, promptTokens, completionTokens);

            return new LlmResponse(
                content,
                new LlmResponse.Usage(promptTokens, completionTokens),
                cost,
                model,
                finishReason
            );
        } catch (LlmException e) {
            throw e;
        } catch (Exception e) {
            throw new LlmException("Failed to parse OpenAI response: " + e.getMessage(), e);
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

    /**
     * Estimates cost in USD based on known model pricing.
     */
    static double estimateCost(String model, int promptTokens, int completionTokens) {
        double[] prices = PRICING.get(model);
        if (prices == null) {
            // Unknown model — use gpt-4o-mini pricing as a floor estimate
            prices = PRICING.get("gpt-4o-mini");
        }
        return (promptTokens * prices[0] + completionTokens * prices[1]) / 1_000_000.0;
    }
}
