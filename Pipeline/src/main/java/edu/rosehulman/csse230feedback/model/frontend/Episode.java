package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Episode(
    String id,
    String startTime,
    String endTime,
    String label,
    String dominantCategory
) {}
