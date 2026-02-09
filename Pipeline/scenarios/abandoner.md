# The Abandoner

## Student Archetype
A student who starts the assignment but gives up partway through. They make some progress on basic insertion and tree properties, begin working on deletion, but never complete it. The second half of the assignment shows no forward progress — the student has effectively abandoned the work.

## Expected Story Arc

### Phase 1: Getting Started (Runs 1-5)
Compilation phase takes the normal amount of time. The student gets basic code compiling.

### Phase 2: Basic Progress (Runs 6-14)
Insert and tree property methods are attempted with hard difficulty, so pass rates are lower. Some reactive debugging patterns appear. Progress is slow but present.

### Phase 3: The Plateau / Abandonment (Runs 15-25)
The student hits a wall at deletion (phase 3 cap). Progress completely stalls:
- Pass probabilities stop growing (plateau)
- No new categories are unlocked (finalPhase = 3)
- No breakthrough occurs
- The last 10 runs show minimal change

The student may still be submitting runs (perhaps trying minor fixes) but is no longer making meaningful progress.

## Expected LLM Assessment
- **Dominant episode type**: stuck (especially in later runs)
- **Pattern**: trial-and-error debugging, stalled progress
- **Intent distribution**: mostly "debugging" with diminishing "extending"
- **Early productive episodes, then prolonged stuck episodes**
- **No breakthrough episodes**
- **Clear stall visible in test passage trend**

## Validation Notes
This scenario represents a student who needs urgent instructor intervention. The LLM should recognize the abandonment pattern — initial effort followed by extended stagnation. The absence of any breakthrough and the long plateau are key signals.
