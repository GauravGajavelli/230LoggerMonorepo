package edu.rosehulman.csse230feedback.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import edu.rosehulman.csse230feedback.model.RunRecord;
import edu.rosehulman.csse230feedback.model.TestResultRecord;
import edu.rosehulman.csse230feedback.model.TestStatus;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.util.*;

public class TestRunInfoParser {

    private static final Set<String> RESERVED_TOP_LEVEL_KEYS = Set.of(
            "prevRunNumber",
            "randomSeed",
            "redactDiffs",
            "rebaselining",
            "toIgnore",
            "skipLogging",
            "strikes",
            "prevBaselineRunNumber",
            "runTimes"
    );

    private final ObjectMapper mapper;

    public TestRunInfoParser() {
        this.mapper = new ObjectMapper();
    }

    public List<RunRecord> parse(Path testRunInfoJson, List<String> warnings) throws IOException {
        byte[] raw = Files.readAllBytes(testRunInfoJson);
        JsonNode rootNode = mapper.readTree(new String(raw, StandardCharsets.UTF_8));
        if (!(rootNode instanceof ObjectNode root)) {
            throw new IOException("testRunInfo.json root is not an object");
        }

        // Run times provide the canonical set of run numbers.
        Map<Integer, String> runTimes = new TreeMap<>();
        JsonNode runTimesNode = root.get("runTimes");
        if (runTimesNode != null && runTimesNode.isObject()) {
            Iterator<String> it = runTimesNode.fieldNames();
            while (it.hasNext()) {
                String k = it.next();
                try {
                    int runNum = Integer.parseInt(k);
                    runTimes.put(runNum, runTimesNode.get(k).asText());
                } catch (NumberFormatException e) {
                    warnings.add("Non-integer runTimes key: " + k);
                }
            }
        } else {
            warnings.add("Missing or invalid runTimes node in testRunInfo.json; will infer run numbers from test results.");
        }

        // Collect test results by run number
        Map<Integer, List<TestResultRecord>> testsByRun = new TreeMap<>();

        Iterator<String> topFields = root.fieldNames();
        while (topFields.hasNext()) {
            String testFileName = topFields.next();
            if (RESERVED_TOP_LEVEL_KEYS.contains(testFileName)) {
                continue;
            }
            JsonNode testFileNode = root.get(testFileName);
            if (testFileNode == null || !testFileNode.isObject()) {
                continue;
            }

            Iterator<String> testNames = testFileNode.fieldNames();
            while (testNames.hasNext()) {
                String testDisplayName = testNames.next();
                JsonNode testNameNode = testFileNode.get(testDisplayName);
                if (testNameNode == null || !testNameNode.isObject()) {
                    continue;
                }

                Iterator<String> runNums = testNameNode.fieldNames();
                while (runNums.hasNext()) {
                    String runNumStr = runNums.next();
                    int runNum;
                    try {
                        runNum = Integer.parseInt(runNumStr);
                    } catch (NumberFormatException e) {
                        warnings.add("Non-integer run number under " + testFileName + "." + testDisplayName + ": " + runNumStr);
                        continue;
                    }

                    String statusAndMaybeCause = testNameNode.get(runNumStr).asText();
                    ParsedStatus parsed = parseStatus(statusAndMaybeCause, warnings);

                    String testId = testFileName + "#" + testDisplayName;
                    TestResultRecord tr = new TestResultRecord(
                            testFileName,
                            testDisplayName,
                            testId,
                            parsed.status,
                            parsed.cause
                    );

                    testsByRun.computeIfAbsent(runNum, _k -> new ArrayList<>()).add(tr);
                    runTimes.putIfAbsent(runNum, null);
                }
            }
        }

        // Build RunRecord list
        List<RunRecord> runs = new ArrayList<>();
        for (Map.Entry<Integer, String> e : runTimes.entrySet()) {
            int runNum = e.getKey();
            String ts = e.getValue();
            Long tsMs = null;

            if (ts != null) {
                // Best-effort conversion; relative time is generally more important in Phase 1.
                try {
                    tsMs = Timestamp.valueOf(ts).getTime();
                } catch (IllegalArgumentException ex) {
                    warnings.add("Could not parse run time timestamp for run " + runNum + ": '" + ts + "'");
                }
            }

            List<TestResultRecord> tests = testsByRun.getOrDefault(runNum, List.of());
            // sort deterministically for stable outputs
            List<TestResultRecord> sorted = new ArrayList<>(tests);
            sorted.sort(Comparator.comparing(TestResultRecord::testId));

            runs.add(new RunRecord(runNum, ts, tsMs, sorted));
        }

        return runs;
    }

    private record ParsedStatus(TestStatus status, String cause) {}

    private ParsedStatus parseStatus(String statusAndMaybeCause, List<String> warnings) {
        if (statusAndMaybeCause == null) {
            return new ParsedStatus(TestStatus.ABORTED, null);
        }
        String s = statusAndMaybeCause.trim();
        String statusToken;
        String cause = null;

        int idx = s.indexOf(": ");
        if (idx >= 0) {
            statusToken = s.substring(0, idx);
            cause = s.substring(idx + 2);
        } else {
            statusToken = s;
        }

        try {
            return new ParsedStatus(TestStatus.fromLoggerToken(statusToken), cause);
        } catch (IllegalArgumentException e) {
            warnings.add("Unknown test status token: '" + statusToken + "' in string: '" + s + "'");
            return new ParsedStatus(TestStatus.ABORTED, s);
        }
    }
}
