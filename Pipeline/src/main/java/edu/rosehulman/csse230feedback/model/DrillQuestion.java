package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DrillQuestion(
    String id,
    String source,           // "Exam 2", "HW5", "Final Exam"
    String sourceLabel,      // human-readable link label, e.g. "Exam 2 — 2023 questions"
    String url,              // optional relative path under /study-materials/
    List<String> categories, // BST category keys this maps to
    String targetFile,       // "BSTTesting.java"
    String timeEstimate,     // "~5 min" | "~10 min" | "~15 min"
    String intro,
    String testCode,         // @Test method with points += 1; (to be rewritten)
    List<String> hints
) {}
