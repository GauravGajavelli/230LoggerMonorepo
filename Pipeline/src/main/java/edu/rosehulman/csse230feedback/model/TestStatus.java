package edu.rosehulman.csse230feedback.model;

public enum TestStatus {
    SUCCESSFUL,
    FAILED,
    ABORTED,
    DISABLED;

    public static TestStatus fromLoggerToken(String token) {
        // token might already be exactly enum name
        return TestStatus.valueOf(token.trim());
    }
}
