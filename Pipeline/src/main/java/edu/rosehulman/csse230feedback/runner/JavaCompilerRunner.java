package edu.rosehulman.csse230feedback.runner;

import edu.rosehulman.csse230feedback.model.CompileResult;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Runs the Java compiler (javac) on workspace source files.
 */
public class JavaCompilerRunner {

    private static final int DEFAULT_TIMEOUT_SECONDS = 120;
    private static final int DEFAULT_JAVA_VERSION = 17;

    private final int javaVersion;
    private final int timeoutSeconds;
    private final Path javaHome;

    public JavaCompilerRunner() {
        this(DEFAULT_JAVA_VERSION, DEFAULT_TIMEOUT_SECONDS, null);
    }

    public JavaCompilerRunner(int javaVersion) {
        this(javaVersion, DEFAULT_TIMEOUT_SECONDS, null);
    }

    public JavaCompilerRunner(int javaVersion, int timeoutSeconds, Path javaHome) {
        this.javaVersion = javaVersion;
        this.timeoutSeconds = timeoutSeconds;
        this.javaHome = javaHome;
    }

    /**
     * Compiles all Java files in the workspace src/ directory.
     *
     * @param workspace Path to workspace root (contains src/ and bin/)
     * @param depsDir Path to dependencies directory (JARs)
     * @return CompileResult with success/failure and output
     * @throws IOException if compilation process fails to start
     */
    public CompileResult compile(Path workspace, Path depsDir) throws IOException {
        // Convert to absolute paths to avoid issues when javac runs from workspace directory
        workspace = workspace.toAbsolutePath();
        Path srcDir = workspace.resolve("src");
        Path binDir = workspace.resolve("bin");

        // Find all Java files
        List<String> javaFiles;
        try (Stream<Path> walk = Files.walk(srcDir)) {
            javaFiles = walk
                .filter(Files::isRegularFile)
                .filter(p -> p.toString().endsWith(".java"))
                .map(Path::toString)
                .collect(Collectors.toList());
        }

        if (javaFiles.isEmpty()) {
            return CompileResult.failure("", "No Java files found in src/", 1, List.of("No Java files found"));
        }

        // Build classpath
        String classpath = buildClasspath(depsDir);

        // Build command
        List<String> command = new ArrayList<>();
        command.add(getJavacPath());
        command.add("-source");
        command.add(String.valueOf(javaVersion));
        command.add("-target");
        command.add(String.valueOf(javaVersion));
        if (classpath != null && !classpath.isEmpty()) {
            command.add("-cp");
            command.add(classpath);
        }
        command.add("-d");
        command.add(binDir.toString());
        command.addAll(javaFiles);

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
                return CompileResult.failure(stdout.toString(), stderr.toString(), -1,
                    List.of("Compilation timed out after " + timeoutSeconds + " seconds"));
            }

            stdoutThread.join();
            stderrThread.join();

            int exitCode = process.exitValue();
            String stderrStr = stderr.toString();

            if (exitCode == 0) {
                return CompileResult.success(stdout.toString(), stderrStr);
            } else {
                List<String> errors = parseCompilerErrors(stderrStr);
                return CompileResult.failure(stdout.toString(), stderrStr, exitCode, errors);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return CompileResult.failure(stdout.toString(), stderr.toString(), -1,
                List.of("Compilation interrupted"));
        }
    }

    /**
     * Builds the classpath string from a dependencies directory.
     */
    private String buildClasspath(Path depsDir) throws IOException {
        if (depsDir == null || !Files.exists(depsDir)) {
            return "";
        }

        // Ensure absolute paths in classpath
        depsDir = depsDir.toAbsolutePath();

        try (Stream<Path> walk = Files.list(depsDir)) {
            return walk
                .filter(Files::isRegularFile)
                .filter(p -> p.toString().endsWith(".jar"))
                .map(p -> p.toAbsolutePath().toString())
                .collect(Collectors.joining(System.getProperty("path.separator")));
        }
    }

    /**
     * Gets the path to javac, respecting JAVA_HOME if set.
     */
    private String getJavacPath() {
        if (javaHome != null) {
            return javaHome.resolve("bin").resolve("javac").toString();
        }

        String javaHomeEnv = System.getenv("JAVA_HOME");
        if (javaHomeEnv != null && !javaHomeEnv.isEmpty()) {
            return Path.of(javaHomeEnv, "bin", "javac").toString();
        }

        return "javac";
    }

    /**
     * Parses compiler error messages from stderr.
     */
    private List<String> parseCompilerErrors(String stderr) {
        List<String> errors = new ArrayList<>();
        if (stderr == null || stderr.isEmpty()) {
            return errors;
        }

        // Split by lines and collect error messages
        String[] lines = stderr.split("\n");
        StringBuilder currentError = new StringBuilder();

        for (String line : lines) {
            if (line.contains(": error:") || line.contains(": warning:")) {
                if (currentError.length() > 0) {
                    errors.add(currentError.toString().trim());
                    currentError = new StringBuilder();
                }
                currentError.append(line);
            } else if (currentError.length() > 0 && !line.trim().isEmpty()) {
                currentError.append("\n").append(line);
            }
        }

        if (currentError.length() > 0) {
            errors.add(currentError.toString().trim());
        }

        return errors;
    }
}
