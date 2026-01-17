package edu.rosehulman.csse230feedback.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RunRecord(
        int runNumber,
        String timestamp,
        Long timestampMs,
        List<TestResultRecord> tests
) {}
