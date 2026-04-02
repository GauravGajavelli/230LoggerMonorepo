# Feedback Communication — Evaluation Rubrics

For each layer (LMS announcement, feedback email, summary report), this document defines:
1. The **role** — what this piece is supposed to accomplish
2. The **information inventory** — what data it has access to and what it presents
3. The **evaluation rubric** — scored questions (1–5) to assess how well it does its job
4. The **exit state** — how the student should feel/think after engaging with it

---

## Layer 0: LMS Announcement

### Role

The announcement is **pre-feedback infrastructure.** It is not persuasion, not a preview of results, and not a tutorial. It has two jobs:

1. **Ensure the data pipeline works.** Students need to commit `run.tar`. If they don't, there's no feedback to generate. This is the primary operational purpose.
2. **Set expectations.** Students should know that feedback is coming and roughly what form it takes, so that when the email arrives, it's recognized and not ignored as spam/noise.

The LMS announcement is the only layer where the audience is the *entire class*, including students who didn't consent to the research. The tool is available to everyone — the research analysis is what's limited to consenting participants. So the tone should be tool-focused, not study-focused.

### Information Inventory

| Information available | Currently presented? | Should it be? | Priority |
|---|---|---|---|
| The tool exists (from demo) | ✓ Reference to demo | ✓ Brief reminder | High — some students may have forgotten |
| `run.tar` must be committed | ✓ Explicit instruction | ✓ This is the main action item | Critical |
| What `run.tar` is / where it lives | ✓ One sentence | ✓ But keep it brief — most students won't need this | Medium |
| When feedback arrives | ✓ "After the deadline" | ✓ Could be slightly more specific | Medium |
| What the feedback contains | ✗ Not described | Partially — one sentence max | Low |
| Feedback is private | ✓ Explicit | ✓ Trust matters | Medium |
| Upload option if `run.tar` missing | ✓ Mentioned | ✓ Safety net | Low |
| Point values / ROI / exam relevance | ✗ | ✗ No — this belongs in the email | None |
| How the tool works technically | ✗ | ✗ No — they don't need to know | None |

### Evaluation Rubric

Score each 1–5 (1 = not at all, 5 = fully).

**A. Clarity of Action**
1. Can a student identify what they need to *do* within 10 seconds of reading? (commit `run.tar`)
2. Is the action item distinguishable from background information?
3. Would a student who skims only bolded text or the first sentence of each paragraph still get the action item?

**B. Expectation Setting**
4. After reading, does the student know *what* is coming? (an email with feedback)
5. After reading, does the student know *when* it's coming? (day after deadline)
6. After reading, will the student recognize the feedback email when it arrives? (vs. ignoring it as spam)

**C. Information Hierarchy**
7. Is the most important information (action item) first or most prominent?
8. Is secondary information (privacy, upload fallback) clearly subordinate?
9. Is there any information that could be cut without losing function?

**D. Tone and Length**
10. Does it feel like a routine course logistics post? (not a research pitch, not a sales email)
11. Is it under 100 words of body text?
12. Would a student who's behind on coursework feel *neutral* about this post? (not guilty, not pressured, not overwhelmed)

**E. Exit State**
13. Target: The student should leave thinking "I need to make sure `run.tar` is in my submission, and I'll get an email about my debugging after I submit." Does the announcement achieve this?
14. The student should NOT leave thinking: "this sounds like a lot of work," "what is this study thing again," or "I need to watch a video / read something long before I submit." Does the announcement avoid triggering these?

### Exit State (ideal)

After reading the LMS announcement, the student should:
- **Know:** feedback is coming after the deadline, they need `run.tar` committed
- **Feel:** neutral to mildly curious — "oh right, that tool from the demo"
- **Do:** nothing right now except keep `run.tar` in mind when they submit
- **Not feel:** pressured, confused, overwhelmed, or like they need to learn something new

---

## Layer 1: Feedback Email

### Role

The email is a **notification and triage mechanism.** It tells the student their feedback exists, gives them enough information to decide whether to engage, and routes them to the appropriate depth (report vs. site). It is the highest-leverage piece because it's the first contact after the student has real, personalized results.

