# GraphSurfing — Feedback Pipeline Setup Kickoff

For the next Claude session that picks up GraphSurfing configuration after BST and
StringHashSet have shipped. Self-contained — read top-to-bottom.

**The goal:** set up per-student feedback for GraphSurfing covering both Milestone 1
(adjacency-list / adjacency-matrix `Graph<T>` implementations) and Milestone 2
(`shortestPath`, `stronglyConnectedComponent`). Drills and `courseAppearances` should
deliberately aim at the **Final Exam** — the only remaining graded assessment after
M2 closes.

GraphSurfing IS the assignment being graded. The Final Exam is what the feedback
prepares students *for*. The Final itself doesn't get its own pipeline config.

### The M1+M2 tars are diagnostic input, not the target of feedback

The student tar zip is at:
`Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-12May.zip` (28 tars dated
5/17 — post-M1, mid-M2). About 18 have content; the rest are 0-byte students who
never ran tests (these go on the `missing_tar` email path automatically).

**Critical framing:** the M1+M2 test results are the **signal** the pipeline uses
to identify which graph concepts each student is weakest on. The drills and
`courseAppearances` surfaced for those patterns must be **Final Exam preparation**,
not "fix your M1" or "finish your M2."

By the time the emails arrive, M2 is closed and there's nothing actionable to do
about the assignment itself. Every pattern detected — whether from a botched M1
adjacency-list implementation or an unimplemented M2 `shortestPath` — should be
the entry point to a Final-Exam-relevant drill or concept reference. Treat M2
failures the same way you'd treat M1 failures: as *evidence of a graph-concept
weakness* that the Final will test, not as something the student should now go
back and finish.

For students who completed M1 *and* M2 with passing tests, the report's patterns
will (correctly) be sparse, and they'll get the no-issues path with a generic
review guide aimed at the Final.

### The assignment description

`Pipeline/assignments/GraphSurfing.md` — the assignment description as the user
provided it. **Note: this file is technically in the wrong place** —
`Pipeline/assignments/` is for config JSON, and student-link-able study materials
typically live under `Pipeline/testInputs/csse230/`. Before referencing the
description in a drill or `futureAppearances` URL, move it to e.g.
`Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md` so the
`/study-materials/...` route can serve it. Don't link it from `Pipeline/assignments/`
— that path isn't served. Also note the non-circular rule applies: the
description itself can be referenced as a *spec recap* for failing M2 tests
(legitimate — students are still working on it), but the description's solutions
or hints aren't drill sources.

---

## What this project is

A feedback pipeline for CSSE 230 (Data Structures) student submissions. It ingests a
student's test-run log (`run.tar`), re-runs their code snapshots to capture stack traces,
then uses an LLM to generate targeted, factual feedback. Output is a printable PDF
emailed to each student and an interactive site.

Working directory: repo root (`/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/`
locally, `/home/csse/230LoggerMonorepo/` on the Ubuntu server).

Existing assignment configs in `Pipeline/assignments/`: `bst`, `wuas`, `string_hashset`.
GraphSurfing config files don't exist yet — that's what this session creates.

Frontend is served via pm2 (`pm2 list` shows `feedback`). DB at `Frontend/db/feedback.db`.

---

## Read these first, in order

1. **`Planning/assignment_context_protocol.md`** — the canonical how-to for adding
   a new assignment. Updated 2026-05-17 with all the StringHashSet-era learnings.
   Don't deviate from it unless you have a specific reason; if you do, update it.
2. **`CLAUDE.md`** — top-level repo orientation.
3. **Auto-memory at `~/.claude/projects/-Users-gauravgajavelli-Documents-GitHub-230LoggerMonorepo/memory/MEMORY.md`** —
   user's persistent preferences. The "drills must not be circular" rule is a hard
   constraint.
4. **This file** for GraphSurfing-specific notes.

---

## The goal in one paragraph

