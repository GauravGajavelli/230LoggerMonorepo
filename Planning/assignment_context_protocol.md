# Protocol: Configuring a New Assignment for the Feedback Pipeline

Use this protocol when adding a new assignment slug (e.g. `stringhashset`, `binaryheaps`,
`graphsurfing`). Each assignment needs four files. Create them in order.

---

## Files required per assignment

| File | Location | Purpose |
|---|---|---|
| `{slug}.json` | `Pipeline/assignments/` | Assignment name, excluded test classes, courseContext |
| `{slug}_test_categories.json` | `Pipeline/assignments/` | Category keys, descriptions, test→category mapping |
| `{slug}_drill_questions.json` | `Pipeline/assignments/` | Bank of curated drill questions |
| `assessment-config.json` | `Frontend/data/{slug}/` | Assessment dates, grade weights, concept_weights |

`{slug}` is the lowercase hyphen-free assignment identifier used in `process-batch.js`
(e.g. `stringhashset`, `binaryheaps`, `graphsurfing`).

---

## File 1 — `{slug}.json`

### What to gather

1. The assignment's main test file(s) — to derive method names for `testCategories`
2. Future assignment test files or specs where the same concepts recur
3. Exam questions that test the same concepts (from `Pipeline/testInputs/csse230/Exams/`)
4. **The course syllabus grading section** (`Planning/CSSE230 Syllabus.md`) — for course learning
   objectives, which improve `futureAppearances` descriptions

### Prompt template

```
You are helping curate course context data for a CSSE 230 student feedback pipeline.
The pipeline analyzes a student's test run history for the [{ASSIGNMENT NAME}] assignment
and generates targeted feedback. Enrich that feedback with references to future course
materials where the same concepts recur.

Output format — a JSON object with this exact schema:
{
  "assignmentName": "{Full Assignment Name}",
  "excludeTestClasses": [],
  "courseContext": {
    "concepts": [
      {
        "concept": "one-line concept name",
        "testCategories": ["label1", "label2"],
        "futureAppearances": [
          { "label": "short context name", "description": "one sentence: how this concept connects" }
        ]
      }
    ]
  }
}

testCategories guidance: derive labels from the test method names I'm providing.
Use lowercase short labels matching the method under test (e.g. testInsert → "insert",
testRemoveMin → "removeMin", testDijkstra → "dijkstra"). Each concept entry should
cover 1–3 closely related test methods.

futureAppearances guidance: scan the future materials I provide. Write one entry per
distinct future context where the concept recurs. The description must be one specific
sentence explaining how this assignment's concept connects to that future context.
Do not hallucinate. Only reference materials I provide.

excludeTestClasses: list any test class names (simple class names, not fully qualified)
that should be excluded from rerun and prepare (e.g. concurrency tests, stress tests
that time out). If none, use [].

---
[Paste main test file(s) here]

[Paste future assignment test files or spec excerpts here]

[Paste relevant exam questions here]

[Optional — paste the syllabus learning objectives / course outcomes section here,
to help write more accurate futureAppearances descriptions]
```

### Output handling

Paste the returned JSON into `Pipeline/assignments/{slug}.json`. Review each
`description` for accuracy before committing.

---

## File 2 — `{slug}_test_categories.json`

### What to gather

1. The complete test file(s) for the assignment
2. The category labels you defined in `{slug}.json` (from step 1)

### Prompt template

```
You are helping configure a test categorization file for a CSSE 230 feedback pipeline.

Given the test file(s) below and the category labels I provide, produce a JSON object
with this exact schema:

{
  "categories": {
    "<category_key>": {
      "description": "one sentence describing what this category tests",
      "tests": ["ClassName#methodName()", ...]
    }
  },
  "testToCategories": {
    "ClassName#methodName()": ["category_key"]
  }
}

Rules:
- Use the exact category keys from the list I provide.
- Every test method in the file must appear in testToCategories with exactly one category.
- Use the format ClassName#methodName() with no arguments (even if the method has params).
- If a test clearly belongs to two categories (rare), list both; otherwise use one.
- Do not invent new category keys.

Category keys for this assignment: [{COMMA-SEPARATED LIST FROM STEP 1}]

---
[Paste test file(s) here]
```

### Output handling

Save as `Pipeline/assignments/{slug}_test_categories.json`.
Verify that every test method appears in `testToCategories` and that no category key is
used that isn't in `categories`.

---

## File 3 — `{slug}_drill_questions.json`

### What to gather

1. Past exam questions and homework problems for this assignment's topics
2. The category keys from step 2 (to annotate each drill)
3. An example student submission or the reference solution (to calibrate difficulty)

### Schema

Each entry is a drill question a student can attempt to earn a point back:

