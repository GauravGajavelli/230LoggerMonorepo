package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SemanticRunEntry(
    int run,
    List<String> diffCategories,
    String semanticDescription,
    String narrativeContext,
    String intent
) {}