Students just submitted GraphSurfing Milestones 1 and 2 (testing both AdjacencyList
and AdjacencyMatrix graph implementations across BFS, DFS, shortest paths, etc.).
The pipeline analyzes their per-student `run.tar` history and surfaces failing-test
patterns. For each pattern, the report should offer practice drills sourced from
**Final Exam preparation materials** — past finals' graph problems, the practice
final's computer part, plus tangentially-relevant graph content from Exam 3 paper
sections. The point is to convert "you struggled on `BFSTest`" into "and here's
a graph drill the Final is likely to test, do this next" — turning every failed
test into Final-Exam prep mileage.

After the Final there's no graded work left, so `futureAppearances` in
`graphsurfing.json` should point exclusively at Final Exam study materials (or
external concept references for graph patterns that recur beyond the course).

---

## What's specific about GraphSurfing-aimed-at-Final

### 1. The Final is the ONLY assessment in the config

`graphsurfing_assessment_config.json` lists **exactly one assessment: the Final Exam**
(2026-05-27, grade_weight 0.12). All other assessments are either past or — in the
case of Graphs2 (2026-05-18) — closing today/imminently, with no actionable
`urgency_factor` benefit from including them. The feedback target is the Final,
period.

Concept weights all attach to that single Final assessment. Per the protocol's
File 4 rules, weights reflect "share of the Final that tests this concept" — the
Final's coding section is 1-tree + 1-graph + 1-array-based, so graph-related
concept weights sum to roughly 0.10–0.15 (about a third of the programming portion
which is itself a fraction of the exam). Don't inflate.

### 2. Drill sourcing strategy

Final-prep-focused. The Final has a 1-tree + 1-graph + 1-array-based programming
section, so drills should be heavily graph-weighted (matching GraphSurfing's
categories) while leaving room for the graph-related paper-section content.

Drill sources, in priority order:

| Source | Path | What it contains |
|---|---|---|
| **Final practice — computer part** | `Pipeline/testInputs/csse230/Exams/Final Exam/FinalPracticeComputerPart.zip` | Starter project with `tree/`, `graph/`, `heap/` packages — three coding problems. The `graph/` package is gold for GraphSurfing-graduates: a graph problem that mirrors the Final's structure exactly. |
| **Final practice — computer PDF** | `Pipeline/testInputs/csse230/Exams/Final Exam/PracticeFinalExamComputerPart201830.pdf` | 2018 programming section. Use for problem framing if the zip's code isn't enough context. |
| **Final practice — paper** | `Pipeline/testInputs/csse230/Exams/Final Exam/PracticeFinalExam.pdf` | Paper-section concept questions. Drill `url` field can point here for "review this paper-style graph reasoning question." Non-solution; safe to link. |
| **Exam 3** | `Pipeline/testInputs/csse230/Exams/Exam 3/Exam3-202320.md` | Already authored as non-solution in StringHashSet session. Touches hash/heap (not graphs directly), but for failing GraphSurfing tests that hint at general algorithmic-analysis weaknesses, Exam 3's paper concept-coverage section is useful as a `futureAppearances` reference. |
| **HW9** | `Pipeline/testInputs/csse230/Homework 9/` *(if present)* | HW9 is dated 2026-05-15. If it's graph-related and present on disk, it's a valid drill source. **Check whether it exists** — if it doesn't, the user hasn't staged it yet and you should skip. |

**Do NOT** source drills from:
- The GraphSurfing assignment itself (the M1/M2 test files; circular)
- Any GraphSurfing solution doc (e.g. `GraphSurfing_soln.pdf` if present; circular)
- `final-202320.zip` (the actual 2023 final's contents; internal-only reference for
  authoring drills, never as a student-facing `url`)
- `PracticeFinalExam-solution.pdf` (solution version of the paper; internal only)

### 3. Test categories will span M1 and M2, AL and AM

The student-facing test class layout (confirmed via the GraphSurfing starter at
`/Users/gauravgajavelli/Documents/GitHub/graphsurfing-202630-GauravGajavelli/src/graphs/`):

```
GraphSurfingMilestone1TestCore.java
GraphSurfingMilestone1ALTest.java
GraphSurfingMilestone1AMTest.java
GraphSurfingMilestone2TestCore.java
GraphSurfingMilestone2ALTest.java
GraphSurfingMilestone2AMTest.java
```

