package edu.rosehulman.csse230feedback.runner;

import edu.rosehulman.csse230feedback.model.TestRunResult;
import org.junit.platform.engine.discovery.DiscoverySelectors;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.TestExecutionSummary;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Runs JUnit 5 tests in-process using the JUnit Platform Launcher API.
 */
public class JUnitPlatformRunner {

    private static final int DEFAULT_TIMEOUT_SECONDS = 300;
    private static final String DISABLE_SIZE_CHECKS_PROP = "csse230.logger.disableSizeChecks";
    private static final String BASE_DIR_PROP = "csse230.logger.baseDir";

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
     * Runs all tests in the workspace using the JUnit Platform Launcher.
     *
     * @param workspace Path to workspace root (contains src/ and bin/)
     * @param depsDir Path to dependencies directory (JARs)
     * @return TestRunResult with execution details
     * @throws IOException if test discovery or execution fails to start
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
     * @throws IOException if test discovery or execution fails to start
     */
    public TestRunResult runTests(Path workspace, Path depsDir, String testClass, String testMethod)
            throws IOException {

        Path binDir = workspace.resolve("bin");
        if (!Files.exists(binDir)) {
            return TestRunResult.noTests("", "bin directory not found: " + binDir);
        }

        LauncherDiscoveryRequestBuilder builder = LauncherDiscoveryRequestBuilder.request()
            .configurationParameter("junit.jupiter.extensions.autodetection.enabled", "true");

        if (testClass != null && !testClass.isEmpty()) {
            if (testMethod != null && !testMethod.isEmpty()) {
                builder.selectors(DiscoverySelectors.selectMethod(testClass, testMethod));
            } else {
                builder.selectors(DiscoverySelectors.selectClass(testClass));
            }
        } else {
            List<String> testClasses = findTestClasses(binDir);
            if (testClasses.isEmpty()) {
                builder.selectors(DiscoverySelectors.selectClasspathRoots(Set.of(binDir)));
            } else {
                for (String tc : testClasses) {
                    builder.selectors(DiscoverySelectors.selectClass(tc));
                }
            }
        }

        LauncherDiscoveryRequest request = builder.build();
        Launcher launcher = LauncherFactory.create();
        SummaryGeneratingListener listener = new SummaryGeneratingListener();

        String prevDisable = System.getProperty(DISABLE_SIZE_CHECKS_PROP);
        System.setProperty(DISABLE_SIZE_CHECKS_PROP, "true");
        String prevBaseDir = System.getProperty(BASE_DIR_PROP);
        System.setProperty(BASE_DIR_PROP, workspace.toAbsolutePath().toString());

        ClassLoader original = Thread.currentThread().getContextClassLoader();
        try (URLClassLoader testLoader = buildClassLoader(binDir, depsDir, original)) {
            Thread.currentThread().setContextClassLoader(testLoader);
            launcher.execute(request, listener);
            invokeForceClose(testLoader);
        } finally {
            Thread.currentThread().setContextClassLoader(original);
            if (prevDisable == null) {
                System.clearProperty(DISABLE_SIZE_CHECKS_PROP);
            } else {
                System.setProperty(DISABLE_SIZE_CHECKS_PROP, prevDisable);
            }
            if (prevBaseDir == null) {
                System.clearProperty(BASE_DIR_PROP);
            } else {
                System.setProperty(BASE_DIR_PROP, prevBaseDir);
            }
        }

        TestExecutionSummary summary = listener.getSummary();
        StringWriter out = new StringWriter();
        summary.printTo(new PrintWriter(out));

        StringBuilder err = new StringBuilder();
        for (TestExecutionSummary.Failure failure : summary.getFailures()) {
            err.append(failure.getTestIdentifier().getDisplayName())
                .append(": ")
                .append(failure.getException().toString())
                .append("\n");
        }

        int exitCode = summary.getTotalFailureCount() > 0 ? 1 : 0;
        return TestRunResult.fromExecution(
            exitCode,
            out.toString(),
            err.toString(),
            (int) summary.getTestsFoundCount(),
            (int) summary.getTestsStartedCount(),
            (int) summary.getTestsSucceededCount(),
            (int) summary.getTestsFailedCount(),
            (int) summary.getTestsAbortedCount(),
            (int) summary.getTestsSkippedCount()
        );
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
                    String relativePath = binDir.relativize(p).toString();
                    return relativePath
                        .replace(".class", "")
                        .replace("/", ".")
                        .replace("\\", ".");
                })
                .filter(name -> name.endsWith("Testing") || name.endsWith("Test"))
                .filter(name -> !name.startsWith("testSupport.")) // Exclude testSupport package
                .collect(Collectors.toList());
        }
    }

    private URLClassLoader buildClassLoader(Path binDir, Path depsDir, ClassLoader parent) throws IOException {
        Set<URL> urls = new HashSet<>();
        urls.add(binDir.toUri().toURL());

        if (depsDir != null && Files.exists(depsDir)) {
            try (Stream<Path> walk = Files.list(depsDir.toAbsolutePath())) {
                walk.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".jar"))
                    .map(p -> {
                        try {
                            return p.toUri().toURL();
                        } catch (IOException e) {
                            return null;
                        }
                    })
                    .filter(u -> u != null)
                    .forEach(urls::add);
            }
        }

        return new ChildFirstClassLoader(urls.toArray(new URL[0]), parent);
    }

    private void invokeForceClose(ClassLoader testLoader) {
        try {
            Class<?> cls = Class.forName("testSupport.LoggingExtension", true, testLoader);
            cls.getDeclaredMethod("forceClose").invoke(null);
        } catch (Exception e) {
            // Best effort: if missing, the CloseableResource should handle it.
        }
    }

    private static final class ChildFirstClassLoader extends URLClassLoader {
        private static final String[] PARENT_FIRST_PREFIXES = new String[] {
            "java.",
            "javax.",
            "sun.",
            "org.junit.",
            "org.opentest4j.",
            "org.apiguardian.",
            "org.slf4j."
        };

        private ChildFirstClassLoader(URL[] urls, ClassLoader parent) {
            super(urls, parent);
        }

        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            for (String prefix : PARENT_FIRST_PREFIXES) {
                if (name.startsWith(prefix)) {
                    return super.loadClass(name, resolve);
                }
            }

            synchronized (getClassLoadingLock(name)) {
                Class<?> loaded = findLoadedClass(name);
                if (loaded == null) {
                    try {
                        loaded = findClass(name);
                    } catch (ClassNotFoundException e) {
                        loaded = super.loadClass(name, resolve);
                    }
                }
                if (resolve) {
                    resolveClass(loaded);
                }
                return loaded;
            }
        }
    }
}
