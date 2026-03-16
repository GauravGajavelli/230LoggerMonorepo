═══════════════════════════════════════════════════════════════════
CSSE 230 DEBUGGING FEEDBACK TOOL — DEMO PREP
═══════════════════════════════════════════════════════════════════

Before doing anything else, gain comprehensive familiarity with 
the full codebase and planning materials. Read these in order:

1. Design philosophy (guiding principles for all decisions):
   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/demo_prep/design_philosophy.md

2. The updated wireframe (the UI design target):
   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/demo_prep/feedback-app-wireframe.jsx

3. The informed consent form (shapes what we can say and do):
   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/demo_prep/InformedConsent-CSSE230-Debugging_Feedback_Tool-updated.docx

4. The full frontend implementation:
   /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend

5. The backend and data processing layer:
   Explore the rest of the monorepo to understand the logger, 
   episode generation, explanation/feedback pipeline, and data 
   shapes. Build a mental model of how data flows from the 
   student's test runs through to the frontend.

Take time with this. Summarize your understanding of the 
codebase architecture, data flow, and current state before 
proceeding. Draw on the design philosophy doc throughout — it 
should inform every decision.

---

CONTEXT: WHAT THE DEMO NEEDS TO PROVE (3–4 MINUTES)

I'm building the demo version of a web feedback application for 
a research study in CSSE 230 (Data Structures). The tool gives 
students next-day, personalized debugging feedback on assignments 
after submission.

Two arguments must land in the demo:
- Value: the tool makes debugging meaningfully better, not just 
  marginally better
- Privacy: students' data isn't exposed to instructors, peers, 
  or the public

The audience includes students who may be future participants, 
so the demo is also a soft recruitment moment — honest, not 
oversold.

---

THIS WORK HAPPENS IN THREE PHASES. EACH PHASE MUST BE COMPLETED 
AND VALIDATED BEFORE THE NEXT BEGINS.


═══════════════════════════════════════════════════════════════════
PHASE 1: DATA PROCESSING AND CONTENT GENERATION CHANGES
═══════════════════════════════════════════════════════════════════

These changes affect how episodes are created, what the 
explanation layer generates, and what data shape the frontend 
expects. All of this must be working and validated against my 
actual demo assignment data before any UI work starts.

---

1A. EPISODE CREATION ALGORITHM

The current algorithm produces too many episodes (19 for a 
57-run assignment) because it segments by edit proximity or 
semantic similarity. The new algorithm should segment by TEST 
OUTCOME BOUNDARIES instead:

- An episode boundary occurs when the pass/fail vector of the 
  test suite changes — any test flips from passing to failing 
  or vice versa. That is the ONLY cut point.
- All runs between two consecutive test-result changes belong 
  to a single episode, regardless of how many edits, methods, 
  or files were touched.
- Runs where test results don't change get absorbed into the 
  surrounding episode.
- The final span (from last test-result change through 
  submission) is one episode, even if many runs occurred.
- Target: roughly 3–8 episodes per typical assignment session. 
  If a session produces more than 8, the segmentation is 
  probably still too granular.

Each episode must include:
- timeRange: start and end timestamps of the span
- edits: count of edits within the span
- area: factual summary of which files/methods were modified 
  (e.g., "remove(), leaf-node branch"). This is WHAT was 
  touched, NOT what the student intended.