Tests are partitioned by milestone × graph representation. Category design for
`graphsurfing_test_categories.json` should group by *operation* — because the same
operation test exists in both AL and AM variants and represents the same underlying
student weakness. Suggested category keys (derived from the M1+M2 method list in
`Pipeline/assignments/GraphSurfing.md`):

- M1: `addEdge`, `removeEdge`, `hasEdge`, `hasVertex`, `keySet`, `size`, `numEdges`,
  `outDegree`, `inDegree`, `successorSet`, `predecessorSet`, `successorIterator`,
  `predecessorIterator`, `relativeSpeed` (the AL-vs-AM speed tests), `lazyIteration`
- M2: `shortestPath`, `stronglyConnectedComponent`, `wikiSurfing` (the
  Wikipedia-graph integration tests)

Per the protocol's File 2 rules, each test method (across all 6 files) must appear
in `testToCategories` exactly once with one category key. M1AL and M1AM tests for
the same operation share a category — they're testing the same concept in two
representations. Same for M2AL and M2AM.

Read the test files in the reference repo before finalizing categories. Spend a few
minutes there — it's the single biggest input to good category granularity. Don't
over-decompose; ~15 categories total is plenty.

### 4. Per-student tars almost certainly exist

GraphSurfing's starter has `src/testSupport/` (TestStatus.java etc.), confirming the
`testSupport` framework that produces `run.tar` files. Students will have submitted
tars; the standard `process-batch.js` flow applies.

---

## Materials available

### Final Exam (drill / courseAppearance source)

Under `Pipeline/testInputs/csse230/Exams/Final Exam/`:

| Path | What it is | Use for |
|---|---|---|
| `PracticeFinalExam.pdf` | Paper part, non-solution | `futureAppearances` URL; "Practice Final (paper)" link in assessment resources |
| `PracticeFinalExam-solution.pdf` | Solution version of above | Internal authoring reference only — do NOT link student-facing |
| `PracticeFinalExamComputerPart201830.pdf` | 2018 programming part, problem statement | `futureAppearances` URL; "Practice Final — Computer Part (2018)" link |
| `FinalPracticeComputerPart/` (unzipped, see below) | Practice computer part source code | **Primary drill source for all three programming-section drills (tree/graph/heap)** |
| `FinalPracticeComputerPart.zip` | Original zip — kept for archival | Backup; the unzipped form is what to reference |
| `final-202320.zip` | **The user's own 2023 final-exam submission** (filename includes `GauravGajavelli`) | **DO NOT unzip into this directory** — would leak the user's actual exam solutions to current students via `/study-materials/`. If you need the source for internal reference, extract to `/tmp/`. |

The unzipped `FinalPracticeComputerPart/` directory contains:

```
FinalPracticeComputerPart/
├─ PracticeFinalExamComputerPart201830.pdf  (problem statement — same as the parent dir's loose PDF)
├─ src/
│  ├─ graph/
│  │  ├─ Graph.java               (abstract class — student implements)
│  │  ├─ AdjacencyListGraph.java  (starter, students fill in)
│  │  ├─ AdjacencyMatrixGraph.java
│  │  └─ GraphTest.java           ← 7KB of test methods — PRIMARY DRILL SOURCE for graph drills
│  ├─ tree/
│  │  ├─ BinarySearchTree.java
│  │  └─ TreeTest.java            (tree problem test methods)
│  ├─ heap/
│  │  ├─ MinIndexOfHeapRoot.java
│  │  └─ MinIndexOfHeapRootTest.java   (heap problem test methods)
│  └─ subtree/
│     ├─ BinaryTree.java
│     └─ SubtreeTest.java         (additional tree-pattern practice)
```

For GraphSurfing drills aimed at Final prep, **`FinalPracticeComputerPart/src/graph/GraphTest.java`
is the gold standard drill source**. Quote its test methods verbatim (with adapted
classnames if needed) into `graphsurfing_drill_questions.json`. The `url` field for
those drills should point at the PDF problem statement
(`Exams/Final Exam/PracticeFinalExamComputerPart201830.pdf`) so students can read
the context. The `targetFile` should be the GraphSurfing-side test class
(`GraphSurfingMilestone1ALTest.java`, `GraphSurfingMilestone2ALTest.java`, etc.)
since that's where students paste drill tests for points.

