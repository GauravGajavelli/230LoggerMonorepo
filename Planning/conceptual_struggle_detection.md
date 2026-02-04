# Conceptual Struggle Detection Plan

## Overview

Enhance the error detection system to identify **conceptual struggles** during a student's debugging journey, not just terminal failures. By combining diff categories (what students changed) with test categories (what they affected), we can detect deeper learning patterns.

---

## Problem Statement

### Current System Captures
- Lingering failures (still broken at end)
- Regressions (broke something that worked)
- Recurring failures (fixed → broke → fixed)
- Costly detours (by run count/time)

### Current System Misses
- **Journey struggles**: Test eventually passes, but took 20 attempts
- **Conceptual patterns**: Student repeatedly makes same type of mistake
- **Cross-test struggles**: Null handling issues in insert AND delete AND contains
- **Root cause identification**: Why did it take so long to fix?
- **Breakthrough moments**: What finally clicked?

### Key Insight
> The hardest learning often happens on the path to success, not just in terminal failures.

A test that fails for 15 runs then passes represents significant struggle—but the current system treats it as "resolved" and may not surface it.

---

## Proposed Solution

### Two-Phase Enhancement

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Rule-Based Struggle Detection                        │
│                                                                 │
│  For each resolved failure interval:                           │
│  - Count attempts to fix                                       │
│  - Identify diff categories tried                              │
│  - Find related tests affected                                 │
│  - Calculate struggle score                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: LLM Conceptual Analysis                              │
│                                                                 │
│  Per student (batched):                                        │
│  - Identify conceptual gaps                                    │
│  - Detect repeated mistake patterns                            │
│  - Find breakthrough moments                                   │
│  - Characterize learning trajectory                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Requirements

### Inputs

| Data Source | Already Available | Notes |
|-------------|------------------|-------|
| Test results per run | Yes | From testRunInfo.json |
| Failure intervals | Yes | From error_detection algorithm |
| Diff categories | **New** | From diff_labeling_prompt.md |
| Test categories | **New** | From test_mapping_prompt.md |

### Required Files Per Assignment

```
Pipeline/testInputs/test_diff_categories/{Assignment}/
├── test_categories.json      # Test → category mapping
└── (diff_categories.json)    # Generated per student during prepare
```

---

## Stack Trace Integration (Implemented)

### Data Flow

Full stack traces now flow through the entire pipeline:

```
EnrichedTestResult.stackTrace()
        │
        ▼
DataTransformer.transformTestResult()
        │ Pass stackTrace to tracker
        ▼
StatusChangeTracker.recordTest(..., stackTrace)
        │ Store in ErrorInfo record
        ▼
StatusChangeTracker.getErrorHistory()
        │ Return [exceptionType, message, stackTrace]
        ▼
ErrorEvolutionTracker.recordError(..., stackTrace)
        │ Store for each failing run
        ▼
ErrorSnapshot(run, errorType, message, stackTrace)
        │
        ▼
ErrorEvolution in frontend.json
```

### Files Modified
| File | Change |
|------|--------|
| `ErrorEvolution.java` | Added `stackTrace` to `ErrorSnapshot` record |
| `StatusChangeTracker.java` | Added `stackTrace` to `ErrorInfo` and methods |
| `DataTransformer.java` | Pass `enriched.stackTrace()` to tracker |
| `ErrorEvolutionTracker.java` | Store and pass through `stackTrace` |
| `PrepareService.java` | Wire stack traces through enhance method |

### Available Data

The `testRunInfo.json` already contains rich error information for each failure:

```json
"testAnagram6()" : {
  "7" : "FAILED: java.lang.NullPointerException: Cannot invoke \"java.lang.Integer.intValue()\" because the return value of \"java.util.HashMap.get(Object)\" is null",
  "8" : "FAILED: org.opentest4j.AssertionFailedError: expected: <true> but was: <false>",
  "9" : "SUCCESSFUL"
}
```

### Error Type Classification

Extract and classify errors into categories that inform conceptual analysis:

| Error Type | Pattern | Conceptual Signal |
|------------|---------|-------------------|
| **NullPointerException** | `java.lang.NullPointerException` | Missing null checks, uninitialized references |
| **AssertionError (boolean)** | `expected: <true> but was: <false>` | Logic error, wrong condition |
| **AssertionError (value)** | `expected: <5> but was: <3>` | Off-by-one, wrong calculation |
| **AssertionError (object)** | `expected: <[1,2,3]> but was: <[1,3,2]>` | Ordering issue, traversal error |
| **IndexOutOfBounds** | `IndexOutOfBoundsException` | Loop bounds, array sizing |
| **ClassCastException** | `ClassCastException` | Type handling, generics |
| **StackOverflow** | `StackOverflowError` | Missing base case, infinite recursion |
| **ConcurrentModification** | `ConcurrentModificationException` | Iterator invalidation |
| **Timeout/Infinite Loop** | `ABORTED` or timeout | Infinite loop, efficiency issue |

