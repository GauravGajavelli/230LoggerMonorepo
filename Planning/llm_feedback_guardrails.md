  ---                                                                                                                     
  What was built                                                                                                   
                                                                                                                          
  Two complementary layers that together give structural guarantees:                                                      
                                                                                                                        
  Layer 1 — Prevention (upstream of the LLM)

  groundTruth block in LLM input JSON (FeedbackGenerationService.buildInputJson):
  "groundTruth": {
    "currentlyPassing": true,
    "firstFailRun": 1,
    "firstPassRun": 9,
    "lastRunWithResult": 40
  }
  Computed directly from statusByRun — immune to the bugs in wasFixed, struggleProfile, or anything else. The LLM gets
  explicit, non-inferrable facts as a named block it can't miss.

  MANDATORY CONSTRAINTS section in the prompt — tells the LLM that groundTruth is authoritative and overrides everything
  else, with concrete examples of what it must not write.

  isLingeringFailure field in the per-test input — already added in the Q3 fix, now reinforced by
  groundTruth.currentlyPassing.

  Layer 2 — Detection (downstream of the LLM)

  FeedbackFactChecker (domain/FeedbackFactChecker.java) — runs in PrepareService after generation + refinement, before the
   output is written:

  - Rule 1 (linger-consistency): Two tiers of phrase matching. Always-wrong phrases ("never passed", "is still failing")
  are checked in the full text. Context-sensitive phrases ("continued to fail", "remained failing") are only checked in
  the last sentence, so historical descriptions like "remained failing through runs 4–8" don't generate false positives.
  - Rule 2 (run-plausibility): Any run number cited in the explanation must fall within the test's actual recorded run
  range.

  Violations print to stderr with [rule] tags and are also added to warnings in the PrepareResult, surfacing them in any
  downstream reporting. The pipeline still completes so you can inspect the output — this is a "loud warning" not a hard
  stop.

  Why not a hard stop?

  Blocking the pipeline on a violation would be wrong: the explanation might still be useful despite a minor phrase issue,
   and regenerating (re-spending LLM budget) isn't warranted automatically. The right action is operator review. If
  violations become zero consistently, that validates the prevention layer is working.

======== ADDITIONAL FIXES ========

  ---                                                                                                                     
  Retry — straightforward. The generate+refine pair is now inside a for (attempt = 1..2) loop. If the fact-check passes,  
  break. If it fails after attempt 1, you see "violation(s) on attempt 1 — retrying..." and a second pair of LLM calls  
  fires. If it still fails after attempt 2, only then does it escalate to operator review. The violation count and rule   
  names are printed either way so there's a paper trail.                                                                  
                                                                                                                          
  Distinguishing pipeline bug from LLM hallucination — this is the more important question you raised. Before constructing
   the LLM input, buildInputJson now cross-checks struggleProfile.wasFixed() against isLingeringFailure. If they disagree,
   it prints PIPELINE DATA INCONSISTENCY to stderr and names the specific fields that conflict.                         

  The wasFixed() issue would have appeared as:
  PIPELINE DATA INCONSISTENCY [BSTManualTesting#testContainsNonBST()]:
    struggleProfile.wasFixed=false contradicts isLingeringFailure=false
    — groundTruth block will override

  That message fires before the LLM call, costs nothing to compute, and points directly at the pipeline field with the bug
   — no LLM output analysis needed. A post-generation FACT-CHECK VIOLATION on the same test would then tell you the LLM
  also got confused, but PIPELINE DATA INCONSISTENCY is the earlier, cheaper signal that says: fix the code, not the
  prompt.

  So the two signals are now clearly separated: PIPELINE DATA INCONSISTENCY = a typo/bug in the Java pipeline code;
  FACT-CHECK VIOLATION after N attempts = genuine LLM hallucination that survived both the prompt constraints and retry.
