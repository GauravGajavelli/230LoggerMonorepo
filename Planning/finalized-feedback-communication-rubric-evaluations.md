# Feedback Communication — Finalized Rubric Evaluations

Final scores reflecting the Moodle-styled email template and the assessment-column report design with recurring test entries.

Scale: 1 = not at all, 5 = fully.

---

## Feedback Email

Template: Moodle-styled transactional notification with hybrid subject line.

```
Subject: CSSE 230 — BST feedback available (3 patterns, Exam 2)

2526S CSSE230 -> Debugging Feedback -> Binary Search Tree
---------------------------------------------------------------------
Your debugging feedback for 'Binary Search Tree' has been
processed. 3 patterns were identified, relevant to Exam 2
(April 10).

You can view your feedback summary:

{link}

This feedback is private to you and is not shared with course staff.
---------------------------------------------------------------------
```

### A. Subject Line Effectiveness

**1. Contains assignment name?**
Score: 5
"BST feedback available" — present and prominent. Uses short name to stay compact.

**2. Contains personalized element?**
Score: 5
"(3 patterns, Exam 2)" — pattern count is unique per student. The parenthetical position mirrors Gradescope's metadata placement (timestamps, due dates) so it reads as system-generated data, not a sales hook.

**3. Connects to future assessment?**
Score: 4
"Exam 2" is in the parenthetical. Not leading the subject (that would break transactional framing), but present and visible. Most mobile clients show the full 58-character subject, so the parenthetical won't be truncated. Students scanning their inbox see the assessment name without opening the email.

**4. Under 60 characters?**
Score: 5
"CSSE 230 — BST feedback available (3 patterns, Exam 2)" = 56 characters. Under the limit. No truncation on any device. For longer assignment names, the short name keeps it compact (BST not Binary Search Tree).

**5. Distinguishable from generic course notification?**
Score: 5
The Moodle-style breadcrumb inside and the "debugging feedback" label in the subject distinguish it from grade notifications ("New feedback for assignment...") and submission confirmations ("You have submitted..."). A student won't confuse this with any existing course email. The `CSSE 230 —` prefix also differs from Moodle's format (`2526S CSSE230-01 ->`) so it doesn't impersonate a Moodle email — it evokes the pattern without faking the source.

### B. Body — Information Hierarchy

**6. First sentence is the "what"?**
Score: 5
"Your debugging feedback for 'Binary Search Tree' has been processed." Transactional, clear. The single-quoted assignment name matches Moodle's convention ("You have new feedback on your assignment submission for 'CNN - Milestone 1'").

**7. Second sentence is the "so what"?**
Score: 5
"3 patterns were identified, relevant to Exam 2 (April 10)." Pattern count (personalized) + assessment name (motivating) + date (urgent) in one sentence. Dense, no filler. A student who reads only this sentence knows the stakes.

**8. Links are the third element?**
Score: 5
"You can view your feedback summary:" + URL. Third position. Matches Moodle's "You can see it appended to your assignment submission:" + URL. Same syntactic structure, same position in the email.

**9. Any unnecessary information?**
Score: 5
Five elements total: breadcrumb (course anchoring), what (line 1), so-what (line 2), link (line 3), privacy (line 4). Nothing extraneous. The breadcrumb could arguably be cut, but it serves the format-mimicry function and adds only one line. The privacy line is the only element not in a Moodle email, and it serves the trust function required by the research context.

**10. Can it be read and acted on in under 30 seconds?**
Score: 5
Four lines of content plus a link. Under 15 seconds for a student accustomed to processing Moodle emails. The dashed-line framing actually speeds reading — students' eyes know to look inside the frame for the content.

### C. Single Link Effectiveness

**11b. Does the single link feel low-friction enough to click?**
Score: 5
"You can view your feedback summary:" is structurally identical to Moodle's link phrasing. No decision to make (no "Quick Review vs Full Feedback" choice). Click or don't click — same binary as every Moodle notification.

**12b. Does the destination (report) handle the routing the email used to do?**
Score: 5
The report's assessment cards at the top provide the 10-second scan that the old "Quick Review" link offered. The drill columns below provide the depth that the old "Full Feedback" link offered. The report is a better routing surface because it has visual hierarchy — the student self-selects engagement depth by how far they scroll, not by which link they click.

### D. Motivation Without Manipulation

