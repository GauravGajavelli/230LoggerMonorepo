package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * Parsed representation of the Frontend assessment-config.json.
 * Used to re-rank sustained-struggle candidates by composite relevance score:
 *   concept_weight × grade_weight × urgency_factor(days_until_assessment)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AssessmentCalendar(
    String assignment,
    List<AssessmentEntry> assessments
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AssessmentEntry(
        String id,
        String name,
        String date,               // ISO-8601: "2026-04-10"
        String type,               // "exam" | "homework" | "assignment"
        Double gradeWeight,        // nullable; falls back to type-based default
        Map<String, Double> conceptWeights  // category → fractional weight, e.g. {"remove": 0.10}
    ) {}
}