The email has to work in a hostile attention environment: it arrives alongside other notifications, probably on a phone, while the student is context-switching between courses. It has ~5 seconds to justify its existence (subject line) and ~30 seconds to deliver value (body).

Specific jobs:
1. **Signal:** Personalized feedback is ready. This isn't generic — the subject line must convey "this is about *your* specific submission."
2. **Contextualize:** Why does it matter *right now*? Connect to the nearest assessment.
3. **Route:** Give two clear paths differentiated by effort. The student self-selects into quick review or deep dive.

### Information Inventory

| Information available | Currently presented? | Should it be? | Priority |
|---|---|---|---|
| Assignment name | ✓ In subject + body | ✓ | Critical — anchors what this is about |
| Pattern count | ✓ In subject + body | ✓ | High — makes it feel personalized, not generic |
| Nearest relevant assessment | ✓ In subject + body | ✓ | High — the "why now" |
| High-urgency pattern count | ✓ In body | ✓ | Medium — differentiates urgency within patterns |
| Pattern names | ✗ | ✗ — belongs in report | None for email |
| Specific test names | ✗ | ✗ — belongs in report | None for email |
| Report link + time estimate | ✓ | ✓ | Critical — primary CTA |
| Site link + time estimate | ✓ | ✓ | High — secondary CTA |
| Privacy statement | ✓ One line | ✓ | Medium |
| Point values / ROI numbers | ✗ | ✗ — feels manufactured | None |
| Course timeline | ✗ | ✗ — belongs in report | None |
| How to upload if missing data | ✗ | ✗ — only relevant for null-feedback case | None |

### Evaluation Rubric

Score each 1–5.

**A. Subject Line Effectiveness**
1. Does the subject line contain the assignment name? (anchoring)
2. Does the subject line contain a personalized element? (pattern count, not just "feedback ready")
3. Does the subject line connect to a future assessment? (the "why open this" hook)
4. Is the subject line under 60 characters? (mobile truncation)
5. Would a student be able to distinguish this from a generic course notification at a glance?

**B. Body — Information Hierarchy**
6. Is the first sentence the "what"? (your submission was processed, N patterns found)
7. Is the second sentence the "so what"? (X are relevant to upcoming exam)
8. Are the links the third element? (the "now what")
9. Is there any information in the body that isn't serving one of those three functions?
10. Can the email be read and acted on in under 30 seconds?

**C. Routing Clarity**
11. Are the two links clearly differentiated by effort level? (quick vs. deep)
12. Does each link have a time estimate?
13. Is it obvious which one to click if you have 3 minutes? Which if you have 15?
14. Is the lower-effort option listed first? (path of least resistance)

**D. Motivation Without Manipulation**
15. Does the email create urgency through *relevance* (connecting to an exam) rather than through *pressure* (language like "don't miss out," "you're falling behind")?
16. Does it respect the student's autonomy? (no guilt, no implied obligation)
17. Is the tone closer to "automated system notification" than to "person trying to convince you"?
18. If a student decides not to engage, does the email leave them feeling neutral? (vs. guilty or anxious)

**E. Personalization Credibility**
19. Does the email feel like it was generated from *their* data? (vs. a template with a name swapped in)
20. Is the personalization substantive (pattern count, assessment mapping) rather than superficial (just their name)?

**F. Exit State**
21. Target: The student should leave thinking one of: (a) "I should skim that report before the exam" or (b) "I'll come back to this when I have time with my IDE." Does the email achieve one of these?
22. The student should NOT leave thinking: "this is too much work," "I don't understand what this is," or "this looks like spam." Does the email avoid these?

### Exit State (ideal)

After reading the email, the student should:
- **Know:** they have N debugging patterns, the most important ones are relevant to [nearest exam]
- **Feel:** mild motivation — "this seems worth 3 minutes before the exam"
- **Do:** either click the report link now OR mentally bookmark it for exam prep
- **Not feel:** overwhelmed, sold to, confused about what the links go to

### Information Hierarchy (what matters most in the student's mind)

