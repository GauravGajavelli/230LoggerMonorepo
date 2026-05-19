# Protocol: Configuring a New Assignment for the Feedback Pipeline

Use this protocol when adding a new assignment (e.g. `binaryheaps`, `graphsurfing`).
Updated 2026-05-17 with the StringHashSet rollout's learnings.

---

## Overview

Each assignment needs:

| File | Location | Purpose |
|---|---|---|
| `{slug}.json` | `Pipeline/assignments/` | Assignment name, excluded test classes, courseContext |
| `{slug}_test_categories.json` | `Pipeline/assignments/` | Category keys, descriptions, test→category mapping |
| `{slug}_drill_questions.json` | `Pipeline/assignments/` | Bank of curated practice drill questions |
| `{slug}_assessment_config.json` | `Pipeline/assignments/` | Assessment dates, grade weights, concept_weights |

`{slug}` is the assignment identifier passed as the first argument to `process-batch.js`
and embedded in the file stems. Use the same stem across all four files. Existing slugs:
`bst`, `wuas`, `string_hashset`. Snake_case (`string_hashset`) and run-together
(`stringhashset`) both work; the code just substitutes the string verbatim. Pick one
convention per assignment and use it consistently for all four file stems.

**All four files are read by `process-batch.js:78-79` and `report.js:126,130` from
`Pipeline/assignments/`.** Earlier versions of this protocol claimed `assessment_config.json`
lived under `Frontend/data/{slug}/` — that was wrong. The code path resolves to
`Pipeline/assignments/{slug}_assessment_config.json`.

Aside from the four config files, each assignment also needs:
- A roster (`data/roster.csv`) with GitHub-username and institutional-email columns
- Tars staged at `Frontend/data/{slug}/tars/{institutional_id}/run.tar`
- A `RERUN_DEPS_DIR` pointing at unzipped JUnit/Jackson/etc. jars from the
  assignment's starter project
- Study-material files under `Pipeline/testInputs/csse230/` for anything drill
  URLs reference relatively

---

## The non-circular rule (read first)

**Drills must NOT be sourced from the assignment being graded or its solution document.**
Sourcing from HW7's own problems while feedback is *about* HW7 is circular and gives no
pedagogical lift — the student already has those problems. Same for `HW{N}_soln.pdf`.

Acceptable drill sources:
- Past exams (especially the exam closest after the assignment is due)
- Earlier homework problems from the same course
- Practice exams (`Exam{N}-practice.zip` extracted into `Pipeline/testInputs/...`)
- LLM-generated fresh problems (handled automatically by `PracticeDrillService` when no
  bank entry matches)

Forward references in `futureAppearances` (in `{slug}.json`) can include external
documentation (Java API docs, course slides) — these aren't drill sources, they're
reading material. They're not circular.

---

## Phase 0 — Stage tars and seed the roster

This phase happens before any of the four config files exist. The roster supplies
the canonical mapping from GitHub username (used to find tar files in the redacted
zip) to institutional ID (used as `student_id` everywhere downstream).

### Roster format

`data/roster.csv` has two columns:

```
student_id,email
agneswang42,wangj36@rose-hulman.edu
rhit-mirandac,mirandac@rose-hulman.edu
Cole-Cary,carynd@rose-hulman.edu
...
```

- Column 1 is the **GitHub Classroom username** (matches the `run-${col1}.tar`
  filename in the redacted-tar zip)
- Column 2 is the institutional email; `generate-tokens.js` derives `student_id`
  from `email.split('@')[0]`, so the email's local-part becomes the
  canonical ID used in `tokens.student_id`, `pipeline_runs.student_id`, and the
  per-student dir at `data/{slug}/tars/{student_id}/run.tar`.

Column 1 and the institutional ID often differ (column 1 = `rhit-mirandac`,
institutional = `mirandac`). The staging script below uses a multi-strategy
match to find the right tar for each roster row.

### Tar staging script

