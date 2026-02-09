package edu.rosehulman.csse230feedback.llm;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Reads prompt template files (.md) from disk and fills placeholders.
 * <p>
 * Templates use simple {@code {placeholder}} syntax:
 * <pre>
 * You are analyzing student code diffs.
 * Here is the student data:
 * {student_data_json}
 * </pre>
 * <p>
 * Prompts are read at runtime (not compiled into Java), so editing a prompt
 * and re-running the pipeline picks up changes immediately. Combined with
 * content-addressable caching, changed prompts automatically cause cache misses.
 */
public class PromptLoader {

    private final Path promptsDir;

    /**
     * @param promptsDir directory containing prompt template files
     */
    public PromptLoader(Path promptsDir) {
        this.promptsDir = promptsDir;
    }

    /**
     * Loads a prompt template file and returns its raw content.
     *
     * @param fileName the template file name (e.g., "diff_labeling_prompt.md")
     * @return the raw template content
     * @throws IOException if the file cannot be read
     */
    public String loadTemplate(String fileName) throws IOException {
        Path path = promptsDir.resolve(fileName);
        if (!Files.exists(path)) {
            throw new IOException("Prompt template not found: " + path.toAbsolutePath());
        }
        return Files.readString(path);
    }

    /**
     * Loads a prompt template and fills all placeholders.
     *
     * @param fileName the template file name
     * @param variables map of placeholder name -> value (e.g., "student_data_json" -> "...")
     * @return the filled prompt content
     * @throws IOException if the file cannot be read
     */
    public String loadAndFill(String fileName, Map<String, String> variables) throws IOException {
        String template = loadTemplate(fileName);
        return fill(template, variables);
    }

    /**
     * Fills placeholders in a template string.
     * Replaces all occurrences of {@code {key}} with the corresponding value.
     */
    public static String fill(String template, Map<String, String> variables) {
        String result = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return result;
    }

    /**
     * Returns the directory where prompt templates are stored.
     */
    public Path promptsDir() {
        return promptsDir;
    }
}
