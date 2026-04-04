package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DrillQuestion(
    String id,
    String source,           // "Exam 2", "HW5", "Final Exam"
    String url,              // optional relative path under /study-materials/ (e.g. "Exams/Exam 2/Exam2-202320-solution.md")
    List<String> categories, // BST category keys this maps to
    String targetFile,       // "BSTTesting.java"
    String timeEstimate,     // "~5 min" | "~10 min" | "~15 min"
    String intro,
    String testCode,         // @Test method with points += 1; (to be rewritten)
    List<String> hints
) {}
