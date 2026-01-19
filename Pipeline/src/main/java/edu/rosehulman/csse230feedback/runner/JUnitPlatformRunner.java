package edu.rosehulman.csse230feedback.runner;

import edu.rosehulman.csse230feedback.model.TestRunResult;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Runs JUnit 5 tests using the JUnit Platform Console Launcher.
 */
public class JUnitPlatformRunner {

    private static final int DEFAULT_TIMEOUT_SECONDS = 300;
    private static final String CONSOLE_LAUNCHER_PREFIX = "junit-platform-console-standalone";

    // Pattern to parse JUnit summary line:
    // "[ 10 tests found ] [ 10 tests started ] [ 0 tests aborted ]..."
    private static final Pattern SUMMARY_PATTERN = Pattern.compile(
        "\\[\\s*(\\d+)\\s+tests?\\s+found\\s*\\].*" +
        "\\[\\s*(\\d+)\\s+tests?\\s+started\\s*\\].*" +
        "\\[\\s*(\\d+)\\s+tests?\\s+aborted\\s*\\].*" +
        "\\[\\s*(\\d+)\\s+tests?\\s+successful\\s*\\].*" +
        "\\[\\s*(\\d+)\\s+tests?\\s+failed\\s*\\]",
        Pattern.CASE_INSENSITIVE
    );

    // Alternative pattern for newer JUnit versions
    private static final Pattern ALT_SUMMARY_PATTERN = Pattern.compile(
        "\\[\\s*(\\d+)\\s+tests?\\s+successful\\s*\\]",
        Pattern.CASE_INSENSITIVE
    );

    private final int timeoutSeconds;
    private final Path javaHome;

    public JUnitPlatformRunner() {
        this(DEFAULT_TIMEOUT_SECONDS, null);
    }

    public JUnitPlatformRunner(int timeoutSeconds, Path javaHome) {
        this.timeoutSeconds = timeoutSeconds;
        this.javaHome = javaHome;
    }

    /**
     * Runs all tests in the workspace using JUnit Platform Console Launcher.
     *
     * @param workspace Path to workspace root (contains src/ and bin/)
     * @param depsDir Path to dependencies directory (JARs, including junit-platform-console-standalone)
     * @return TestRunResult with execution details
     * @throws IOException if test execution fails to start
     */
    public TestRunResult runTests(Path workspace, Path depsDir) throws IOException {
        return runTests(workspace, depsDir, null, null);
    }

    /**
     * Runs specific tests in the workspace.
     *
     * @param workspace Path to workspace root
     * @param depsDir Path to dependencies directory
     * @param testClass Optional specific test class to run (e.g., "TestFoo")
     * @param testMethod Optional specific test method (requires testClass)
     * @return TestRunResult with execution details
     * @throws IOException if test execution fails to start
     */
    public TestRunResult runTests(Path workspace, Path depsDir, String testClass, String testMethod)
            throws IOException {

        Path binDir = workspace.resolve("bin");
        Path consoleLauncher = findConsoleLauncher(depsDir);

        if (consoleLauncher == null) {
            return TestRunResult.noTests("",
                "junit-platform-console-standalone JAR not found in " + depsDir);
        }

        // Build classpath: bin + all JARs in deps
        String classpath = buildClasspath(binDir, depsDir);

        // Build command
        List<String> command = new ArrayList<>();
        command.add(getJavaPath());
        command.add("-Dcsse230.logger.disableSizeChecks=true");
        command.add("-jar");
        command.add(consoleLauncher.toAbsolutePath().toString());
        command.add("--class-path");
        command.add(classpath);
        command.add("--disable-ansi-colors");
        command.add("--details=tree");
        command.add("--config");
        command.add("junit.jupiter.extensions.autodetection.enabled=true");

        // Add test selectors
        if (testClass != null && !testClass.isEmpty()) {
            if (testMethod != null && !testMethod.isEmpty()) {
                command.add("--select-method");
                command.add(testClass + "#" + testMethod);
            } else {
                command.add("--select-class");
                command.add(testClass);
            }
        } else {
            // --scan-class-path doesn't find classes in the default package.
            // Instead, find all *Testing.class files and select them explicitly.
            List<String> testClasses = findTestClasses(binDir);
            if (testClasses.isEmpty()) {
                // Fallback to scan if no testing classes found
                command.add("--scan-class-path");
            } else {
                for (String tc : testClasses) {
                    command.add("--select-class");
                    command.add(tc);
                }
            }
        }

        // Debug: print command
        System.err.println("[DEBUG] JUnit command: " + String.join(" ", command.subList(0, Math.min(6, command.size()))) + " ...");

        // Execute
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workspace.toFile());
        pb.redirectErrorStream(false);

        Process process = pb.start();

        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();