When a student sees this email, their internal priority stack is roughly:
1. **Is this relevant to my grade?** → The assessment name answers this
2. **How much effort is this?** → The time estimates answer this
3. **Is this actually about *my* work?** → The pattern count answers this
4. **Can I do this right now?** → The two-tier routing answers this
5. **Is this trustworthy / private?** → The privacy line answers this

The email should present information in approximately this order. Currently it does: assessment (subject), pattern count (first line), links with time estimates (middle), privacy (last line). This is close to correct.

---

## Layer 2: Summary Report (PDF)

### Role

The report is a **bridge and a standalone deliverable.** It sits between the email (which told you feedback exists) and the site (which lets you practice). But critically, it should also be *complete enough that a student who never visits the site still gets value.*

The report's jobs:
1. **Expand on the email's claims.** The email said "3 patterns relevant to Exam 2." The report shows *which* patterns, *which* tests, and *why* each matters.
2. **Create temporal context.** Show the student where they are in the course and why this feedback is time-sensitive.
3. **Lower the activation energy for the site.** By showing specific drill links with time estimates, the jump from "reading a PDF" to "doing a drill" becomes one click, not a decision.
4. **Serve as a reference.** A student studying for the exam should be able to pull up this report and quickly find which concepts to prioritize.

### Information Inventory

| Information available | Currently presented? | Should it be? | Priority |
|---|---|---|---|
| Everything in the email | ✓ Superset | ✓ | Baseline — must include |
| Pattern names | ✓ Card headings | ✓ | Critical — the "what specifically" |
| Failed test names per pattern | ✓ In expanded cards | ✓ | High — grounds it in their work |
| Why each pattern matters | ✓ One sentence per card | ✓ | High — the "so what" per pattern |
| Source attribution (which tests) | ✓ "From: BST — Tests 7, 12" | ✓ | Medium |
| Target attribution (which assessment) | ✓ "Relevant to: Exam 2" | ✓ | High |
| Secondary targets | ✗ Not shown | ✓ Add "Also useful for:" line | Medium |
| Drill link per pattern | ✓ In expanded cards | ✓ | High — the call to action |
| Drill time per pattern | ✓ Badge | ✓ | High — effort calibration |
| Total drill time | ✓ In footer | ✓ | Medium |
| Course timeline (next 3–4 weeks) | ✓ Timeline bar | ✓ | High — temporal urgency |
| Which timeline weeks are relevant | ✓ Highlighted | ✓ | High |
| Urgency ranking | ✓ Colored dots + sort order | Review — is it clear what the dots mean? | Medium |
| Student's overall test pass rate | ✓ "6 of 18 tests" | Partially — useful as context but could feel discouraging | Low |
| Concept names (pedagogical labels) | ✗ Not directly shown | Maybe — could help students connect to lecture material | Low |
| Code snippets from their submission | ✗ | ✗ — belongs on the site | None |
| Comparison to class performance | ✗ | ✗ — could feel judgmental, IRB implications | None |

### Evaluation Rubric

Score each 1–5.

**A. Progressive Disclosure (Email → Report)**
1. Does the report feel like a natural "next step" after the email? (vs. a repetition or a jarring shift)
2. Does it add substantial new information beyond what the email said?
3. Can a student who skipped the email still make sense of the report?

**B. Information Hierarchy — Per Pattern**
4. Is the most important information about each pattern visible without interaction? (In a PDF: is it all visible? In an interactive version: is the collapsed state sufficient?)
5. Is the pattern name descriptive enough that a student can recognize the concept? ("Iterator traversal logic" vs. "Pattern 1")
6. Is the source → target attribution clear and scannable? (From: X → Relevant to: Y)
7. Is the "why it matters" sentence specific enough to be actionable? ("AVL rotations depend on correct height calculation" vs. "this concept appears again later")

**C. Information Hierarchy — Overall Document**
8. What's the first thing a student's eye lands on? Is it the right thing? (Should be: pattern list, not the header metadata)
9. Is the urgency ordering clear? (Do students know which pattern to look at first?)
10. Is the urgency signaling legible? (Colored dots need a legend or to be self-evident. Currently no legend.)
11. Is there a clear "minimum viable engagement"? (Can a student get value from just reading the pattern names + target assessments in 60 seconds, without expanding anything?)

