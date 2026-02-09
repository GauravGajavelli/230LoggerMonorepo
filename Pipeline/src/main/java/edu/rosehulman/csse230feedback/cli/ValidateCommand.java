package edu.rosehulman.csse230feedback.cli;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.rosehulman.csse230feedback.domain.*;
import edu.rosehulman.csse230feedback.model.frontend.FrontendOutput;
import edu.rosehulman.csse230feedback.util.Json;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.util.concurrent.Callable;

@Command(
    name = "validate",
    mixinStandardHelpOptions = true,
    description = "Validates LLM semantic output against narrative scenario expectations."
)
public class ValidateCommand implements Callable<Integer> {

    @Option(names = {"-i", "--input"}, required = true,
            description = "Path to frontend.json (output of prepare command).")
    private Path input;

    @Option(names = {"-n", "--narrative"}, required = true,
            description = "Path to scenario JSON file with expectations.")
    private Path narrative;

    @Option(names = {"--report"}, description = "Path to write JSON validation report (optional).")
    private Path report;

    @Option(names = {"--strict"}, description = "Treat WARN as FAIL for exit code (default: false).")
    private boolean strict = false;

    @Override
    public Integer call() throws Exception {
        // Load inputs (tolerant of unknown fields in frontend.json)
        ObjectMapper tolerantMapper = Json.mapper().copy()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        FrontendOutput frontend = tolerantMapper.readValue(input.toFile(), FrontendOutput.class);
        NarrativeSpec spec = NarrativeLoader.load(narrative);

        // Run validation
        ValidationService service = new ValidationService();
        ValidationReport result = service.validate(frontend, spec);

        // Print summary
        result.printSummary();

        // Write JSON report if requested
        if (report != null) {
            Json.writeJson(report, result);
            System.out.println("\n  Report written to: " + report.toAbsolutePath());
        }

        // Exit code
        if (result.failCount() > 0) {
            return 1;
        }
        if (strict && result.warnCount() > 0) {
            return 1;
        }
        return 0;
    }
}