**15. Urgency through relevance, not pressure?**
Score: 5
"Relevant to Exam 2 (April 10)" — states a fact. No "don't miss out," "time is running out," or "you're falling behind." The date creates natural urgency. The student connects "April 10" to their own calendar without being told what to feel about it.

**16. Respects student autonomy?**
Score: 5
No imperative language anywhere. "Has been processed" (informing), "were identified" (reporting), "you can view" (offering). The student is never told to do anything. Even the link phrasing is permissive ("you can") not directive ("please review").

**17. Tone closer to system notification than persuasion?**
Score: 5
Indistinguishable in structure from a Moodle notification. Passive voice ("has been processed," "were identified") reinforces the automated feel. The breadcrumb and dashed lines are visual markers of system-generated content. No human voice, no enthusiasm, no concern.

**18. Neutral exit if student ignores it?**
Score: 5
Nothing in the email implies consequences for not clicking. No follow-up threat, no "this won't be available after..." The nudge email exists but is sent separately and only to non-viewers — the initial email itself implies nothing about future contact.

### E. Personalization Credibility

**19. Feels generated from their data?**
Score: 4
"3 patterns were identified" is unique per student. A student who got 1 pattern sees a different number than one who got 5. This signals the system actually analyzed their submission. Slight deduction: the email doesn't name any patterns — that's the report's job. A student might briefly wonder "is everyone getting 3?" until they click through. The report immediately dispels this by showing specific test names.

**20. Personalization is substantive, not superficial?**
Score: 4
Pattern count + assessment mapping is data-driven personalization. No "Hi Gaurav" name-drop, no "Great job on your submission!" filler. The personalization is in the *numbers*, not the *greeting*. Slight deduction: two data points (count + assessment) is the minimum substantive personalization. The report carries the deeper personalization load (specific patterns, test names, weights).

### F. Exit State

**21. Student leaves wanting to skim the report or bookmark for later?**
Score: 5
The Moodle format triggers trained behavior: "course notification → click the link." The exam date in parenthetical creates a natural bookmark ("before April 10"). A student who doesn't click immediately will likely think "I'll check this before the exam" — which is the optimal outcome for a notification sent days before the assessment.

**22. Student doesn't leave overwhelmed, confused, or thinking it's spam?**
Score: 5
The Moodle format is the strongest anti-spam signal for this audience. Students process dozens of these per quarter. The content is four lines — impossible to feel overwhelmed. The breadcrumb anchors which course this is about. No confusion possible.

### Email — Final Average: 4.8/5.0

---

## Summary Report

Design: Assessment-column layout with proportion bars, recurring drill entries across columns, explicit test method names.

### A. Progressive Disclosure (Email → Report)

**1. Feels like a natural next step after the email?**
Score: 5
The email says "3 patterns, relevant to Exam 2." The report opens with an Exam 2 assessment card showing exactly how those patterns map to the exam. The visual escalation from plaintext email to designed report feels like going from a notification to the thing it notified you about — the same experience as clicking a Moodle notification and landing on the assignment page.

**2. Adds substantial new information beyond the email?**
Score: 5
The email has: pattern count, assessment name, link. The report adds: pattern names, JUnit test method names, per-pattern assessment weights, proportion bars, drill time estimates, drill links, course timeline context, cross-assessment recurrence. The information density jump is large but structured — the assessment cards compress it into a scannable overview before the details appear.

**3. Student who skipped the email can still make sense of it?**
Score: 5
The framing sentence ("Your submission was analyzed. Here's what to focus on.") and the header ("CSSE 230 · Debugging Feedback / Binary Search Tree") provide full context. A student arriving via the landing page (no email) immediately understands: this is debugging feedback for BST, here are the relevant assessments, here are the drills.

### B. Information Hierarchy — Per Pattern

**4. Most important info visible without interaction?**
Score: 5
Every drill card displays: pattern name, test method names, assessment weight, time estimate, and drill link — all visible, no expansion required. This is the biggest improvement over the original mockup where drill links and test names were hidden behind click-to-expand cards. In a static PDF or server-rendered HTML, everything is visible on load.

**5. Pattern name descriptive enough to recognize the concept?**
Score: 4
"Iterator traversal logic" and "Edge case handling in remove" map to concepts students would recognize from lecture and their own debugging experience. Quality depends on the pipeline's labeling — some generated names may be less clear. The explicit test method names below each pattern name provide a concrete anchor even if the pattern name is abstract: a student who doesn't immediately parse "Recursive size/height confusion" will recognize `testCountLeftNodesAtDepth` from their IDE.