### Error Evolution Tracking

Track how errors change across runs for the same test:

```json
{
  "test_id": "BSTTesting#testContains",
  "error_evolution": [
    {
      "run": 3,
      "type": "NullPointerException",
      "message": "Cannot invoke... current is null",
      "stackTrace": "java.lang.NullPointerException: Cannot invoke...\n\tat BinarySearchTree.contains(BinarySearchTree.java:45)\n\tat BSTTesting.testContains(BSTTesting.java:78)"
    },
    {
      "run": 5,
      "type": "NullPointerException",
      "message": "Cannot invoke... left is null",
      "stackTrace": "java.lang.NullPointerException: Cannot invoke...\n\tat BinarySearchTree.contains(BinarySearchTree.java:52)\n\tat BSTTesting.testContains(BSTTesting.java:78)"
    },
    {
      "run": 8,
      "type": "AssertionError",
      "message": "expected: <true> but was: <false>",
      "stackTrace": "org.opentest4j.AssertionFailedError: expected: <true>...\n\tat BSTTesting.testContains(BSTTesting.java:82)"
    },
    {"run": 12, "type": "AssertionError", "message": "expected: <false> but was: <true>", "stackTrace": "..."},
    {"run": 15, "type": "SUCCESSFUL", "message": null, "stackTrace": null}
  ],
  "error_transitions": [
    {"from": "NullPointerException", "to": "NullPointerException", "run": 5, "insight": "Fixed one NPE at line 45, revealed another at line 52"},
    {"from": "NullPointerException", "to": "AssertionError", "run": 8, "insight": "Null handling fixed, logic still wrong"},
    {"from": "AssertionError", "to": "AssertionError", "run": 12, "insight": "Flipped logic, still incorrect"},
    {"from": "AssertionError", "to": "SUCCESSFUL", "run": 15, "insight": "Logic corrected"}
  ]
}
```

**Key Insight**: The full stack trace reveals that the NPE at run 3 was at line 45, while the NPE at run 5 was at line 52. This shows the student is fixing null checks **reactively** (one at a time) rather than understanding the full null flow.

### Error Pattern Detection

| Pattern | Detection | Meaning |
|---------|-----------|---------|
| **NPE → NPE → NPE** | Same exception type, different locations (via stackTrace) | Reactive null handling, not systematic |
| **NPE → AssertionError** | Exception type changes | Fixed crash, now logic error |
| **AssertionError flip** | `true→false` becomes `false→true` | Overcorrected, doesn't understand condition |
| **StackOverflow** | Any occurrence | Missing/wrong base case |
| **Same error 5+ runs** | Identical error message | Stuck, not understanding feedback |

*Note: Full stack traces are now stored in `ErrorSnapshot.stackTrace`, enabling location-based pattern detection.*

### Enhanced Struggle Profile with Errors

```json
{
  "test_id": "BSTTesting#testContains",
  "start_run": 3,
  "end_run": 14,
  "resolved": true,
  "resolution_run": 15,

  "struggle_profile": {
    "attempts_to_fix": 12,
    "diff_categories_tried": [...],

    "error_analysis": {
      "distinct_error_types": ["NullPointerException", "AssertionError"],
      "error_sequence": [
        {"run": 3, "type": "NPE", "location": "contains:line 45"},
        {"run": 5, "type": "NPE", "location": "contains:line 52"},
        {"run": 8, "type": "AssertionError", "expected": "true", "actual": "false"},
        {"run": 12, "type": "AssertionError", "expected": "false", "actual": "true"}
      ],
      "error_transitions": 3,
      "stuck_on_same_error": 0,
      "error_progression": "NPE→NPE→AssertionError→AssertionError→SUCCESS",
      "interpretation": "Fixed null handling (2 attempts), then fixed logic (2 attempts)"
    },

    "struggle_score": 68
  }
}
```

### Updated Struggle Score Formula

```
struggle_score =
    25 * log2(attempts_to_fix + 1)
  + 20 * min(distinct_strategies, 5)
  + 15 * repeated_mistake_count
  + 10 * related_tests_struggling
  + 10 * (1 if resolved_in_last_10% else 0)
  + 15 * (1 if had_StackOverflowError else 0)      // NEW: Recursion issues
  + 10 * error_type_transitions                    // NEW: More transitions = more confusion
  + 20 * (stuck_on_same_error >= 5 ? 1 : 0)        // NEW: Not learning from error
  - 30 * (1 if linear_progress else 0)
  - 10 * (1 if NPE_to_success_in_2_runs else 0)    // NEW: Quick NPE fix = understood it
```

