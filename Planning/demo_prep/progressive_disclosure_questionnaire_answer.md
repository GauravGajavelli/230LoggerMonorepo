# Progressive Disclosure Questionnaire

**Instructions:** You've just submitted your code and opened this feedback tool. Answer each question in order — they reflect the natural sequence of things you'd want to know. For each question, rate 1–5 how well the tool answers it **at the moment you'd naturally ask it**, without any extra clicking or exploration.

> 1 = Not answered / I had to hunt for it
> 3 = Partially answered / took some effort
> 5 = Immediately clear, no effort required

---

## Layer 1 — First glance (before any interaction)

**Q1. "Do I have anything that needs my attention right now?"**

*Does the landing view immediately surface whether there's something actionable — without you having to read through details or explore?*

Rating (1–5): ___

Notes:

---

**Q2. "How bad is it? Is this a lot to deal with?"**

*Does the tool give you a quick sense of scale and framing — e.g., "3 of 8 tests need attention" or "you improved since your last run" — before you dig in?*

Rating (1–5): ___

Notes:

---

## Layer 2 — Scanning (light interaction, no expanding)

**Q3. "Which specific test(s) are the problem?"**

*Can you identify the failing or newly-broken tests by scanning the page, without opening anything?*

Rating (1–5): ___

Notes:

---

**Q4. "Did something just break, or has this been failing for a while?"**

*Is the recency or change-status of a failure visible without replaying the timeline — e.g., a visual marker for tests that changed this run?*

Rating (1–5): ___

Notes:

---

## Layer 3 — Understanding (expanding a test card)

**Q5. "Why did this test fail?"**

*Once you open a failing test, is the explanation of the cause clear and easy to read? Does it feel like it's talking about your specific situation?*

Rating (1–5): ___

Notes:

---

**Q6. "What code change caused this?"**

*Is the relevant diff visible within the explanation, without navigating to a separate view or mentally reconstructing what changed?*

Rating (1–5): ___

Notes:

---

## Layer 4 — Acting (deepest level)

**Q7. "What should I actually do to fix this?"**

*Is a concrete next step available after reading the explanation, and does it feel like a natural continuation — not buried or bolted on?*

Rating (1–5): ___

Notes:

---

## Overall

**Q8. Did the order in which you encountered information feel natural?**

*Did the tool lead you from "do I have a problem?" → "what is it?" → "why?" → "what now?" in a way that felt like reading a story rather than navigating a dashboard?*

Rating (1–5): ___

Notes:

---

**Q9. At any point did you feel overwhelmed or discouraged?**

*Did the volume or framing of the information feel like too much at once? Did seeing failures feel punishing rather than constructive?*

Rating (1–5, where 5 = never overwhelmed): ___

Notes:

---

## Summary

| # | Question | Rating |
|---|----------|--------|
| Q1 | Immediate actionability visible | /5 |
| Q2 | Scale and framing on landing | /5 |
| Q3 | Failing tests identifiable by scanning | /5 |
| Q4 | Change-recency visible without timeline replay | /5 |
| Q5 | Explanation is clear and specific | /5 |
| Q6 | Code diff accessible within explanation | /5 |
| Q7 | Next step is clear and reachable | /5 |
| Q8 | Information order felt natural | /5 |
| Q9 | Did not feel overwhelmed/discouraged | /5 |
| | **Total** | /45 |

---

*Based on the design philosophy in `design_philosophy.md`. Low scores on Q1–Q2 suggest the landing view needs a stronger summary. Low scores on Q3–Q4 suggest scan-ability issues. Low scores on Q5–Q6 suggest the expansion layer is weak. Low scores on Q7 suggest suggestions are buried.*