**6. Source → target attribution clear and scannable?**
Score: 5
The column header IS the target ("EXAM 2 · Friday, April 10"). Every drill card under it is implicitly attributed to that assessment. No per-card "From: X → Relevant to: Y" labels needed — the grouping does the work. When a drill recurs in a second column, the second column header provides the new target context. This is cleaner and more scannable than the original per-card attribution.

**7. "Why it matters" specificity?**
Score: 4
The assessment weight percentage ("~12% of exam content") tells the student how much this matters quantitatively. The test method names tell them what specifically went wrong. Together, these are more actionable than the original one-liner ("AVL rotations depend on correct height calculation"). The conceptual connection (why this test maps to this exam topic) is implicit in the column placement — if the drill is under "Exam 2," the student infers it's because the exam tests this concept. A brief conceptual note per drill ("AVL rotations depend on this") would push this to a 5, but adds length to every card. The current design trades conceptual explanation for scannability.

### C. Information Hierarchy — Overall Document

**8. First thing the student's eye lands on — is it the right thing?**
Score: 5
The eye lands on the assessment cards: "EXAM 2 — Friday, April 10 — ~20% overlaps with your practice drills." This is exactly the right first impression. The student immediately knows: what's at stake (exam), when (Friday), how much (20%). The original version led with test pass rate ("6 of 18 tests"), which was a backwards-looking score. The assessment cards are forward-looking and actionable.

**9. Is urgency ordering clear?**
Score: 5
Columns are ordered left-to-right by assessment priority (exam before homework, sooner before later). Within each column, drills are sorted top-to-bottom by weight (highest first). A student who reads left-to-right, top-to-bottom naturally encounters the most urgent, highest-impact items first. No colored dots, no legend needed — the structure itself encodes priority.

**10. Is urgency signaling legible?**
Score: 5
Urgency is communicated through three self-explanatory mechanisms: column position (left = most urgent), sort order (top = most impactful), and proportion bars (wider = more overlap). All three are immediately legible without any legend or explanation. The original colored dots (red/amber) with no legend scored 2. This is a complete redesign of how urgency is communicated.

**11. Clear "minimum viable engagement"?**
Score: 5
A 10-second scan of just the assessment cards gives: "Exam 2 covers ~20% of my weak areas with 2 drills totaling 9 minutes. HW5 covers ~8% with 1 drill totaling 6 minutes." That's a complete triage without reading a single drill card. The original required reading pattern names and mentally mapping them to assessments — the redesign does that mapping structurally.

### D. Temporal Context

**12. Does the timeline help understand when this matters?**
Score: 5
Assessment dates are embedded directly in the cards and column headers ("Friday, April 10"). No separate timeline widget needed. The date is co-located with the stakes, creating immediate temporal urgency: "this exam is Friday and 20% of it overlaps with my drills." The old separate timeline bar was a separate visual element requiring the student to cross-reference. Integrated dates are more direct.

**13. Connection between patterns and highlighted weeks explicit?**
Score: 5
Each drill is literally inside the column of the assessment it impacts. When a drill recurs across columns, it appears in each one — the student sees the same pattern under both "Exam 2" and "HW5" and understands it matters for both. No ambiguity, no cross-referencing, no footnotes.

**14. Useful for a student studying 3 days before an exam?**
Score: 4
The Exam 2 column is a ready-made study checklist: "do these 2 drills, 9 minutes total, covering ~20% of the exam." The sort order (highest weight first) implies where to start. A one-line directive at the top of the column ("Highest impact: Iterator traversal — 5 min, ~12%") would make the starting point explicit, but the current design is close enough that most students will start at the top naturally.

**15. Right amount of future context?**
Score: 4
Showing 2–3 assessments is the right amount. The cards show what's immediately relevant without drowning the student in the full quarter calendar. If patterns map to 4+ assessments, the least urgent are collapsed into a footer note. One consideration: if the student views the report long after the assessments have passed, the cards will show past dates. The edge case spec addresses this ("note suggests relevance to future work").

### E. Actionability

**16. Drill links prominent enough?**
Score: 5
Every drill card has "Open drill →" visible without expansion, as the last element of the card. It's a natural stopping point — the student reads the pattern name, sees the test names and weight, and the link is right there. The link uses the same muted blue accent color used for assessment labels, creating visual consistency. In the original mockup, drill links were hidden inside expandable cards — this was a 3.