### Reference repos (out-of-tree)

- **`/Users/gauravgajavelli/Documents/GitHub/graphsurfing-202630-GauravGajavelli/`** —
  GraphSurfing starter. Read `src/graphs/*Test*.java` for the test class layout that
  drives `graphsurfing_test_categories.json`. Ignore the `*  2/` trailing-space
  duplicates (macOS Finder artifact); the non-suffixed dirs are canonical.
  The JAR set at the repo root (junit-jupiter-*, jackson-*, etc.) is the same set
  StringHashSet used — these jars can serve as `RERUN_DEPS_DIR` if a dedicated
  GraphSurfing deps dir isn't separately unzipped.

---

## Suggested first moves

In order.

### 1. Verify environment

```bash
cd /home/csse/230LoggerMonorepo
git pull
git log -3 --oneline
ls Pipeline/assignments/   # confirm bst, string_hashset, wuas present; NO graphsurfing yet
sqlite3 Frontend/db/feedback.db "SELECT assignment, COUNT(*) FROM tokens GROUP BY assignment;"
ls Pipeline/testInputs/csse230/Exams/Final\ Exam/   # confirm Final materials present
```

### 2. Inspect GraphSurfing's test structure (local)

```bash
cd /Users/gauravgajavelli/Documents/GitHub/graphsurfing-202630-GauravGajavelli/src/graphs
ls
# Read each Test*.java file. Note: TestCore + AL + AM is the pattern.
# Pull out @Test method names — these become the testToCategories keys.
```

### 3. Inspect the Final practice graph drill source

```bash
unzip -l "/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline/testInputs/csse230/Exams/Final Exam/FinalPracticeComputerPart.zip" | grep -E '/graph/|/tree/|/heap/'
# Pull out the graph problem source for inspection — that's your primary drill.
unzip -p "/Users/.../Final Exam/FinalPracticeComputerPart.zip" "FinalPracticeComputerPart/src/graph/GraphTest.java"
```

### 4. Confirm slug and roster with the user

Ask:
- "Slug `graphsurfing`?"  (matches the protocol's starter config)
- "Roster: same `Frontend/data/roster.csv` as StringHashSet?"
- "Tars: `Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-12May.zip`,
  staged via the Phase 0 multi-strategy script. M1+M2 tests are in the same
  tars — both are diagnostic signal for Final-prep drilling, not assignment-
  completion targets."

### 5. Follow the protocol's Phase 0 + Files 1-4

Use `Pipeline/assignments/string_hashset.json` and siblings as the working examples.
Reuse the protocol's prompt templates with this session's source materials substituted in.

### 6. Specifically for `graphsurfing_assessment_config.json`

Start from the protocol's GraphSurfing starter config. **Override** by including only
upcoming assessments: at minimum the Final Exam, plus Graphs1/Graphs2 only if
today's date is before each. Skeleton:

```json
{
  "assignment": "Graph Surfing",
  "short_name": "Graphs",
  "full_name": "Graph Surfing",
  "assessments": [
    {
      "id": "final_exam",
      "name": "Final Exam",
      "date": "2026-05-27",
      "date_display": "May 27",
      "type": "exam",
      "grade_weight": 0.12,
      "concept_weights": { /* fill in from PracticeFinalExam content */ },
      "resources": [
        { "url": "Exams/Final Exam/PracticeFinalExam.pdf",
          "label": "Practice Final Exam (paper)" },
        { "url": "Exams/Final Exam/PracticeFinalExamComputerPart201830.pdf",
          "label": "Practice Final — Computer Part (2018)" }
      ]
    }
  ]
}
```

For the `concept_weights` keys, use the same category keys defined in
`graphsurfing_test_categories.json`. The Final's coding section is 1-tree +
1-graph + 1-array-based, so the graph slice is ~1/3 of programming, which is
some fraction of the overall exam. Weights should reflect that proportion —
roughly: graph categories sum to ~10-15% of the Final.

### 7. Dress rehearsal + real send per the protocol

`EMAIL_DEV_REDIRECT`, `HOLD_EMAILS=true`, queue, click-through, clean up, real send.
The protocol's "Dress rehearsal" and "Real send" sections are the runbook.

---

## Recent code changes you must not undo

Same list as the StringHashSet kickoff — all fixes from StringHashSet shipped and
must not be regressed. The protocol's changelog at the bottom enumerates them.
Key ones to be aware of when authoring GraphSurfing configs:

- **Strict bank-match** (`PracticeDrillService.java:236-247`) — drill `categories`
  must overlap the failing test's categories for the drill to fire. Miscategorized
  drills will silently never appear.
- **Concept-review-orphan path** in `report.js` — when no drill fires, the renderer
  synthesizes a row from `futureAppearances`. So if a graph concept has no
  matching drill but does have `futureAppearances`, the student still sees something.
- **`EXTERNAL_LINK_HOSTS` allowlist** in `server.js` — current allowlist is
  `docs.oracle.com`, `moodle.rose-hulman.edu`, `rose-hulman.hosted.panopto.com`.
  If you want to add a graph-specific external reference (e.g. an algorithm
  visualization site), add its host to the allowlist AND `pm2 restart feedback`.

---

## What to ask the user up front

1. **"Slug — `graphsurfing`?"** (default: yes)
2. **"Roster — `Frontend/data/roster.csv`?"** (default: yes, same as prior batches)
3. **"Confirming: feedback for this batch is purely Final-Exam-oriented. Drills
   target Final prep; M1+M2 test results are diagnostic input. No 'finish your
   assignment' framing in the email body or drill intros, even for students with
   unimplemented M2 methods?"** (Strong default: yes, this is correct — the
   assignment is closed by the time emails arrive.)