**D. Temporal Context**
12. Does the timeline help the student understand *when* this matters?
13. Is the connection between their specific patterns and the highlighted weeks explicit? (vs. implied)
14. Would a student studying for an exam in 3 days find this timeline useful for prioritization?
15. Does the timeline show enough future context to be useful without being overwhelming? (3–4 weeks is probably right; a full quarter view would dilute the urgency)

**E. Actionability**
16. Are the drill links prominent enough that a motivated student can find and click them quickly?
17. Are the time estimates per drill accurate and trustworthy? (If a "5 min" drill takes 20 min, trust is broken for all future estimates)
18. Is there a clear "what to do next" at the bottom? (Link to full site, or "start with Pattern 1")
19. Can a student use this report as a study checklist? (Print it, check off patterns as they review them?)

**F. Emotional Calibration**
20. Does the overall test pass rate ("6 of 18 tests") feel informative or discouraging? Would a student with 15/18 failures feel attacked? Consider: is this number necessary, or does the pattern count serve the same function?
21. Does the urgency signaling (red/amber dots) create productive motivation or anxiety?
22. Does the report respect the student's time? (No filler, no repetition, no condescending explanations)
23. Is the tone clinical/neutral? (The report is generated by a system, not written by a person judging them)

**G. Standalone Value**
24. If a student reads only the report (never visits the feedback site), did they get useful information?
25. Could they use the report to study for the exam? (Know which concepts to focus on, which tests to revisit)
26. Would they feel the 3–5 minutes was well spent?

**H. Exit State**
27. Target: The student should leave thinking one of: (a) "I know exactly which 2 concepts to review before the exam" or (b) "I'm going to click into that traversal drill right now." Does the report achieve one of these?
28. The student should NOT leave thinking: "I don't understand what these patterns mean," "this is overwhelming," or "I already knew this." Does the report avoid these?

### Exit State (ideal)

After reading the report, the student should:
- **Know:** which specific concepts they struggled with, which ones matter for the next exam, and how long it would take to practice each one
- **Feel:** informed and mildly motivated — "I have a clear study plan for these 2–3 things"
- **Do:** either click a drill link now OR save/print the report for exam prep
- **Not feel:** overwhelmed by the number of issues, judged for their performance, confused about what to do next

### Information Hierarchy (what matters most in the student's mind when reading the report)

The student's internal priority stack during report reading:
1. **What specifically did I get wrong?** → Pattern names + failed test names
2. **Does this matter for the exam?** → Target assessment attribution
3. **How long will it take to fix?** → Per-drill time estimates
4. **What should I do first?** → Urgency ordering
5. **Where do I go to practice?** → Drill links
6. **What else is coming up that I should know about?** → Timeline
7. **Am I doing okay overall?** → Pass rate (handle carefully — see Q20)

The report should present information approximately in this order. Currently the mockup leads with the header metadata (pass rate) before the patterns. Consider whether the pattern list should come first, with the pass rate demoted to a less prominent position or removed entirely.

---

## Cross-Layer Consistency Checks

Score each 1–5.

1. Does the LMS announcement set expectations that the email fulfills? (If the announcement says "you'll receive an email," does the email feel like the thing that was promised?)
2. Does the email set expectations that the report fulfills? (If the email says "3 patterns," does the report show exactly 3 patterns?)
3. Is the visual identity consistent across layers? (Font choices, tone, header format)
4. Are time estimates consistent? (If the email says "3 min read," is the report actually 3 minutes?)
5. Does each layer add value, or could any be removed without loss? (If the report is just "the email but longer," it's not earning its place)
6. Is the cognitive load per layer appropriate to its time budget? (30 sec / 3–5 min / 10–15 min)
7. Is there a clear escalation path at each layer? (LMS → wait for email, Email → report or site, Report → site)

---

## Using This Rubric

1. Score each question 1–5 for the current draft
2. Any question scoring ≤ 2 is a redesign priority
3. Any question scoring 3 is worth improving if time allows
4. Focus on the exit state questions (E/F/H sections) first — if the student leaves in the wrong mental state, no amount of information hierarchy fixes it
5. Re-score after revisions to confirm improvement
