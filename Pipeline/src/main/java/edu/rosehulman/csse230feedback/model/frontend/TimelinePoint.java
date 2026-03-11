package edu.rosehulman.csse230feedback.model.frontend;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TimelinePoint(
    String time,     // formatted timestamp, e.g. "11:40 PM"
    int passing,     // cumulative count of passing tests at this point
    int failing,     // cumulative count of failing tests at this point
    String event     // description if a test status changed, else null
) {}