### Algorithm: Error Parser

```python
def parse_error_message(error_string: str) -> ErrorInfo:
    """
    Parse error message from testRunInfo.json into structured data.

    Examples:
      "FAILED: java.lang.NullPointerException: Cannot invoke \"foo\" because \"bar\" is null"
      "FAILED: org.opentest4j.AssertionFailedError: expected: <true> but was: <false>"
      "SUCCESSFUL"
      "ABORTED"
    """
    if error_string == "SUCCESSFUL":
        return ErrorInfo(type="SUCCESS", message=None)

    if error_string == "ABORTED":
        return ErrorInfo(type="ABORTED", message="Test aborted (timeout or crash)")

    if not error_string.startswith("FAILED:"):
        return ErrorInfo(type="UNKNOWN", message=error_string)

    # Extract exception class and message
    match = re.match(r"FAILED: ([\w.]+): (.+)", error_string)
    if match:
        exception_class = match.group(1).split(".")[-1]  # e.g., "NullPointerException"
        message = match.group(2)

        # Extract expected/actual for assertions
        assertion_match = re.search(r"expected: <(.+?)> but was: <(.+?)>", message)
        if assertion_match:
            return ErrorInfo(
                type="AssertionError",
                expected=assertion_match.group(1),
                actual=assertion_match.group(2),
                message=message
            )

        return ErrorInfo(type=exception_class, message=message)

    return ErrorInfo(type="PARSE_ERROR", message=error_string)


def analyze_error_evolution(test_results: Dict[int, str]) -> ErrorEvolution:
    """
    Analyze how errors change across runs for a single test.
    """
    evolution = ErrorEvolution()
    prev_error = None

    for run in sorted(test_results.keys()):
        error = parse_error_message(test_results[run])
        evolution.sequence.append({"run": run, "error": error})

        if prev_error and prev_error.type != error.type:
            evolution.transitions.append({
                "from": prev_error.type,
                "to": error.type,
                "run": run
            })

        prev_error = error

    # Detect patterns
    evolution.had_stack_overflow = any(e["error"].type == "StackOverflowError" for e in evolution.sequence)
    evolution.stuck_count = max_consecutive_same_error(evolution.sequence)
    evolution.npe_count = sum(1 for e in evolution.sequence if e["error"].type == "NullPointerException")

    return evolution
```

### LLM Input Enhancement

Include error information in the LLM prompt for richer analysis:

```json
{
  "significant_struggles": [
    {
      "test": "BSTTesting#testContains",
      "runs_failing": "3-14",
      "attempts": 12,
      "strategies_tried": ["null_check_added", "comparison_operator_fixed"],

      "error_summary": {
        "progression": "NPE → NPE → AssertionError → AssertionError → SUCCESS",
        "npe_count": 2,
        "assertion_flip": true,
        "had_stackoverflow": false,
        "key_errors": [
          {"run": 3, "error": "NullPointerException: current is null"},
          {"run": 8, "error": "AssertionError: expected <true> was <false>"},
          {"run": 12, "error": "AssertionError: expected <false> was <true>"}
        ]
      }
    }
  ]
}
```

### Pedagogical Insights from Errors

| Error Pattern | What It Reveals | Recommended Feedback |
|---------------|-----------------|---------------------|
| Multiple NPEs in same method | Not tracing null flow | "Draw the object graph - where can nulls come from?" |
| NPE → AssertionError | Fixed crash, logic wrong | "Good progress! Now focus on the algorithm logic" |
| AssertionError flip | Overcorrected | "Your condition is inverted - trace through a simple example" |
| StackOverflowError | Recursion base case | "What's your stopping condition? When should recursion end?" |
| Same error 5+ times | Not learning from feedback | "Try adding print statements to see what values you have" |
| expected `[1,2,3]` got `[1,3,2]` | Traversal order wrong | "Check your traversal order - are you going left-root-right?" |

### Token Cost Impact

Adding error summaries increases input size slightly:

| Component | Without Errors | With Errors | Increase |
|-----------|---------------|-------------|----------|
| Per struggle interval | ~200 tokens | ~350 tokens | +75% |
| Per student (10 struggles) | ~2K tokens | ~3.5K tokens | +75% |
| 45 students | 90K tokens | 157K tokens | +75% |
| **Cost increase (GPT-4o-mini)** | $0.11 | $0.19 | **+$0.08** |