**17. Time estimates accurate and trustworthy?**
Score: N/A
Cannot score without testing actual drills against estimated times. Flagged in the QA checklist: time every drill yourself and verify estimates are within ±2 minutes. If a "5 min" drill consistently takes 15, trust breaks across all future estimates. Better to slightly overestimate ("5–8 min") than underestimate.

**18. Clear "what to do next" at the bottom?**
Score: 4
The footer has "Open full feedback site →" and the summary "3 unique drills · 15 min total · All drills are optional." The footer is adequate but generic. A more directed CTA ("Start with your highest-impact drill: Iterator traversal →") would score a 5, but adds complexity to the template. The current footer works because the drill cards above already have individual links — the footer CTA is for students who want the full site, not a specific drill.

**19. Usable as a study checklist?**
Score: 4
The column layout maps directly to "things to do before Exam 2" and "things to do before HW5." Drill cards function as checklist items. Test names within each card help students locate the relevant code. A student could screenshot or print this page and use it as an exam prep guide. No explicit checkboxes, but the structure supports checklist use without them.

### F. Emotional Calibration

**20. Does the presentation feel informative or discouraging?**
Score: 5
No test pass rate anywhere. The header says "Here's what to focus on" — forward-looking, task-oriented. Assessment overlap is framed as "overlaps with your practice drills" — neutral, preparation-focused. The word "practice" frames drills as proactive improvement, not remediation. A student seeing "~20% of exam content overlaps with your practice drills" reads: "I can target 20% of the exam with 9 minutes of practice." That's motivating, not discouraging.

**21. Does urgency signaling create motivation or anxiety?**
Score: 4
No red dots, no alarm colors. The proportion bars use a muted blue fill. The assessment type labels use subdued colors (muted blue for exams, muted green for homework). Dates create natural urgency without dramatic signaling. The remaining concern: if a student's overlap percentage is very high (e.g., "~45% of exam"), the number itself could cause anxiety regardless of color or framing. The 50% cap in the data pipeline mitigates extreme values, and the "practice drills" framing softens the message. Leaving at 4 because very high percentages are inherently anxiety-inducing no matter how you frame them.

**22. Respects student's time? No filler?**
Score: 5
Every element on the page serves a function. No decorative elements, no motivational text, no repeated information. The assessment cards are data-dense. The drill cards are compact. The footer is three lines. A student spending 3 minutes on this page is reading information the entire time — there's no "skip past the intro" overhead.

**23. Tone is clinical/neutral?**
Score: 5
"Your submission was analyzed." "Patterns were identified." "Overlaps with your practice drills." Passive voice throughout. No judgment ("you struggled with"), no praise ("great job on the tests that passed"), no emotion. The serif/sans-serif typography pairing creates an editorial, document-like feel — clinical without being cold.

### G. Standalone Value

**24. If the student never visits the site, did they get useful information?**
Score: 5
They know: which assessments are affected, by how much, which specific concepts and test cases are involved, and how long each drill would take. They have a prioritized study plan grouped by assessment. A student who reads only the report and never clicks a drill link still walks away knowing "I should review iterator traversal and size/height confusion before the exam, and remove edge cases before HW5."

**25. Could they use it to study for the exam?**
Score: 5
The Exam 2 column is a study guide: "These concepts, covering ~20% of the exam, tested by these specific test methods." A student could take this to office hours: "I had issues with `testPreOrderIterator` and `testCountLeftNodesAtDepth` — can we go over traversal and height?" The test names make the feedback concrete enough to act on without the interactive site.

**26. Would 3–5 minutes feel well spent?**
Score: 5
The report answers "what should I study, in what order, for how long, for which assessment" in under 3 minutes. High value density. The only scenario where it wouldn't feel worth it: if the patterns are generic or the assessment mapping is wrong. Quality depends on the pipeline and the assessment config — the report design itself maximizes the value of whatever data it receives.

### H. Exit State

**27. Student leaves thinking "I know which concepts to review" or "I'm clicking that drill"?**
Score: 4
The assessment columns make priorities crystal clear. The drill links are visible and low-friction. The test method names ground the feedback in the student's concrete experience. A motivated student will click a drill. A time-pressed student will mentally bookmark the column. Both are good exit states. Slight deduction: no explicit "start here" recommendation means the student must infer priority from sort order rather than being told directly.

