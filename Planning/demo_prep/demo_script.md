# Demo Script — CSSE 230 Debugging Feedback Tool
**Duration:** 3–4 minutes
**Setting:** Classroom, projected browser, fullscreen
**Audience:** CSSE 230 students (may not know BSTs yet)

---

## Pre-Demo Setup Checklist

- [ ] Run `make demo-full-cached` to regenerate `frontend.json` (free, uses LLM cache)
- [ ] `npm run dev` running in Frontend/, browser open to `localhost:5173`
- [ ] Browser fullscreen, zoom level normal (100%)
- [ ] Assignment list is the landing view (not detail view)
- [ ] All test cards collapsed
- [ ] Practice drill modal closed
- [ ] Have the consent form packets ready (stapled, stacked, tray + pens near the door)

**Best card to expand during demo:** `testRemoveReturnValue` — has 3 labeled diffs spanning different timestamps, which visually shows the multi-cause story better than any other card. It's in the **Improved** tab. Pre-click it once to verify the shimmer → content flow looks right, then close it.

---

## The Demo (3–4 min)

### SETUP — Before clicking anything (0:00–0:25)

> **[Show of hands]** "Quick one — how many of you have had this moment in 220: it's midnight, your test is failing, you have no idea what you changed, and you're scrolling back through terminal output trying to figure it out?"

*[Pause for hands — nearly everyone.]*

> "Yeah. I had the same experience here in 230. I did OK on the homework but bombed the first exam, and when I went back to figure out why, I realized: I was finishing assignments without actually learning from what went wrong. I'd fix the bug, move on, and then see the same pattern come back on the exam three weeks later.

> I built this tool to fix that gap — to turn the work you've already done into something you can actually learn from.

> Before I show it: this is from a BST assignment — that's later in the quarter, don't worry about the code. Watch what the tool shows you about the **process**, not the code itself."

---

### SCREEN 1 — Assignment List (0:25–0:45)

*[Browser is on the assignment list.]*

> "This is what you'd see the morning after submitting. Your assignments are here."

*[Point to the BST card — the status pill, the mini color bar.]*

> "The bar on the right is your test suite at a glance. Blue is tests that were failing at some point but you fixed. Green is tests that were always passing. You can see the shape of the session without clicking anything."

> "And here —" *[point to header: 'Private to you' + lock icon]* "— this is yours. I can't see it. Course staff can't see it. It lives on your browser, tied to your submission."

*[Pause one beat.]*

> "The footer says IRB study — I'll come back to that."

---

### SCREEN 2 — Detail View, Summary + Timeline (0:45–1:20)

*[Click the BST card.]*

> "Here's the session. Everything passed by submission —" *[point to 'All 33 tests passing' in the summary banner]* "— which is the goal. But 12 of those took real work to get there."

*[Point to the timeline chart.]*

> "This is the session as a timeline. Each point is a test run. The yellow dots are moments where something changed — a test broke or a test got fixed. You can see the cluster of work on the left —" *[gesture at the left-side density]* "— and a long stretch in the middle where nothing changed, probably sleeping or in class."

*[Point to the episode chips below the chart.]*

> "The chips below are the 13 meaningful segments of the session — what the tool calls episodes. Each one ends when a test's status flipped. The red ones are regressions — a working test broke. The blue ones are fixes. You can click any chip and it'll jump directly to that test's feedback."

*[Optional humor — if the timestamps are visible:]* "You'll notice this session started at 11:42 PM. Relatable." *[Brief pause — move on quickly.]*

---

### SCREEN 3 — Improved Tab, Test Card (1:20–2:30)

*[The app auto-selects the Improved tab since there are no lingering failures.]*

> "The interesting tab is this one — **Improved**. These are tests that were failing at some point and you eventually fixed. Five of them have detailed feedback — those are the ones marked with the amber dot."

*[Click `testRemoveReturnValue` — the amber dot card. The shimmer plays, then content fades in.]*

> "Let me open this one."

*[The card opens. Point to "What happened".]*

> "**What happened** — this is the explanation. Not a description of what you intended to do, what actually changed: 'this test was passing in run 50, broke in run 53 after a change to the successor logic, and here are the three edits that contributed.'"

*[Scroll slightly to show the diffs.]*

> "**Code change** — here are the three edits, labeled with timestamps and location. Before and after, inline. You don't have to open a separate file, you don't have to reconstruct what changed — it's right here."

> "Notice the labels: Run 50, Run 53, Run 55. The tool traces the specific moments across your session, not just the final state."

*[Scroll to show "Why this matters" / next steps if visible.]*

> "And **why this matters** — this concept shows up again later in the course. The tool connects what happened here to what's coming."

*[Point to the practice drill button.]*

> "And at the bottom — a practice test worth a point back. One function, about 10 minutes. That's optional. But it's there if you want to close the loop."

---

### HONESTY MOMENT (2:30–2:45)

