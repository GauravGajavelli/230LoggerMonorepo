# Demo Outline — CSSE 230 Debugging Feedback Tool
**Duration:** 5–6 min · **Audience:** CSSE 230 students

---

## Setup checklist

- [ ] `make demo-full-cached` to regenerate `frontend.json` (free, uses cache)
- [ ] `npm run dev` in Frontend/, browser at `localhost:5173`, fullscreen
- [ ] App open to assignment list, all cards collapsed, drill modal closed
- [ ] Calendar spreadsheet open in another tab (BST through end of quarter)
- [ ] Moodle Exam Resources page open in another tab
- [ ] Eclipse open with BSTTesting.java ready to paste into
- [ ] Consent form packets ready, stapled, stacked on the right side

**Best card to expand:** `testRemoveReturnValue` in the Improved tab — 3 diffs across 3 timestamps. Pre-click once to verify the shimmer animation, then close it.

---

## 1. Motivation (personal story)

- Did well on the homework assignments, but struggled on the exams
- That feeling: you could get the homework done, but you still didn't feel confident in your abilities
  - Sort of figuring things out on the fly while you're in the code — not sure why things work out in the end
  - Accidentally passing test cases happens more than you'd think: you change something, the test passes, you move on without knowing why
- Then you walk into the exam. You saw this exact thing on the homework. But you never really understood it — you just got it to pass.
- Show of hands: how many of you have had that experience, in 220 or even in this class so far?
- That gap — between finishing an assignment and actually understanding what you debugged — is what this tool is trying to close

---

## 2. Logistics + key terms

**No extra work:**
- The logger runs automatically as part of your normal testing workflow — nothing to install, nothing to run differently
- Feedback appears after you submit. You don't have to open it, and opening it doesn't affect your grade

**Scope:**
- Only on a few assignments later in the quarter — not WarmupAndStretching, which you're working on right now
- When you do get feedback, you'll see at most 5 highlighted items — the tests that most warrant a second look

**Key terms** (not standard for freshman-level CS):
- **Session** — from when you first started working on the assignment to when you submitted
- **Episode** — a discrete segment of your session. The tool cuts the session into episodes at the moments when a test's status actually changed: something broke, or something got fixed. Each episode ends at a boundary event.
- **Regression** — a test that was passing and then broke. Not a dirty word — it happens constantly in development.
- **Diff** — the before-and-after view of a code change. Two columns: what was there, what replaced it.

---

## 3. Set expectations

- This isn't a wall of information — it's a small, focused set of things worth revisiting
- It's also why it only runs on selected assignments: the tool is most useful when the concept matter beyond the assignment itself, not on every piece of practice work
- Think of it as an interactive study guide built from your own session — we'll come back to what that means

---

## 4. UI walkthrough

### Assignment list
- This is the landing view after submission
- Each card shows the assignment and a color bar: blue = tests that were failing at some point but you fixed, green = always passing. You can see the shape of the session before clicking anything.
- "Private to you" in the header with the lock — this is yours. Not visible to course staff.
- IRB footer — briefly acknowledge, say you'll explain after the demo

### Click into BST

#### Session timeline
- Each point on the chart is a test run
- Yellow dots mark the moments when a test's status changed — something broke or got fixed
- The density on the left is the active work; the flat stretch in the middle is probably sleep or class. The timeline is the session as it actually happened.
- Caption below the chart: "Based on test runs recorded during your work session"
- Natural humor moment if the timestamps show: this session started at 11:42 PM

#### Episode chips
- The chips below the chart are the episodes — the discrete segments defined by test-status changes
- Red chip = regression (something that was working broke), blue chip = fix
- Clicking a chip jumps directly to the feedback for that test
- These are navigation — a way to orient yourself in the session before reading anything

#### Summary banner
- Shows the overall shape: how many tests needed work, how many improved, how many always passed
- Hover over the individual bars to see test names
- Everything passed by submission here; 12 of 33 took real work to get there