**28. Student doesn't leave overwhelmed, confused, or thinking "I already knew this"?**
Score: 5
Not overwhelmed: the column structure breaks information into bounded chunks per assessment. Not confused: the layout is self-explanatory. "I already knew this" risk is low because the assessment weight percentages and test method names are new information even if the student was already aware of their failures. Knowing you failed `testPreOrderIterator` is different from knowing that concept covers ~12% of the upcoming exam.

### Report — Final Average: 4.7/5.0

---

## Cross-Layer Consistency (Email ↔ Report)

**1. Email sets expectations that the report fulfills?**
Score: 5
Email says "3 patterns, relevant to Exam 2." Report shows exactly 3 unique patterns, with Exam 2 as the primary assessment column. The numbers match. The framing matches. No surprises.

**2. Visual identity transition feels natural?**
Score: 4
The email is plaintext with Moodle-style dashed lines. The report is a designed HTML page with serif typography and proportion bars. The jump from plaintext to designed page is noticeable but expected — it's the same experience as clicking a Moodle notification and landing on the Moodle assignment page (which has its own CSS and layout). The transition is from "notification" to "content" and students are trained for that. Slight deduction because the report's editorial styling (Source Serif, muted blues) is a distinct aesthetic that doesn't exist anywhere else in the course ecosystem — it's recognizable as "the feedback tool" but not as "a Rose-Hulman thing."

**3. Time estimates consistent?**
Score: N/A
Need to verify that the report is readable in the time budgeted (3–5 min for full review, 10 sec for card scan). Flagged for QA.

**4. Each layer adds value?**
Score: 5
Email: notification + triage decision (click or don't). Report: study prioritization plan + drill links. Each has a distinct role. A student who reads only the email knows feedback exists. A student who reads the report has a study plan. Neither layer is redundant.

**5. Cognitive load appropriate to time budget?**
Score: 5
Email: very low load, under 15 seconds. Report: moderate load, 3–5 minutes for full review, 10 seconds for card scan. The escalation is correct. The report's visual hierarchy (cards first, drills below, footer last) means cognitive load increases gradually as the student scrolls — they can bail at any point with proportional value received.

**6. Clear escalation path?**
Score: 5
Email → single link → report → per-drill links → feedback site. Each step is one click deeper. No branching, no choice paralysis, no dead ends. The footer's "Open full feedback site →" provides a general escalation for students who want to explore beyond the recommended drills.

### Cross-Layer — Final Average: 4.8/5.0

---

## Score Summary

| Component | Average |
|---|---|
| Feedback Email | 4.8 |
| Summary Report | 4.7 |
| Cross-Layer Consistency | 4.8 |

### Remaining Items Below 5

| Score | Question | Notes |
|---|---|---|
| 4 | Email A.3 — Assessment in subject | In parenthetical, not leading. Acceptable tradeoff for transactional framing. |
| 4 | Email E.19 — Feels from their data | Pattern count is personalized, but no pattern names in email. Report handles this. |
| 4 | Email E.20 — Substantive personalization | Two data points (count + assessment) is minimum substantive. Report carries depth. |
| 4 | Report B.5 — Pattern names descriptive | Depends on pipeline labeling quality. Test names provide a fallback anchor. |
| 4 | Report B.7 — "Why it matters" specificity | Weight percentages are quantitative. Conceptual notes would add depth but also length. |
| 4 | Report D.14 — Cramming utility | Sort order implies priority. Explicit "start here" directive would help. |
| 4 | Report D.15 — Future context amount | 2–3 assessments is right. Past-date edge case is handled in spec. |
| 4 | Report E.18 — "What to do next" | Footer CTA is generic. Directed CTA would be better but adds template complexity. |
| 4 | Report E.19 — Checklist usable | Structure supports checklist use. No explicit checkboxes. |
| 4 | Report F.21 — Urgency tone | Muted colors and neutral framing. Very high percentages could still cause anxiety. |
| 4 | Report H.27 — Exit → action | Clear priorities. No explicit "start here." |
| N/A | Report E.17 — Time estimates | Requires QA against actual drill times. |
| N/A | Cross-Layer 3 — Time consistency | Requires QA against actual reading times. |
| 4 | Cross-Layer 2 — Visual identity | Plaintext → designed page is a natural transition. Report aesthetic is unique to the tool. |

No scores at 3 or below. All items at 4 are deliberate design tradeoffs (transactional framing vs. persuasion, scannability vs. depth, template simplicity vs. directedness) rather than quality gaps.
