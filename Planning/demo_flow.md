## “Alive” flow (Phase 1)

Even without counterexamples/traces, you can make clicking a failing test feel interactive:

1. **Click failing test**

* show its pass/fail history
* show “current failing interval”

2. **Show “introduced here”**

* computed via bisect on runs
* displayed as: “Introduced in Session 4 (run 2)”

3. **Show “what changed”**

* diff between last good and first bad run
* highlight touched methods

4. **Show “evidence”**

* stack trace into student method
* expected/actual (if you can capture via rerun-for-evidence)

5. **Show “fix pattern”**

* short checklist + recommended assertion points

Episodes are mainly used for (2) and for making navigation feel human.

---

## Bottom line

**Yes, do episode splits in the MVP**—but keep them simple and position them as *navigation + summarization*.
**Do not** base meaningful-failure selection on episode boundaries; base it on test outcome intervals/regressions, and then *attribute* to episodes for the story.

If you tell me how many runs a typical student produces (rough range) and how often they run subsets vs full suite, I can recommend the best default thresholds for the time gap and focus-window rules.
