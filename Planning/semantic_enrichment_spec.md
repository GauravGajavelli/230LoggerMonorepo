# Semantic Enrichment Enhancement Specification

## Overview

This document specifies enhancements to the conceptual struggle detection system to add **semantic enrichment** of the diff/test log. The goal is to move beyond abstract category labels toward narrative understanding of the student's debugging journey.

**Key Change**: Add a second LLM pass after diff categorization that generates semantic descriptions and maintains a rolling narrative context.

---

## Architecture Change

```
CURRENT PIPELINE:
  Diffs → [Batch categorization] → diff_categories.json → [Conceptual analysis]

ENHANCED PIPELINE:
  Diffs → [Batch categorization] → diff_categories.json
                                          ↓
                               [Semantic enrichment pass]
                                          ↓
                               semantic_log (in frontend.json)
                                          ↓
                               [Episode summarization]
                                          ↓
                               [Conceptual analysis]
```

---

## New Data Models

### Add to `frontend.json` schema

```java
// New record: SemanticRunEntry
record SemanticRunEntry(
    int run,
    List<String> diffCategories,        // From existing diff categorization
    String semanticDescription,          // NEW: What this change is doing
    String narrativeContext,             // NEW: How it fits in the journey
    String intent,                       // NEW: "debugging" | "extending" | "refactoring" | "experimenting"
    Map<String, String> errorOutcomes    // Test → brief outcome description
)

// New record: SemanticLog
record SemanticLog(
    List<SemanticRunEntry> entries,
    String currentNarrative,             // Rolling summary of journey so far
    List<String> detectedPatterns        // e.g., "reactive_debugging", "oscillating_fix"
)

// New record: EpisodeSemantics
record EpisodeSemantics(
    String summary,                      // 1-2 sentence episode summary
    String dominantIntent,               // Primary activity type in episode
    List<String> conceptsAddressed,      // What the student worked on
    String progressAssessment            // "productive" | "stuck" | "regressing" | "breakthrough"
)
```

### Modify existing Episode record

```java
// MODIFY: Add semantics field to Episode
record Episode(
    int startRun,
    int endRun,
    // ... existing fields ...
    EpisodeSemantics semantics           // NEW
)
```

### Modify existing TestHistory or top-level frontend.json

```java
// ADD to frontend.json top level (or appropriate container)
{
    // ... existing fields ...
    "semanticLog": SemanticLog,
    "episodes": [Episode with semantics]
}
```

---

## Semantic Enrichment Pass

### When to Run

After diff categorization is complete, before conceptual analysis.

### Batch Formation

Batches should be formed by **token budget**, not fixed run count:

```java
// Pseudocode for batch formation
int TOKEN_BUDGET = 3000;  // Leave room for prompt template + output
List<List<RunDiff>> batches = new ArrayList<>();
List<RunDiff> currentBatch = new ArrayList<>();
int currentTokens = 0;

for (RunDiff diff : allDiffs) {
    int diffTokens = estimateTokens(diff);
    if (currentTokens + diffTokens > TOKEN_BUDGET && !currentBatch.isEmpty()) {
        batches.add(currentBatch);
        currentBatch = new ArrayList<>();
        currentTokens = 0;
    }
    currentBatch.add(diff);
    currentTokens += diffTokens;
}
if (!currentBatch.isEmpty()) batches.add(currentBatch);
```

### Diff Format for LLM

Use a **simplified unified diff format** with context. Standard unified diff is well-understood by LLMs but can be verbose. Recommended format:

```
=== Run 5 → Run 6 ===
Categories: [null_check_added, control_flow_modified]
Tests changed: testInsert (FAILED→FAILED), testContains (PASSED→PASSED)
Error state: testInsert: NullPointerException at BinarySearchTree.java:42

--- BinarySearchTree.java ---
@@ lines 40-48 @@
  public void insert(int value) {
+     if (root == null) {
+         root = new Node(value);
+         return;
+     }
      Node current = root;
      while (current != null) {
          if (value < current.value) {
-             current = current.left;
+             if (current.left == null) {
+                 current.left = new Node(value);
+                 return;
+             }
+             current = current.left;
          }
      }
  }
```

