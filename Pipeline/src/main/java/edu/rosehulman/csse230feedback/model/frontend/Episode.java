package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Episode(
    String id,
    String startTime,
    String endTime,
    String label,
    String dominantCategory,
    EpisodeSemantics semantics
) {
    public Episode(String id, String startTime, String endTime, String label, String dominantCategory) {
        this(id, startTime, endTime, label, dominantCategory, null);
    }

    public Episode withSemantics(EpisodeSemantics semantics) {
        return new Episode(id, startTime, endTime, label, dominantCategory, semantics);
    }
}