> "The tool isn't perfect. The explanations are AI-generated and they're usually accurate about **what changed** — that's traceable directly from your test runs and diffs. The **interpretive layer** — why it broke, what to do — is where it's still being improved.

> That's the honest version. When it's right, it saves you the worst part of debugging. When it's not, you have the diffs right there to look at yourself."

---

### THE SETUP / NOT EXTRA WORK (2:45–3:00)

> "The logger runs automatically as part of your normal testing workflow. You don't install anything, run anything extra, or change how you work. The feedback shows up after you submit. You don't have to open it, and opening it doesn't affect your grade.

> Think of it as an interactive study guide for the practical side of the course — one that's already built from the work you already did."

---

### CLOSE + TRANSITION (3:00–3:10)

> "That's it. Let me show you the consent form."

*[Begin distributing packets — pass down rows.]*

---

## Verbal Framing Before Handing Out Consent Forms

Say these four things **before** students start reading:

1. **No grade impact:** "Signing or not signing has no effect on your grade, your standing in the course, or your access to the tool."

2. **Everyone gets the tool:** "Everyone in the course gets the feedback regardless of whether you participate in the study — the study is only about whether your de-identified data is included in research analysis."

3. **Purpose:** "The goal is to help you learn from what happened during your debugging session so you can come back stronger on the next assignment — it's not a judgment of your work."

4. **Take it home:** "You can take the form with you if you'd rather think about it — this is not a decision you need to make right now in front of everyone."

---

## Consent Form Distribution Logistics

- Forms are stapled packets, passed down rows from a stack
- Metal tray + pens near the door: *"When you're done, signed or unsigned, drop it in the tray on your way out. Pens are there if you need one."*
- **Once forms go out, transition to the next class activity.** Don't stand at the front watching students read. Let the pace be theirs. Be available for quiet questions but don't hover.

---

## What Might Surprise Students Reading the Form

Flag these for brief verbal mention during or right after the demo so students aren't caught off guard:

| Item | Where to mention | Suggested framing |
|------|-----------------|-------------------|
| **Language model (AI) analysis of code and test data** | During the honesty moment | Already covered — "explanations are AI-generated" handles this |
| **Survey in Weeks 9–10** | Before distributing forms | *"There's also a short survey later in the quarter — that's the main way you'd give feedback on whether the tool helped."* |
| **Gift card drawing** | Before distributing forms | *"Participants are entered into a gift card drawing — that's on the form."* |
| **Automatic data collection language** | Before distributing forms (if needed) | *"The logger collects what's already in your test output and git history — it doesn't observe anything new about you."* |

---

## Handling Difficult Questions

**"What if I don't want the feedback?"**
> "You can ignore it entirely. It shows up, and if you never open it, nothing happens — no reminder, no grade impact."

**"What if I don't want this to exist at all / I don't want my work analyzed?"**
> "The logger reads what's already in your test output and git history. It doesn't observe anything new. And the feedback only goes to you — I can't see your individual data and I don't want to. That's not what this is for."

**"How accurate is the AI?"**
> "The factual layer — what changed, when — is directly from your diffs, so that's reliable. The interpretive layer is where I'd say 'usually right but not always.' The diffs are always there if you want to check it yourself."

**"Is this graded?"**
> "No. Opening or not opening the feedback has no effect on your grade."

**Silence / no questions:**
Have a natural transition ready: *"Great — let me get you the forms."* Don't wait for hands.

---

## Demo Data Notes

**Current state (as of last pipeline run):**
- 0 failing, 12 improved, 21 passing (all tests fixed by submission)
- 5 feedback items (all in Improved tab) — `testRemoveReturnValue` (3 diffs), `testIterator`, `testRemoveAdvanced`, `testContainsNonBST`, `testPreOrderIterator`
- 13 episodes

**Demo card to expand:** `testRemoveReturnValue` — 3 diffs across 3 timestamps is the strongest visual demonstration of multi-cause analysis. The pattern label "Inverted size assertions and pointer-replacement logic errors in remove" is slightly jargon-heavy, but the explanation prose and the labeled diffs carry the story without requiring BST knowledge.

**If asked about the 13 episodes:** "For this session with 33 tests and 57 runs, 13 test-flip events is about right. Each one is a real boundary — a test changed status. The target for a typical session is 3–8, but a session with a lot of back-and-forth on a complex assignment will produce more."

---

## Pedagogical Research Note (for the "striking while iron is hot" argument)

If you want to cite research for the timely feedback point:
- **Hattie & Timperley (2007)** — meta-analysis showing feedback is most effective when it's specific, timely, and tied to the task rather than the person
- **Karpicke & Roediger (2008)** — retrieval practice / spaced repetition: re-engaging with material shortly after learning consolidates it better than passive re-study
- **Black & Wiliam (1998)** — formative assessment (feedback during learning, not just at the end) is one of the highest-leverage interventions in education

Framing: *"The feedback is most useful right after submission, while your memory of the session is fresh. That's the window. Three days later you're already mentally moved on."*
