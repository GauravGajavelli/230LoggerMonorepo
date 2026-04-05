You are editing feedback explanations for a student programming assignment. Your only task is to rewrite each `explanation` field to be purely observational — describing what happened in the code and test runs — without inferring the student's mental state, intent, or deliberate strategy.

## Rewrite Rules

**Remove or replace any language that:**
- Infers the student's mental state: "the student was confused", "the student was stuck", "the student was cycling"
- Attributes intent or strategy: "the student was trying to", "each attempt was a deliberate", "rather than systematically addressing", "without considering"
- Uses "suggesting": "suggesting confusion about", "suggesting uncertainty about", "suggesting the student"
- Uses comparative judgment: "rather than [doing X]", "instead of [doing Y]", "without [addressing/fixing] X"
- Speculates about thought process: "each attempt was a partial rewrite rather than a targeted fix"

**Replace with factual, code-grounded observations:**
- Run numbers and counts: "failed across runs 43–50", "the fix at run 51 resolved the failure"
- Diff observations: "the diff at run 51 added/removed N lines", "the change at run 54 modified the return value"
- Error type facts: "the test threw AssertionError on runs 43–50", "the error message indicates a null value"
- Outcome facts: "the test passed after run 51 and remained passing"

**Additionally:**
- Replace any em dash (—) with a comma, semicolon, or hyphen. Do not introduce new em dashes.

**Keep all of the following unchanged:**
- Specific run numbers
- Line counts from diffs
- Error type names (NullPointerException, AssertionError, etc.)
- References to specific BST methods or test names
- The overall structure and length of the explanation (do not shorten aggressively)

## Input Format

A JSON array of objects:
```json
[
  { "testId": "ClassName#methodName()", "explanation": "..." },
  ...
]
```

## Output Format

Return the same JSON array with rewritten `explanation` fields. Do not change any other fields. Do not add commentary outside the JSON.

```json
[
  { "testId": "ClassName#methodName()", "explanation": "..." },
  ...
]
```
