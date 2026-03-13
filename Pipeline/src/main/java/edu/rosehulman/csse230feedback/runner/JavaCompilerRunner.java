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
        workspace = workspace.toAbsolutePath();
        Path srcDir = workspace.resolve("src");

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

        return compileFileList(workspace, depsDir, javaFiles);
    }

    /**
     * Compiles a specific subset of Java files into the workspace bin/ directory.
     * Used for graceful degradation when some source files have compile errors.
     *
     * @param workspace Path to workspace root (contains src/ and bin/)
     * @param depsDir Path to dependencies directory (JARs)
     * @param javaFiles Explicit list of absolute .java file paths to compile
     * @return CompileResult with success/failure and output
     * @throws IOException if compilation process fails to start
     */
    public CompileResult compileFileList(Path workspace, Path depsDir, List<String> javaFiles) throws IOException {
        workspace = workspace.toAbsolutePath();
        Path binDir = workspace.resolve("bin");

        String classpath = buildClasspath(depsDir);

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

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workspace.toFile());
        pb.redirectErrorStream(false);

        Process process = pb.start();

        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();

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
     * Extracts the set of .java file paths referenced in compiler error output.
     */
    public static java.util.Set<String> errorFiles(String compilerStderr) {
        java.util.Set<String> files = new java.util.LinkedHashSet<>();
        if (compilerStderr == null) return files;
        for (String line : compilerStderr.split("\n")) {
            // javac error lines start with: /absolute/path/to/File.java:NN: error:
            int colon = line.indexOf(':');
            if (colon > 1 && line.substring(colon + 1).stripLeading().startsWith("error:")) {
                files.add(line.substring(0, colon));
            } else if (colon > 1) {
                // Try second colon: /path/File.java:NN: error: ...
                String rest = line.substring(colon + 1);
                int colon2 = rest.indexOf(':');
                if (colon2 >= 0 && rest.substring(colon2 + 1).stripLeading().startsWith("error:")) {
                    String candidate = line.substring(0, colon);
                    if (candidate.endsWith(".java")) {
                        files.add(candidate);
                    }
                }
            }
        }
        return files;
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
