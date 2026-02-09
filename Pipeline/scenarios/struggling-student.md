# The Struggling Student

## Student Archetype
A student who is not well-prepared and faces persistent difficulties throughout the assignment. They spend long periods stuck on basic concepts, experience regressions where previously-working code breaks, and only achieve a late breakthrough after many attempts.

## Expected Story Arc

### Phase 1: Rough Start (Runs 1-5)
Extended compilation issues. The student takes longer than average to get basic code compiling.

### Phase 2: Slow Progress (Runs 6-11)
Basic insert and tree properties are attempted, but with low pass rates. Multiple tests are stuck in reactive debugging patterns (same error repeated across runs). Some tests oscillate between passing and failing.

### Phase 3: The Plateau (Runs 12-22)
The student gets stuck. Pass probabilities stop growing. A regression occurs around run 20 where a previously-passing test breaks. This is the most challenging period — the student makes minimal forward progress for ~10 runs.

### Phase 4: Late Breakthrough (Runs 23-35)
After the plateau, gradual improvement resumes. A breakthrough at run 30 unlocks several tests simultaneously. The student starts making up for lost time.

### Phase 5: Partial Recovery (Runs 36-40)
The student finishes with moderate test coverage but likely doesn't complete all advanced topics due to time spent stuck earlier.

## Expected LLM Assessment
- **Dominant episode type**: stuck
- **Pattern**: trial-and-error debugging, possibly regression cycles
- **Intent distribution**: heavily "debugging" with minimal "extending"
- **Multiple prolonged stuck episodes**
- **At least one breakthrough after the plateau**
- **Clear plateau visible in test passage trend**

## Validation Notes
This scenario represents a student who would benefit from instructor intervention during the plateau phase. The LLM should flag repeated debugging patterns and the extended period of no progress.
