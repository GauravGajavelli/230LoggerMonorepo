package edu.rosehulman.csse230feedback.llm;

import java.util.List;

/**
 * Model representing a request to an LLM provider.
 */
public record LlmRequest(
    String model,
    List<Message> messages,
    double temperature
) {
    public record Message(String role, String content) {}

    /**
     * Convenience factory for a simple system + user prompt.
     */
    public static LlmRequest of(String model, String systemPrompt, String userContent) {
        return new LlmRequest(model, List.of(
            new Message("system", systemPrompt),
            new Message("user", userContent)
        ), 0.0);
    }

    /**
     * Convenience factory with custom temperature.
     */
    public static LlmRequest of(String model, String systemPrompt, String userContent, double temperature) {
        return new LlmRequest(model, List.of(
            new Message("system", systemPrompt),
            new Message("user", userContent)
        ), temperature);
    }
}
