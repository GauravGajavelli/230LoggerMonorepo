# RQ1 Expert Rating Tool

A lightweight, browser-based tool for expert raters (TAs/tutors) to evaluate the quality of generated debugging feedback for CSSE 230 students.

## Purpose

**Research Question 1 (Quality):** To what extent do generated feedback plans align with expert judgment in correctness and actionability, and what are common failure modes?

2–3 raters independently score a set of student-assignment feedback pairs on three dimensions, flag failure modes, and export their ratings for inter-rater reliability analysis (Cohen's κ).

## Quick Start

### 1. Generate rating data

```bash
# Demo mode (uses developer's own data — 1 pair)
node Frontend/tools/rq1-rating/prepare-rating-data.cjs --demo

# Full mode (all 35 de-identified student-assignment pairs)
node Frontend/tools/rq1-rating/prepare-rating-data.cjs
```

### 2. Serve locally

The tool loads data via `fetch`, so it needs a local server (won't work from `file://`).

```bash
cd Frontend/tools/rq1-rating
python3 -m http.server 8787
```

### 3. Open in browser

```
Demo:  http://localhost:8787/rating-tool.html?demo
Full:  http://localhost:8787/rating-tool.html
```

Enter a rater ID on first visit (e.g., `TA-1`). No login or account required.

## What Raters See

For each student-assignment pair, the tool displays everything the system generated:

| Section | Source | What it shows |
|---------|--------|---------------|
| **Failed Tests** | `testHistories`, `failureHighlights` | Test names, highlight category, failed run count, fix status, error progression |
| **Feedback Items** | `feedback[]` | Pattern name, confidence, root cause explanation, next steps, code diffs, course/assessment mappings, drill recommendations |
| **Episode Context** | `episodes[].semantics` | What the student was doing in each coding session (intent, progress assessment) |
| **Assessment Drills** | `report.json` | Which upcoming exams/HW the drills map to, overlap percentages |

All student IDs are replaced with anonymous codes (A001–A035). Test names and code diffs are preserved since they are assignment-specific, not student-identifying.

## Rating Dimensions

Each scored 1–5:

**Correctness** — Is the feedback factually accurate?
- 1: Major errors (misidentifies problem, hallucinates methods)
- 5: Fully correct (precise identification, accurate concept mapping)

**Actionability** — Could a student act on this to improve?
- 1: Completely vague ("review your code")
- 5: Directly actionable (specific location, what's wrong, what to change, targeted drill)

**Specificity** — Is the feedback specific to THIS student's submission?
- 1: Completely generic (could apply to anyone)
- 5: Deeply specific (references exact debugging progression and misconception)

## Failure Mode Tags

Select all that apply per pair:

| Tag | Meaning |
|-----|---------|
| `hallucinated_reference` | References a test, method, or concept that doesn't exist |
| `wrong_root_cause` | Identifies a real problem but attributes it to the wrong cause |
| `vague_recommendation` | Drill or suggestion is too generic to act on |
| `mismatched_concept` | Maps feedback to the wrong course concept or assessment |
| `redundant` | Repeats the same point without adding information |
| `missing_obvious` | Fails to identify a clear, major issue visible in the data |
| `correct_but_unhelpful` | Technically accurate but doesn't help the student improve |
| `other` | Free text field for unlisted failure modes |

## Features

- **No setup required** — open the page, enter a rater ID, start rating
- **All context in one view** — no navigating between files or pages
- **Autosave** — ratings are saved to `localStorage` on every change
- **Resume** — close the browser and come back; position and ratings are preserved
- **Progress tracking** — dot indicator and progress bar show completion status
- **Keyboard shortcuts** — Left/Right arrows to navigate between pairs
- **Collapsible sections** — expand/collapse any section to focus on what matters
- **Rubric reference** — expandable rubric definitions always accessible in the rating panel

## Export

Two export formats, both ready for statistical analysis:

**JSON** — `rq1-ratings-{raterId}.json`
```json
[
  {
    "pair_id": "A001",
    "rater_id": "TA-1",
    "assignment": "Binary Search Tree",
    "correctness": 4,
    "actionability": 3,
    "specificity": 5,
    "failure_mode_tags": ["vague_recommendation"],
    "notes": "Drill intro is good but nextSteps could be more specific",
    "timestamp": "2026-05-12T14:23:00Z"
  }
]
```

**CSV** — `rq1-ratings-{raterId}.csv`
```
pair_id,rater_id,assignment,correctness,actionability,specificity,failure_mode_tags,notes,timestamp
```

Failure mode tags are `|`-delimited in CSV. Import directly with `pandas.read_csv()` or `read.csv()` in R.

## Data Pipeline

```
Frontend/data/{assignment}/output/{student}/frontend.json
Frontend/data/{assignment}/output/{student}/report.json
        │
        ▼
  prepare-rating-data.cjs
  (extract, de-identify, shuffle)
        │
        ▼
  rating-data.json (or rating-data-demo.json)
        │
        ▼
  rating-tool.html (browser, localStorage)
        │
        ▼
  rq1-ratings-{raterId}.json / .csv
```

## File Inventory

| File | Purpose |
|------|---------|
| `prepare-rating-data.cjs` | Node.js script — extracts and de-identifies student data |
| `rating-tool.html` | Self-contained rating interface (vanilla JS + Tailwind CDN) |
| `rating-data-demo.json` | Generated demo data (1 pair, developer's own) |
| `rating-data.json` | Generated full data (35 de-identified pairs) |

## Target Workload

- **35 pairs** total, all rated by all raters (shared set for inter-rater reliability)
- **1–2 minutes** per pair
- **~60 minutes** total rating time per rater
