Few minimal edit to update the plan to reflect this: 

Here’s exactly where I’d update your existing plan so it explicitly proves the CloseableResource “finalize/close” happens after the entire JUnit run and that it actually saved the finished artifact.


Where to update the plan



1) Update 
Phase 1, step 2
 (right after “run tests… verify run.tar is created”)


In your plan, Phase 1 currently says:

* “Run tests in Eclipse/IntelliJ — verify run.tar is created”    


Replace/expand that single check into three checks that validate “close-at-end” behavior:

Add these sub-steps under Phase 1, step 2:

1. “Once per run” check (not per class):
    * Run the entire suite once → record prevRunNumber from testRunInfo.json
    * Run the entire suite again (no code changes required) → prevRunNumber should increment by exactly +1, not by “number of test classes”.
2. Failure-path check (still closes and saves):
    * Intentionally make one test fail (or temporarily throw in a test)
    * Run the suite → verify run.tar is still written and verify_tar.sh still validates structure/JSON.


These three checks are the “closed-loop resource” proof: you’re verifying the logger closes after the run, closes exactly once, and closes even on failures.




2) Update 
Phase 1, step 4–5
 (where you run 
verify_tar.sh
 and judge pass/fail)


Right now, Phase 1 ends with “Run verify_tar.sh … Pass criteria: all 8 checks pass…” 

Add one more explicit pass criterion:

* New pass criterion: “prevRunNumber equals the number of full suite executions, not the number of test classes.”


This makes it impossible to “accidentally pass” while still closing too often.

(Your verify script already includes a run-consistency check idea and a sample output showing prevRunNumber and runTimes counts.  )




3) Update 
Phase 2 steps for other assignments
 (the repeated rollout procedure)


Phase 2 currently has “Run tests 10 times… validate with verify_tar.sh” 

Add one extra instruction that mirrors Phase 1’s “once per run” check:

* After the 10 runs, spot-check that prevRunNumber == 10 for that assignment.


This is the cheapest way to ensure CloseableResource is not firing per-class or per-method.




4) Update 
Phase 3 (Windows validation)
 similarly


Phase 3 already says “run tests 15 times … then verify_tar.sh” 

Add:

* After 15 runs, confirm prevRunNumber == 15 on Windows too.


That catches Windows-only issues where the final close/save might be skipped or interrupted.




How many times do you need to manually check “it was actually saving”?


You don’t need to eyeball it every single run—you need a small number of checks that prove the lifecycle:

Minimum manual verification set (per platform/runner combo):

1. 2 back-to-back full suite runs (proves “close once per run” via prevRunNumber increment)
2. 1 failing run (proves it still saves on failure)
3. 1 multi-run loop (10–20 runs) + final verify_tar.sh (proves stability over time)


So practically:

* Mac + Eclipse/IntelliJ: do that set once.
* Windows + Eclipse: do that set once.


That’s usually 2 platforms × 1 runner each = 2 “full manual validations”, not dozens.

If you want the shortest safe answer: check it deeply twice per environment (a clean pass run + a forced failure run), and use the prevRunNumber == run count spot-check to cover the rest.

If you paste the exact “logger switch / obtain node” wording you mean (or the relevant snippet from LoggingExtension), I can tailor the Phase 1 sub-steps so they assert that specific “node obtained at close” behavior, not just “tar saved.”

