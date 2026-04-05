package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PracticeDrill(
    String mode,             // "repair" | "probe"
    String timeEstimate,     // "~5 min" | "~10 min" | "~15 min"
    String intro,            // one-sentence framing
    String testCode,         // complete @Test method body (no placeholders)
    List<String> hints,      // 2–3 progressive hints
    String targetFile,       // e.g. "BSTTesting.java"
    Integer pointsAvailable, // sum of points += N in original test, or null
    Integer drillPoints,     // scaled value (≈25% of pointsAvailable); shown on card + modal
    String source,           // e.g. "Exam 2", "HW5" — from DrillQuestion.source; null for LLM-generated
    String sourceUrl,        // relative path under /study-materials/; null for LLM-generated or no URL
    String sourceLabel       // human-readable link label; null for LLM-generated or no URL
) {}