```bash
cd Frontend
rm -rf data/{slug}/output data/{slug}/tars
mkdir -p data/{slug}/tars
unzip -o ../Pipeline/testInputs/studentTars/{the-latest-zip}.zip -d /tmp/{slug}-tars

while IFS=, read -r COL1 EMAIL; do
  [ "$COL1" = "student_id" ] && continue
  COL1="${COL1//$'\r'/}"; EMAIL="${EMAIL//$'\r'/}"
  SID="${EMAIL%@*}"
  TAR=""
  # Try matches in order: literal GH user, strip leading rhit-, strip trailing -rhit, fall back to institutional ID
  for CANDIDATE in "$COL1" "${COL1#rhit-}" "${COL1%-rhit}" "$SID"; do
    [ -z "$CANDIDATE" ] && continue
    T=$(find /tmp/{slug}-tars -maxdepth 2 -name "run-${CANDIDATE}.tar" 2>/dev/null | head -1)
    if [ -n "$T" ] && [ -s "$T" ]; then TAR="$T"; break; fi
  done
  if [ -z "$TAR" ]; then
    echo "  [no-tar] ${SID} (gh:${COL1}) — will land in missing_tar email path"
    continue
  fi
  mkdir -p "data/{slug}/tars/${SID}"
  cp "$TAR" "data/{slug}/tars/${SID}/run.tar"
done < data/roster.csv
```

