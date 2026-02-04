# Diff Category Labeling Prompt

Use this prompt to label code changes between runs. This helps identify what kind of fix or modification the student made at each step. Run it manually, review the output, then save as `diff_categories.json`.

This prompt supports **batched input** - you can label all diffs for a student in a single LLM call, which is more cost-effective (~$0.03-0.08 per student vs $1-2 for individual calls).

---

## Prompt (Batched Version - Recommended)

```
You are a teaching assistant for CSSE 230 (Data Structures & Algorithms) analyzing a student's debugging process. Your task is to categorize ALL code changes across their development session to understand their debugging patterns.

## Assignment Context
[REPLACE: Describe the assignment - e.g., "Students are implementing a Binary Search Tree"]

## All Code Changes for This Student

[REPLACE: Paste all changes, formatted as below]

### Run 2 (diff):
--- a/BinarySearchTree.java
+++ b/BinarySearchTree.java
@@ -42,7 +42,7 @@
    private Node insertHelper(Node current, int value) {
-        if (current.left == null) {
+        if (current == null) {
            return new Node(value);
        }

### Run 5 (diff):
[paste diff]

### Run 10 (baseline - full file snapshot):
[paste full file content]

Note: Some runs have "baseline" entries instead of diffs. This happens when the
logging system rebaselines (stores full file instead of patch). For baselines,
categorize based on the overall state of the code compared to what you know
about the assignment and previous changes.

## Instructions

1. Analyze each code change sequentially
2. Classify each change into one or more categories (a single change can fix multiple issues)
3. Provide a brief explanation of what was fixed/changed
4. Rate your confidence (HIGH/MEDIUM/LOW)
5. List affected methods/functions

## Category Options

Choose from these categories (multiple allowed per change):

**Bug Fixes:**
- `null_check_added` - Added missing null/empty check
- `null_check_fixed` - Corrected existing null check logic
- `off_by_one_fixed` - Fixed loop bounds or index calculation
- `comparison_operator_fixed` - Changed <, >, <=, >=, ==, !=
- `return_value_fixed` - Changed what a method returns
- `base_case_added` - Added missing recursion base case
- `base_case_fixed` - Corrected existing base case
- `recursion_fixed` - Fixed recursive call (wrong args, wrong direction)
- `assignment_fixed` - Fixed variable assignment
- `initialization_fixed` - Fixed variable initialization
- `logic_error_fixed` - General logic correction

**Structural Changes:**
- `method_added` - Added new helper method
- `method_removed` - Removed a method
- `variable_added` - Added new field or local variable
- `control_flow_changed` - Changed if/else/switch structure
- `loop_structure_changed` - Changed loop type or structure
- `major_refactor` - Significant restructuring of code

**Refactoring:**
- `variable_renamed` - Renamed variable for clarity
- `code_extracted` - Extracted code into helper method
- `code_inlined` - Inlined helper method
- `whitespace_only` - Only formatting/whitespace changes
- `comment_added` - Added or modified comments

**Other:**
- `other` - Doesn't fit other categories

## Output Format

Return a JSON array with all changes:
[
  {
    "runNumber": 2,
    "changeType": "diff",
    "categories": ["null_check_added", "base_case_added"],
    "confidence": "HIGH",
    "explanation": "Added null checks in both insert and contains methods",
    "affectedMethods": ["insert", "contains"]
  },
  {
    "runNumber": 10,
    "changeType": "baseline",
    "categories": ["major_refactor"],
    "confidence": "MEDIUM",
    "explanation": "Full file rebaseline - significant restructuring of Node class",
    "affectedMethods": ["Node"]
  }
]

Note: A single change can have multiple categories if it fixes multiple issues
or touches multiple concerns.
```

---

## Single Diff Prompt (Alternative)

For labeling individual diffs one at a time:

```
You are a teaching assistant for CSSE 230 (Data Structures & Algorithms) analyzing a student's debugging process. Your task is to categorize code changes (diffs) to understand what kind of modifications the student made.

## Assignment Context
[REPLACE: Describe the assignment - e.g., "Students are implementing a Binary Search Tree"]

## Diff to Analyze

Run [REPLACE: run number] changes:

[REPLACE: Paste the unified diff]

## Instructions

1. Analyze what the student changed
2. Classify the change into one or more categories
3. Provide a brief explanation of what was fixed/changed
4. Rate your confidence (HIGH/MEDIUM/LOW)

## Output Format

Return a JSON object:
{
  "runNumber": 5,
  "changeType": "diff",
  "categories": ["null_check_added"],
  "confidence": "HIGH",
  "explanation": "Student added a null check for the current node before accessing its left child.",
  "affectedMethods": ["insertHelper"]
}
```

---

## How to Use

1. **Extract diffs** from the archives:
   ```bash
   # List available diffs
   ls ingested/archives/

   # View a specific diff (requires unzipping)
   unzip -p ingested/archives/diffs_001.zip "*.patch" | head -50
   ```

2. **Build the batched prompt** with all diffs for one student

3. **Run the prompt** through Claude (claude.ai, API, or Claude Code)

4. **Review and edit** - ensure categories match what actually changed

5. **Save output** as `diff_categories.json` in the ingested directory

6. **Run prepare** - the pipeline will read and incorporate these labels

---

## Expected File Format: diff_categories.json

```json
{
  "assignmentContext": "Binary Search Tree implementation",
  "generatedAt": "2024-01-15T10:30:00Z",
  "generationMethod": "batched_llm",
  "diffLabels": [
    {
      "runNumber": 2,
      "changeType": "diff",
      "categories": ["null_check_added"],
      "confidence": "HIGH",
      "explanation": "Added null check in insert method",
      "affectedMethods": ["insert"]
    },
    {
      "runNumber": 3,
      "changeType": "diff",
      "categories": ["off_by_one_fixed", "comparison_operator_fixed"],
      "confidence": "HIGH",
      "explanation": "Fixed loop bound and comparison in contains method",
      "affectedMethods": ["contains"]
    },
    {
      "runNumber": 10,
      "changeType": "baseline",
      "categories": ["major_refactor", "method_added"],
      "confidence": "MEDIUM",
      "explanation": "Rebaselined after significant refactoring - added rotation methods",
      "affectedMethods": ["Node", "rotateLeft", "rotateRight"]
    }
  ]
}
```

### Schema Notes

- **runNumber**: The run where this change appeared (simpler than fromRun/toRun)
- **changeType**: Either "diff" (patch) or "baseline" (full snapshot from rebaselining)
- **categories**: Array of category labels (multiple allowed per change)
- **confidence**: "HIGH", "MEDIUM", or "LOW"
- **explanation**: Human-readable description of what changed
- **affectedMethods**: List of methods/functions touched by this change

---

## Tips for Accurate Labeling

1. **Multiple categories are OK** - If a diff adds a null check AND fixes a base case, include both categories

2. **Consider test results** - If you know which tests started passing after this diff, that helps identify what was fixed

3. **When uncertain, use MEDIUM confidence** - This flags it for review

4. **Handle baselines carefully** - Baselines occur when the logger rebaselines (stores full file). Categorize based on the overall change from previous known state

5. **Note patterns** - Students often make the same type of mistake repeatedly; consistent labeling helps identify this

6. **Cost efficiency** - Batched prompts are ~20-40x cheaper than individual calls. For ~100 runs per student with ~50-100 small diffs, expect ~$0.03-0.08 per student

---

## Workflow for Batched Generation

```
1. Extract all code changes from student's archives/
2. Build single prompt with ALL changes
3. One LLM call → get all diff categories
4. Human review → save as diff_categories.json
5. Pipeline reads during prepare
```