This is a worthwhile investment for significantly richer analysis.

---

## Phase 1: Rule-Based Struggle Detection

### Enhanced Interval Object

```json
{
  "test_id": "BSTTesting#testContains",
  "start_run": 3,
  "end_run": 18,
  "resolved": true,
  "resolution_run": 19,

  "effort": {
    "runs_while_failing": 16,
    "time_ms": 420000
  },

  "struggle_profile": {
    "attempts_to_fix": 16,
    "distinct_fix_strategies": 5,
    "diff_categories_tried": [
      {"category": "null_check_added", "count": 3, "runs": [5, 9, 14]},
      {"category": "comparison_operator_fixed", "count": 2, "runs": [7, 11]},
      {"category": "base_case_fixed", "count": 1, "runs": [19]}
    ],
    "winning_fix": {
      "category": "base_case_fixed",
      "run": 19
    },
    "related_tests_affected": [
      {"test": "BSTTesting#testContainsStrings", "correlation": 0.85},
      {"test": "BSTTesting#testIsEmpty", "correlation": 0.45}
    ],
    "test_category": "search_contains",
    "struggle_score": 78
  }
}
```

### Struggle Score Formula

```
struggle_score =
    25 * log2(attempts_to_fix + 1)      // More attempts = harder (0-50 range)
  + 20 * min(distinct_strategies, 5)    // Tried many things = confused (0-100)
  + 15 * repeated_mistake_count         // Same diff category 3+ times (0-45)
  + 10 * related_tests_struggling       // Category-wide issue (0-30)
  + 10 * (1 if resolved_in_last_10% else 0)  // Barely made it (0-10)
  - 30 * (1 if linear_progress else 0)  // Steady progress = learning (penalty)

// Normalized to 0-100 scale
```

**Interpretation:**
| Score | Meaning |
|-------|---------|
| 70-100 | Significant conceptual struggle |
| 40-69 | Moderate difficulty |
| 20-39 | Normal debugging |
| 0-19 | Quick fix |

### Struggle Pattern Types

| Pattern | Detection Rule | Pedagogical Meaning |
|---------|---------------|---------------------|
| **Prolonged Fix** | `attempts_to_fix >= 10` | Fundamental misunderstanding |
| **Whack-a-Mole** | Fix test A → break test B in same category | Incomplete mental model |
| **Repeated Mistake** | Same diff category appears 3+ times | Concept not internalized |
| **Concept Blindspot** | Multiple tests in same category struggle | Category-level gap |
| **Cascading Fix** | One fix resolves 3+ tests | Found root cause |
| **Near Miss** | Resolved in last 10% of session | Time pressure struggle |

### Algorithm: Struggle Analyzer

```python
def analyze_struggle(interval, diff_categories, test_categories, all_runs):
    """
    Analyze a resolved failure interval for struggle patterns.

    Args:
        interval: FailureInterval with start_run, end_run, resolution_run
        diff_categories: Dict[run_number, List[DiffCategory]]
        test_categories: Dict[test_id, List[category]]
        all_runs: List of all runs for correlation analysis

    Returns:
        StruggleProfile
    """
    profile = StruggleProfile()

    # Count attempts and strategies
    profile.attempts_to_fix = interval.end_run - interval.start_run + 1

    categories_tried = defaultdict(list)
    for run in range(interval.start_run, interval.resolution_run + 1):
        for cat in diff_categories.get(run, []):
            categories_tried[cat].append(run)

    profile.distinct_fix_strategies = len(categories_tried)
    profile.diff_categories_tried = [
        {"category": cat, "count": len(runs), "runs": runs}
        for cat, runs in categories_tried.items()
    ]

    # Identify winning fix
    resolution_diffs = diff_categories.get(interval.resolution_run, [])
    if resolution_diffs:
        profile.winning_fix = {
            "category": resolution_diffs[0],  # Primary category
            "run": interval.resolution_run
        }

    # Find related tests (same test category)
    test_cat = test_categories.get(interval.test_id, [])
    related = find_tests_in_categories(test_cat, test_categories)
    profile.related_tests_affected = compute_correlation(
        interval.test_id, related, all_runs
    )

    # Detect repeated mistakes
    profile.repeated_mistakes = [
        cat for cat, runs in categories_tried.items()
        if len(runs) >= 3
    ]

    # Calculate score
    profile.struggle_score = calculate_struggle_score(profile, interval, all_runs)

    return profile
```

---

## Phase 2: LLM Conceptual Analysis

### When to Run
- After Phase 1 completes for all intervals
- Once per student (batched)
- Can be run asynchronously / in background

### Input Preparation

