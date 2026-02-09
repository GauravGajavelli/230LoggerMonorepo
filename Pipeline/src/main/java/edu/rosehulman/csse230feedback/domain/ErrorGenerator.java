package edu.rosehulman.csse230feedback.domain;

import java.util.List;
import java.util.Random;

/**
 * Generates realistic Java exceptions for simulated test failures.
 */
public class ErrorGenerator {

    private final Random random;

    public ErrorGenerator(Random random) {
        this.random = random;
    }

    public enum ErrorType {
        COMPILATION_ERROR,
        ASSERTION_WRONG_OUTPUT,
        ASSERTION_WRONG_SIZE,
        NULL_POINTER,
        STACK_OVERFLOW,
        UNSUPPORTED_OPERATION,
        ILLEGAL_ARGUMENT,
        CONCURRENT_MODIFICATION,
        CLASS_CAST,
        INDEX_OUT_OF_BOUNDS
    }

    public record GeneratedError(
        String exceptionType,
        String message,
        String stackTrace,
        String expected,
        String actual,
        String cause
    ) {}

    public GeneratedError generate(ErrorType type, String testClass, String testMethod) {
        return switch (type) {
            case COMPILATION_ERROR -> compilationError(testClass);
            case ASSERTION_WRONG_OUTPUT -> assertionWrongOutput(testClass, testMethod);
            case ASSERTION_WRONG_SIZE -> assertionWrongSize(testClass, testMethod);
            case NULL_POINTER -> nullPointer(testClass, testMethod);
            case STACK_OVERFLOW -> stackOverflow(testClass, testMethod);
            case UNSUPPORTED_OPERATION -> unsupportedOperation(testClass, testMethod);
            case ILLEGAL_ARGUMENT -> illegalArgument(testClass, testMethod);
            case CONCURRENT_MODIFICATION -> concurrentModification(testClass, testMethod);
            case CLASS_CAST -> classCast(testClass, testMethod);
            case INDEX_OUT_OF_BOUNDS -> indexOutOfBounds(testClass, testMethod);
        };
    }

    /**
     * Returns an appropriate error type for a given category and progression phase.
     */
    public ErrorType pickErrorType(String category, int phase) {
        if (phase <= 1) {
            return ErrorType.COMPILATION_ERROR;
        }

        List<ErrorType> candidates = switch (category) {
            case "basic_insert" -> List.of(ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.NULL_POINTER);
            case "tree_properties" -> List.of(ErrorType.ASSERTION_WRONG_SIZE, ErrorType.ASSERTION_WRONG_OUTPUT);
            case "search_contains" -> List.of(ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.NULL_POINTER);
            case "conversion" -> List.of(ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.NULL_POINTER, ErrorType.INDEX_OUT_OF_BOUNDS);
            case "deletion" -> List.of(ErrorType.NULL_POINTER, ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.STACK_OVERFLOW);
            case "iterators" -> List.of(ErrorType.UNSUPPORTED_OPERATION, ErrorType.NULL_POINTER, ErrorType.CONCURRENT_MODIFICATION);
            case "edge_cases" -> List.of(ErrorType.ILLEGAL_ARGUMENT, ErrorType.NULL_POINTER);
            case "efficiency" -> List.of(ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.STACK_OVERFLOW);
            case "concurrency" -> List.of(ErrorType.CONCURRENT_MODIFICATION, ErrorType.UNSUPPORTED_OPERATION);
            default -> List.of(ErrorType.ASSERTION_WRONG_OUTPUT, ErrorType.NULL_POINTER);
        };

        return candidates.get(random.nextInt(candidates.size()));
    }

    private GeneratedError compilationError(String testClass) {
        return new GeneratedError(
            "java.lang.Error",
            "Unresolved compilation problems",
            buildTrace("java.lang.Error: Unresolved compilation problems",
                testClass, "<init>", 1,
                "sun.reflect.NativeConstructorAccessorImpl", "newInstance0", -2),
            null, null,
            "java.lang.Error: Unresolved compilation problems"
        );
    }

    private GeneratedError assertionWrongOutput(String testClass, String testMethod) {
        String[] expectedValues = {"[1, 2, 3, 4, 5]", "[5, 10, 15, 20]", "true", "[A, B, C]", "3"};
        String[] actualValues = {"[1, 2, 3]", "[5, 10, 15]", "false", "[A, C]", "2"};
        int idx = random.nextInt(expectedValues.length);
        String expected = expectedValues[idx];
        String actual = actualValues[idx];

        return new GeneratedError(
            "org.opentest4j.AssertionFailedError",
            "expected: <" + expected + "> but was: <" + actual + ">",
            buildTrace("org.opentest4j.AssertionFailedError: expected: <" + expected + "> but was: <" + actual + ">",
                "org.junit.jupiter.api.AssertionUtils", "failNotEqual", 198,
                testClass, testMethod, random.nextInt(50) + 20),
            expected, actual,
            "org.opentest4j.AssertionFailedError: expected: <" + expected + "> but was: <" + actual + ">"
        );
    }