```json
{
  "id": "unique-kebab-case-id",
  "source": "Exam 3",
  "categories": ["category_key"],
  "targetFile": "TheTestFile.java",
  "timeEstimate": "~10 min",
  "intro": "One sentence framing why this drill matters and what to implement.",
  "testCode": "@Test\npublic void practice_methodName_scenario() {\n    ...\n    points += 1;\n}",
  "hints": [
    "First hint — what to think about.",
    "Second hint — a concrete implementation step.",
    "Third hint — the tricky edge case."
  ]
}
```

### Guidelines

- `source` should match the exact `name` field you'll use in `assessment-config.json`
  (e.g. `"Exam 3"`, `"HW7"`, `"Final Exam"`) so the urgency tag in the UI displays correctly.
- `categories` must use keys from `{slug}_test_categories.json`.
- Aim for 2–4 drills per high-weight category, 1 per lower-weight category.
- Prioritize drills sourced from actual past exams — these are the most motivating.
- Each drill should require implementing a new method, not patching existing code.
- The `testCode` should fail against a student's buggy submission and pass once the
  concept is correctly implemented.

### Prompt template

```
You are writing practice drill questions for CSSE 230 students who struggled on the
[{ASSIGNMENT NAME}] assignment. Each drill should require implementing a new method
that exercises the same concept as the failing test, giving students a low-stakes way
to practice before the next exam.

For each drill, output JSON matching this schema:
[paste schema above]

Source materials — exam questions to draw from:
[Paste exam questions here]

Category keys and descriptions:
[Paste from {slug}_test_categories.json]

Existing test file (for API reference — use the same class names and method signatures):
[Paste test file here]

Write [N] drills covering: [list specific categories and sources].
```

---

## File 4 — `assessment-config.json`

This file powers both the PDF report (urgency bars, days-left badge) and the feedback
app (drill source tag color). It must be created **before** running `process-batch.js`
so that drill selection is urgency-weighted.

Location: `Frontend/data/{slug}/assessment-config.json`

### Schema

```json
{
  "assignment": "Full Assignment Name",
  "short_name": "SHORT",
  "full_name": "Full Assignment Name",
  "assessments": [
    {
      "id": "exam_3",
      "name": "Exam 3",
      "date": "2026-05-06",
      "date_display": "May 6",
      "type": "exam",
      "grade_weight": 0.07,
      "concept_weights": {
        "category_key": 0.08
      }
    }
  ]
}
```

### Field reference

| Field | Notes |
|---|---|
| `id` | Unique snake_case identifier |
| `name` | Must match `source` in drill questions exactly — drives the UI source tag |
| `date` | ISO-8601 (`YYYY-MM-DD`). Used for days-left computation |
| `type` | `"exam"` \| `"homework"` \| `"assignment"` |
| `grade_weight` | Fraction of final grade — **read from the syllabus**, not estimated |
| `concept_weights` | Category key → fraction of assessment content (0.0–1.0). Sum across all categories need not equal 1.0 |

### Setting grade_weight

**Source: `Planning/CSSE230 Syllabus.md`** — the authoritative grading breakdown. Do not
estimate from general norms. The Spring 2026 values are in the table below, but always
verify against the syllabus before creating a new config (weights can change term to term).

### Setting concept_weights

**Source: `Pipeline/testInputs/csse230/Exams/` and `Pipeline/testInputs/csse230/Homework {N}/`.**
Read the actual exam solution or homework spec before setting any weight — do not infer
from `courseAppearances` descriptions in `{slug}.json`, which are summaries written after
the fact and are not detailed enough to distinguish implementation vs. setup use.

Rules:
- Assign weight only to categories that appear as **things students must implement**,
  not categories used only to set up test data. Example: `insert` used inside a test
  to build a tree before testing `remove` does NOT warrant an `insert` weight — `remove`
  is what the question is testing.
- Higher weight → standalone programming question on this concept
- Lower weight → concept appears as a sub-step or in a written tracing question
- Omit categories that don't appear at all — they score 0 and fall back to list order
- After setting weights, cross-check: every drill in `{slug}_drill_questions.json`
  whose `source` matches this assessment should have at least one category with
  a non-zero weight here, otherwise that drill will never be urgency-scored

### Spring 2026 assessment dates (for reference)

Dates and weights verified from `Planning/CSSE230 Syllabus.md`. If the term changes, re-read
the syllabus and update both this table and any starter configs below.

