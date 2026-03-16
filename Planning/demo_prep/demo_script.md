# Demo Outline — CSSE 230 Debugging Feedback Tool
**Duration:** 3–4 min · **Audience:** CSSE 230 students (may not know BSTs yet)

---

## Setup checklist

- [ ] `make demo-full-cached` — regenerates `frontend.json` (free, uses cache)
- [ ] `npm run dev` in Frontend/, browser at `localhost:5173`, fullscreen
- [ ] App open to assignment list, all cards collapsed
- [ ] Consent form packets ready, tray + pens near the door

**Best card to expand:** `testRemoveReturnValue` in the Improved tab — 3 diffs across 3 timestamps, strongest visual story. Pre-click once to verify the shimmer animation, then close it.

---

## Demo flow

### Before clicking anything
- Show of hands: "How many of you have had this moment — it's midnight, your test is failing, no idea what you changed?"
- Personal framing: I did OK on homework but struggled on exams. Realized I was finishing assignments without learning from them. Built this to fix that gap.
- Upfront disclaimer: "This is from a BST assignment — later in the quarter. Don't worry about the code. Watch what the tool shows about the process."

### Assignment list
- Point out the mini color bar on the BST card — the shape of the session at a glance without clicking anything. Blue = fixed, green = always passing.
- Point to "Private to you" in the header. I can't see this. Course staff can't. It's yours.
- Note the IRB footer briefly: "I'll come back to that."

### Click into the BST assignment
- Summary banner: everything passed by submission, but 12 tests took real work to get there.
- Timeline: each point is a test run, yellow dots are status changes. Note the density on the left (active work) vs. the flat stretch in the middle (sleeping or class).
- Natural humor moment if the timestamps are showing: the session started at 11:42 PM.
- Episode chips below the chart: each chip is a segment that ended when a test flipped. Red = regression, blue = fix. Clickable — jumps to that test's feedback.

### Improved tab + expand a card
- App auto-selects the Improved tab (0 lingering failures). Five cards have the amber dot — that's where the detailed feedback lives.
- Open `testRemoveReturnValue`.
- **What happened:** what actually changed, not what you intended. Covers all three contributing edits chronologically.
- **Code change:** three diffs, labeled with run number and location. Before/after, inline. Point out that it traces specific moments, not just the final state.
- **Why this matters:** connects this concept to where it shows up later in the course.
- Practice drill button at the bottom: optional, one function, worth a point back.

### Honesty
- The explanations are AI-generated. What changed and when is reliable — that's traceable from diffs. The interpretive layer (why it broke) is still being improved. When it's right, it saves the worst part of debugging. When it's not, the diffs are right there.

### Not extra work
- The logger runs automatically with your normal testing workflow. Nothing to install or change.
- Feedback appears after submission. You don't have to open it. Opening it doesn't affect your grade.
- It's basically a study guide built from work you already did.

### Close
- "That's it — let me show you the consent form."
- Start passing packets down rows.

---

## Before handing out forms, say these four things

1. Signing or not signing has no effect on your grade, standing, or access to the tool.
2. Everyone in the course gets the feedback regardless of whether they participate in the study — the study is only about whether your de-identified data is included in analysis.
3. The goal is to help you come back stronger on the next assignment. It's not a judgment of your work.
4. You can take the form home if you'd rather think about it. You don't need to decide right now.

Also mention briefly: there's a short survey in Weeks 9–10, participants are entered in a gift card drawing, and the logger collects what's already in your test output and git history — it doesn't observe anything new. (These are in the form and can catch students off guard if unannounced.)

**Once forms are out, transition to the next topic.** Don't stand at the front watching people read. Be available for quiet questions but let the pace be theirs.

---

## If questions come up

**"What if I don't want the feedback?"** — You can ignore it. Nothing happens if you never open it.

**"What if I don't want my work analyzed at all?"** — The logger reads what's already in your test output and git history. It doesn't observe anything new. The feedback only goes to you.

**"How accurate is it?"** — What changed and when is reliable. The interpretation is usually right but not always — the diffs are there if you want to check.

**No questions / silence** — "Great, let me get you the forms." Don't wait for hands.

---

## Data reference

- 0 failing, 12 improved, 21 passing at submission
- 5 feedback items in the Improved tab
- 13 episodes (expected — 13 test-flip events across 57 runs)
- Research citations if you want them for the timely-feedback argument: Hattie & Timperley (2007), Karpicke & Roediger (2008), Black & Wiliam (1998)
