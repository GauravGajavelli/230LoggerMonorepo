I'm building the demo version of a web feedback application for a 
research study in CSSE 230 (Data Structures). The tool gives students 
next-day, personalized debugging feedback on assignments after 
submission. I need to reshape both the data processing layer and the 
UI to match a planned design direction.

Read these files first, in this order:

1. The updated wireframe (the design target):
   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/demo_prep/feedback-app-wireframe.jsx

2. My current implementation:
Frontend:   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/
Data/explanation layer:   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline/
- Ignore the rest of /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/ for now

---

CONTEXT: WHAT THIS DEMO NEEDS TO PROVE (4 MINUTES)

Two arguments must land:
- Value: the tool makes debugging meaningfully better, not just 
  marginally better
- Privacy: students' data isn't exposed to instructors, peers, or 
  the public

The audience includes students who may be future participants, so 
the demo is also a soft recruitment moment — honest, not oversold.

---

THIS WORK HAPPENS IN TWO PHASES. PHASE 1 (DATA/PROCESSING) MUST 
BE COMPLETED AND VALIDATED BEFORE PHASE 2 (UI) BEGINS.

═══════════════════════════════════════════════════════════════════
PHASE 1: DATA PROCESSING AND CONTENT GENERATION CHANGES
═══════════════════════════════════════════════════════════════════

These changes affect how episodes are created, what the explanation 
layer generates, and what data shape the frontend expects. All of 
this must be working and validated against my actual demo assignment 
data before any UI work starts.

---

1A. EPISODE CREATION ALGORITHM

The current algorithm produces too many episodes (19 for a 57-run 
assignment) because it segments by edit proximity or semantic 
similarity. The new algorithm should segment by TEST OUTCOME 
BOUNDARIES instead:

- An episode boundary occurs when the pass/fail vector of the 
  test suite changes — any test flips from passing to failing or 
  vice versa. That is the ONLY cut point.
- All runs between two consecutive test-result changes belong to 
  a single episode, regardless of how many edits, methods, or 
  files were touched.
- Runs where test results don't change get absorbed into the 
  surrounding episode.
- The final span (from last test-result change through submission) 
  is one episode, even if many runs occurred.
- Target: roughly 3–8 episodes per typical assignment session. If 
  a session produces more than 8, the segmentation is probably 
  still too granular.

Each episode must include:
- timeRange: start and end timestamps of the span
- edits: count of edits within the span
- area: factual summary of which files/methods were modified 
  (e.g., "remove(), leaf-node branch"). This is WHAT was touched, 
  NOT what the student intended.
