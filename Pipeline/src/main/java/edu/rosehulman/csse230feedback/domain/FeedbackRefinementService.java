package edu.rosehulman.csse230feedback.domain;

import com.fasterxml.jackson.databind.JsonNode;
import edu.rosehulman.csse230feedback.llm.LlmException;
import edu.rosehulman.csse230feedback.llm.LlmResponse;
import edu.rosehulman.csse230feedback.llm.LlmService;
import edu.rosehulman.csse230feedback.llm.PromptLoader;
import edu.rosehulman.csse230feedback.model.frontend.Feedback;
import edu.rosehulman.csse230feedback.util.Json;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.util.*;

/**
 * Second-pass LLM service that rewrites feedback explanations to remove
 * intent narration and keep only factual, code-grounded observations.
 */
public class FeedbackRefinementService {

    private final LlmService llmService;
    private final PromptLoader promptLoader;

    public FeedbackRefinementService(LlmService llmService, PromptLoader promptLoader) {
        this.llmService = llmService;
        this.promptLoader = promptLoader;
    }

    /**
     * Rewrites the explanation fields of the given feedbacks to remove
     * intent narration. All other fields are unchanged.
     *
     * @param feedbacks list of Feedback objects to refine
     * @param requestNum current request number for LLM progress tracking
     * @param totalRequests total expected requests
     * @return list of Feedback with rewritten explanations
     */
    public List<Feedback> refine(List<Feedback> feedbacks, int requestNum, int totalRequests)
            throws LlmException, IOException {

        // Build input JSON: array of { testId, explanation }
        ArrayNode inputArray = Json.mapper().createArrayNode();
        for (Feedback fb : feedbacks) {
            if (fb.explanation() != null) {
                ObjectNode node = Json.mapper().createObjectNode();
                node.put("testId", fb.testId());
                node.put("explanation", fb.explanation());
                inputArray.add(node);
            }
        }

        if (inputArray.isEmpty()) {
            return feedbacks;
        }

        String inputData = Json.mapper().writeValueAsString(inputArray);
        String promptContent = promptLoader.loadTemplate("feedback_refinement_prompt.md");

        LlmResponse response = llmService.complete(
            "feedback_refinement_prompt.md",
            promptContent,
            inputData,
            "feedback_refinement (" + feedbacks.size() + " explanations)",
            requestNum,
            totalRequests
        );

        // Parse rewritten explanations
        Map<String, String> rewritten = parseRefinedExplanations(response.content());

        // Merge back into original Feedback objects
        return feedbacks.stream()
            .map(fb -> {
                String newExplanation = rewritten.get(fb.testId());
                if (newExplanation != null && !newExplanation.equals(fb.explanation())) {
                    return new Feedback(fb.testId(), fb.pattern(), fb.confidence(),
                        newExplanation, fb.nextSteps(), fb.diffs(), fb.relatedTestIds(),
                        fb.courseAppearances());
                }
                return fb;
            })
            .toList();
    }

    private Map<String, String> parseRefinedExplanations(String responseContent) {
        Map<String, String> result = new LinkedHashMap<>();
        try {
            String json = extractJson(responseContent);
            JsonNode root = Json.mapper().readTree(json);
            if (root.isArray()) {
                for (JsonNode item : root) {
                    String testId = item.has("testId") ? item.get("testId").asText() : null;
                    String explanation = item.has("explanation") ? item.get("explanation").asText() : null;
                    if (testId != null && explanation != null) {
                        result.put(testId, explanation);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Warning: failed to parse refinement response: " + e.getMessage());
        }
        return result;
    }

    private static String extractJson(String content) {
        return Json.extractLlmJson(content);
    }
}