After staging, `data/{slug}/tars/` should contain one directory per institutional ID
with a non-empty `run.tar` inside (students without a tar fall through to the
`missing_tar` email path automatically — that's fine).

### Stage RERUN_DEPS_DIR

`process-batch.js` calls `rerun` between ingest and prepare *only if*
`RERUN_DEPS_DIR` is set in `Frontend/.env` and the path exists. Without it,
every student runs in basic-fallback mode (no stack traces, no exception types,
no per-test durations) and the LLM produces significantly thinner feedback.

```bash
DEPS=Pipeline/output/{slug}-deps
mkdir -p "$DEPS"
unzip -o "Pipeline/testInputs/csse230/Homework {N}/{slug-starter}.zip" -d "$DEPS"
# Add to Frontend/.env:
#   RERUN_DEPS_DIR=/absolute/path/to/$DEPS/{starter-dir}
# Verify the deps dir contains junit-jupiter-*.jar, jackson-*.jar, etc.
ls "$DEPS"/*/*.jar | head
```

This step is the difference between "neawedba's 6 failing tests produce 0 patterns"
and "neawedba gets 5 actionable feedback items." Don't skip it.

---

## File 1 — `{slug}.json`

### What to gather

1. The assignment's main test file(s) — to derive method names for `testCategories`
2. Future course materials where the same concepts recur (later HWs, exams, Final)
3. Exam questions that touch the same concepts (from `Pipeline/testInputs/csse230/Exams/`)
4. `Planning/CSSE230 Syllabus.md` — for course learning objectives that improve
   `futureAppearances` descriptions
5. External documentation (Java API docs, course slides) for concepts that recur
   *outside* graded assessments — e.g. iterator semantics that show up in many
   future contexts but aren't a coding question on any one exam

### Schema

```json
{
  "assignmentName": "Full Assignment Name",
  "excludeTestClasses": [],
  "courseContext": {
    "concepts": [
      {
        "concept": "one-line concept name",
        "testCategories": ["category_key_1", "category_key_2"],
        "futureAppearances": [
          {
            "label": "short context name",
            "url": "Exams/Exam 3/Exam3-202320.md",
            "description": "one specific sentence: how this concept connects"
          }
        ]
      }
    ]
  }
}
```

Each `futureAppearances` entry needs all three fields:
- `label`: short, shown as a clickable link's text in the report
- `url`: either a path relative to `Pipeline/testInputs/csse230/` (served at
  `/study-materials/...`) or an absolute external URL (`https://...`)
- `description`: rendered inline as a sentence explaining the connection

**External URLs** (absolute `https://`) route through `/external?token=...&url=...`
for click-tracking and must have their host listed in `EXTERNAL_LINK_HOSTS` in
`Frontend/server.js`. Current allowlist: `docs.oracle.com`, `moodle.rose-hulman.edu`,
`rose-hulman.hosted.panopto.com`. **Adding a new host requires editing `server.js`
and restarting pm2** — clicks to unlisted hosts return 403.

### For HW-only concepts (no future graded test)

Some concepts (e.g. iterator semantics, toString formatting) appear in the HW being
graded but aren't on any future exam's coding section. Don't leave `futureAppearances`
empty — the renderer will silently drop those failure patterns.

Instead, populate `futureAppearances` with non-circular *concept references*:

```json
{
  "concept": "Iterator across an array of chained buckets",
  "testCategories": ["iterator", "iterator_edge_cases"],
  "futureAppearances": [
    {
      "label": "java.util.Iterator contract",
      "url": "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Iterator.html",
      "description": "Every iterator you write — for hash sets, EditorTrees, graphs — must satisfy the same hasNext()/next()/NoSuchElementException contract."
    }
  ]
}
```

This makes the renderer surface a "concept review" row pointing at relevant reading,
rather than dropping the pattern entirely.

### Prompt template

```
You are helping curate course context data for a CSSE 230 student feedback pipeline.
The pipeline analyzes a student's test run history for the [{ASSIGNMENT NAME}] assignment
and generates targeted feedback. Enrich that feedback with references to future course
materials where the same concepts recur.

Output the JSON schema shown in this protocol's File 1 section. Rules:

- testCategories: derive labels from the test method names I'm providing. Use lowercase
  short labels matching the method under test (testInsert → "insert"). Each concept entry
  covers 1–3 closely related test methods.
- futureAppearances: scan the future materials I provide. One entry per distinct future
  context where the concept recurs. Description must be one specific sentence. Each entry
  must include a url field — relative path under Pipeline/testInputs/csse230/ for course
  materials, or an absolute https URL for external docs. Do not hallucinate.
- For HW-only concepts with no future graded test, use external concept references
  (Java API docs, course slides) instead of empty futureAppearances.
- excludeTestClasses: list any test class names that should be skipped during rerun and
  prepare (concurrency tests, stress tests). If none, use [].

---
[Paste main test file(s) here]

[Paste future assignment test files / spec excerpts]

[Paste relevant exam questions]

[Optional: paste syllabus learning objectives section]
```

---

## File 2 — `{slug}_test_categories.json`

### Schema

```json
{
  "categories": {
    "category_key": {
      "description": "one sentence describing what this category tests",
      "tests": ["ClassName#methodName()", "..."]
    }
  },
  "testToCategories": {
    "ClassName#methodName()": ["category_key"]
  }
}
```

### Rules

- Every test method in the assignment's test class must appear in `testToCategories`
- Use the format `ClassName#methodName()` with parens but no arguments
- A test usually has one category; multiple is allowed but rare
- Category keys must match the `testCategories` arrays in `{slug}.json` exactly
- Don't invent categories that aren't referenced from `{slug}.json`

### Prompt template

```
Given the test file below and the category keys [{COMMA-SEPARATED FROM FILE 1}],
produce the JSON schema from this protocol's File 2 section. Every test method
must appear in testToCategories with exactly one category (or two only if the test
clearly straddles two distinct concepts). Don't invent new keys.

---
[Paste test file]
```

---

## File 3 — `{slug}_drill_questions.json`

### Critical rules

1. **No circular sourcing.** Don't pull problems from the assignment being graded or
   its solution doc. The non-circular rule at the top of this protocol applies here
   most strictly.
2. **The `categories` field is authoritative for matching.** Per the strict-bank-match
   fix in `PracticeDrillService.java:236-247`, drills only fire when their declared
   `categories` overlap the failing test's categories. Miscategorized drills will never
   surface — the LLM-derived category mapping no longer compensates.
3. **`source` must match assessment `name` exactly** (case-sensitive) so the urgency
   tag in the UI displays correctly. If `{slug}_assessment_config.json` calls it
   `"Exam 3"`, the drill's `source` must also be `"Exam 3"` (not `"exam3"`, `"Exam3"`,
   etc.).
4. **Aim for 3 drills per high-weight category, 1 per lower-weight category.** The
   renderer caps each assessment column at `drill_cap=3` for the printed PDF, so more
   than 3 drills for a single concept is wasted PDF real estate (they'll still appear
   on the interactive site).

### Schema