- outcome: the test status change that ended this episode, stated 
  with direction (e.g., "testRemoveLeaf went from passing to 
  failing"). For the final episode, if no test changed, state 
  what was touched and that no test results changed.
- outcomeType: "regression" or "fix"
- linkedTestId: the test whose status change defines this episode 
  boundary (used for navigation only — this is a 1:1 simplification 
  for the UI, not a causal claim)

---

1B. TIMELINE DATA SHAPE

The timeline chart needs to handle a VARIABLE number of tests 
across the session. Students don't always run the full suite — 
they may run a single test or a subset. The timeline must use 
CUMULATIVE LAST-KNOWN RESULTS:

- At each time step, carry forward the most recent known result 
  for every test. If the student runs only testRemoveLeaf at 
  10:05 PM, the passing/failing counts at that time step should 
  reflect the new result for testRemoveLeaf plus the last known 
  results for all other tests.
- Never drop a test from the count just because it wasn't included 
  in a particular run. The total (passing + failing) should remain 
  stable or change only when new tests are added for the first 
  time.
- Each timeline data point must include:
  - time: timestamp
  - passing: count of tests whose last known result is passing
  - failing: count of tests whose last known result is failing
  - event: string description if a test's status changed at this 
    point (e.g., "testRemoveLeaf broke"), null otherwise
- The timeline's vertical axis should adapt to the actual total 
  number of tests, not be hardcoded to a fixed max.

---

1C. EXPLANATION LAYER CONTENT REQUIREMENTS

The explanation layer generates the content that appears inside 
expanded test cards. The current mock assumes one explanation, one 
diff, and one suggestion per failing test. In practice, a single 
test failure can result from multiple code changes across the 
session, and students may revisit the same code area multiple 
times. The explanation layer must handle this:

EXPLANATION TEXT ("What happened"):
- A single synthesized prose paragraph that describes ALL 
  contributing causes for this test's failure.
- If multiple code changes contributed, the explanation should 
  describe them in chronological order and explain how they 
  interact: "At 10:05 PM you modified the value copy in the 
  successor logic, and at 10:31 PM you changed the successor 
  lookup itself. The lookup issue is the primary cause, but the 
  earlier value copy change also has an off-by-one that will 
  surface once the lookup is fixed."
- The explanation should be factual about what changed and 
  mechanical about consequences. It should NOT narrate the 
  student's intent, mental state, or emotional experience. 
  "You changed X and this caused Y" — not "You tried to fix X" 
  or "You struggled with X."
- Language should be constructive: describe what needs attention, 
  not what the student did wrong.

DIFFS ("Code change"):
- A LIST of diffs, not a single diff, when multiple code changes 
  contribute to a failure.
- Each diff in the list must include:
  - label: a timestamp and brief location identifier 
    (e.g., "10:05 PM — successor value copy, line 132")
  - before: array of code lines (with - prefix for removed lines)
  - after: array of code lines (with + prefix for added lines)
- Order diffs chronologically.
- For tests where only one change is relevant, this is a list 
  of length 1 — the UI handles both cases identically.

SUGGESTION ("Suggested next step"):
- A single synthesized paragraph that addresses the most 
  impactful fix FIRST, then mentions secondary issues if they 
  exist.
- If multiple changes contribute: "Start by fixing [primary 
  issue] on line X. Once that's working, check [secondary issue] 
  on line Y."