Key principles:
- Include run transition header with categories and test outcomes
- Include current error state for failing tests
- Use standard `+`/`-` diff markers
- Include enough context lines (3-5) for understanding
- Truncate very large diffs with `[... N more lines ...]`

---

## Prompt Templates

### Semantic Enrichment Batch Prompt

```
You are analyzing a student's debugging journey on a programming assignment.

## Context
Assignment: {assignment_name}
This is batch {batch_number} of {total_batches}.

### Story So Far
{narrative_so_far}
(If first batch: "Student is beginning the assignment.")

### Current Test Status
{test_status_summary}
Example: "testInsert: FAILING (NullPointerException), testContains: PASSING, testRemove: FAILING (AssertionError)"

## Diffs in This Batch

{formatted_diffs}

## Your Task

For each run transition, provide:
1. **semantic_description**: One sentence describing what the code change is trying to accomplish
2. **intent**: One of: "debugging" (fixing a bug), "extending" (adding new functionality), "refactoring" (restructuring without behavior change), "experimenting" (exploratory changes)

Then provide:
3. **narrative_update**: 2-3 sentences updating the "story so far" to include this batch. Focus on the student's apparent strategy and understanding.
4. **detected_patterns**: List any struggle patterns you observe:
   - "reactive_debugging": Fixing symptoms one at a time without systematic approach
   - "oscillating_fix": Going back and forth between two approaches
   - "cascade_breakage": Fix causes new failures elsewhere
   - "productive_iteration": Making steady progress
   - "stuck": Repeated similar attempts without progress
   - "breakthrough": Clear evidence of new understanding

## Output Format (JSON)

```json
{
  "runs": [
    {
      "run": <number>,
      "semantic_description": "<description>",
      "intent": "<intent>"
    }
  ],
  "narrative_update": "<updated narrative>",
  "detected_patterns": ["<pattern1>", "<pattern2>"]
}
```

Respond with only the JSON, no additional commentary.
```

### Episode Summarization Prompt

After all semantic enrichment is complete, generate episode-level summaries:

```
You are summarizing episodes in a student's debugging journey.

## Full Semantic Log
{semantic_log_json}

## Episode Boundaries
{episode_boundaries}
Example: "Episode 1: runs 1-12, Episode 2: runs 13-25, Episode 3: runs 26-45"

## Your Task

For each episode, provide:
1. **summary**: 1-2 sentence summary of what happened in this episode
2. **dominant_intent**: The primary activity type ("debugging", "extending", "refactoring", "experimenting")
3. **concepts_addressed**: List of concepts/topics the student worked on (e.g., "null handling", "tree traversal", "base cases")
4. **progress_assessment**: One of:
   - "productive": Making clear progress toward working code
   - "stuck": Little meaningful progress despite effort
   - "regressing": Breaking things that worked before
   - "breakthrough": Clear moment of understanding leading to rapid progress

## Output Format (JSON)

```json
{
  "episodes": [
    {
      "episode_number": 1,
      "summary": "<summary>",
      "dominant_intent": "<intent>",
      "concepts_addressed": ["<concept1>", "<concept2>"],
      "progress_assessment": "<assessment>"
    }
  ]
}
```

Respond with only the JSON, no additional commentary.
```

---

## Integration with Conceptual Analysis

### Modify Phase 2 Input

The conceptual analysis prompt (per-student batched) should now receive:

```
CURRENT INPUT:
- Struggle profiles (scores, categories, error evolution)
- Test histories

ENHANCED INPUT:
- Struggle profiles
- Test histories  
- Semantic log with narrative
- Episode semantics
- Detected patterns across all batches
```

### Conceptual Analysis Can Reference Narrative

Update the conceptual analysis prompt to leverage the narrative:

```
## Student Journey Narrative
{current_narrative}

## Detected Struggle Patterns
{aggregated_patterns}
Example: "reactive_debugging (observed 4 times), oscillating_fix (observed 2 times)"

## Episode Summaries
{episode_semantics}
```

This gives the conceptual analyzer pre-digested semantic understanding rather than having to infer everything from raw categories.

---

## Changes to Existing Documents

### Update `phase_1_planning.md`

**Section "Phase 1 intermediate outputs" - Add new item after item 3:**

```markdown
### 3.5) Semantic enrichment (second LLM pass)

* **SemanticRunEntry (per run with diffs)**
  * semantic_description: what the change is accomplishing
  * narrative_context: how it fits in the journey
  * intent: debugging / extending / refactoring / experimenting
  * error_outcomes: test → outcome summary

* **SemanticLog (per student)**
  * entries: list of SemanticRunEntry
  * currentNarrative: rolling summary of journey
  * detectedPatterns: struggle patterns observed

* **Batch formation**: By token budget (~3000 tokens), not fixed run count
* **Diff format**: Simplified unified diff with context + test outcomes + error state
```

**Section "Episode artifacts" - Modify:**

```markdown
### 3) Episode artifacts (navigation layer)

* **Episode boundaries** (time-gap + focus-window category shift)
* **Episode aggregates**
  * top test categories, top diff categories
  * net test delta vs episode start
  * representative failing tests
* **Episode semantics** (NEW - from semantic enrichment)
  * summary: 1-2 sentence description
  * dominant_intent: primary activity type
  * concepts_addressed: topics worked on
  * progress_assessment: productive / stuck / regressing / breakthrough
```

### Update `conceptual_struggle_detection.md`

**Section "Two-Phase Enhancement" - Modify diagram:**

```markdown
### Three-Phase Enhancement

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Rule-Based Struggle Detection                        │
│  (unchanged)                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1.5: Semantic Enrichment (NEW)                          │
│                                                                 │
│  Per student, after diff categorization:                       │
│  - Generate semantic descriptions per run                      │
│  - Maintain rolling narrative                                  │
│  - Detect struggle patterns                                    │
│  - Generate episode summaries                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: LLM Conceptual Analysis                              │
│                                                                 │
│  (Enhanced with semantic log input)                            │
│  - Identify conceptual gaps                                    │
│  - Detect repeated mistake patterns                            │
│  - Find breakthrough moments                                   │
│  - Characterize learning trajectory                            │
└─────────────────────────────────────────────────────────────────┘
```
```

**Section "Data Requirements" - Add row to table:**

```markdown
| Data Source | Already Available | Notes |
|-------------|------------------|-------|
| Test results per run | Yes | From testRunInfo.json |
| Failure intervals | Yes | From error_detection algorithm |
| Diff categories | Yes | From diff_labeling_prompt.md |
| Test categories | Yes | From test_mapping_prompt.md |
| **Semantic log** | **New** | **From semantic enrichment pass** |
| **Episode semantics** | **New** | **From episode summarization** |
```

**Add new section after "Error Evolution Tracking":**

```markdown
## Semantic Log Structure

The semantic log captures narrative understanding of the debugging journey:

```json
{
  "semanticLog": {
    "entries": [
      {
        "run": 5,
        "diffCategories": ["null_check_added"],
        "semanticDescription": "Added null check for root node before traversal",
        "narrativeContext": "First attempt to address NullPointerException in insert",
        "intent": "debugging",
        "errorOutcomes": {
          "testInsert": "NPE moved from line 42 to line 58"
        }
      }
    ],
    "currentNarrative": "Student is adding null checks reactively as each NPE surfaces, suggesting they don't have a mental model of the full null-flow through their tree traversal.",
    "detectedPatterns": ["reactive_debugging"]
  }
}
```

### Struggle Patterns Vocabulary