```json
[
  {
    "id": "unique-kebab-case-id",
    "source": "Exam 3",
    "sourceLabel": "Exam 3 — 2023 questions",
    "url": "Exams/Exam 3/Exam3-202320.md",
    "targetFile": "StringHashSetTest.java",
    "categories": ["category_key"],
    "timeEstimate": "~10 min",
    "intro": "One sentence framing why this drill matters and what to implement.",
    "testCode": "@Test\npublic void practice_methodName_scenario() {\n    ...\n    sPoints += 1;\n}",
    "hints": [
      "First hint — what to think about.",
      "Second hint — a concrete implementation step.",
      "Third hint — the tricky edge case."
    ]
  }
]
```

### Guidelines

- Each drill should require implementing a **new** method, not patching existing code.
  A drill that passes for a working student's submission gives no challenge.
- `testCode` should fail against a buggy submission and pass once the concept is
  correctly implemented. Don't just verify behavior the assignment already tests.
- `intro` must not leak answers from the source exam. If the source is "Exam 3
  Problem 4(c)(ii) — what is the minimum number of items to add before rehash?",
  the intro can reference the question but **must not state the answer.**
- Match the test class's points-tracking convention. HW7's `StringHashSetTest` uses
  `sPoints`; BST's tests use `points`. Wrong variable name → student paste fails compile.
- Bank-matched drills get a "From: {sourceLabel}" tag in the rendered UI. Make
  `sourceLabel` student-friendly.

### Prompt template

```
You are writing practice drill questions for CSSE 230 students who struggled on the
[{ASSIGNMENT NAME}] assignment. Each drill requires implementing a new method that
exercises the same concept as the failing test, giving students a low-stakes way to
practice before the next exam.

CRITICAL: do not source drills from the [{ASSIGNMENT NAME}] assignment itself or its
solution. Use only past exams, earlier homeworks, and practice exam zips. Reasoning:
sourcing from the assignment under feedback is circular and gives no new practice.

For each drill, output JSON matching the schema in this protocol's File 3 section.

Source materials — exam questions to draw from:
[Paste past exam questions / practice exam content]

Category keys and descriptions:
[Paste from {slug}_test_categories.json]

Existing test file (for API reference — use the same class names and method signatures,
and the same sPoints / points variable convention):
[Paste test file]

Write [N] drills covering: [list specific categories and sources].
Do NOT leak answers in the intro. The intro can reference the source question by
number but should not state the numerical or coded answer.
```

---

## File 4 — `{slug}_assessment_config.json`

### Schema

```json
{
  "assignment": "Full Assignment Name",
  "short_name": "SHORT",
  "full_name": "Full Assignment Name",
  "review_video_url": "https://rose-hulman.hosted.panopto.com/...",
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
      },
      "resources": [
        { "url": "Exams/Exam 3/Exam3-202320.md", "label": "Exam 3 — 2023 questions" },
        { "url": "Exams/Exam 3/Exam3-practice.zip", "label": "Practice Exam 3 (zip)" }
      ]
    }
  ]
}
```

### Field reference

| Field | Notes |
|---|---|
| `review_video_url` | Optional, top-level. If present, drill-sheet subtitle says "from the review video"; if absent, falls back to "from the review materials" |
| `id` | Unique snake_case identifier for this assessment within the file |
| `name` | Must match `source` in drill questions exactly — drives the UI source tag |
| `date` | ISO-8601 (`YYYY-MM-DD`). Used for days-left computation and urgency factor |
| `type` | `"exam"` \| `"homework"` \| `"assignment"` |
| `grade_weight` | Fraction of final grade — **read from the syllabus**, not estimated |
| `concept_weights` | Category key → fraction of THIS assessment that tests this concept (0.0–1.0). Sum need not equal 1.0 — represents share of the assessment, not a probability distribution |
| `resources` | Optional array. Always-shown links per assessment (practice zips, alt-year PDFs). Used as fallback source URL for review-only-orphan rows when the concept has no `futureAppearances` |

### Setting `concept_weights` correctly

**Source: `Pipeline/testInputs/csse230/Exams/` solution files.** Read the actual exam
solution before setting any weight — do not infer from `courseAppearances` descriptions
in `{slug}.json`.

The weight reflects **the share of THIS specific exam that tests THIS concept**, not
the concept's overall importance. If Exam 3 has ~16 points of hash content out of 120
total, the hash-related concept_weights for the `exam_3` assessment should sum to
roughly 0.13 — not 1.0. Inflated weights produce misleading "your drills cover ~100% of
this exam" framing.