- Should reference specific line numbers and, where possible, 
  point to a parallel case in the student's own code that's 
  correct (e.g., "compare this to how you handle the mirror 
  case on line 153").

---

1D. DATA SHAPE SUMMARY — WHAT THE FRONTEND EXPECTS

For the assignment list, each assignment needs:
- id, title, dueDate, submittedAt
- status: "new" or "reviewed"
- passing, failing, improved, total: integer counts
  (improved = tests that were failing earlier in the session 
  but are now passing at submission)

For the detail view, each assignment needs:
- summary: { passing, failing, improved } counts
- tests: array, each with:
  - id, name
  - status: "failing" | "passing" | "improved"
  - changedAt: timestamp of most recent status change (null if 
    test never changed status)
  - explanation: synthesized prose string (see 1C above)
  - suggestion: synthesized prose string (see 1C above)
  - diffs: ARRAY of { label, before, after } objects (see 1C)
    (note: this is "diffs" plural, not "diff" singular)
- timeline: array of cumulative data points (see 1B above)
- episodes: array of episode objects (see 1A above)

---

PHASE 1 DELIVERABLE: Implement the processing changes above and 
run them against my actual demo assignment data. Show me the 
output: the episode list, timeline data, and one example of a 
multi-cause test explanation if one exists in my data. I will 
validate this before proceeding to Phase 2.

═══════════════════════════════════════════════════════════════════
PHASE 2: UI CHANGES (DO NOT START UNTIL PHASE 1 IS VALIDATED)
═══════════════════════════════════════════════════════════════════

SCREEN ARCHITECTURE

Two screens only:

1. Assignment list (landing page)
   - "New feedback" vs "Previously reviewed" grouping
   - Each card shows: title, due date, pass/fail/improved counts, 
     status pill ("3 to review" / "Reviewed"), mini color bar
   - Subheader includes: "Only you can see this feedback — it is 
     not shared with course staff."
   - No empty state hint (cut for demo)

2. Detail view (the core)
   - Back nav to assignment list
   - Summary banner: constructive framing ("3 of 8 tests need 
     attention") + progress acknowledgment ("2 tests improved")
   - Session timeline chart with event dots at test status 
     changes. Dots should be large enough for projector 
     visibility. Y-axis adapts to actual test count.
   - Episode chips displayed inline below the timeline chart 
     caption, inside the same card. Small colored chips 
     (red-tinted = regression, blue-tinted = fix) showing start 
     time and code area. Clickable — jumps to linked test card 
     by switching tab and scrolling. These are navigation aids, 
     NOT a prominent section.
   - Tabbed test list: Needs attention / Improved / Passing
   - Failing test cards expand to show three layers:
     "What happened" (synthesized explanation prose) → 
     "Code change" (one OR MORE labeled inline diffs, stacked 
     vertically, ordered chronologically) → 
     "Suggested next step" (synthesized suggestion prose)
   - "Mark as reviewed" closure button at bottom

Persistent across both screens:
- Header with "CSSE 230 · Debugging Feedback" left, 
  "Private to you" with lock icon right (must be legible on 
  projector — bright text, not muted)
- Footer: "Part of an IRB-approved research study. Learn more"
  (no opt-out link — that's handled via email)
- Timeline caption: "Based on test runs recorded during your 
  work session" (explains data provenance without a separate 
  screen)

---

DESIGN PRINCIPLES (RESEARCH CONTEXT — THESE MATTER)

- Color encodes meaning only: fail/pass/improved status. No 
  decorative color.
- Animation limited to state-change signaling: expand/collapse, 
  hover feedback. No entrance animations or engagement flourishes.
- Typography does hierarchy: small uppercase labels for sections, 
  monospace for code and timestamps, readable body for 
  explanations.
- Test: "If I removed this element, would the student 
  misunderstand something or lose their place?" If no, it 
  shouldn't be there.
- The study tracks whether feedback was opened, features used, 
  and time spent. Visual engagement tricks become research 
  confounds.

---

WHAT TO CARRY OVER FROM MY CURRENT IMPLEMENTATION

- **Color palette**: My current implementation uses colors that 
  align with our institution's branding. Carry those over rather 
  than using the wireframe's palette outside of the figures. 
  Apply my existing colors to the wireframe's structure — the 
  header, status indicators, buttons, and accent colors should 
  all use my current scheme. The semantic meaning (red-ish = 
  failing, green-ish = passing, etc.) should still hold, just 
  using my institution's specific values.
- **Data fetching and backend integration**: Keep all existing 
  API calls, data shapes, and state management. Reshape the UI 
  layer only.
- **Component structure**: Refactor rather than rewrite. Keep my 
  existing component boundaries where possible and reshape their 
  rendering to match the wireframe's layout and information 
  hierarchy.
- NOTE: When used on current demo data (based on my completing 
  an actual assignment), the current episode timeline and the 
  Progress Over Time bar chart either overflow due to too many 
  items or just look awkward. Phase 1 changes should resolve 
  the underlying data issues; Phase 2 resolves the visual ones.

---

PHASE 2 TASK

Compare my current implementation against the wireframe and 
principles above. Then:

1. Identify my current color values (from CSS, theme files, or 
   component styles) and map them to the wireframe's color roles 
   (header bg, primary text, muted text, fail status, pass 
   status, improved status, card borders, button bg, etc.)

2. For each screen/component, list:
   - What aligns with the wireframe direction (keep)
   - What diverges (change, with specifics)
   - What's missing (add, with placement)
   - These will be resolved before moving on to implementation

3. Implement the changes, starting with the highest-impact items 
   first. Work through each component, preserving my data layer 
   and institutional colors while reshaping the UI to match the 
   wireframe's structure and information hierarchy.

Pause after step 2 for my review before making changes.

================= TODO Afterwards ======================

To address the questions: have the list view, but just route to the same assignment data, please help me debate the usefulness of these features for review students will realistically want/use, as they're mentioned in my proposal (provide   
  both sides of the argument), and finally the 

================= TODO Afterwards ======================

The Phase 1 (data processing) and Phase 2 (UI) changes are 
now implemented. I'm reviewing the result against the demo 
script before finalizing. Walk through the app with me, 
using my actual demo assignment data — not mock data.

---

SCREEN-BY-SCREEN REVIEW

1. Assignment list:
   - Is the new/reviewed split clear at a glance?
   - Does the institutional color palette maintain semantic 
     meaning (fail = obvious, pass = obvious, improved = 
     distinct from both)?
   - Does the "Only you can see this feedback" line read 
     clearly without competing with the main subheader?

2. Detail view — summary and timeline:
   - Does the summary banner correctly count passing, failing, 
     and improved based on the actual data?
   - Does the timeline chart handle the real number of tests 
     in my data? Is the Y-axis scaled correctly — not 
     hardcoded to 8?
   - With cumulative last-known results, does the total 
     (passing + failing) stay stable across time steps, or 
     are there drops where partial test runs cause the count 
     to dip?
   - Are the event dots visible and correctly placed at 
     moments where the pass/fail vector actually changed?
   - Do the episode chips below the timeline reflect the 
     test-outcome-boundary segmentation? How many episodes 
     does my real data produce? If more than 8, something 
     may still be off in the processing.

3. Detail view — test cards:
   - Expand a failing test that has MULTIPLE contributing 
     code changes (if one exists in my data). Does the 
     explanation read as a single synthesized paragraph 
     covering all causes, or does it only address one?
   - Are multiple diffs displayed as labeled, chronologically 
     ordered, stacked sections under "Code change"?
   - Does the suggestion address the primary fix first and 
     mention secondary issues?
   - For a simple single-cause failure, does the same UI 
     feel clean and not over-structured?

4. Projector check:
   - "Private to you" label with lock icon: legible on a 
     washed-out projector? (Needs bright text on dark header, 
     not muted gray.)
   - Timeline event dots: large enough with sufficient stroke 
     weight?
   - Status pills on assignment cards: readable at distance?
   - Episode chips: legible but not competing with the test 
     cards below?
   - IRB footer: present but unobtrusive?

5. Episode chip navigation:
   - Click each episode chip. Does it switch to the correct 
     tab, scroll to the linked test card, and briefly 
     highlight it?
   - Does the highlight clear after a few seconds?
   - If an episode links to an improved test (not a failing 
     one), does it still navigate correctly to the Improved 
     tab?

Flag anything that looks off and suggest targeted fixes. 
Prioritize by demo impact — things visible in the 4-minute 
script matter most.

---

IN-CLASS FLOW REVIEW

Separately, I need help reviewing the in-class flow around 
the demo. The plan is:

1. Run the 4-minute demo (script already planned)
2. Open for 1-2 minutes of questions
3. Hand out informed consent forms for students to read and 
   sign in class

The consent form is given AFTER the demo, not before — 
students need a concrete mental model of the tool before 
processing language about data collection and 
de-identification. The demo builds the value case so the 
consent form lands as a real tradeoff to weigh, not an 
abstraction to be suspicious of.

Right before handing out forms, I need to state three things 
verbally:

- Signing or not signing has no effect on your grade, your 
  standing in the course, or your access to the tool
- You can take the form home if you'd rather think about it
- This is not a decision you need to make right now in front 
  of everyone

Review the informed consent form here: [path to consent form]

Check that these three verbal statements are consistent with 
what the consent form actually says. Flag any discrepancies — 
for example, if the consent form implies a deadline or 
condition that contradicts what I'm saying out loud. Also flag 
if there's anything else in the consent form that should be 
stated verbally to avoid students being surprised by something 
they read after I've already moved on.