| Pattern | Detection Signal | Meaning |
|---------|-----------------|---------|
| `reactive_debugging` | Serial single-point fixes for same error type | Not understanding root cause |
| `oscillating_fix` | Alternating between two approaches | Uncertain about correct solution |
| `cascade_breakage` | Fixes cause new failures | Not understanding dependencies |
| `productive_iteration` | Steady test improvement | Good debugging strategy |
| `stuck` | Repeated similar attempts, no progress | May need help |
| `breakthrough` | Sudden multi-test improvement | Key learning moment |
```

**Section "Cost Summary" - Update:**

```markdown
### Cost Summary (Updated)

| Component | Type | Cost |
|-----------|------|------|
| Test history computation | Code | $0 |
| Failure intervals | Code | $0 |
| Meaningfulness scores | Code | $0 |
| Error evolution tracking | Code | $0 |
| Cross-test correlation | Code | $0 |
| Struggle profile generation | Code | $0 |
| Diff category labeling | LLM | $0.88 |
| **Semantic enrichment** | **LLM** | **~$0.60** |
| **Episode summarization** | **LLM** | **~$0.10** |
| Conceptual analysis | LLM | $0.14 |
| **Total** | | **~$1.72** |

*Semantic enrichment estimate: ~40 batches × $0.015/batch = $0.60*
*Episode summarization: 1 call per student × $0.10 = $0.10*
```

---

## Frontend Changes

### Feedback Panel Enhancement

The existing feedback panel layout should be extended to show semantic context:

```
┌─────────────────────────────────────────────────────────────────┐
│ FeedbackPanel (when you click a failing test)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stack Trace          │  AI Feedback                           │
│  ─────────────        │  ──────────────────────────────────    │
│  NullPointerException │  Pattern: Reactive debugging           │
│  at BST.insert:42     │  (High confidence)                     │
│  ...                  │                                        │
│                       │  What's happening:                     │
│                       │  "You're adding null checks one at a   │
│                       │   time as each NPE appears. Consider   │
│                       │   tracing all paths through insert()   │
│                       │   to find all null cases at once."     │
│  ─────────────────────│                                        │
│  Journey Context (NEW)│  Breakthrough moment:                  │
│  ─────────────────────│  "Run 34: recursion_fixed - you        │
│  "This is your 5th    │   realized the base case was wrong"    │
│   attempt to fix null │                                        │
│   handling. Previous  │  Next steps:                           │
│   attempts at runs    │  1. Review all recursive calls         │
│   8, 12, 18, 23..."   │  2. Add null checks systematically     │
│                       │                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Episode View Enhancement

Episodes should display their semantic summary:

```
┌─────────────────────────────────────────────────────────────────┐
│ Episode 2: Runs 13-25                          [Expand/Collapse]│
├─────────────────────────────────────────────────────────────────┤
│ Summary: Focused on fixing tree traversal, struggled with       │
│          null handling at leaf nodes                            │
│ Progress: stuck                                                 │
│ Concepts: null handling, tree traversal                         │
│ ────────────────────────────────────────────────────────────    │
│ [Run timeline visualization]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Data models**: Add new record types (SemanticRunEntry, SemanticLog, EpisodeSemantics)
2. **Batch formation**: Implement token-budget batching for semantic enrichment
3. **Diff formatter**: Create utility to format diffs for LLM consumption
4. **Semantic enrichment service**: Implement LLM calls with rolling narrative
5. **Episode summarization**: Implement post-enrichment episode summary generation
6. **Integration**: Wire into PrepareService after diff categorization
7. **Output format**: Update frontend.json schema to include semantic log
8. **Conceptual analysis update**: Modify prompts to use semantic context
9. **Frontend**: Update feedback panel and episode view

---

## Testing Checklist

- [ ] Batch formation respects token budget
- [ ] Rolling narrative updates correctly across batches
- [ ] Detected patterns are consistent with visible behavior
- [ ] Episode summaries are coherent and accurate
- [ ] Semantic log appears correctly in frontend.json
- [ ] Conceptual analysis leverages semantic context
- [ ] Cost per class stays under $2.00