Rules:
- Assign weight only to categories that appear as **things students must implement**,
  not categories used only to set up test data. `insert` used to build a tree before
  testing `remove` does NOT warrant an `insert` weight — `remove` is what's tested.
- Higher weight → a standalone programming question on this concept
- Lower weight → concept appears as a sub-step or written tracing question
- Omit categories that don't appear at all
- After setting weights, run `node scripts/validate-assignment-config.js {slug}` —
  it will warn about categories in `concept_weights` that have no matching drill,
  and vice versa

---

## Pre-run setup checklist

Before invoking `process-batch.js`:

### Source materials read
- [ ] Main test file(s) for the assignment — method names + classes to exclude
- [ ] `Pipeline/testInputs/csse230/Exams/` — solutions for the relevant assessment(s)
- [ ] `Pipeline/testInputs/csse230/Homework {N}/` — specs for the relevant homework(s)
- [ ] `Planning/CSSE230 Syllabus.md` — grade weights verified

### Config files
- [ ] `Pipeline/assignments/{slug}.json` exists with `assignmentName`,
      `excludeTestClasses`, `courseContext`. All `futureAppearances` have `url` fields.
- [ ] `Pipeline/assignments/{slug}_test_categories.json` exists with all test
      methods mapped, no orphan category keys
- [ ] `Pipeline/assignments/{slug}_drill_questions.json` exists with ≥1 drill per
      high-weight category, every `categories` value matches `_test_categories.json`,
      every `source` matches an assessment `name`, intros don't leak answers
- [ ] `Pipeline/assignments/{slug}_assessment_config.json` exists with
      `concept_weights` filled in for all assessed categories
- [ ] `grade_weight` values match the syllabus (not estimated)
- [ ] `node scripts/validate-assignment-config.js {slug}` passes with zero warnings
- [ ] Any new external host in `futureAppearances` is added to `EXTERNAL_LINK_HOSTS`
      in `server.js`

### Environment
- [ ] `Frontend/.env` has `ASSIGNMENT_SLUG`, `ASSIGNMENT_DISPLAY_NAME` set
- [ ] `Frontend/.env` has `RERUN_DEPS_DIR` pointing at unzipped starter jars
- [ ] Pipeline JAR is newer than `Pipeline/src/main/java/`:
      `ls -l Pipeline/target/csse230-feedback.jar Pipeline/src/main/java/edu/rosehulman/csse230feedback/domain/PracticeDrillService.java`
- [ ] If JAR is stale: `mvn -f Pipeline/pom.xml package -q -DskipTests`
- [ ] After any `server.js` / `lib/*.js` change: `pm2 restart feedback`
- [ ] DB is in the expected state — either fresh (no `{slug}` rows) or you've
      explicitly chosen to keep stale rows

### Tars and tokens
- [ ] Tars staged via the Phase 0 script under `data/{slug}/tars/{institutional_id}/run.tar`
- [ ] Roster CSV at `data/roster.csv` has GitHub-username + institutional-email columns
- [ ] `node scripts/generate-tokens.js {slug} roster.csv` run; token count matches
      roster row count

---

## Running the pipeline

```bash
cd /home/csse/230LoggerMonorepo/Frontend
node scripts/process-batch.js {slug} "{Full Assignment Name}"
```

Expected wall time: ~3-5 minutes per student with cold LLM cache, ~5-15 seconds per
student with warm cache (Puppeteer PDF render dominates the warm case).

Spot-check distribution after the run:

```bash
sqlite3 db/feedback.db "SELECT status, COUNT(*) FROM pipeline_runs WHERE assignment='{slug}' GROUP BY status;"
```

Errors (status='error') aren't catastrophic — the affected students will fall through
to `missing_tar` in queue-emails. But more than a couple errors warrants reading the
batch log: `tail -100 data/{slug}/batch.log`.

---

## Dress rehearsal — send to dev address first

Don't skip this. The dress rehearsal exposes pattern_name mismatches, drill content
that reads weirdly in print, broken external links, and rendering bugs that don't
show up until a real Puppeteer pass writes PDFs to disk.

### Setup

In `Frontend/.env`:
```
EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
HOLD_EMAILS=true
```

