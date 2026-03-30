package edu.rosehulman.csse230feedback.prepare;

import edu.rosehulman.csse230feedback.data.DiffFileReconstructor;
import edu.rosehulman.csse230feedback.model.PatchPointer;
import edu.rosehulman.csse230feedback.model.frontend.TestSource;
import edu.rosehulman.csse230feedback.util.Json;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Extracts @Test method source snippets from test class files stored in the diff archives.
 * Produces a map from testId ("ClassName#methodName()") to TestSource.
 */
public class TestSourceExtractor {

    private final DiffFileReconstructor reconstructor = new DiffFileReconstructor();

    public Map<String, TestSource> extract(
            Path inputDir, Collection<String> testIds, List<String> warnings) throws IOException {

        Path archivesDir = inputDir.resolve("archives");
        Path patchesIndex = inputDir.resolve("patches_index.jsonl");
        Path cacheDir = inputDir.resolve(".cache");

        if (!Files.exists(archivesDir) || !Files.exists(patchesIndex)) {
            return Collections.emptyMap();
        }
        Files.createDirectories(cacheDir);

        List<PatchPointer> allPatches = loadPatchesIndex(patchesIndex, warnings);
        if (allPatches.isEmpty()) return Collections.emptyMap();

        // Group method names by class
        Map<String, List<String>> methodsByClass = new LinkedHashMap<>();
        for (String testId : testIds) {
            int hash = testId.indexOf('#');
            if (hash < 0) continue;
            String className = testId.substring(0, hash);
            // Strip parameter list: "testFoo()" → "testFoo", "testFoo(int)" → "testFoo"
            String methodName = testId.substring(hash + 1).replaceFirst("\\(.*", "");
            methodsByClass.computeIfAbsent(className, k -> new ArrayList<>()).add(methodName);
        }

        Map<String, TestSource> result = new LinkedHashMap<>();

        for (Map.Entry<String, List<String>> entry : methodsByClass.entrySet()) {
            String className = entry.getKey();
            List<String> methods = entry.getValue();

            // Test class file key has two observed formats depending on how LoggingExtension
            // was configured when the student's run.tar was captured:
            //   1. Default-package projects (BST, BinaryHeaps, StringHashSet):
            //        "ClassName.java.ClassName"
            //   2. Named-package projects (WuaS, GraphSurfing):
            //        "package.ClassName"  (dots replace path separators, no ".java." infix)
            // We try the exact default-package key first; if absent, fall back to any patch
            // whose fileKey ends with ".<ClassName>" (the package-qualified suffix).
            String defaultKey = className + ".java." + className;
            String suffix     = "." + className;
            // Use the latest available patch so we see the most complete version of the file
            // (e.g. tests that were commented-out in the baseline but uncommented by run 1)
            Optional<PatchPointer> patch = allPatches.stream()
                .filter(p -> p.fileKey().equals(defaultKey) || p.fileKey().endsWith(suffix))
                .max(Comparator.comparingInt(PatchPointer::runNumber));

            if (patch.isEmpty()) {
                // Test class not tracked in patches — not an error, some files may be absent
                continue;
            }

            List<String> lines;
            try {
                lines = reconstructor.reconstruct(archivesDir, patch.get(), cacheDir, warnings);
            } catch (Exception e) {
                warnings.add("TestSourceExtractor: failed to reconstruct " + patch.get().fileKey() + ": " + e.getMessage());
                continue;
            }

            String fileName = className + ".java";
            for (String methodName : methods) {
                String testId = className + "#" + methodName + "()";
                TestSource source = parseMethod(lines, fileName, methodName);
                if (source != null) {
                    result.put(testId, source);
                } else {
                    warnings.add("TestSourceExtractor: method '" + methodName + "' not found in " + fileName);
                }
            }
        }

        return result;
    }

    /**
     * Parses a Java source file to locate a specific @Test method.
     * Handles @Test with parameters, multiple annotations between @Test and the method,
     * and brace counting that skips string literals and comments.
     */
    static TestSource parseMethod(List<String> lines, String fileName, String methodName) {
        int annotationLine = -1;  // 1-based line of the @Test annotation
        boolean awaitingMethod = false;

        for (int i = 0; i < lines.size(); i++) {
            String trimmed = lines.get(i).trim();

            if (trimmed.startsWith("@Test") || trimmed.startsWith("@ParameterizedTest")) {
                awaitingMethod = true;
                annotationLine = i + 1;  // 1-based
                continue;
            }

            if (!awaitingMethod) continue;

            // Skip other annotations and blank lines/comments between @Test and method sig
            if (trimmed.startsWith("@") || trimmed.isEmpty() || trimmed.startsWith("//") || trimmed.startsWith("*")) {
                continue;
            }

            // Check for matching method signature
            if (trimmed.contains("void " + methodName + "(") ||
                trimmed.contains("void " + methodName + " (")) {
                int endLine = findMethodEnd(lines, i);
                if (endLine < 0) return null;
                String content = String.join("\n", lines.subList(annotationLine - 1, endLine));
                return new TestSource(fileName, annotationLine, endLine, content);
            }

            // Non-annotation non-blank line that doesn't match our method — reset
            awaitingMethod = false;
            annotationLine = -1;
        }

        return null;
    }

    /**
     * Given the 0-based index of the method signature line, finds the 1-based line
     * of the closing brace. Handles string literals, char literals, and comments
     * to avoid false brace counts.
     */
    private static int findMethodEnd(List<String> lines, int methodLineIdx) {
        int depth = 0;
        boolean foundOpen = false;
        boolean inBlockComment = false;

        for (int i = methodLineIdx; i < lines.size(); i++) {
            String line = lines.get(i);
            boolean inString = false;
            boolean inChar = false;

            for (int j = 0; j < line.length(); j++) {
                char c = line.charAt(j);
                char next = (j + 1 < line.length()) ? line.charAt(j + 1) : 0;

                if (inBlockComment) {
                    if (c == '*' && next == '/') { inBlockComment = false; j++; }
                    continue;
                }

                if ((inString || inChar) && c == '\\') { j++; continue; }
                if (c == '"' && !inChar)   { inString = !inString; continue; }
                if (c == '\'' && !inString) { inChar   = !inChar;  continue; }

                if (!inString && !inChar) {
                    if (c == '/' && next == '/') break;  // line comment
                    if (c == '/' && next == '*') { inBlockComment = true; j++; continue; }
                    if (c == '{') { depth++; foundOpen = true; }
                    else if (c == '}') { depth--; }
                }
            }

            if (foundOpen && depth == 0) return i + 1;  // 1-based
        }

        return -1;
    }

    private List<PatchPointer> loadPatchesIndex(Path patchesIndex, List<String> warnings)
            throws IOException {
        List<PatchPointer> patches = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(patchesIndex)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    try {
                        patches.add(Json.mapper().readValue(line, PatchPointer.class));
                    } catch (IOException e) {
                        warnings.add("TestSourceExtractor: failed to parse patch entry: " + e.getMessage());
                    }
                }
            }
        }
        return patches;
    }
}
