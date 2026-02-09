package edu.rosehulman.csse230feedback.llm;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Model representing a response from an LLM provider.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LlmResponse(
    String content,
    Usage usage,
    double costEstimateUsd,
    String model,
    String finishReason
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Usage(int promptTokens, int completionTokens) {
        public int totalTokens() {
            return promptTokens + completionTokens;
        }
    }
}