`EMAIL_DEV_REDIRECT` is read at **queue time**, not send time. The redirect is baked
into the `email_queue.recipient` column. If you queue with this set and then unset
it before flipping `HOLD_EMAILS=false`, the queue still has your dev address — you
must cancel + re-queue to actually route to real students.

### Run

```bash
node scripts/queue-emails.js {slug} "{Full Assignment Name}"

# Verify the dev-redirect is baked in
sqlite3 db/feedback.db <<'SQL'
SELECT recipient, email_type, substr(subject,1,60) AS subject
FROM email_queue WHERE assignment='{slug}' AND status='pending' LIMIT 10;
SQL
# Every recipient must be your dev address. Subjects must start with [DEV to <real>].

nano Frontend/.env   # HOLD_EMAILS=true → false
# server.js re-reads .env per relay-drain tick. Wait ~60s for emails to start arriving.
```

### Click-through

Click each link from your dev-redirect inbox. Verify:
- Subject prefix `[DEV to <real-email>]` is present (proves redirect is active)
- Report PDF link opens the right student's content
- Feedback site link opens the right student's `frontend.json`
- External `futureAppearances` links route through `/external?token=...&url=...` and
  302 to the destination (not a `/study-materials/https%3A//...` 404)
- Footer counts match what's printed: real drills counted as "drills", review-only
  rows counted as "concept reviews", time only from real drills
- No "Apologies for the earlier email" leftover paragraph in `feedback_ready` emails

### Clean up after each token reviewed

```bash
TOKEN='<token>'
sqlite3 db/feedback.db <<SQL
DELETE FROM events      WHERE token='${TOKEN}';
DELETE FROM email_queue WHERE token='${TOKEN}' AND assignment='{slug}';
SQL
```

The events deletion returns the token to "first-view" state for the real student.
The email_queue deletion removes the dev-redirect-tagged row so re-queueing later
will create a fresh row with the real recipient.

### Coverage — which students to spot-check

A minimum-clicks audit (~6 students) that hits every case the recent fixes touch:

1. **A student with all-real drills** (or the highest drill-to-review ratio in your
   batch) — sanity-check the most common case
2. **A review-only-only student** (0 drills, only concept reviews) — verifies the
   empty-state branch doesn't fire and external links work
3. **A small-report student** (1-2 patterns total) — verifies no overflow tail
4. **Yourself / a known token** — easy click-test of the generic-guide flow
5. **A mixed real+review student** — verifies adaptive footer wording
6. **A missing_tar student** — verifies the generic flow + missing_tar email body

---

## Real send

If the dress rehearsal looked good and you're ready to release:

### Option A — incremental (keep cached pipeline outputs and tokens)

```bash
# 1. Cancel all dev-redirected rows so re-queue creates fresh ones with real recipients
sqlite3 db/feedback.db "UPDATE email_queue SET status='cancelled', error_msg='dress rehearsal' WHERE assignment='{slug}' AND status='pending';"

# 2. Remove the dev redirect; keep HOLD_EMAILS=true initially
nano Frontend/.env
#   - Remove or comment out EMAIL_DEV_REDIRECT
#   - HOLD_EMAILS=true (still)

# 3. Re-queue
node scripts/queue-emails.js {slug} "{Full Assignment Name}"

# 4. Verify recipients are now REAL student emails
sqlite3 db/feedback.db "SELECT recipient, email_type FROM email_queue WHERE assignment='{slug}' AND status='pending' LIMIT 10;"
# Subjects must NOT start with [DEV to...]. If they do, EMAIL_DEV_REDIRECT is still
# active — repeat steps 1-3.

# 5. Release
nano Frontend/.env   # HOLD_EMAILS=true → false
```

### Option B — pristine reset (full DB restore)

```bash
pm2 stop feedback
rm -f db/feedback.db db/feedback.db-wal db/feedback.db-shm
cp db/<pre-{slug}-backup>.bak db/feedback.db
pm2 start feedback
# Re-do Phase 0 + generate-tokens + process-batch + queue-emails
# (without EMAIL_DEV_REDIRECT; with HOLD_EMAILS=true initially)
```

The WAL/SHM cleanup is required — `cp` over an open DB while keeping stale WAL files
produces `disk I/O error (10)` at next open.