```python
def prepare_llm_input(student_id, intervals, diff_categories, test_categories):
    """
    Prepare condensed input for LLM analysis.
    Only include transitions and high-signal data.
    """
    condensed = {
        "student_id": student_id,
        "total_runs": len(all_runs),
        "assignment": "BinarySearchTree",

        # Only include intervals with struggle_score > 30
        "significant_struggles": [
            {
                "test": i.test_id,
                "test_category": test_categories.get(i.test_id),
                "runs_failing": f"{i.start_run}-{i.end_run}",
                "resolved": i.resolved,
                "attempts": i.struggle_profile.attempts_to_fix,
                "strategies_tried": i.struggle_profile.diff_categories_tried,
                "winning_fix": i.struggle_profile.winning_fix,
                "struggle_score": i.struggle_profile.struggle_score
            }
            for i in intervals
            if i.struggle_profile.struggle_score > 30
        ],

        # Aggregate patterns
        "diff_category_totals": aggregate_diff_categories(diff_categories),
        "test_category_outcomes": summarize_by_test_category(intervals, test_categories),

        # Timeline summary (not full details)
        "session_timeline": [
            {"run": r, "tests_passing": count_passing(r), "tests_failing": count_failing(r)}
            for r in milestone_runs(all_runs)  # Every 10th run + key transitions
        ]
    }
    return condensed
```

### LLM Prompt

```markdown
You are analyzing a student's debugging journey on a Binary Search Tree assignment for CSSE 230.

## Assignment Context
Students implement: insert, contains, remove, size, height, isEmpty, toArray, toArrayList, toString, and three iterators (inefficient, preOrder, inOrder).

## Test Categories
- basic_insert: Adding elements to the tree
- search_contains: Finding elements using contains()
- deletion: Removing elements while maintaining BST property
- tree_properties: size, height, isEmpty queries
- conversion: toArray, toArrayList, toString
- iterators: Tree traversal via iterators
- edge_cases: Exception handling and null checks
- efficiency: Performance requirements

## Diff Categories (what students typically change)
- null_check_added/fixed: Null safety modifications
- base_case_added/fixed: Recursion termination conditions
- comparison_operator_fixed: <, >, <=, >=, == changes
- recursion_fixed: Recursive call corrections
- return_value_fixed: Changed method return values
- logic_error_fixed: General logic corrections
- control_flow_changed: if/else/loop structure changes

## Error Types (from stack traces)
- NullPointerException: Missing null checks, uninitialized references
- AssertionError (boolean flip): Logic error, wrong condition
- AssertionError (value mismatch): Off-by-one, wrong calculation
- AssertionError (collection order): Traversal order wrong
- StackOverflowError: Missing base case, infinite recursion
- IndexOutOfBoundsException: Loop bounds, array sizing
- ConcurrentModificationException: Iterator invalidation during modification

## Student Data

{student_data_json}

## Analysis Tasks

Based on the struggle data above, identify:

### 1. Conceptual Gaps
What CS concepts did this student struggle with? Look for:
- Repeated use of same diff category without success
- Multiple tests in same category failing together
- Long intervals before resolution
- **Error patterns**: Multiple NPEs suggests null handling gap; StackOverflow suggests recursion gap
- **Error evolution**: NPE→NPE→NPE means reactive fixing; NPE→AssertionError means progress

### 2. Repeated Mistakes
What mistakes did they make multiple times? Especially:
- Same diff category appearing 3+ times
- Fixes that broke other tests
- Patterns suggesting incomplete mental model

### 3. Breakthrough Moments
When did something finally "click"? Look for:
- A single fix that resolved multiple tests
- Sudden drop in failure count
- Change in fix strategy that worked

### 4. Learning Trajectory
How did their debugging approach evolve?
- Early: random changes vs. targeted fixes
- Late: more systematic or still trial-and-error
- Overall: improving, stagnant, or regressing

## Output Format

Return JSON:
{
  "conceptual_gaps": [
    {
      "concept": "string - e.g., 'recursion_base_cases'",
      "evidence": "string - specific observations from the data",
      "error_evidence": "string - what stack traces/errors revealed about this gap",
      "tests_affected": ["test1", "test2"],
      "severity": "high|medium|low",
      "recommendation": "string - what to review"
    }
  ],
  "repeated_mistakes": [
    {
      "pattern": "string - description of the mistake",
      "occurrences": 4,
      "runs": [5, 12, 23, 31],
      "diff_category": "null_check_added",
      "error_type": "NullPointerException",
      "insight": "string - why they might be making this mistake"
    }
  ],
  "error_pattern_insights": [
    {
      "pattern": "string - e.g., 'NPE → AssertionError transition'",
      "tests": ["test1", "test2"],
      "interpretation": "string - what this error evolution reveals"
    }
  ],
  "breakthrough_moments": [
    {
      "run": 47,
      "description": "string - what happened",
      "tests_fixed": ["test1", "test2"],
      "key_insight": "string - what they likely learned"
    }
  ],
  "learning_trajectory": {
    "early_phase": "string - description of runs 1-33",
    "mid_phase": "string - description of runs 34-66",
    "late_phase": "string - description of runs 67-100",
    "overall_pattern": "improving|stagnant|variable|regressing",
    "debugging_sophistication": "trial_and_error|semi_systematic|systematic"
  },
  "instructor_summary": "string - 2-3 sentence summary for instructor",
  "student_feedback": "string - encouraging, specific feedback for student"
}
```