    private GeneratedError assertionWrongSize(String testClass, String testMethod) {
        int expected = random.nextInt(10) + 1;
        int actual = random.nextBoolean() ? expected + random.nextInt(3) + 1 : Math.max(0, expected - random.nextInt(3) - 1);

        return new GeneratedError(
            "org.opentest4j.AssertionFailedError",
            "expected: <" + expected + "> but was: <" + actual + ">",
            buildTrace("org.opentest4j.AssertionFailedError: expected: <" + expected + "> but was: <" + actual + ">",
                "org.junit.jupiter.api.AssertionUtils", "failNotEqual", 198,
                testClass, testMethod, random.nextInt(30) + 10),
            String.valueOf(expected), String.valueOf(actual),
            "org.opentest4j.AssertionFailedError: expected: <" + expected + "> but was: <" + actual + ">"
        );
    }

    private GeneratedError nullPointer(String testClass, String testMethod) {
        String[] locations = {"BinarySearchTree.insert", "BinarySearchTree.contains", "BinarySearchTree.remove",
            "BinaryNode.getLeft", "BinaryNode.getRight"};
        String loc = locations[random.nextInt(locations.length)];

        return new GeneratedError(
            "java.lang.NullPointerException",
            "Cannot invoke method on null reference",
            buildTrace("java.lang.NullPointerException: Cannot invoke method on null reference",
                loc.split("\\.")[0], loc.split("\\.")[1], random.nextInt(100) + 10,
                testClass, testMethod, random.nextInt(50) + 20),
            null, null,
            "java.lang.NullPointerException: Cannot invoke method on null reference"
        );
    }

    private GeneratedError stackOverflow(String testClass, String testMethod) {
        return new GeneratedError(
            "java.lang.StackOverflowError",
            null,
            buildTrace("java.lang.StackOverflowError",
                "BinarySearchTree", "remove", random.nextInt(50) + 30,
                testClass, testMethod, random.nextInt(40) + 15),
            null, null,
            "java.lang.StackOverflowError"
        );
    }

    private GeneratedError unsupportedOperation(String testClass, String testMethod) {
        return new GeneratedError(
            "java.lang.UnsupportedOperationException",
            "iterator not implemented",
            buildTrace("java.lang.UnsupportedOperationException: iterator not implemented",
                "BinarySearchTree", "iterator", random.nextInt(30) + 50,
                testClass, testMethod, random.nextInt(30) + 10),
            null, null,
            "java.lang.UnsupportedOperationException: iterator not implemented"
        );
    }

    private GeneratedError illegalArgument(String testClass, String testMethod) {
        return new GeneratedError(
            "java.lang.IllegalArgumentException",
            "Element cannot be null",
            buildTrace("java.lang.IllegalArgumentException: Element cannot be null",
                "BinarySearchTree", "insert", random.nextInt(20) + 5,
                testClass, testMethod, random.nextInt(30) + 10),
            null, null,
            "java.lang.IllegalArgumentException: Element cannot be null"
        );
    }

    private GeneratedError concurrentModification(String testClass, String testMethod) {
        return new GeneratedError(
            "java.util.ConcurrentModificationException",
            null,
            buildTrace("java.util.ConcurrentModificationException",
                "BinarySearchTree$BSTIterator", "next", random.nextInt(20) + 80,
                testClass, testMethod, random.nextInt(30) + 10),
            null, null,
            "java.util.ConcurrentModificationException"
        );
    }

    private GeneratedError classCast(String testClass, String testMethod) {
        return new GeneratedError(
            "java.lang.ClassCastException",
            "class java.lang.String cannot be cast to class java.lang.Integer",
            buildTrace("java.lang.ClassCastException: class java.lang.String cannot be cast to class java.lang.Integer",
                "BinarySearchTree", "insert", random.nextInt(30) + 10,
                testClass, testMethod, random.nextInt(30) + 10),
            null, null,
            "java.lang.ClassCastException: class java.lang.String cannot be cast to class java.lang.Integer"
        );
    }

    private GeneratedError indexOutOfBounds(String testClass, String testMethod) {
        int idx = random.nextInt(20) + 5;
        int size = random.nextInt(idx);
        return new GeneratedError(
            "java.lang.IndexOutOfBoundsException",
            "Index " + idx + " out of bounds for length " + size,
            buildTrace("java.lang.IndexOutOfBoundsException: Index " + idx + " out of bounds for length " + size,
                "java.util.ArrayList", "get", 459,
                testClass, testMethod, random.nextInt(30) + 10),
            null, null,
            "java.lang.IndexOutOfBoundsException: Index " + idx + " out of bounds for length " + size
        );
    }

    private String buildTrace(String header, String class1, String method1, int line1,
                              String class2, String method2, int line2) {
        StringBuilder sb = new StringBuilder();
        sb.append(header).append("\n");
        sb.append("\tat ").append(class1).append(".").append(method1).append("(").append(class1).append(".java:").append(line1).append(")\n");
        sb.append("\tat ").append(class2).append(".").append(method2).append("(").append(class2).append(".java:").append(line2).append(")\n");
        return sb.toString();
    }
}
