package edu.rosehulman.csse230feedback.domain;

import java.nio.file.Path;

/**
 * Configuration options for test rerun operations.
 */
public record RerunOptions(
    /** Path to ingested output directory (contains archives/, runs.jsonl, patches_index.jsonl) */
    Path inputDir,

    /** Output directory for enriched results */
    Path outDir,

    /** Working directory for temp workspaces */
    Path workDir,

    /** Path to dependencies directory (JARs including junit-platform-console-standalone) */
    Path depsDir,

    /** Path to testSupport source files to overlay */
    Path testSupportDir,

    /** Java home path (null to use system default) */
    Path javaHome,

    /** Java version to compile for (default: 17) */
    int javaVersion,

    /** Specific run number to rerun, or -1 for all */
    int runNumber,

    /** Specific test to rerun (format: "TestClass#testMethod"), or null for all */
    String testSelector,

    /** Whether to preserve working directories after completion */
    boolean keepWorkDir,

    /** Timeout in seconds for compilation */
    int compileTimeout,

    /** Timeout in seconds for test execution */
    int testTimeout
) {
    /** Default Java version */
    public static final int DEFAULT_JAVA_VERSION = 17;

    /** Default compile timeout in seconds */
    public static final int DEFAULT_COMPILE_TIMEOUT = 120;

    /** Default test timeout in seconds */
    public static final int DEFAULT_TEST_TIMEOUT = 300;

    /**
     * Builder for RerunOptions.
     */
    public static class Builder {
        private Path inputDir;
        private Path outDir;
        private Path workDir;
        private Path depsDir;
        private Path testSupportDir;
        private Path javaHome;
        private int javaVersion = DEFAULT_JAVA_VERSION;
        private int runNumber = -1;
        private String testSelector;
        private boolean keepWorkDir = false;
        private int compileTimeout = DEFAULT_COMPILE_TIMEOUT;
        private int testTimeout = DEFAULT_TEST_TIMEOUT;

        public Builder inputDir(Path inputDir) {
            this.inputDir = inputDir;
            return this;
        }

        public Builder outDir(Path outDir) {
            this.outDir = outDir;
            return this;
        }

        public Builder workDir(Path workDir) {
            this.workDir = workDir;
            return this;
        }

        public Builder depsDir(Path depsDir) {
            this.depsDir = depsDir;
            return this;
        }

        public Builder testSupportDir(Path testSupportDir) {
            this.testSupportDir = testSupportDir;
            return this;
        }

        public Builder javaHome(Path javaHome) {
            this.javaHome = javaHome;
            return this;
        }

        public Builder javaVersion(int javaVersion) {
            this.javaVersion = javaVersion;
            return this;
        }

        public Builder runNumber(int runNumber) {
            this.runNumber = runNumber;
            return this;
        }

        public Builder testSelector(String testSelector) {
            this.testSelector = testSelector;
            return this;
        }

        public Builder keepWorkDir(boolean keepWorkDir) {
            this.keepWorkDir = keepWorkDir;
            return this;
        }

        public Builder compileTimeout(int compileTimeout) {
            this.compileTimeout = compileTimeout;
            return this;
        }

        public Builder testTimeout(int testTimeout) {
            this.testTimeout = testTimeout;
            return this;
        }

        public RerunOptions build() {
            // Default workDir to outDir/work if not specified
            Path actualWorkDir = workDir != null ? workDir : outDir.resolve("work");

            return new RerunOptions(
                inputDir, outDir, actualWorkDir, depsDir, testSupportDir,
                javaHome, javaVersion, runNumber, testSelector, keepWorkDir,
                compileTimeout, testTimeout
            );
        }
    }

    /**
     * Creates a new builder.
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Returns true if a specific run number is targeted.
     */
    public boolean hasSpecificRun() {
        return runNumber >= 0;
    }

    /**
     * Returns true if a specific test is targeted.
     */
    public boolean hasTestSelector() {
        return testSelector != null && !testSelector.isEmpty();
    }

    /**
     * Parses test selector into class and method components.
     * @return String array [className, methodName] or [className, null] if no method
     */
    public String[] parseTestSelector() {
        if (testSelector == null || testSelector.isEmpty()) {
            return new String[] { null, null };
        }

        int hashIndex = testSelector.indexOf('#');
        if (hashIndex < 0) {
            return new String[] { testSelector, null };
        }

        return new String[] {
            testSelector.substring(0, hashIndex),
            testSelector.substring(hashIndex + 1)
        };
    }
}