- outcome: the test status change that ended this episode, 
  stated with direction (e.g., "testRemoveLeaf went from 
  passing to failing"). For the final episode, if no test 
  changed, state what was touched and that no test results 
  changed.
- outcomeType: "regression" or "fix"
- linkedTestId: the test whose status change defines this 
  episode boundary (used for navigation only — this is a 1:1 
  simplification for the UI, not a causal claim)

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
- Never drop a test from the count just because it wasn't 
  included in a particular run. The total (passing + failing) 
  should remain stable or change only when new tests are added 
  for the first time.
- Each timeline data point must include:
  - time: timestamp
  - passing: count of tests whose last known result is passing
  - failing: count of tests whose last known result is failing
  - event: string description if a test's status changed at 
    this point (e.g., "testRemoveLeaf broke"), null otherwise
- The timeline's vertical axis should adapt to the actual total 
  number of tests, not be hardcoded to a fixed max.

---

1C. EXPLANATION LAYER CONTENT REQUIREMENTS

The explanation layer generates the content that appears inside 
expanded test cards. The current mock assumes one explanation, 
one diff, and one suggestion per failing test. In practice, a 
single test failure can result from multiple code changes across 
the session, and students may revisit the same code area 
multiple times. The explanation layer must handle this:

EXPLANATION TEXT ("What happened"):
- A single synthesized prose paragraph that describes ALL 
  contributing causes for this test's failure.
- If multiple code changes contributed, the explanation should 
  describe them in chronological order and explain how they 
  interact: "At 10:05 PM you modified the value copy in the 
  successor logic, and at 10:31 PM you changed the successor 
  lookup itself. The lookup issue is the primary cause, but 
  the earlier value copy change also has an off-by-one that 
  will surface once the lookup is fixed."
- The explanation should be factual about what changed and 
  mechanical about consequences. It should NOT narrate the 
  student's intent, mental state, or emotional experience. 
  "You changed X and this caused Y" — not "You tried to fix X" 
  or "You struggled with X."
- Language should be constructive: describe what needs 
  attention, not what the student did wrong.

DIFFS ("Code change"):
- A LIST of diffs, not a single diff, when multiple code 
  changes contribute to a failure.
- Each diff in the list must include:
  - label: a timestamp and brief location identifier 
    (e.g., "10:05 PM — successor value copy, line 132")
  - before: array of code lines (with - prefix for removed)
  - after: array of code lines (with + prefix for added)
- Order diffs chronologically.
- For tests where only one change is relevant, this is a list 
  of length 1 — the UI handles both cases identically.

SUGGESTION ("Suggested next step"):
- A single synthesized paragraph that addresses the most 
  impactful fix FIRST, then mentions secondary issues if they 
  exist.
- If multiple changes contribute: "Start by fixing [primary 
  issue] on line X. Once that's working, check [secondary 
  issue] on line Y."
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
  - changedAt: timestamp of most recent status change (null 
    if test never changed status)
  - explanation: synthesized prose string (see 1C above)
  - suggestion: synthesized prose string (see 1C above)
  - diffs: ARRAY of { label, before, after } objects (see 1C)
    (note: this is "diffs" plural, not "diff" singular)
- timeline: array of cumulative data points (see 1B above)
- episodes: array of episode objects (see 1A above)

---

PHASE 1 DELIVERABLE: Implement the processing changes above 
and run them against my actual demo assignment data. Show me 
the output: the episode list, timeline data, and one example 
of a multi-cause test explanation if one exists in my data. 
I will validate this before proceeding to Phase 2.


═══════════════════════════════════════════════════════════════════
PHASE 2: UI CHANGES (DO NOT START UNTIL PHASE 1 IS VALIDATED)
═══════════════════════════════════════════════════════════════════

SCREEN ARCHITECTURE

Two screens only:

1. Assignment list (landing page)
   - "New feedback" vs "Previously reviewed" grouping
   - Each card shows: title, due date, pass/fail/improved 
     counts, status pill ("3 to review" / "Reviewed"), mini 
     color bar
   - Subheader includes: "Only you can see this feedback — it 
     is not shared with course staff."
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
     (red-tinted = regression, blue-tinted = fix) showing 
     start time and code area. Clickable — jumps to linked 
     test card by switching tab and scrolling. These are 
     navigation aids, NOT a prominent section.
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
  work session" (explains data provenance)

---

DESIGN PRINCIPLES (RESEARCH CONTEXT — THESE MATTER)

- Color encodes meaning only: fail/pass/improved status. No 
  decorative color.
- Animation limited to state-change signaling: expand/collapse, 
  hover feedback. No entrance animations or engagement 
  flourishes.
- Typography does hierarchy: small uppercase labels for 
  sections, monospace for code and timestamps, readable body 
  for explanations.
