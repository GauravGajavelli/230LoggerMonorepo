# The Sprinter

## Student Archetype
A confident student who moves quickly through the assignment, perhaps too quickly. They make rapid initial progress through the early phases but their haste leads to a significant regression midway. After recovering, they finish in fewer runs than average.

## Expected Story Arc

### Phase 1: Quick Start (Runs 1-3)
Brief compilation phase. The student's high phaseSpeedMultiplier (1.5) means they advance through phases faster than normal.

### Phase 2: Rapid Progress (Runs 4-8)
Insert, properties, search, and conversion methods are implemented in quick succession. A breakthrough at run 8 shows multiple tests passing at once — the student is moving fast.

### Phase 3: The Regression (Runs 9-12)
The fast pace catches up. Around run 12, a regression occurs with moderate severity (0.5). A previously-passing test fails, likely due to a refactoring mistake or incorrect optimization.

### Phase 4: Recovery (Runs 13-15)
The student identifies and fixes the regression. They finish with good test coverage, having completed the assignment efficiently despite the setback.

## Expected LLM Assessment
- **Dominant episode type**: productive
- **Pattern**: incremental development (with possible regression mention)
- **Intent distribution**: mostly "extending" with some "debugging" during regression
- **Fast upward progress, visible dip, then recovery**
- **At least one breakthrough and one regression episode**

## Validation Notes
This scenario illustrates a student who could benefit from encouragement to slow down and test more carefully. The regression is a natural consequence of moving too fast. The LLM should note both the impressive speed and the regression.
