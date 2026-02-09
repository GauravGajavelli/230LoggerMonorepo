package edu.rosehulman.csse230feedback.llm;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Loads LLM configuration from environment variables and .env file.
 * Priority: CLI flags > environment variables > .env file > defaults.
 */
public class LlmConfig {

    private final String provider;
    private final String model;
    private final String apiKey;

    private LlmConfig(String provider, String model, String apiKey) {
        this.provider = provider;
        this.model = model;
        this.apiKey = apiKey;
    }

    public String provider() { return provider; }
    public String model() { return model; }
    public String apiKey() { return apiKey; }

    /**
     * Resolves the API key for the active provider.
     * Uses the explicit apiKey if set, otherwise looks up the provider-specific env var.
     */
    public String resolvedApiKey() {
        if (apiKey != null && !apiKey.isBlank()) {
            return apiKey;
        }
        String envVarName = envVarName();
        return getEnvOrProperty(envVarName, null);
    }

    public void validate() throws LlmException {
        if (resolvedApiKey() == null || resolvedApiKey().isBlank()) {
            throw new LlmException(
                "No API key found for provider '" + provider + "'. " +
                "Set " + envVarName() + " in your environment or .env file, " +
                "or pass --llm-api-key on the command line."
            );
        }
    }

    private String envVarName() {
        return switch (provider) {
            case "openai" -> "OPENAI_API_KEY";
            case "anthropic" -> "ANTHROPIC_API_KEY";
            case "google" -> "GOOGLE_API_KEY";
            default -> provider.toUpperCase() + "_API_KEY";
        };
    }

    /**
     * Loads a .env file and sets any values as system properties
     * (only if the corresponding environment variable is not already set).
     */
    public static void loadDotEnv(Path dotEnvPath) {
        if (!Files.exists(dotEnvPath)) {
            return;
        }
        Map<String, String> envVars = parseDotEnv(dotEnvPath);
        for (Map.Entry<String, String> entry : envVars.entrySet()) {
            String existing = System.getenv(entry.getKey());
            if (existing == null || existing.isBlank()) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        }
    }

    /**
     * Gets an env var, falling back to system property (set by .env loading).
     */
    private static String getEnvOrProperty(String name, String defaultValue) {
        String env = System.getenv(name);
        if (env != null && !env.isBlank()) return env;
        String prop = System.getProperty(name);
        if (prop != null && !prop.isBlank()) return prop;
        return defaultValue;
    }

    /**
     * Builds config from environment + .env file + CLI overrides.
     *
     * @param dotEnvPath path to .env file (can be null)
     * @param cliProvider CLI override for provider (can be null)
     * @param cliModel CLI override for model (can be null)
     * @param cliApiKey CLI override for API key (can be null)
     */
    public static LlmConfig load(Path dotEnvPath, String cliProvider, String cliModel, String cliApiKey) {
        if (dotEnvPath != null) {
            loadDotEnv(dotEnvPath);
        }

        String provider = cliProvider != null ? cliProvider
            : getEnvOrProperty("LLM_PROVIDER", "openai");

        String model = cliModel != null ? cliModel
            : getEnvOrProperty("LLM_MODEL", "gpt-4o-mini");

        String apiKey = cliApiKey != null ? cliApiKey : null;

        return new LlmConfig(provider, model, apiKey);
    }

    private static Map<String, String> parseDotEnv(Path path) {
        Map<String, String> result = new HashMap<>();
        try (BufferedReader reader = Files.newBufferedReader(path)) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int eq = line.indexOf('=');
                if (eq <= 0) continue;
                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();
                // Strip surrounding quotes
                if ((value.startsWith("\"") && value.endsWith("\""))
                    || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                result.put(key, value);
            }
        } catch (IOException e) {
            System.err.println("Warning: could not read .env file: " + e.getMessage());
        }
        return result;
    }

    @Override
    public String toString() {
        return "LlmConfig{provider=" + provider + ", model=" + model
            + ", apiKey=" + (apiKey != null ? "[set]" : "[from env]") + "}";
    }
}
