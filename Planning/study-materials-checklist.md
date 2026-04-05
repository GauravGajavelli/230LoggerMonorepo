# Study Materials Checklist — Student-Facing Links

Files in `Pipeline/testInputs/csse230/` are served at `/study-materials/` on the feedback server.
Drill questions reference these via `url`. Students must only see **non-solution** files via the
feedback report. Solution files stay in the same directories for internal drill configuration use.

## Naming Convention

| Purpose | Pattern | Example |
|---|---|---|
| Non-solution exam (student link) | `Exam{N}-{year}.md` or `.pdf` | `Exam2-202320.md` |
| Solution exam (internal only) | `Exam{N}-{year}-solution.md` or `.pdf` | `Exam2-202320-solution.md` |
| Practice exam non-solution | `Exam{N}-practice.{ext}` | `Exam2-practice.zip` |
| HW guide (non-solution) | `Homework_{N}_CSSE230.md` | `Homework_5_CSSE230.md` |

---

## Exam 2

**Used by:** `bst`, and any future assignment that targets Exam 2 content.

| File | Status | Notes |
|---|---|---|
| `Exams/Exam 2/Exam2-202320-solution.md` | ✅ exists | Internal only — drill config reference |
| `Exams/Exam 2/Exam2-202320.md` | ❌ **needed** | Non-solution questions — paste here for student links |
| `Exams/Exam 2/Exam2-practice.zip` | ✅ exists | Optional: link as supplemental practice |

**Action:** Paste the non-solution Exam 2 question text as `Exams/Exam 2/Exam2-202320.md`.

---

## Exam 3

**Used by:** `stringhashset`, `binaryheaps`.

| File | Status | Notes |
|---|---|---|
| `Exams/Exam 3/Exam3-202320-solution.pdf` | ✅ exists | Internal only |
| `Exams/Exam 3/Exam3-202320.pdf` or `.md` | ❌ **needed** | Non-solution questions |
| `Exams/Exam 3/Exam3-practice.zip` | ✅ exists | Optional: link as practice |

**Action:** Provide the non-solution Exam 3 as `Exams/Exam 3/Exam3-202320.md` (or `.pdf`).

---

## Final Exam

**Used by:** `graphsurfing`.

| File | Status | Notes |
|---|---|---|
| `Exams/Final Exam/PracticeFinalExam.pdf` | ✅ exists | Non-solution practice — can link directly |
| `Exams/Final Exam/PracticeFinalExam-solution.pdf` | ✅ exists | Internal only |
| `Exams/Final Exam/final-202320.zip` | ✅ exists | Actual final (may contain solutions — do not link) |
| `Exams/Final Exam/PracticeFinalExamComputerPart201830.pdf` | ✅ exists | Old year, supplemental |

**Action:** Link drill questions to `Exams/Final Exam/PracticeFinalExam.pdf` — already non-solution.
If you want to add 2026 final questions once the exam runs, place them as `Final-202630.md`.

---

## Homework Guides

| Assignment slug | File | Status | Notes |
|---|---|---|---|
| `bst` | `Homework 5/Homework_5_CSSE230.md` | ✅ exists | Problem set, no solutions embedded |
| `stringhashset` | `Homework 7/Homework_7_CSSE230.md` | ❌ **needed** | Paste HW7 guide here |
| `binaryheaps` | `Homework 8/Homework_8_CSSE230.md` | ❌ **needed** | Paste HW8 guide here |
| `graphsurfing` | `Homework 9/Homework_9_CSSE230.md` | ❌ **needed** | Paste HW9 guide here |
| (future) | `Homework 6/Homework_6_CSSE230.md` | ✅ exists | Already present if needed |

HW guides are typically already non-solution (they're the assignment descriptions). Verify before
adding — if a guide contains model solutions, provide a version without.

---

## Written Assignment Guides (Graphs1, Graphs2)

These appear in the `graphsurfing` assessment config but may be written assignments rather than
homework. Confirm naming and place under `Written Assignments/` if they exist as separate files.

| File | Status |
|---|---|
| `Written Assignments/Graphs1_CSSE230.md` | ❓ unknown |
| `Written Assignments/Graphs2_CSSE230.md` | ❓ unknown |

---

## Summary: What to provide now (for BST batch run)

1. `Exams/Exam 2/Exam2-202320.md` — non-solution Exam 2 questions (**paste to Claude Code**)

That's the only missing file for the current BST assignment. All other BST-linked files exist.
HW7/HW8/HW9 and Exam 3 non-solution can be added before each respective assignment's batch run.