### Output Example

```json
{
  "conceptual_gaps": [
    {
      "concept": "recursion_base_cases",
      "evidence": "Added/fixed base cases 6 times across insert (runs 5,12), contains (runs 18,23), and remove (runs 45,52). Each time resolved temporarily then similar issue appeared in different method.",
      "tests_affected": ["testInsertInts", "testContainsInts", "testRemove", "testRemoveAdvanced"],
      "severity": "high",
      "recommendation": "Review recursive tree traversal patterns - when to check for null vs when to recurse"
    },
    {
      "concept": "bst_ordering_property",
      "evidence": "Changed comparison operators 4 times in contains method before getting correct < vs <= distinction",
      "tests_affected": ["testContainsInts", "testContainsStrings"],
      "severity": "medium",
      "recommendation": "Practice BST property: left < current < right, with attention to equality handling"
    }
  ],
  "repeated_mistakes": [
    {
      "pattern": "Adding null checks reactively rather than understanding null flow",
      "occurrences": 5,
      "runs": [8, 15, 27, 38, 56],
      "diff_category": "null_check_added",
      "error_evidence": "NullPointerException appeared 5 times in different locations before student started checking systematically",
      "insight": "Student adds null checks when NullPointerException occurs but doesn't trace why null appears - treating symptom not cause"
    }
  ],
  "error_pattern_insights": [
    {
      "pattern": "NPE → AssertionError transition",
      "tests": ["testContains", "testInsert"],
      "interpretation": "Student successfully moved past null handling to logic errors - good progress signal"
    },
    {
      "pattern": "AssertionError flip (true↔false)",
      "tests": ["testContainsStrings"],
      "runs": [23, 25],
      "interpretation": "Student overcorrected comparison logic - doesn't fully understand BST ordering"
    }
  ],
  "breakthrough_moments": [
    {
      "run": 67,
      "description": "Changed recursive structure in remove() to handle three cases explicitly",
      "tests_fixed": ["testRemove", "testRemoveAdvanced", "testRemoveReturnValue"],
      "key_insight": "Realized remove needs separate logic for: no children, one child, two children"
    }
  ],
  "learning_trajectory": {
    "early_phase": "Trial and error - making changes and running tests without clear hypothesis",
    "mid_phase": "Started grouping related fixes - fixing insert fully before moving to contains",
    "late_phase": "More systematic - used test failures to guide which method to focus on",
    "overall_pattern": "improving",
    "debugging_sophistication": "semi_systematic"
  },
  "instructor_summary": "Student showed significant struggle with recursion base cases, making similar mistakes across insert, contains, and remove. By session end, demonstrated improved systematic debugging but would benefit from explicit recursion pattern review.",
  "student_feedback": "You made great progress! Your biggest breakthrough was in run 67 when you restructured the remove method. For future tree problems, try drawing out the recursive calls before coding - this can help catch base case issues earlier."
}
```

---

## Cost Estimate

### Assumptions
- 45 students
- 100 runs per student
- BinarySearchTree assignment (22 graded tests)
- 5-way split for diff labeling (from previous analysis)

### Phase 1: Diff Labeling (already planned)

| Item | Calculation | Cost |
|------|-------------|------|
| Tokens per student | ~95K (100 runs) | |
| Total tokens | 45 × 95K = 4.275M | |
| **GPT-4o-mini** | 4.275M × $0.15/1M + 0.4M × $0.60/1M | **$0.88** |
| **Claude Haiku** | 4.275M × $0.80/1M + 0.4M × $4/1M | **$5.02** |
| **Gemini Flash** | 4.275M × $0.075/1M + 0.4M × $0.30/1M | **$0.44** |

### Phase 2: Conceptual Struggle Analysis (with stack traces)

