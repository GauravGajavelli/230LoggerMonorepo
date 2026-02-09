package edu.rosehulman.csse230feedback.llm;

/**
 * Abstraction over LLM API providers (OpenAI, Anthropic, Google).
 */
public interface LlmProvider {

    /**
     * Sends a completion request and returns the response.
     *
     * @param request the LLM request
     * @return the LLM response
     * @throws LlmException if the request fails
     */
    LlmResponse complete(LlmRequest request) throws LlmException;

    /**
     * @return human-readable provider name (e.g., "openai", "anthropic")
     */
    String providerName();
}
