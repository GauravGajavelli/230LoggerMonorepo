package edu.rosehulman.csse230feedback.data;

import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.model.TestStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TestRunInfoParserTest {

    @TempDir
    Path tempDir;

    private Path writeJson(String content) throws IOException {
        Path p = tempDir.resolve("testRunInfo.json");
        Files.writeString(p, content, StandardCharsets.UTF_8);
        return p;
    }

    @Test
    void parse_allPass_returnsCorrectRunRecords() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testInsert": {"1": "SUCCESSFUL"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(1, runs.size());
        assertEquals(1, runs.get(0).runNumber());
        assertEquals(1, runs.get(0).tests().size());
        assertEquals(TestStatus.SUCCESSFUL, runs.get(0).tests().get(0).status());
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }

    @Test
    void parse_missingRunTimes_emitsWarningAndInfersFromTestResults() throws IOException {
        String json = """
                {
                  "BSTTest": {
                    "testInsert": {"3": "SUCCESSFUL"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(1, runs.size());
        assertEquals(3, runs.get(0).runNumber());
        assertTrue(warnings.stream().anyMatch(w -> w.contains("runTimes")),
                "Expected warning about missing runTimes, got: " + warnings);
    }

    @Test
    void parse_nonIntegerRunTimesKey_emitsWarningAndSkipsKey() throws IOException {
        String json = """
                {
                  "runTimes": {"run1": "2026-01-01 10:00:00.000", "2": "2026-01-01 10:01:00.000"},
                  "BSTTest": {
                    "testInsert": {"2": "SUCCESSFUL"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("Non-integer runTimes key")),
                "Expected warning about non-integer key, got: " + warnings);
        // Only run 2 exists (from runTimes + test results); run "run1" is dropped
        assertEquals(1, runs.size());
        assertEquals(2, runs.get(0).runNumber());
    }

    @Test
    void parse_nonIntegerRunNumberInTestResults_emitsWarningAndSkipsResult() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testInsert": {"run1": "SUCCESSFUL", "1": "SUCCESSFUL"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertTrue(warnings.stream().anyMatch(w -> w.contains("Non-integer run number")),
                "Expected warning about non-integer run key, got: " + warnings);
        assertEquals(1, runs.size());
        // Only the valid "1" key produces a test result
        assertEquals(1, runs.get(0).tests().size());
    }

    @Test
    void parse_emptyObject_returnsEmptyRunList() throws IOException {
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson("{}"), warnings);

        assertTrue(runs.isEmpty());
    }

    @Test
    void parse_unknownStatusToken_emitsWarningAndAbortsTest() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testInsert": {"1": "TIMEOUT"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(1, runs.size());
        assertEquals(TestStatus.ABORTED, runs.get(0).tests().get(0).status());
        assertTrue(warnings.stream().anyMatch(w -> w.contains("Unknown test status token")),
                "Expected warning about unknown token, got: " + warnings);
    }

    @Test
    void parse_failedStatusWithCause_extractsCause() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testInsert": {"1": "FAILED: AssertionError: expected 5 but was 3"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(TestStatus.FAILED, runs.get(0).tests().get(0).status());
        assertEquals("AssertionError: expected 5 but was 3", runs.get(0).tests().get(0).cause());
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }

    @Test
    void parse_rootIsArray_throwsIOException() {
        assertThrows(IOException.class, () ->
                new TestRunInfoParser().parse(writeJson("[]"), new ArrayList<>()));
    }

    @Test
    void parse_multipleRunsInRunTimes_sortedByRunNumber() throws IOException {
        String json = """
                {
                  "runTimes": {
                    "3": "2026-01-01 10:02:00.000",
                    "1": "2026-01-01 10:00:00.000",
                    "2": "2026-01-01 10:01:00.000"
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(3, runs.size());
        assertEquals(1, runs.get(0).runNumber());
        assertEquals(2, runs.get(1).runNumber());
        assertEquals(3, runs.get(2).runNumber());
    }

    @Test
    void parse_testResultsAcrossMultipleFiles_groupedByRun() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testInsert": {"1": "SUCCESSFUL"},
                    "testRemove": {"1": "FAILED: NullPointerException"}
                  },
                  "IteratorTest": {
                    "testIterator": {"1": "SUCCESSFUL"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(1, runs.size());
        assertEquals(3, runs.get(0).tests().size());
        // Tests are sorted by testId for stable output
        List<String> testIds = runs.get(0).tests().stream()
                .map(t -> t.testId()).toList();
        assertEquals(testIds, testIds.stream().sorted().toList());
    }

    @Test
    void parse_disabledStatusIsPreserved() throws IOException {
        String json = """
                {
                  "runTimes": {"1": "2026-01-01 10:00:00.000"},
                  "BSTTest": {
                    "testSkipped": {"1": "DISABLED"}
                  }
                }""";
        List<String> warnings = new ArrayList<>();
        List<RunRecord> runs = new TestRunInfoParser().parse(writeJson(json), warnings);

        assertEquals(TestStatus.DISABLED, runs.get(0).tests().get(0).status());
        assertTrue(warnings.isEmpty(), "Expected no warnings, got: " + warnings);
    }
}
