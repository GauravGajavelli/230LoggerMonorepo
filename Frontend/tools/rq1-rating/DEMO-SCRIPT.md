# RQ1 Rating Tool — Demo Script

A 5-minute walkthrough to show raters how the tool works before they start.

## Setup (before the demo)

```bash
# Generate demo data (uses your own submission, not real students)
node Frontend/tools/rq1-rating/prepare-rating-data.cjs --demo

# Start local server
cd Frontend/tools/rq1-rating
python3 -m http.server 8787
```

Open: **http://localhost:8787/rating-tool.html?demo**

---

## Demo Steps

### 1. Enter your rater ID (~15 seconds)

- The landing screen asks for a Rater ID
- Type something like `Demo-Rater` and click **Start Rating**
- Point out: "This is the only setup — no accounts, no login"

### 2. Orient to the layout (~30 seconds)

- **Top bar**: shows rater name, progress (0 of 1 rated), and dot indicators
- **Left side**: all the generated feedback for this student-assignment pair
- **Right side**: the rating panel (sticky — stays visible as you scroll)
- Point out the pair ID (DEMO-001) and assignment label (Binary Search Tree)

### 3. Walk through the feedback content (~2 minutes)

- **Failed Tests** (already expanded): "Here are all the tests this student failed — you can see the highlight category, how many runs failed, and whether they eventually fixed it"
- **Feedback Item 1/5**: expand and walk through:
  - **Pattern + confidence badge**: "The system identified this as a regression from incorrect pointer reassignment"
  - **Root cause analysis**: "This is the LLM's explanation of what went wrong — this is what you're primarily evaluating"
  - **Next steps**: "Actionable recommendations the student would see"
  - **Code diffs**: "Before/after code with an annotation explaining what changed"
  - **Course appearances**: "How the system mapped this to upcoming assessments"
  - **Drill**: "A practice problem the student can try — note the test code, hints, and source attribution"
- Collapse Feedback 1, briefly show that there are 4 more feedback items
- **Episode Context** (collapsed): "This shows what the student was doing in each coding session — intent, progress. It's background context, not what you're rating"
- **Assessment Drill Mapping** (collapsed): "Shows which exams these drills map to and overlap percentages"

### 4. Rate the pair (~1 minute)

- **Correctness**: select a score from the dropdown — point out the rubric text in each option
- **Actionability**: select a score
- **Specificity**: select a score
- Show the **Rubric Reference** toggle: "If you need to review the full rubric definitions, expand this"
- Check a failure mode checkbox (e.g., `vague_recommendation`): "Tag any issues you notice"
- Type a quick note: "Optional — add context for anything unusual"
- Point out: "Your rating is saved automatically — no save button needed"
- The progress dot turns green and the counter updates to "1 of 1 rated"

### 5. Show resume behavior (~30 seconds)

- Close the browser tab entirely
- Reopen **http://localhost:8787/rating-tool.html?demo**
- "Notice it skipped the setup screen and went straight back to where I was — my rater ID, position, and all ratings are preserved"
- Show the rating panel still has the scores you entered

### 6. Show export (~30 seconds)

- Click **Export JSON**: a file downloads with your ratings
- Click **Export CSV**: a second file downloads
- "These go directly into R or Python for inter-rater reliability analysis"

### 7. Wrap up (~15 seconds)

- "When you do the real rating, you'll have 35 pairs instead of 1"
- "Use left/right arrow keys to move between pairs"
- "Click any dot at the top to jump to a specific pair"
- "Budget about 1–2 minutes per pair — the whole thing should take under an hour"

---

## Common questions raters may ask

**Q: What exactly am I rating?**
The system's generated feedback — the pattern identification, root cause explanation, next steps, drills, and concept mappings. You're judging whether these are correct, actionable, and specific to this particular student.

**Q: Should I rate each feedback item separately?**
No — give one holistic rating per pair. Consider all the feedback items together.

**Q: What if I want to change a rating?**
Navigate back to that pair (click its dot or use arrow keys) and change the scores. It autosaves.

**Q: Can I rate in any order?**
Yes, but the default order is the same for all raters (for consistency). You can jump around if needed.

**Q: What happens if my browser crashes?**
Your progress is saved after every change. Just reopen the URL.
