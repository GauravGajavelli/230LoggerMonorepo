# Expert Rating Integration — Claude Code Prompt

## Step 1: Understand the Codebase (do this first, before any changes)

Read the full project structure and understand:

1. **Directory layout** — run `find . -type f -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.html' -o -name '*.json' | grep -v node_modules | grep -v dist | head -100` and then read the top-level README, package.json, and any config files
2. **Pages/routes** — there are approximately two main views. Identify what they are, what data they consume, and how students navigate between them
3. **Data model** — read a sample `frontend.json` and `report.json` from `Frontend/data/`. Understand the structure: episodes, feedback items, test histories, failure highlights, drills, assessment mappings
4. **How feedback is rendered** — trace the code path from data loading to the UI components that display feedback items, code diffs, test results, episode timelines, and drill recommendations. Identify the key components and what props they receive
5. **How authentication works** — understand the token system (how a student's token maps to their data directory)
6. **The existing rating tool** — read `Frontend/tools/rq1-rating/` including `prepare-rating-data.cjs`, `rating-tool.html`, and the demo script. Understand what data it extracts and how raters currently interact with it

After reading, provide a summary of:
- The two main pages and what each does
- The component hierarchy for feedback display
- The data flow from JSON files to rendered UI
- The token/auth system
- What the existing rating tool extracts vs what the full app shows

## Step 2: Identify the Gap

The existing rating tool (`rating-tool.html`) extracts feedback data into a standalone page. But it's missing something critical: **raters need to see the student's actual code** to judge whether the system's feedback is correct. They need to understand the basis of the feedback — what the student's code looked like, what changed between attempts, what the test failures actually were in context.

Compare what the existing rating tool shows versus what the full feedback app shows. Identify specifically:
- What code views exist in the app that are missing from the rating tool?
- What contextual information (episode details, code diffs, test output) would a rater need to evaluate correctness?
- Can this information be extracted into the rating data, or does it require the full app?

## Step 3: Design the Solution

The goal: allow 2–3 expert raters (TAs familiar with CSSE 230) to view the full feedback the system generated for de-identified students — including the student's code, code diffs, test results, and episode context — and rate each student-assignment pair on three dimensions (correctness 1–5, actionability 1–5, specificity 1–5) plus tag failure modes.

Requirements:
- Raters should see everything a student would see in the feedback app, plus the rating panel
- Student identities must be anonymized (replace student IDs with codes like A001–A035)
- Raters should be able to work through ~35 pairs at their own pace, with progress saved
- Ratings should be exportable as CSV/JSON for inter-rater reliability analysis
- The solution must be hostable on the existing server (which is available until June 1)
- Keep it as simple as possible — prefer adding a rating overlay to the existing app over building a separate system

Possible approaches (evaluate which is best given the codebase):

**Option A — Rating mode in the existing app.** Add a query parameter or route (e.g., `/feedback?token=XXX&rater=TA-1`) that, when present, shows the existing feedback view with a sticky rating panel overlaid. The rater navigates through pre-generated tokens for de-identified students. Ratings save to the server's SQLite database.

**Option B — Enhanced standalone tool.** Expand `prepare-rating-data.cjs` to extract ALL the data the app renders (including code, diffs, episode details) into the JSON. Rebuild the rating tool to render everything the app does, self-contained. This is more work but doesn't depend on the server.

**Option C — Separate rating route.** Add a new page/route to the app specifically for raters. It loads the same data and components as the student view but adds rating controls and navigates through a list of de-identified pairs.

Pick the approach that requires the least new code given what already exists. Explain why.

## Step 4: Implement

Build the chosen solution. Key details:

### Rating Panel (same as existing rating tool)
Three dropdowns (Correctness 1–5, Actionability 1–5, Specificity 1–5) with rubric descriptions in each option:

**Correctness:**
- 1: Major errors — misidentifies the problem, hallucinates methods
- 2: Significant inaccuracies — right area, wrong specifics
- 3: Mostly correct with minor errors
- 4: Accurate — correctly identifies issues and relevant tests
- 5: Fully correct — precise identification, accurate concept mapping

**Actionability:**
- 1: Completely vague ("review your code")
- 2: Points in a direction but not enough to act
- 3: General approach given
- 4: Specific and actionable
- 5: Directly actionable with clear path and targeted drill

**Specificity:**
- 1: Completely generic — could apply to anyone
- 2: Mentions right assignment but nothing student-specific
- 3: References specific tests but analysis is generic
- 4: Clearly based on this student's patterns
- 5: Deeply specific — references exact debugging progression

**Failure mode checkboxes:**
- hallucinated_reference
- wrong_root_cause
- vague_recommendation
- mismatched_concept
- redundant
- missing_obvious
- correct_but_unhelpful
- other (free text)

**Notes:** free text field

### De-identification
- Replace student IDs/names/emails with anonymous codes (A001–A035)
- Preserve test names and code (these are assignment-specific, not student-identifying)
- Preserve everything else the feedback app shows

### Navigation
- Rater can move between pairs (prev/next buttons or keyboard arrows)
- Progress indicator showing how many are rated
- Pairs should be shuffled across assignments (not all BST then all Graphs)

### Persistence
- Save ratings after every change
- If server-hosted: save to SQLite via API endpoint
- Support resume — rater can close and come back

### Export
- JSON and CSV export of all ratings
- Format: pair_id, rater_id, assignment, correctness, actionability, specificity, failure_mode_tags, notes, timestamp

## Constraints
- The server is available until June 1. Everything must be deployed and working before then.
- 2–3 raters, 35 pairs each. This is tiny scale — don't over-engineer.
- The raters are CS TAs, not general users. The UI can be functional, not polished.