| Item | Calculation | Cost |
|------|-------------|------|
| Input per student | ~12K tokens (with error data) | |
| Output per student | ~2K tokens | |
| Total input | 45 × 12K = 540K | |
| Total output | 45 × 2K = 90K | |
| **GPT-4o-mini** | 540K × $0.15/1M + 90K × $0.60/1M | **$0.14** |
| **Claude Haiku** | 540K × $0.80/1M + 90K × $4/1M | **$0.79** |
| **Gemini Flash** | 540K × $0.075/1M + 90K × $0.30/1M | **$0.07** |

*Note: Including stack trace/error evolution data increases input by ~50% but provides significantly richer analysis.*

### Total Cost Summary

| Provider | Diff Labeling | Struggle Analysis | **Total** |
|----------|--------------|-------------------|-----------|
| **GPT-4o-mini** | $0.88 | $0.14 | **$1.02** |
| **Claude Haiku** | $5.02 | $0.79 | **$5.81** |
| **Gemini Flash** | $0.44 | $0.07 | **$0.51** |

### Processing Time (with parallelization)

| Phase | Requests | At Tier 2 Rates | Time |
|-------|----------|-----------------|------|
| Diff labeling (5-split) | 225 | OpenAI: 5000 RPM | ~3 min |
| Struggle analysis | 45 | OpenAI: 5000 RPM | <1 min |
| **Total** | 270 | | **~4 min** |

---

## Implementation Plan

### Step 1: Extend Prepare Pipeline
**Files to modify:**
- `PrepareService.java` - Add struggle analysis after interval detection
- `DataTransformer.java` - Add struggle profile to output model

**New classes:**
- `StruggleAnalyzer.java` - Phase 1 rule-based analysis
- `StruggleProfile.java` - Data model for struggle metrics

**Effort:** ~2-3 days

### Step 2: Add LLM Integration
**New components:**
- `ConceptualAnalysisService.java` - LLM API calls
- `LLMPromptBuilder.java` - Build prompts from struggle data
- `ConceptualAnalysisResult.java` - Parse LLM output

**Configuration:**
- Add LLM provider selection (OpenAI/Anthropic/Google)
- Add API key configuration
- Add rate limiting / retry logic

**Effort:** ~3-4 days

### Step 3: Update Output Format
**Modify:**
- `prepare_output.json` schema to include struggle profiles
- Frontend to display conceptual gaps and breakthroughs
- Episode view to show struggle timeline

**Effort:** ~2-3 days

### Step 4: Testing & Validation
- Test with run54.tar sample data
- Validate LLM outputs are pedagogically useful
- Tune struggle score thresholds
- Test rate limiting and error handling

**Effort:** ~2-3 days

### Total Implementation Effort
**~10-13 days** for full implementation

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Struggle detection accuracy | >80% | Manual review of 10 students |
| Conceptual gap relevance | >75% useful | Instructor survey |
| Processing time | <5 min for 45 students | Automated timing |
| Cost per class | <$6 | API billing |
| False positive rate | <20% | Flagged struggles that weren't real |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM hallucinations | Incorrect conceptual analysis | Require evidence citations; human review |
| Redacted code limits understanding | Poor diff categorization | Use test outcomes as ground truth |
| Rate limiting | Slow processing | Implement backoff; use cheaper models |
| Cost overruns | Budget issues | Set hard limits; alert on anomalies |
| Student privacy | Data exposure | Process locally; don't send identifiers to LLM |

---

## Future Enhancements

### Phase 3 (Future)
- **Cohort analysis**: Compare struggle patterns across students
- **Predictive flagging**: Identify at-risk students mid-assignment
- **Adaptive hints**: Generate targeted hints based on detected gaps
- **Instructor dashboard**: Aggregate class-wide conceptual gaps

### Phase 4 (Future)
- **Cross-assignment learning**: Track conceptual growth across semester
- **Personalized review**: Generate custom review materials per student
- **Integration with LMS**: Push insights to Canvas/Moodle

---

## Appendix: Sample Struggle Timeline Visualization

```
Test: BSTTesting#testRemove
Runs: 1 ──────────────────────────────────────────────────────── 100

Status:     ░░░░████████████████████████████░░░░░░░░░░░░░░░░░░░░░
            │   │                           │
           Pass Fail (run 5)               Pass (run 34)

Diff categories tried:
  Run  5: null_check_added        ❌ Still failing
  Run  8: null_check_added        ❌ Still failing
  Run 12: comparison_operator_fixed ❌ Still failing
  Run 18: return_value_fixed      ❌ Still failing
  Run 23: base_case_added         ❌ Still failing
  Run 34: recursion_fixed         ✅ RESOLVED

Struggle Score: 72 (High)
Related struggles: testRemoveAdvanced (correlation: 0.91)
Conceptual gap: recursion_base_cases
```