| Assessment | Date | Type | grade_weight |
|---|---|---|---|
| Exam 1 | 2026-03-27 | exam | 0.07 |
| Exam 2 | 2026-04-10 | exam | 0.07 |
| HW5 | 2026-04-10 | homework | 0.035 |
| HW6 | 2026-04-24 | homework | 0.035 |
| HW7 | 2026-05-01 | homework | 0.035 |
| Exam 3 | 2026-05-06 | exam | 0.07 |
| HW8 | 2026-05-08 | homework | 0.035 |
| Graphs1 | 2026-05-11 | assignment | 0.035 |
| HW9 | 2026-05-15 | homework | 0.035 |
| Graphs2 | 2026-05-18 | assignment | 0.035 |
| Final Exam | 2026-05-27 | exam | 0.12 |

---

## Starter configs for upcoming assignments

These are starting points — fill in `concept_weights` from the actual exam materials.

### StringHashSet (`stringhashset`)

Relevant assessments: Exam 3 (2026-05-06), HW7 (2026-05-01), Final Exam (2026-05-27)

```json
{
  "assignment": "String Hash Set",
  "short_name": "SHS",
  "full_name": "String Hash Set",
  "assessments": [
    {
      "id": "hw7",
      "name": "HW7",
      "date": "2026-05-01",
      "date_display": "May 1",
      "type": "homework",
      "grade_weight": 0.035,
      "concept_weights": {}
    },
    {
      "id": "exam_3",
      "name": "Exam 3",
      "date": "2026-05-06",
      "date_display": "May 6",
      "type": "exam",
      "grade_weight": 0.07,
      "concept_weights": {}
    },
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": {}
    }
  ]
}
```

### BinaryHeaps (`binaryheaps`)

Relevant assessments: HW8 (2026-05-08), Exam 3 (2026-05-06), Final Exam (2026-05-27)

```json
{
  "assignment": "Binary Heaps",
  "short_name": "Heaps",
  "full_name": "Binary Heaps",
  "assessments": [
    {
      "id": "exam_3",
      "name": "Exam 3",
      "date": "2026-05-06",
      "date_display": "May 6",
      "type": "exam",
      "grade_weight": 0.07,
      "concept_weights": {}
    },
    {
      "id": "hw8",
      "name": "HW8",
      "date": "2026-05-08",
      "date_display": "May 8",
      "type": "homework",
      "grade_weight": 0.035,
      "concept_weights": {}
    },
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": {}
    }
  ]
}
```

### GraphSurfing (`graphsurfing`)

Relevant assessments: Graphs1 (2026-05-11), HW9 (2026-05-15), Graphs2 (2026-05-18),
Final Exam (2026-05-27)

```json
{
  "assignment": "Graph Surfing",
  "short_name": "Graphs",
  "full_name": "Graph Surfing",
  "assessments": [
    {
      "id": "graphs1",
      "name": "Graphs1",
      "date": "2026-05-11",
      "date_display": "May 11",
      "type": "assignment",
      "grade_weight": 0.035,
      "concept_weights": {}
    },
    {
      "id": "hw9",
      "name": "HW9",
      "date": "2026-05-15",
      "date_display": "May 15",
      "type": "homework",
      "grade_weight": 0.035,
      "concept_weights": {}
    },
    {
      "id": "graphs2",
      "name": "Graphs2",
      "date": "2026-05-18",
      "date_display": "May 18",
      "type": "assignment",
      "grade_weight": 0.035,
      "concept_weights": {}
    },
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": {}
    }
  ]
}
```

---

## Checklist before running `process-batch.js`

### Source materials read
- [ ] Main test file(s) for the assignment — reviewed for method names and exclude candidates
- [ ] `Pipeline/testInputs/csse230/Exams/` — exam solution(s) for the relevant assessment(s) read
- [ ] `Pipeline/testInputs/csse230/Homework {N}/` — homework spec(s) for the relevant assessment(s) read
- [ ] `Planning/CSSE230 Syllabus.md` — grade weights verified for all assessments in this config

### Config files
- [ ] `Pipeline/assignments/{slug}.json` exists with `assignmentName`, `excludeTestClasses`, and `courseContext`
- [ ] `Pipeline/assignments/{slug}_test_categories.json` exists with all test methods mapped
- [ ] `Pipeline/assignments/{slug}_drill_questions.json` exists with at least one drill per high-weight category
- [ ] `Frontend/data/{slug}/assessment-config.json` exists with `concept_weights` filled in for all assessed categories
- [ ] `grade_weight` values in `assessment-config.json` match the syllabus (not estimated)
- [ ] `name` values in `assessment-config.json` match `source` values in drill questions exactly
- [ ] `Frontend/data/{slug}/` directory exists on the server

## After running the pipeline

- [ ] Verify `courseAppearances` appear in `frontend.json` for feedback items
- [ ] Verify `drills[0].source` is populated for bank-matched drills (null for LLM-generated)
- [ ] Verify the report PDF shows assessment cards with correct days-left badge
- [ ] Verify the feedback app shows the drill source tag with urgency color