        // Read output streams
        Thread stdoutThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stdout.append(line).append("\n");
                }
            } catch (IOException e) {
                // Ignore
            }
        });

        Thread stderrThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderr.append(line).append("\n");
                }
            } catch (IOException e) {
                // Ignore
            }
        });

        stdoutThread.start();
        stderrThread.start();

        try {
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new TestRunResult(-1, stdout.toString(), stderr.toString(),
                    0, 0, 0, 0, 0, 0);
            }

            stdoutThread.join();
            stderrThread.join();

            int exitCode = process.exitValue();
            String output = stdout.toString();
            String errOutput = stderr.toString();

            // Debug output
            System.err.println("[DEBUG] JUnit exit code: " + exitCode);
            System.err.println("[DEBUG] JUnit stdout length: " + output.length());
            System.err.println("[DEBUG] JUnit stderr length: " + errOutput.length());
            if (output.length() > 0) {
                System.err.println("[DEBUG] JUnit stdout (first 1000): " + output.substring(0, Math.min(1000, output.length())));
            }
            if (errOutput.length() > 0) {
                System.err.println("[DEBUG] JUnit stderr: " + errOutput.substring(0, Math.min(500, errOutput.length())));
            }

            // Parse test counts from output
            return parseTestResults(exitCode, output, errOutput);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return new TestRunResult(-1, stdout.toString(), stderr.toString(),
                0, 0, 0, 0, 0, 0);
        }
    }

    /**
     * Finds test classes in the bin directory.
     * Looks for classes ending in "Testing" or "Test" in the default package.
     */
    private List<String> findTestClasses(Path binDir) throws IOException {
        if (binDir == null || !Files.exists(binDir)) {
            return List.of();
        }

        try (Stream<Path> walk = Files.walk(binDir)) {
            return walk
                .filter(Files::isRegularFile)
                .filter(p -> p.toString().endsWith(".class"))
                .filter(p -> !p.toString().contains("$")) // Skip inner classes
                .map(p -> {
                    // Convert path to class name
                    String relativePath = binDir.relativize(p).toString();
                    String className = relativePath
                        .replace(".class", "")
                        .replace("/", ".")
                        .replace("\\", ".");
                    return className;
                })
                .filter(name -> name.endsWith("Testing") || name.endsWith("Test"))
                .filter(name -> !name.startsWith("testSupport.")) // Exclude testSupport package
                .collect(Collectors.toList());
        }
    }

    /**
     * Finds the JUnit Platform Console Launcher JAR in the deps directory.
     */
    private Path findConsoleLauncher(Path depsDir) throws IOException {
        if (depsDir == null || !Files.exists(depsDir)) {
            return null;
        }

        try (Stream<Path> walk = Files.list(depsDir)) {
            return walk
                .filter(Files::isRegularFile)
                .filter(p -> {
                    String name = p.getFileName().toString().toLowerCase();
                    return name.startsWith(CONSOLE_LAUNCHER_PREFIX) && name.endsWith(".jar");
                })
                .findFirst()
                .orElse(null);
        }
    }

    /**
     * Builds the classpath string for test execution.
     */
    private String buildClasspath(Path binDir, Path depsDir) throws IOException {
        List<String> paths = new ArrayList<>();

        // Add bin directory (absolute path)
        paths.add(binDir.toAbsolutePath().toString());

        // Add all JARs from deps (absolute paths)
        if (depsDir != null && Files.exists(depsDir)) {
            try (Stream<Path> walk = Files.list(depsDir.toAbsolutePath())) {
                walk.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".jar"))
                    // Exclude the console launcher itself from classpath
                    .filter(p -> !p.getFileName().toString().toLowerCase().startsWith(CONSOLE_LAUNCHER_PREFIX))
                    .map(p -> p.toAbsolutePath().toString())
                    .forEach(paths::add);
            }
        }

        return String.join(System.getProperty("path.separator"), paths);
    }

    /**
     * Gets the path to java, respecting JAVA_HOME if set.
     */
    private String getJavaPath() {
        if (javaHome != null) {
            return javaHome.resolve("bin").resolve("java").toString();
        }

        String javaHomeEnv = System.getenv("JAVA_HOME");
        if (javaHomeEnv != null && !javaHomeEnv.isEmpty()) {
            return Path.of(javaHomeEnv, "bin", "java").toString();
        }

        return "java";
    }

    /**
     * Parses test results from JUnit console output.
     */
    private TestRunResult parseTestResults(int exitCode, String stdout, String stderr) {
        int found = 0, started = 0, succeeded = 0, failed = 0, aborted = 0, skipped = 0;

        // Try to parse the summary line
        Matcher matcher = SUMMARY_PATTERN.matcher(stdout);
        if (matcher.find()) {
            found = Integer.parseInt(matcher.group(1));
            started = Integer.parseInt(matcher.group(2));
            aborted = Integer.parseInt(matcher.group(3));
            succeeded = Integer.parseInt(matcher.group(4));
            failed = Integer.parseInt(matcher.group(5));
        } else {
            // Try counting from output lines
            found = countOccurrences(stdout, "tests found");
            started = countOccurrences(stdout, "tests started");
            succeeded = countOccurrences(stdout, "tests successful");
            failed = countOccurrences(stdout, "tests failed");
            aborted = countOccurrences(stdout, "tests aborted");
            skipped = countOccurrences(stdout, "tests skipped");
        }

        return TestRunResult.fromExecution(exitCode, stdout, stderr,
            found, started, succeeded, failed, aborted, skipped);
    }

    /**
     * Counts occurrences of a pattern like "[ N tests found ]" in output.
     */
    private int countOccurrences(String text, String suffix) {
        Pattern p = Pattern.compile("\\[\\s*(\\d+)\\s+" + Pattern.quote(suffix) + "\\s*\\]",
            Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return 0;
    }
}
