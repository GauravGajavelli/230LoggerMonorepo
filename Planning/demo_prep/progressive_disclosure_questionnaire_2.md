# Progressive Disclosure Questionnaire — Round 2

**Context:** Several changes were made based on your first round of feedback. This questionnaire
re-tests the areas that scored lowest (Q3, Q5, Q7, Q8, Q9) and introduces new questions on topics
the first round didn't fully reach. Use the same scale as before.

> 1 = Not answered / I had to hunt for it
> 3 = Partially answered / took some effort
> 5 = Immediately clear, no effort required

Where a question is a re-test, the specific change made is noted in italics.

---

## Layer 2 — Scanning (re-test)

**Q1. "Which tests are the problem, and roughly how many?"**

*What changed: the mini-bar row in the summary banner is now sorted (failing → improved →
passing) and a count line ("2 failing · 1 improved · 30 passing") appears directly below it —
no hover required.*

*Can you now read the distribution of test statuses at a glance, without hovering or reading
through the full test list?*

Rating (1–5): ___

Notes:

---

## Layer 3 — Understanding (re-tests + new)

**Q2. "Before reading the full explanation, what kind of problem am I dealing with?"**

*What changed: a short diagnostic label (e.g., "Regression with incorrect return value from
remove") now appears as a badge at the top of each expanded test card, above the "What happened"
section.*

*Does the label help you orient immediately — do you know the category of failure before reading
any prose?*

Rating (1–5): ___

Notes:

---

**Q3. "Is the 'What happened' section easy to scan?"**

*What changed: the explanation is now split into individual sentence bullets instead of a single
prose paragraph.*

*Does the bulleted format make it faster to find the sentence that matters most to you, or does
it still feel like too much at once?*

Rating (1–5): ___

Notes:

---

**Q4. "Do the code diffs help me understand what changed — or do they just add noise?"**

*This is a new question. The diffs were present before but the first round noted that the
connection between a diff and the surrounding explanation wasn't obvious, and that multiple diffs
stacked vertically felt overwhelming.*

*When you see a code diff inside an expanded test card: does it clarify something the text
didn't, or does it feel like extra material you have to work through?*

Rating (1–5): ___

Notes:

---

**Q5. "Before I click an episode chip, do I know which test it will jump me to?"**

*What changed: each chip now shows the linked test name after the concept label (e.g.,
"isEmpty operation → testContainsNonBST()"). The first round noted that the chip label (concept
name) and the destination test name were different, which caused confusion.*

*Does the chip label now set accurate expectations before you click?*

Rating (1–5): ___

Notes:

---

## Layer 4 — Acting (re-tests + new)

**Q6. "Do the steps in 'What to work on' feel like they're teaching me a skill — or just
telling me to fix this test?"**

*What changed: the suggestion field was replaced with a 2–3 item bullet list ("What to work
on"), and the LLM was re-prompted to frame each step around the underlying concept or technique
rather than around passing the specific test.*

*Read the steps for one or two tests. Do they feel like something you'd find useful to review
before an exam or a future assignment, or do they still feel like post-hoc instructions for
something you've already done?*

Rating (1–5): ___

Notes:

---

**Q7. "Does this feedback make me feel like I'll be better prepared for what comes next?"**

*This is a new question, prompted by your note: "I already solved this — so what's useful
about this?" The intended value proposition is not "here's how to fix the test" but "here's a
concept gap that could hurt you on the exam or in CSSE 330." Does the tool communicate that
value, or does it still feel like a post-mortem on a closed chapter?*

Rating (1–5): ___

Notes:

---

## Layer 5 — Reflection (new layer)

**Q8. "Do the episodes tell me a coherent story about my work session?"**

*This is a new question. The first round noted that run numbers carry no inherent meaning and
that episodes don't fully fix that. Each chip now shows concept label + linked test name + color
(regression = red, fix = blue). Does the row of chips give you a readable narrative of what
happened during your session — or is it still a sequence of unlabeled events?*

Rating (1–5): ___

Notes:

---

## Overall

**Q9. Compared to your first session with this tool, does it feel more readable and actionable?**

*Direct delta question. Think about the specific moments that frustrated you last time — the wall
of text, the chip that took you somewhere unexpected, the suggestion that felt irrelevant. Have
those friction points been reduced, or are there new ones that replaced them?*

Rating (1–5): ___

Notes:

---

**Q10. Is there anything the tool is now doing that it should stop doing, or anything it's still
not doing that would make it genuinely useful to you?**

*Open-ended. No rating.*

Notes:

---

## Summary

| # | Question | Re-test? | Rating |
|---|----------|----------|--------|
| Q1 | Test distribution scannable at a glance | Q3 re-test | /5 |
| Q2 | Diagnostic label orients before reading prose | Q5 re-test (partial) | /5 |
| Q3 | Sentence bullets easier to scan than paragraph | Q5/Q9 re-test | /5 |
| Q4 | Code diffs clarify rather than overwhelm | Q6 / Q9 new angle | /5 |
| Q5 | Chip label sets accurate destination expectation | Q5 re-test (partial) | /5 |
| Q6 | "What to work on" steps feel skill-building | Q7 re-test | /5 |
| Q7 | Feedback feels useful post-completion | Q7/Q8 new angle | /5 |
| Q8 | Episode chips read as a coherent session story | Q8 new angle | /5 |
| Q9 | Overall improvement vs round 1 | Overall delta | /5 |
| Q10 | Open-ended: stop/start/continue | — | — |
| | **Total (Q1–Q9)** | | /45 |

---

### Scoring guide for the researcher

| Band | Interpretation |
|------|----------------|
| Q1 ≥ 4 | Sorted bars + count text solved the scan problem |
| Q2 ≥ 3 | Pattern badge is orienting; < 3 → label is too jargon-heavy or too small |
| Q3 ≥ 4 | Sentence bullets resolved the wall-of-text complaint |
| Q4 < 3 | Code diffs are still net noise → consider collapsing by default |
| Q5 ≥ 4 | Chip→test name resolved the destination confusion |
| Q6 ≥ 3 | nextSteps framing is landing; < 3 → prompt reframing needed |
| Q7 < 3 | Post-completion relevance is the core unresolved problem |
| Q8 < 3 | Episode narrative still unclear → consider relative-time labels ("session start + 42 min") |
| Q9 — | Directional signal; combine with Q10 notes for next iteration |
