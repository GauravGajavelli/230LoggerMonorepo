package testSupport;

public class TestEvidence {
    public long durationMs;
    public String stackTrace;     // full trace as string
    public String exceptionType;  // e.g. java.lang.AssertionError
    public String message;

    // when applicable
    public String expected;       // stringified
    public String actual;         // stringified

    // useful for uniqueness
    public String uniqueId;       // JUnit unique id (optional)
}
