package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

/** A future course context where a concept recurs (exam, future assignment, etc.). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CourseAppearance(String label, String description, String url) {}