- Test: "If I removed this element, would the student 
  misunderstand something or lose their place?" If no, it 
  shouldn't be there.
- The study tracks whether feedback was opened, features used, 
  and time spent. Visual engagement tricks become research 
  confounds.

---

WHAT TO CARRY OVER FROM MY CURRENT IMPLEMENTATION

- **Color palette**: My current implementation uses colors that 
  align with our institution's branding. Carry those over 
  rather than using the wireframe's palette outside of the 
  figures. Apply my existing colors to the wireframe's 
  structure — the header, status indicators, buttons, and 
  accent colors should all use my current scheme. The semantic 
  meaning (red-ish = failing, green-ish = passing, etc.) 
  should still hold, just using my institution's specific 
  values.
- **Data fetching and backend integration**: Keep all existing 
  API calls, data shapes, and state management. Reshape the 
  UI layer only.
- **Component structure**: Refactor rather than rewrite. Keep 
  my existing component boundaries where possible and reshape 
  their rendering to match the wireframe's layout and 
  information hierarchy.
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
   component styles) and map them to the wireframe's color 
   roles (header bg, primary text, muted text, fail status, 
   pass status, improved status, card borders, button bg, etc.)

2. For each screen/component, list:
   - What aligns with the wireframe direction (keep)
   - What diverges (change, with specifics)
   - What's missing (add, with placement)
   - These will be resolved before moving on to implementation

3. Implement the changes, starting with the highest-impact 
   items first. Work through each component, preserving my 
   data layer and institutional colors while reshaping the UI 
   to match the wireframe's structure and information 
   hierarchy.

Pause after step 2 for my review before making changes.


═══════════════════════════════════════════════════════════════════
PHASE 3: DEMO REVIEW AND IN-CLASS FLOW
(DO NOT START UNTIL PHASE 2 IS VALIDATED)
═══════════════════════════════════════════════════════════════════

The Phase 1 (data processing) and Phase 2 (UI) changes are now 
implemented. I'm reviewing the result against the demo script 
before finalizing. Walk through the app with me, using my actual 
demo assignment data — not mock data.

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
   - Are multiple diffs displayed as labeled, 
     chronologically ordered, stacked sections under 
     "Code change"?
   - Does the suggestion address the primary fix first and 
     mention secondary issues?
   - For a simple single-cause failure, does the same UI 
     feel clean and not over-structured?

4. Projector check:
   - "Private to you" label with lock icon: legible on a 
     washed-out projector?
   - Timeline event dots: large enough with sufficient 
     stroke weight?
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
Prioritize by demo impact — things visible in the 3–4 minute 
script matter most.

---

DEMO SCRIPT AND VERBAL FRAMING

Help me build a 3–4 minute demo script. The demo should be 
framed as a personal story: I built this because I did well 
on the homework assignments but struggled on the exams, and I 
realized the gap was in how I was learning (or not learning) 
from my debugging process. This positions me as a peer who had 
the same experience, not a researcher asking for something.

Review the demo script with these framing goals:

PITCH FRAMING:
- Frame the tool as what it feels like to get even with the 
  assignment — to actually understand what went wrong instead 
  of just moving on.
- Frame it as a chance for a comeback, not extra work. "You 
  already did the hard part. This just helps you learn from 
  it."
- Argue for striking while the iron is hot: the feedback is 
  most valuable right after you've been in the code, while 
  your memory of the session is fresh. Suggest any 
  pedagogical research on timely feedback and spaced 
  retrieval that supports this if you're aware of it.
- Frame the tool as basically an interactive study guide for 
  the practical side of the course — everyone understands the 
  value of a study guide.
