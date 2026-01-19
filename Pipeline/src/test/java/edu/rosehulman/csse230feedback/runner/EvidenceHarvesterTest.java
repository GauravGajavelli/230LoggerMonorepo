package edu.rosehulman.csse230feedback.runner;

import edu.rosehulman.csse230feedback.model.EnrichedTestResult;
import edu.rosehulman.csse230feedback.model.TestStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class EvidenceHarvesterTest {

    @TempDir
    Path tempDir;

    @Test
    void harvest_shouldExtractCorrectStatusFromRunNode() throws IOException {
        // Copy the test tar to a workspace structure
        Path runTarSource = Path.of("testOutputs/rerunOutputs/enriched_runs/run_10.tar");
        if (!Files.exists(runTarSource)) {
            System.out.println("Skipping test - test data not available");
            return;
        }

        // Create workspace structure: workspace/src/testSupport/run.tar
        Path workspace = tempDir.resolve("workspace");
        Path testSupportDir = workspace.resolve("src").resolve("testSupport");
        Files.createDirectories(testSupportDir);
        Files.copy(runTarSource, testSupportDir.resolve("run.tar"));

        // Run the harvester
        EvidenceHarvester harvester = new EvidenceHarvester();
        EvidenceHarvester.HarvestResult result = harvester.harvest(workspace);

        // Verify results
        assertEquals(8, result.runNumber(), "Should extract prevRunNumber correctly");
        assertFalse(result.results().isEmpty(), "Should have results");
        assertTrue(result.warnings().isEmpty(), "Should have no warnings");

        // Check specific test statuses
        for (EnrichedTestResult testResult : result.results()) {
            assertNotEquals(TestStatus.ABORTED, testResult.status(),
                "Status should not be ABORTED - test: " + testResult.testId());
            assertEquals(TestStatus.SUCCESSFUL, testResult.status(),
                "Test should be SUCCESSFUL for run 8: " + testResult.testId());
        }

        System.out.println("Harvested " + result.results().size() + " test results:");
        for (EnrichedTestResult r : result.results()) {
            System.out.println("  " + r.testId() + ": " + r.status());
        }
    }
}