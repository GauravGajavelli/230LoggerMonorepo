# Progressive Disclosure Questionnaire

**Instructions:** You've just submitted your code and opened this feedback tool. Answer each question in order — they reflect the natural sequence of things you'd want to know. For each question, rate 1–5 how well the tool answers it **at the moment you'd naturally ask it**, without any extra clicking or exploration.

> 1 = Not answered / I had to hunt for it
> 3 = Partially answered / took some effort
> 5 = Immediately clear, no effort required

---

## Layer 1 — First glance (before any interaction)

**Q1. "Do I have anything that needs my attention right now?"**

*Does the landing view immediately surface whether there's something actionable — without you having to read through details or explore?*

Rating (1–5): 4

Notes: I'd say it does. When I see the assignment list screen, there's a clear indicator of new feedback for the last assignment. Then, clicking into it, the same animation is shown on the improved tab, indicating that there is something worth looking at. The same goes for the episodes on the left, which go to the feedback when clicked.

However, it might help to have a global count of feedback items to look at that is decremented as you go through (some like the top right, but not necessarily), since it might be easy to miss the little dots. Feel free to disagree.

---

**Q2. "How bad is it? Is this a lot to deal with?"**

*Does the tool give you a quick sense of scale and framing — e.g., "3 of 8 tests need attention" or "you improved since your last run" — before you dig in?*

Rating (1–5): 5

Notes: Yeah, zero needed attention, so not very much to deal with.

---

## Layer 2 — Scanning (light interaction, no expanding)

**Q3. "Which specific test(s) are the problem?"**

*Can you identify the failing or newly-broken tests by scanning the page, without opening anything?*

Rating (1–5): 3

Notes: Seeing the failing tests is easy because they're under needs attention. However the colored rectangles from the "All 33 tests passing" window take a while to show the name, it would be better if it were somehow more obvious what tests they referred to.

---

**Q4. "Did something just break, or has this been failing for a while?"**

*Is the recency or change-status of a failure visible without replaying the timeline — e.g., a visual marker for tests that changed this run?*

Rating (1–5): N/A

Notes: I didn't have any failures. Also one of the episodes is red and another gray for some reason.

---

## Layer 3 — Understanding (expanding a test card)

**Q5. "Why did this test fail?"**

*Once you open a failing test, is the explanation of the cause clear and easy to read? Does it feel like it's talking about your specific situation?*

Rating (1–5): 1

Notes: The first episode I received a notification for is called the isEmpty operation, which I don't 100% remember what it was. When I clicked it, it took me to testContainsNonBST, which I don't remember working on.

Moreover, I don't see the purpose of what they are bringing up here. The "What Happened" seems accurate enough, but the suggested next step here is pointless; I think this method was already implemented, and the "suggested next step" is basically useless because I already solved this. Also, it being a big paragraph is difficult to read, and it should be split into a limited number of bullets. Even looking at the one for testIterator I think they're accurate, but I don't see how these are useful. I guess for testIterator the advice is good (basically telling me the non-hacky way to do it), but I won't ever remember to because the assignment is over and no test is having me implement an iterator for a BST.

For testRemove, you're just telling me what happened in the "What happened", but I already knew the test failed and had to be rewritten. The suggested next step made sense, though maybe the framing of a suggested next step makes it seem annoying because I already did this and got it to work. The advice for testRemoveAdvanced was also useful, but would've been more so when I was doing the assignment.

---

**Q6. "What code change caused this?"**

*Is the relevant diff visible within the explanation, without navigating to a separate view or mentally reconstructing what changed?*

Rating (1–5): 3

Notes: I can see the code changes, but I don't think the connection between them and the surrounding context is obvious, as well as with the suggested feedback. Maybe we could allow clicking through if there are multiple runs' diffs being shown so the runs to take up less vertical space and reduce overwhelm.

---

## Layer 4 — Acting (deepest level)

**Q7. "What should I actually do to fix this?"**

*Is a concrete next step available after reading the explanation, and does it feel like a natural continuation — not buried or bolted on?*

Rating (1–5): 2

Notes: The suggested next steps are a natural continuation: they are indeed the correct way to solve the problem. However, they fall flat; I already fixed it, so what’s useful about this? The suggested next steps should be useful information to a student reviewing the thing; what underlying skill are they struggling with? How could we help them?

Maybe something that states the underlying issue directly, something that they will have to deal with in the future.

    - The what happened and code change don’t work either.
        - It just throws all of these run numbers at you like that’s supposed to mean something. Who cares?
        - Is this what the flashing alert was for? I already know this/can’t see a benefit

- It should be obvious how it benefits you; I don’t want to lose the research-tool nature of it, but what comes to mind is video game grinding
    - I want each of the things to have the clarity of the stat boost; something that, if you do it, will yield an obvious benefit
    - You know what your weakness is (a certain stat or level) and so you grind the thing to make up for that
    - I don’t know how to clearly convey that in a research context though, since I don’t want a game-style radar chart. Or maybe like a radar chart of their strength in the concepts needed for this particular assignment and the feedback as stat boosts to those (like with a ghost version of where they would be improve if they acted on the feedback or practiced or something)? And then they fill out the radar chart as they go along. The only thing is that the chart might be too spiky. Might need to be more interactive then IDK, plus who knows if they really don't understand since they did indeed finish the assignment.

The run numbers don’t carry any inherent meaning, and frankly the episodes don’t fix that

Ultimately the goal here should be to avoid future, more catastrophic mistakes. This is easier to convince students of if they've already struggled, but too much FUD can backfire. I just know that I clearly did not understand enough when I did this.

---

## Overall

**Q8. Did the order in which you encountered information feel natural?**

*Did the tool lead you from "do I have a problem?" → "what is it?" → "why?" → "what now?" in a way that felt like reading a story rather than navigating a dashboard?*

Rating (1–5): 2

Notes: It did clearly go from "do I have a problem?" to "what is it?", but for the reasons mentioned earlier the "why" and "what now" aren't compelling enough to warrant further interest. Maybe there just isn't enough information being fed to the logger. We have the assignments characterized well enough, but perhaps more data from the course (i.e., assessment content or future assignments something) could be referenced to convey the importance of review. Feel free to disagree.

---

**Q9. At any point did you feel overwhelmed or discouraged?**

*Did the volume or framing of the information feel like too much at once? Did seeing failures feel punishing rather than constructive?*

Rating (1–5, where 5 = never overwhelmed): 3

Notes: I wasn't overwhelmed by the amount of feedback, but the way it was presented (several paragraphs and giant blocks of code with no immediate meaning or context) was difficult to parse. The failures didn't feel punishing, and the feedback felt measured and well-intentioned.

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

*Based on the design philosophy in `/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/demo_prep/design_philosophy.md`. Low scores on Q1–Q2 suggest the landing view needs a stronger summary. Low scores on Q3–Q4 suggest scan-ability issues. Low scores on Q5–Q6 suggest the expansion layer is weak. Low scores on Q7 suggest suggestions are buried.*