### Watch the queue drain

```bash
watch -n 5 "sqlite3 db/feedback.db 'SELECT status, COUNT(*) FROM email_queue WHERE assignment=\"{slug}\" GROUP BY status;'"
```

Ctrl-C when `pending=0`. The relay typically polls every ~60s.

---

## After running the pipeline

- [ ] `courseAppearances` appear in `frontend.json` for feedback items in relevant categories
- [ ] `drills[0].source` is populated for bank-matched drills (null/missing for LLM-generated)
- [ ] Report PDF shows the assessment strip with correct days-left + grade-weight info
- [ ] Strip-row count matches the printed column count (`N drills · M reviews · X min (+K more)`)
- [ ] Footer matches: `N drills · M concept reviews · X min total` (drills and concept
      reviews counted separately; time excludes review-only)
- [ ] Real drills sort before review-only rows in each column
- [ ] External links route through `/external?token=...&url=...` and log events
- [ ] Empty-state copy only appears when BOTH `total_unique_drills=0` and
      `total_review_concepts=0`

---

## Spring 2026 assessment dates (reference)

Verified from `Planning/CSSE230 Syllabus.md` on 2026-05-17. **Re-verify each term.**

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

## Starter assessment_config skeletons

Fill in `concept_weights` from the actual exam materials. All four below correctly
target `Pipeline/assignments/{slug}_assessment_config.json` (the corrected location).

### BinaryHeaps (`binaryheaps` or `binary_heaps`)

Relevant assessments: HW8 (2026-05-08), Exam 3 (2026-05-06), Final Exam (2026-05-27).

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
      "concept_weights": {},
      "resources": []
    },
    {
      "id": "hw8",
      "name": "HW8",
      "date": "2026-05-08",
      "date_display": "May 8",
      "type": "homework",
      "grade_weight": 0.035,
      "concept_weights": {},
      "resources": []
    },
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": {},
      "resources": []
    }
  ]
}
```

### GraphSurfing (`graphsurfing` or `graph_surfing`)

Relevant assessments: Graphs1 (2026-05-11), HW9 (2026-05-15), Graphs2 (2026-05-18),
Final Exam (2026-05-27).

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
      "concept_weights": {},
      "resources": []
    },
    {
      "id": "hw9",
      "name": "HW9",
      "date": "2026-05-15",
      "date_display": "May 15",
      "type": "homework",
      "grade_weight": 0.035,
      "concept_weights": {},
      "resources": []
    },
    {
      "id": "graphs2",
      "name": "Graphs2",
      "date": "2026-05-18",
      "date_display": "May 18",
      "type": "assignment",
      "grade_weight": 0.035,
      "concept_weights": {},
      "resources": []
    },
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": {},
      "resources": []
    }
  ]
}
```

---

## What changed in this update (2026-05-17)

Summary of revisions from the original protocol, based on the StringHashSet rollout:

1. **Fixed assessment_config location.** Moved from `Frontend/data/{slug}/assessment-config.json`
   (wrong) to `Pipeline/assignments/{slug}_assessment_config.json` (matches code).
2. **Added the non-circular rule** at the top and reinforced in File 3.
3. **Added `url` to `futureAppearances` schema** with external-host allowlist note.
4. **Added `resources` and `review_video_url` to assessment_config schema.**
5. **Added Phase 0 (tar staging + roster) section** before the four config files.
6. **Added `RERUN_DEPS_DIR` setup** — without this, prepare runs in basic-fallback
   mode and LLM-feedback quality drops dramatically.
7. **Added the dress-rehearsal section** with `EMAIL_DEV_REDIRECT` workflow,
   click-through coverage, and cleanup queries.
8. **Added the real-send section** with both incremental and pristine-reset options.
9. **Added pm2 / mvn discipline** to the pre-run checklist — multiple times during
   the StringHashSet rollout we ran the pipeline with stale code or a stale JAR.
10. **Documented HW-only-concept handling** — populate `futureAppearances` with
    external concept references (Java docs etc.) so the renderer's concept-review
    fallback can surface those failure patterns.
11. **Documented post-run verification checks** for the renderer's adaptive copy
    (drill/review split, real-drills-first sort, external-link routing).