- Use minimizing language sparingly but strategically. ONE 
  well-placed "only" is effective ("feedback on only a few 
  assignments across the quarter"). Multiple "only"s in 
  sequence sound like a sales tactic. Identify the single 
  strongest place to use it.

DEMO DATA CONSIDERATIONS:
- The current demo data shows 5 failing tests. For a 3–4 
  minute demo, this is too many — the summary banner feels 
  heavy and there's no time to address them all. Evaluate 
  whether the demo data can be scoped to show 2–3 failures 
  so the proportions feel encouraging and the single expanded 
  test card doesn't feel like it's hiding four others.

DEMO AUDIENCE CONSTRAINT:
- Students in the room may not yet be familiar with Binary 
  Search Trees or the specific assignment used in the demo 
  data. The demo must land its value argument WITHOUT 
  requiring the audience to understand the code content.
- Identify any moment where the value depends on the audience 
  understanding BST-specific logic (pointer reassignment, 
  successor lookup, etc.) and suggest how to reframe that 
  moment around the STRUCTURAL value instead: "the tool 
  identified which edit broke which test" rather than "the 
  tool found the pointer bug."
- The timeline, the summary banner, the episode chips, and 
  the three-layer test card structure should all be 
  explainable in terms of "something broke here, here's what 
  changed, here's what to try" without needing to understand 
  what a BST node is.
- Suggest a brief verbal framing for the start of the demo 
  (1–2 sentences) that acknowledges the unfamiliar content 
  and redirects attention to the tool's behavior rather than 
  the code. Something like: "This is from an assignment later 
  in the quarter — don't worry about the code itself, watch 
  what the tool shows you about your debugging session."
- Flag any UI text visible during the demo (test names, 
  explanation prose, diff content, suggestion text) that 
  would be confusing or alienating to someone who doesn't 
  know the data structure, and suggest whether it matters or 
  whether the surrounding context carries the point.

INTERACTIVITY AND GROUNDING:
- Students haven't seen BSTs yet but they HAVE taken CSSE 220 
  and worked on earlier assignments. The demo should ground 
  the value in shared experience.
- Suggest 1–2 moments for brief audience interaction — a show 
  of hands ("how many of you have stared at a failing test at 
  midnight with no idea what changed?") or a callback to a 
  shared course experience ("remember [early assignment] in 
  220?"). These should be quick and early, not mid-demo.
- The goal is to make students think "I wish I had this in 
  220" before they even see the full demo.

HUMOR:
- Identify 1–2 natural moments in the demo script where a 
  light comment would fit — probably around the "11:42 PM 
  submission" timestamp or the experience of late-night 
  debugging. The humor should come from shared recognition 
  ("we've all been there") not from the tool itself.
- Don't script specific jokes — just flag the openings where 
  levity lands naturally.

FRAMING: NOT EXTRA WORK:
- The logger runs automatically as part of their normal 
  testing workflow. They don't install anything, run anything 
  extra, or change how they work.
- The feedback appears after submission. They don't have to 
  use it at all, and using it is not graded.
- The tool exists to give them a leg up — a head start on 
  understanding what went wrong so they're better prepared 
  for the next assignment, not to add another task to their 
  workload.
- Suggest where in the demo script this framing lands best. 
  It likely belongs early — either in the spoken setup before 
  showing the assignment list, or as part of the transition 
  into the detail view. Students who think "this is extra 
  work" will mentally check out before the value moment 
  arrives.
- Review the consent form's language about time commitment 
  and verify the verbal framing is consistent. The consent 
  form says "The tool does not affect grades or require any 
  additional time beyond your usual work" — the verbal 
  version should match this without overpromising.

ADDRESSING THE RELUCTANT STUDENT:
- Some students won't just be indifferent — they'll actively 
  not want automated feedback generated about their work at 
  all. This could stem from feeling surveilled, not wanting 
  their debugging mistakes documented, or a general 
  resistance to tools that analyze their process.
- The key reframe: the logger collects the same information 
  that already exists in their git history and test runner 
  output. The tool doesn't observe anything new — it 
  organizes what's already there into something more readable 
  than scrolling through terminal output the next morning.
- The feedback is not a report card on their process. It 
  doesn't score them, rank them, or tell the instructor 
  anything. It's closer to a smart bookmark in their own work 
  history.
- Students can ignore it entirely. It appears, it waits, and 
  if they never open it, nothing happens. No reminders, no 
  guilt, no grade impact.
- This framing probably should NOT be in the demo itself — 
  spending demo time on reluctant students dilutes the value 
  pitch for the majority. It more likely belongs in the 
  verbal framing around the consent form.
- Review whether the consent form adequately addresses this 
  posture, or whether there's a gap between what the form 
  says and what a reluctant student needs to hear. Flag if 
  the form's language about automatic data collection could 
  feel coercive to someone who doesn't want the tool to 
  exist at all, and suggest verbal framing that addresses 
  this honestly.

HONESTY ABOUT LIMITATIONS:
- After the core value moment (expanded test card), include 
  a brief acknowledgment: the tool isn't perfect, 
  explanations won't always be right, it won't catch 
  everything. But when it works, it saves the worst part of 
  debugging.
- Tone: confident about purpose, candid about current state. 
  "We built this to help, it's still being improved, and 
  your experience is part of what makes it better."
- This comes AFTER the value moment, not before.
- Review the verbal statements made before handing out 
  consent forms and suggest whether the limitations 
  acknowledgment belongs there too, or whether saying it 
  once during the demo is sufficient.

CLOSING THE DEMO:
- Be prepared for no follow-up questions. Have a natural 
  transition ready: "Great — let me show you the consent 
  form" or a brief closing line that doesn't hang in awkward 
  silence waiting for hands to go up.
- Be prepared for "what if I don't want this feedback?" 
  Answer honestly: "You can ignore it entirely. It shows up, 
  and if you never open it, nothing happens."
- Be prepared for "what if I don't want feedback to exist at 
  all?" The reframe: the tool reads information that already 
  exists in your git history and test output. It doesn't 
  observe anything new.
- Do NOT say "we're legally required to not look at your 
  data" or frame protections as legal obligations. Instead 
  state it directly: "I can't see your individual data and 
  I don't want to — that's not what this is about."

---

CONSENT FORM DISTRIBUTION

The consent form is given AFTER the demo, not before — students 
need a concrete mental model of the tool before processing 
language about data collection and de-identification. The demo 
builds the value case so the consent form lands as a real 
tradeoff to weigh, not an abstraction to be suspicious of.

Right before handing out forms, state these four things 
verbally:

- Signing or not signing has no effect on your grade, your 
  standing in the course, or your access to the tool
- Everyone in the course gets the tool and its feedback 
  regardless of whether you participate in the study — this 
  is only about whether your de-identified data is included 
  in research analysis
- The goal of this tool is to help you learn from what 
  happened during your debugging process so you can come back 
  stronger on the next assignment — it's not a judgment of 
  your work
- You can take the form home if you'd rather think about it 
  — this is not a decision you need to make right now in 
  front of everyone

LOGISTICS:
- Consent forms should be stapled as complete packets — each 
  student gets one packet, no loose pages to assemble or lose.
- Forms are passed down rows from a stack. Each student takes 
  one and passes the rest.
- A metal document tray with pens sits near the door. After 
  the forms go out, briefly say: "When you're done, signed or 
  unsigned, drop it in the tray on your way out. Pens are 
  there if you need one."
- The tray's physical presence near the exit does the work — 
  it signals the collection method without making it a 
  moment. Students who sign can drop it off casually. 
  Students who don't sign can leave an unsigned form just as 
  casually. Students who want to take it home just keep it.
- IMPORTANT: Once the forms are out, transition to the next 
  class topic or activity. Don't stand at the front watching 
  students read. Give them something else to focus on so 
  students still reading don't feel like they're holding up 
  the room, and students who signed quickly don't feel like 
  they rushed. Stick around and be available for quiet 
  questions, but let the pace be theirs.

Review the informed consent form and check that the four verbal 
statements above are consistent with what the form actually 
says. Flag any discrepancies. Also flag if there's anything in 
the consent form that would surprise a student after the verbal 
framing — for example, the mention of language model analysis, 
the survey in Weeks 9–10, or the gift card drawing. These may 
need brief verbal mention so students aren't caught off guard 
reading the form.