#### Test tabs — click through all three
- **Failing** — tests that were still broken at submission. (Empty here — everything got fixed.)
- **Improved** — tests that were failing at some point and you eventually fixed. This is where the interesting feedback lives.
- **Passing** — tests that were always passing throughout the session.
- Amber dot on a tab = there's unread feedback in that tab
- The timestamp on each test card in the Improved tab is when the test last changed status — i.e., when it finally passed

#### How detection works (before opening a card)
- The pipeline replays your session: it re-runs all your test snapshots in order, tracks which tests flip and when, identifies the code changes that coincide with those flips, and flags the tests where the debugging took the longest or where something regressed
- Flip-flops, sustained failure runs, regressions — that's what surfaces as a feedback item
- The five highlighted here are the tests that most warrant a second look. All 33 are still on the exams and future assignments — the tool is just telling you where to focus your review time

#### Value proposition (before opening a card)
- What you're looking at now is basically a study guide built from your own session
- Switch to the calendar spreadsheet: point out BST concepts and where they appear again — the next exam, the next assignment that builds on it. This isn't a one-and-done topic.
- Switch back to the app: the tool knows this context. When you look at a flagged test, it tells you where that concept shows up next and what you can do about it right now.

#### Open `testRemoveReturnValue`
- **What happened** — what actually changed, not what you intended. All three contributing edits, in chronological order. Specific run numbers.
- **Code change** — three labeled diffs: Run 50, Run 53, Run 55. Before and after, inline. The labels tell you not just what changed but when. You don't have to reconstruct this from git history.
- **Why this matters** — concept score bars and future course appearances. Point to where this concept shows up on the next exam.
  - Switch to the Moodle Exam Resources page: "This is what's there now — past exams, practice problems. I'm basically organizing the relevant parts of this for you, tied to your specific session."
  - Switch back to the app.
- **Practice drill** — this is the actionable piece. One function to implement, worth a point back on regrade.
  - Pedagogical argument: you're still in the code. Your memory of this session is fresh. The research on spaced retrieval and timely feedback (Karpicke & Roediger 2008, Hattie & Timperley 2007) is consistent: re-engaging with material right after you've worked on it consolidates it better than coming back to it cold. The drill is designed to hit that window.
  - Switch to Eclipse: paste in the drill test, show it compiling and running. This is a real, runnable test — not advice to read.
  - Switch back to the app.
- Run history sparkline at the bottom of the card: the bar chart of your session for this specific test — shows when it was failing, when it passed, how long the struggle lasted

#### Other interactive elements worth noting
- **View test** button (`</> view test`) — shows the original test code inline if you want to see exactly what was being tested
- **Mark as reviewed** button at the bottom of the page — for when you're done

---

## 5. Consent forms

- "That's the tool. Let me tell you what participation in the study actually means."

**Say these four things before passing forms:**
1. Signing or not signing has no effect on your grade, standing, or access to the tool
2. Everyone gets the feedback regardless — the study is only about whether your de-identified data is included in research analysis
3. The goal is to help you come back stronger on the next assignment — not a judgment of your work
4. You can take the form home if you'd rather think about it

**Also mention** (these are in the form and will catch people off guard otherwise):
- Short survey in Weeks 9–10
- Gift card drawing for participants
- AI analysis: explanations are AI-generated from your diffs and test data
- Data collection reads what's already in your test output and git history — it doesn't observe anything new

**Pass forms down from the stack on the right.** When they're done — signed or not — they pass back to you at the end of class. Be available for quiet questions but transition to whatever's next so students aren't waiting on each other.

---

## If questions come up

**"What if I don't want the feedback?"** — You can ignore it. Nothing happens if you never open it.

**"What if I don't want this to exist?"** — The logger reads what's already in your test output and git history. It doesn't observe anything new. The feedback only goes to you.

**"How accurate is the AI?"** — What changed and when is reliable — that's directly from your diffs. The interpretation is usually right but not always. The diffs are there if you want to check it yourself.

**"Is this graded?"** — No.

**Silence** — "Great, let me get you the forms." Don't wait for hands.