4. **"Has HW9 been staged under `Pipeline/testInputs/csse230/Homework 9/`? If
   graph-related, it's a valid drill source; if not, skipping."**
5. **"Where should I put `GraphSurfing.md` so it can be served via
   `/study-materials/`? Suggest moving to
   `Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md`. Even then, it
   serves only as a *concept-recap reference* for the assignment students just
   finished — not as a drill target."**

---

## Definition of done

- [ ] All four config files exist under `Pipeline/assignments/graphsurfing_*.json`
- [ ] `node scripts/validate-assignment-config.js graphsurfing` returns zero warnings
- [ ] Categories cover every test method across M1AL, M1AM, M1Core, M2AL, M2AM, M2Core
- [ ] Drills sourced from Final practice materials (FinalPracticeComputerPart.zip's
      `graph/` package primarily) and/or Exam 3 paper section, NOT from GraphSurfing
      itself
- [ ] `futureAppearances` point to Final Exam materials (not to non-existent future
      graded work)
- [ ] Tars staged under `Frontend/data/graphsurfing/tars/<institutional_id>/run.tar`
- [ ] Tokens generated, `process-batch.js` completes
- [ ] Dress rehearsal sent to `gajavegs@rose-hulman.edu` and visually verified
- [ ] No regressions in the renderer (drills/reviews split, real-drills-first sort,
      external links route through `/external`)
- [ ] Real send queue verified (recipients are real student emails, subjects don't
      start with `[DEV to...]`)
- [ ] `HOLD_EMAILS=false` and queue drained

---

## Reference

- Protocol: `Planning/assignment_context_protocol.md`
- Repo CLAUDE.md: `CLAUDE.md`
- Memory file: `~/.claude/projects/-Users-gauravgajavelli-Documents-GitHub-230LoggerMonorepo/memory/MEMORY.md`
- StringHashSet plan (precedent): `~/.claude/plans/looking-at-the-current-dreamy-swan.md`
- Final Exam materials: `Pipeline/testInputs/csse230/Exams/Final Exam/`
- Working assignment configs (examples): `Pipeline/assignments/{bst,string_hashset}*.json`
- GraphSurfing starter reference repo: `/Users/gauravgajavelli/Documents/GitHub/graphsurfing-202630-GauravGajavelli/`