---

## Pipeline Data Integration (Implemented)

This section documents what data is already computed by the Pipeline and how the conceptual struggle detection leverages it.

### Data Already Available in Pipeline

#### From EnrichedTestResult (enriched_runs/)
| Field | Type | Struggle Detection Use |
|-------|------|----------------------|
| `stackTrace` | String | Full exception trace for error classification |
| `exceptionType` | String | NPE vs AssertionError vs StackOverflow classification |
| `message` | String | Error details, expected/actual extraction |
| `expected` | String | What test expected |
| `actual` | String | What code produced |
| `durationMs` | Long | Timeout/efficiency detection |

#### From TestHistory (frontend.json)
| Field | Type | Struggle Detection Use |
|-------|------|----------------------|
| `statusByRun` | Map<Int, String> | Complete timeline of pass/fail transitions |
| `failureIntervals` | List<FailureInterval> | Pre-computed struggle periods |
| `isLingeringFailure` | Boolean | Unresolved issues flag |
| `isRegression` | Boolean | Broke previously working code |
| `recursCount` | Int | How many times test failed separately |
| `flipsWithin` | Int | Pass/fail oscillation count |
| `totalFailedRuns` | Int | Total effort spent failing |
| `meaningfulnessScore` | Double | Base struggle score |
| `highlightCategory` | String | stillFailing / regression / costlyDetour |
| `categories` | List<String> | Test category for cross-test correlation |
| `errorEvolution` | ErrorEvolution | **NEW**: How errors changed across runs |
| `struggleProfile` | StruggleProfile | **NEW**: Enhanced struggle analysis |

### New Data Model Classes (Implemented)

#### ErrorEvolution
Tracks how error types evolve across runs for a single test:
```java
record ErrorEvolution(
    List<ErrorSnapshot> sequence,      // Error at each failing run
    List<ErrorTransition> transitions, // When error type changed
    boolean hadStackOverflow,          // Recursion issue signal
    int stuckOnSameError,              // Consecutive runs with identical error
    int npeCount,                      // Total NullPointerExceptions
    String progressionSummary          // "NPE→NPE→AssertionError→SUCCESS"
)

record ErrorSnapshot(int run, String errorType, String message, String stackTrace)
record ErrorTransition(int fromRun, int toRun, String fromType, String toType)
```

#### StruggleProfile
Enhanced struggle profile combining multiple signals:
```java
record StruggleProfile(
    int attemptsToFix,                         // Total runs spent trying to fix
    int distinctStrategies,                    // Number of different approaches tried
    List<DiffCategoryCount> strategiesTried,   // What code change patterns were attempted
    DiffCategoryCount winningFix,              // What finally worked
    List<TestCorrelation> relatedTests,        // Tests that fail together
    double struggleScore,                      // Enhanced score combining all signals
    ErrorEvolution errorEvolution              // How errors evolved during struggle
)
```

### New Pipeline Components (Implemented)

| Component | Location | Purpose |
|-----------|----------|---------|
| `ErrorEvolution.java` | model/frontend/ | Data model for error tracking |
| `StruggleProfile.java` | model/frontend/ | Data model for struggle analysis |
| `ErrorEvolutionTracker.java` | prepare/ | Tracks error types across runs |
| `CrossTestCorrelator.java` | prepare/ | Computes test failure correlations |
| `StruggleProfileGenerator.java` | prepare/ | Generates enhanced struggle profiles |

### Cost Summary (Updated)

| Component | Already Done | New Cost |
|-----------|--------------|----------|
| Test history computation | ✅ Free | $0 |
| Failure intervals | ✅ Free | $0 |
| Meaningfulness scores | ✅ Free | $0 |
| Error evolution tracking | ✅ Free (code) | $0 |
| Cross-test correlation | ✅ Free (code) | $0 |
| Struggle profile generation | ✅ Free (code) | $0 |
| Diff category labeling | LLM | $0.88 (GPT-4o-mini) |
| Conceptual analysis | LLM | $0.14 (GPT-4o-mini) |
| **Total** | | **$1.02** |

### Verification Steps

1. Run Pipeline on sample student (run54.tar)
2. Check frontend.json includes:
   - `testHistories[].errorEvolution`
   - `testHistories[].struggleProfile`
3. Validate error transitions match raw testRunInfo.json
4. Verify cross-test correlations are sensible

---

## References

- `error_detection.md` - Current failure interval algorithm
- `diff_labeling_prompt.md` - Diff category definitions
- `test_mapping_prompt.md` - Test category generation
- `test_categories.json` - BinarySearchTree test mappings
