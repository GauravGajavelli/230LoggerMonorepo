# Go-Live Runbook — Sending Feedback to Real Students

This is the official production runbook. Run it **after** the BST e2e test (`bst-demo-e2e-test.md`)
is fully complete including Part D (non-happy-path). Do not skip to this document first.

---

## What runs automatically vs. what you run manually

Everything in this system is triggered manually by you except the relay and the server's email drain loop.

| Script / process | Triggered by | When |
|---|---|---|
| `relay-server.js` | pm2 on Zenbook (automatic, on login) | Always running |
| Email drain loop | server.js background interval | Every 60s automatically once `HOLD_EMAILS` removed |
| `validate-assignment-config.js` | **You** | Before pipeline, each new assignment |
| `process-batch.js` | **You** | Once, after tars arrive from Dr. Krohn |
| `regenerate-reports.js` | **You** | Only if assessment config or report template changes after pipeline |
| `summarize-feedback.js` | **You** | After pipeline, before send — optional QA scan |
| `generate-tokens.js` | **You** | Once per assignment (re-running is safe, tokens are stable) |
| `queue-emails.js` | **You** | Once per assignment, after pipeline + tokens |
| `queue-nudges.js` | **You** | Once, ~2 days before the nearest exam |

Nothing sends automatically without you first running `queue-emails.js` or `queue-nudges.js`
and then removing `HOLD_EMAILS`. The relay only delivers what's already in the queue.

---

## Dev/demo switches — full reference

These are the settings in Ubuntu's `Frontend/.env` that must change before a real send.

| Setting | Dev/test value | Production value | Effect |
|---|---|---|---|
| `EMAIL_DEV_REDIRECT` | `gajavegs@rose-hulman.edu` | *(removed)* | All emails go to you instead of real students |
| `DEMO_TOKEN` | `demo` | *(removed)* | Enables `/demo` route and demo token short-circuit |
| `HOLD_EMAILS` | *(unset)* | `true` during preview, then removed | Queues emails without sending; see preview step below |
| `BASE_URL` | `http://localhost:3000` | `https://feedback.csse.rose-hulman.edu` | Embedded in PDF links — must be prod URL |
| `DEV_BYPASS_AUTH` | `true` (local Mac only) | *(never set on Ubuntu)* | Skips RoseFire — local dev only, never on server |

`DEMO_TOKEN` and `EMAIL_DEV_REDIRECT` must both be **absent** (not just commented out) before the
real send. `pm2 restart feedback` is required after any `.env` change.

---

## After a `git pull` — run before anything else

Any time you pull new code onto Ubuntu, from `Frontend/`:

```bash
npm install                                              # new dependencies
mvn -f ../Pipeline/pom.xml package -q -DskipTests       # new Java source
npm run build                                            # new React source
pm2 restart feedback                                     # pick up all changes
curl -s http://localhost:3000/api/health                 # confirm healthy
```

DB schema is self-migrating — no manual action needed.

---

## Pre-conditions

Before starting this runbook:

- [ ] BST e2e test (Parts A–D) is complete — all checks passed
- [ ] `node scripts/validate-assignment-config.js bst` exits 0
- [ ] JAR is current: `ls ../Pipeline/target/csse230-feedback.jar` (rebuild with `mvn -f ../Pipeline/pom.xml package -q -DskipTests` if stale or missing)
- [ ] Frontend is built: `npm run build` (rebuild if any `src/` files changed since e2e)
- [ ] Zenbook relay is online: `pm2 list` shows `relay` as `online`
- [ ] Your own test events are cleared from the DB (see D5 in the e2e doc)
- [ ] You have the real student roster at `data/bst/roster.csv` (see note below) — **must be in place before Stage 0**
- [ ] Tars are in place at `data/bst/tars/<student_id>/run.tar` for all submissions (student_id = email prefix, not GitHub name)
- [ ] After any `.env` change: `pm2 restart feedback` (required for changes to take effect)

Verify `.env` is in production state before proceeding:

```bash
# Required vars — all must be present and non-placeholder
grep -E "^(BASE_URL|SECRET_KEY|ROSEFIRE_SECRET|ROSEFIRE_REGISTRY_TOKEN|RELAY_SECRET)" .env
# BASE_URL=https://feedback.csse.rose-hulman.edu
# ROSEFIRE_REGISTRY_TOKEN=<uuid>
# ROSEFIRE_SECRET=<value>
# RELAY_SECRET=<value>
# SECRET_KEY=<value>

# Dev vars — all must be absent (not just commented out)
grep -E "^(EMAIL_DEV_REDIRECT|DEMO_TOKEN|DEV_BYPASS_AUTH|HOLD_EMAILS)" .env \
  && echo "ERROR: remove dev vars before real send" || echo "OK — dev vars absent"
```

`HOLD_EMAILS` is added back deliberately in Step 3 — it must be absent here at the start.

### roster.csv vs roster.dev.csv

`roster.dev.csv` is for e2e testing only. `data/bst/roster.csv` is the production roster used
by both `stage-tars.sh` (GitHub username → email prefix lookup) and `generate-tokens.js`.

The roster format is `student_id,email` where `student_id` is the student's **GitHub username** —
this is the key used by `stage-tars.sh` to map tar filenames to email-prefix student IDs.
`generate-tokens.js` derives the actual stable student ID from the email prefix (e.g.,
`beloremd@rose-hulman.edu` → `beloremd`), so the `student_id` column is only used by stage-tars.sh.

**Add yourself to `data/bst/roster.csv`:**

```
gajavegs,gajavegs@rose-hulman.edu
```

This gives you a stable token permanently in the system, means you automatically receive the
real email every cycle (no canary setup needed for the `feedback_ready` path), and lets you
test the upload flow and drill interactions using your own entry without cleanup.

The `missing_tar` canary (`gajavegs_mt`) is still useful the first time to validate that
specific email template — see Step 5 for the updated canary approach.

**Before running research queries on the events table**, clear your own interactions:

```bash
sqlite3 db/feedback.db \
  "DELETE FROM events WHERE token=(SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst');"
```

### Student IDs — email prefix, not GitHub username

After Step 0, everything downstream uses the **email prefix** as the stable student ID:
- `data/bst/tars/` directories are named by email prefix (e.g., `beloremd/`, `guffeygi/`)
- `pipeline_runs`, `tokens`, `events`, `email_queue` all use email prefix as `student_id`
- GitHub usernames appear only in `data/bst/roster.csv` (as the lookup key) and in the tar filenames from Dr. Krohn

`stage-tars.sh` is the translation boundary that maps GitHub name → email prefix.

---

## Step 0 — Unpack and stage the tars

> **Pre-condition:** `data/bst/roster.csv` must be in place before this step.
> The script reads it to translate GitHub usernames → email-prefix student IDs.

Dr. Krohn provides a zip of the form `allTar-BST-Sp2026.zip`. The zip typically contains a
directory layer (e.g., `allTar-BST-Sp2026-7April/`) with files named `run-<githubUsername>.tar`
inside. The script handles this automatically.

```bash
# On Ubuntu, from Frontend/
bash scripts/stage-tars.sh /path/to/allTar-BST-Sp2026.zip bst
```

What the script does:
- Reads `data/bst/roster.csv` to build a GitHub username → email prefix map
- For each `run-<githubUsername>.tar` entry in the zip, strips trailing resubmission suffixes
  (e.g., `run-cahoonlh-1.tar` → looks up `cahoonlh` in the roster map)
- Stages the tar as `data/bst/tars/<emailPrefix>/run.tar`
- Skips 0-byte tars (→ `missing_tar` email path) and already-staged students (safe to re-run)
- Falls back to the GitHub username as the ID if the username isn't in roster (with a warning)

Your own tar (`run-gajavegs.tar` or similar) is staged as `gajavegs` automatically if your
GitHub username appears in the roster with your `gajavegs@rose-hulman.edu` email.

**Verify:**
```bash
ls data/bst/tars/ | wc -l     # number of students with real tars
ls data/bst/tars/              # should show email prefixes: beloremd/ guffeygi/ cahoonlh/ ...
```

### If a new zip arrives later with additional tars

```bash
# Stage only the new ones — already-staged students are skipped
bash scripts/stage-tars.sh /path/to/allTar-BST-Sp2026-v2.zip bst

# Process only the newly staged students (those without frontend.json)
node scripts/process-batch.js bst "Binary Search Tree" --skip-existing
```

Then re-run `generate-tokens.js` and `queue-emails.js` — both are idempotent and will
skip students already queued.

### If a student resubmits (tar size changed — UPDATED in stage-tars.sh output)

`stage-tars.sh` detects size changes and prints an `UPDATED` block with a ready-made command:

```
⚠  Updated students need reprocessing and email queue reset:
     guffeygi
     wakefib

To reprocess updated students only, run:
  node scripts/reprocess-students.js bst guffeygi wakefib
```

IDs in this output are email prefixes (not GitHub names). Copy that command and run it from `Frontend/`. It will:
1. Delete the student's pipeline output (forces fresh ingest + prepare)
2. Cancel any queued email (`status='cancelled'`) so queue-emails.js will re-queue
3. Re-run ingest → prepare → PDF generation

Then re-queue emails for those students only:
```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# Already-queued (non-cancelled) students are skipped; only the reprocessed ones get new emails
```

---

## Step 1 — Validate config, then run the pipeline

First, verify all three config files are present and internally consistent:

```bash
node scripts/validate-assignment-config.js bst
# Must exit 0 before proceeding
```

Build the JAR (safe to re-run; skips if already current):

```bash
mvn -f ../Pipeline/pom.xml package -q -DskipTests
ls ../Pipeline/target/csse230-feedback.jar   # confirm it exists
```

Then run the pipeline:

```bash
# First run — processes all staged students
node scripts/process-batch.js bst "Binary Search Tree"

# Progress is logged to data/bst/batch.log — tail it in another terminal to monitor:
# tail -f data/bst/batch.log

# If interrupted, resume without re-running already-finished students:
node scripts/process-batch.js bst "Binary Search Tree" --skip-existing
# --skip-existing skips anyone who already has frontend.json.
# This means errors are also retried automatically — a failed ingest or prepare never
# produces frontend.json, so those students are included in the next run.
# Exception: PDF/report generation failures (soft warnings after pipeline success) are NOT
# retried this way because frontend.json already exists. Use regenerate-reports.js for those:
#   node scripts/regenerate-reports.js bst

# If some tars arrived late (re-run stage-tars.sh first), process only new ones:
node scripts/process-batch.js bst "Binary Search Tree" --skip-existing

# Full cache clear (only if you want fresh LLM calls, e.g. prompt changed):
# rm -rf ../Pipeline/cache/llm/*
# node scripts/process-batch.js bst "Binary Search Tree"
```

Wait for it to finish. Check the summary output: `N succeeded, M failed`.

For any failed runs:
```bash
sqlite3 db/feedback.db \
  "SELECT student_id, status, error_msg FROM pipeline_runs \
   WHERE assignment='bst' AND status != 'success' ORDER BY id DESC;"
```

A failed run means that student won't get a feedback email — they'll get a missing_tar email
(if they also have no tar) or nothing (if their tar exists but errored). Decide whether to
investigate before proceeding.

---

## Step 2 — Generate tokens for the full roster

```bash
node scripts/generate-tokens.js bst bst/roster.csv
# reads data/bst/roster.csv; derives student_id from email prefix (e.g., beloremd@... → beloremd)
```

Tokens are deterministic. If some tokens already exist from e2e testing, this upserts them
safely — no change to existing values.

---

## Step 2b — QA scan (optional but recommended)

Before queueing emails, get a one-line summary of every student's pipeline output. Useful for
catching students with zero patterns, missing drills, or pipeline warnings before they receive
a confusing email.

```bash
node scripts/summarize-feedback.js bst 2>/dev/null | column -t -s $'\t'
```

Each row shows: `student_id | runs | episodes | categories | feedback_items | drills | warnings`

Look for:
- `feedback_items = 0` — student will get `(0 patterns)` in their subject line. Intentional?
- `drills = 0` but `feedback_items > 0` — patterns found but no drills matched. Check `wuas_drill_questions.json` categories.
- `warnings` column non-empty — pipeline flagged something unusual.

If you find issues that require changing the assessment config or report template (not the pipeline output itself), run `regenerate-reports.js` rather than re-running the full pipeline:

```bash
# Rebuilds report.json + report.pdf for all students from existing frontend.json
# Fast — no LLM calls
node scripts/regenerate-reports.js bst
```

---

## Step 3 — Set HOLD_EMAILS and queue emails

Adding `HOLD_EMAILS=true` means the queue drains only when you explicitly release it.

```bash
# Add to .env
echo "HOLD_EMAILS=true" >> .env
pm2 restart feedback

# Verify the flag is active
curl -s http://localhost:3000/api/health
# → {"status":"ok","students":N,...}
# (No indication of HOLD_EMAILS in the health response — that's fine)
```

Queue the emails:

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
```

You should see output like:
```
  [feedback_ready] student1 → student1@rose-hulman.edu (3 patterns)
  [missing_tar]    student2 → student2@rose-hulman.edu (+ review guide)
  ...
Done. 17 feedback_ready, 3 missing_tar queued; 0 skipped.
```

Emails are now in the DB with `status='pending'` but **will not send** until you release the hold.

---

## Step 3b — Full email preview via redirect (optional but recommended)

This step sends every queued email to **you** instead of students, so you can check every
subject line and body in real Outlook before anyone else sees them. It costs nothing extra —
you'll just reset the queue to `pending` afterward.

```bash
# Add dev redirect (send everything to yourself)
echo "EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu" >> .env
pm2 restart feedback

# Release the hold — all pending emails fire to you (subject prefix: [DEV → real@email])
sed -i '/^HOLD_EMAILS/d' .env
pm2 restart feedback
```

Check your Outlook inbox. Verify every subject and body looks correct. Then reset the queue so
the emails send for real in Step 6:

```bash
# After reviewing: reset all sent emails back to pending
sqlite3 db/feedback.db \
  "UPDATE email_queue SET status='pending', attempts=0, error_msg=NULL \
   WHERE assignment='bst' AND status='sent';"

# Remove the redirect and hold before continuing
# (Edit .env to remove EMAIL_DEV_REDIRECT; HOLD_EMAILS will be re-added in Step 6)
nano .env   # remove EMAIL_DEV_REDIRECT line
pm2 restart feedback

# Confirm redirect is gone
grep "EMAIL_DEV_REDIRECT" .env && echo "ERROR: still set" || echo "OK"
```

> **LLM cache note:** reprocessing any students after this preview is free — LLM responses are
> cached in `Pipeline/cache/llm/` from the first run.

---

## Step 4 — Preview

### 4a. Count and type check

```bash
sqlite3 db/feedback.db \
  "SELECT email_type, COUNT(*) as n FROM email_queue \
   WHERE assignment='bst' AND status='pending' GROUP BY email_type;"
# feedback_ready | 17
# missing_tar    | 3
```

Verify counts match your roster expectations.

### 4b. Spot-check subjects

```bash
sqlite3 db/feedback.db \
  "SELECT student_id, subject FROM email_queue eq \
   JOIN tokens t ON eq.token = t.token \
   WHERE eq.assignment='bst' ORDER BY eq.id LIMIT 10;"
```

Verify subject lines look correct: `CSSE 230: Binary Search Tree Feedback Available (N patterns, Exam 2)`

### 4c. Preview a full email body

```bash
sqlite3 db/feedback.db \
  "SELECT body FROM email_queue WHERE assignment='bst' ORDER BY id LIMIT 1;" \
  | python3 -c "
import sys, html
body = sys.stdin.read()
# Strip HTML tags for readable terminal preview
import re
print(re.sub(r'<[^>]+>', '', html.unescape(body)).strip())
"
```

This prints a plain-text approximation. To see the real HTML, copy the `body` column value
and paste it into a browser's address bar as a `data:text/html,` URL:

```bash
# On Ubuntu, write to a temp file and open via scp/rsync to Mac, then open in browser
sqlite3 db/feedback.db \
  "SELECT body FROM email_queue WHERE assignment='bst' ORDER BY id LIMIT 1;" \
  > /tmp/preview_email.html
```

Then on your Mac:
```bash
scp csse@feedback:/tmp/preview_email.html /tmp/preview_email.html
open /tmp/preview_email.html
```

Check:
- [ ] Sans-serif font throughout (no serif on contact line)
- [ ] `<hr>` horizontal rules render as lines (not dashes)
- [ ] Report link is `https://feedback.csse.rose-hulman.edu/report?token=…`
- [ ] Feedback link is `https://feedback.csse.rose-hulman.edu/feedback?token=…`
- [ ] No raw HTML tags visible
- [ ] No mid-sentence line breaks

### 4d. Preview the report PDF

```bash
# Pick any student with a feedback_ready email
sqlite3 db/feedback.db \
  "SELECT t.student_id, t.token FROM email_queue eq \
   JOIN tokens t ON eq.token = t.token \
   WHERE eq.assignment='bst' AND eq.email_type='feedback_ready' LIMIT 1;"
```

Open `https://feedback.csse.rose-hulman.edu/report?token=<token>` in your browser.

Check:
- [ ] PDF is not blank (> 50KB)
- [ ] Assessment table shows upcoming exams/HW with correct dates
- [ ] Drill column shows numbered drill entries
- [ ] "Open drill ›" links use `https://feedback.csse.rose-hulman.edu/feedback?token=…#drill-…`
- [ ] No phantom "Open drill ›" links for tests with no drill

### 4e. Preview the feedback site and verify interaction logging

Open `https://feedback.csse.rose-hulman.edu/feedback?token=<same token>` in browser.

- [ ] Feedback site loads (not white screen)
- [ ] Test cards visible with explanation and suggestion text
- [ ] Drill button visible where expected
- [ ] Click "✦ practice drill" — modal opens with correct content

While you're here, confirm telemetry is recording (critical — nudge targeting depends on it):

```bash
export TOKEN=$(sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst'")

sqlite3 db/feedback.db \
  "SELECT event_type, event_data, timestamp FROM events \
   WHERE token='$TOKEN' ORDER BY id DESC LIMIT 10;"
```

Expected after loading the page and opening a drill:
- `page_view` — fires on page load
- `feedback_opened` — fires when a feedback accordion is expanded (with `test_id`)
- `drill_opened` — fires when drill modal opens
- `drill_closed` — fires on close (with `seconds` value)
- `hint_revealed` — fires if you click "Show hints"
- `feedback_reviewed` — fires once when all feedback cards have been opened

If `page_view` is missing: the React build is stale — run `npm run build && pm2 restart feedback`.

### 4f. Preview a missing_tar email and generic report

The generic report is generated per-student by `queue-emails.js` so the footer feedback site
link is unique to each student's token. After Step 3 queues emails, grab a token to preview:

```bash
sqlite3 db/feedback.db \
  "SELECT t.student_id, t.token FROM email_queue eq \
   JOIN tokens t ON eq.token = t.token \
   WHERE eq.assignment='bst' AND eq.email_type='missing_tar' LIMIT 1;"
```

Open `https://feedback.csse.rose-hulman.edu/report?token=<token>` in browser.

Check:

**Page 1 (summary):**
- [ ] Generic notice strip visible: "Class-wide review guide. Upload your run.tar..."
- [ ] Assessment table shows upcoming exams with dates and drill counts
- [ ] Focal exam column shows drill names, intro, time/weight meta, source badge, and practice resource links (e.g. "Practice Exam 2 (Winter 2020-21) ›")
- [ ] Footer shows "N topics · M min total" and correct `feedback?token=…` link — no "Only you can see this feedback" line

**Page 2 (drill sheet):**
- [ ] Page 2 exists — PDF is at least 2 pages
- [ ] "Drill Sheet" header with maroon left border
- [ ] 3 drill cards, each with: name + source badge, time/weight meta, study guide link (e.g. "Exam 2 - 2023 questions ›"), Java `@Test` code block
- [ ] Code block text is **selectable and copyable** — select `@Test` through the closing `}`, paste into a text editor, verify indentation is preserved
- [ ] No hints, no "Paste into:" lines

### 4g. Clear your preview interactions

You clicked around in 4d/4e generating real `page_view` and `drill_*` events. Clear them
now — nudge targeting queries the events table to find students who haven't opened their
feedback, and your test clicks would make you look like an engaged student.

```bash
export TOKEN=$(sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst'")

sqlite3 db/feedback.db "DELETE FROM events WHERE token='$TOKEN';"

# Confirm cleared
sqlite3 db/feedback.db \
  "SELECT COUNT(*) FROM events WHERE token='$TOKEN';"
# → 0
```

Do this after **every** preview session, not just the first one.

---

## Step 5 — Canary send (missing_tar validation)

You're on `roster.csv` permanently with a real tar, so you'll receive the `feedback_ready`
email automatically in Step 6. This step only validates the `missing_tar` path with a
single canary — `gajavegs_mt`.

### 5a. Create canary token directly and remove EMAIL_DEV_REDIRECT

`generate-tokens.js` derives student_id from the email prefix, so adding
`gajavegs_mt,gajavegs@rose-hulman.edu` to the roster would just upsert the existing `gajavegs`
token (same email). Instead, insert the canary token directly into the DB:

```bash
# Confirm no tar exists for the canary
ls data/bst/tars/gajavegs_mt 2>/dev/null && echo "WARNING: remove this dir" || echo "OK"

# Insert canary token directly (student_id='gajavegs_mt', email routes to your inbox)
node --input-type=module << 'EOF'
import 'dotenv/config';
import db from './lib/db.js';
import { generateToken } from './lib/tokens.js';
const token = generateToken('gajavegs_mt', 'bst', process.env.SECRET_KEY);
db.prepare('INSERT OR REPLACE INTO tokens (token, student_id, email, assignment) VALUES (?,?,?,?)')
  .run(token, 'gajavegs_mt', 'gajavegs@rose-hulman.edu', 'bst');
console.log('Canary token created:', token);
db.close();
EOF

# Remove EMAIL_DEV_REDIRECT and DEMO_TOKEN, keep HOLD_EMAILS=true
nano .env
pm2 restart feedback

# Verify
grep -E "^(EMAIL_DEV_REDIRECT|DEMO_TOKEN|HOLD_EMAILS)" .env
# Should print only:
# HOLD_EMAILS=true
```

### 5b. Queue canary only, then release

`queue-emails.js` will find the new `gajavegs_mt` token, see no tar, and queue a `missing_tar` email:

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [missing_tar] gajavegs_mt → gajavegs@rose-hulman.edu (+ review guide)

# Release — only gajavegs_mt is pending so only it sends
sed -i '/^HOLD_EMAILS/d' .env
pm2 restart feedback
# Email arrives within ~2 minutes
```

### 5c. Validate in Outlook

Check `gajavegs@rose-hulman.edu` (no `[DEV →]` prefix now):

- [ ] Subject: `CSSE 230: Binary Search Tree Feedback, Action Needed`
- [ ] Renders HTML — sans-serif font, `<hr>` rules as lines
- [ ] Upload link clickable → shows file upload widget at feedback site
- [ ] Review guide link clickable → generic 2-page PDF loads
- [ ] Generic PDF page 1: assessment table, focal exam drills, generic notice strip
- [ ] Generic PDF page 2: "Drill Sheet" with 3 drill cards, code selectable, hints numbered

### 5d. Clean up canary

The canary was inserted directly into the DB (not via roster), so only DB cleanup is needed:

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue WHERE token IN (SELECT token FROM tokens WHERE student_id='gajavegs_mt' AND assignment='bst')").run();
db.prepare("DELETE FROM tokens      WHERE student_id='gajavegs_mt' AND assignment='bst'").run();
db.close();
console.log('Canary removed');
EOF

rm -rf data/bst/output/gajavegs_mt
```

---

## Step 6 — Queue and send real students

With canary validated and dev switches gone:

```bash
# Re-add HOLD_EMAILS for a final safety gate before real send
echo "HOLD_EMAILS=true" >> .env
pm2 restart feedback

node scripts/generate-tokens.js bst bst/roster.csv    # generates tokens for all real roster students
node scripts/queue-emails.js bst "Binary Search Tree"
# → N feedback_ready, M missing_tar queued

# Final check: confirm counts match expectations
sqlite3 db/feedback.db \
  "SELECT email_type, COUNT(*) FROM email_queue \
   WHERE assignment='bst' AND status='pending' GROUP BY email_type;"
```

When satisfied, release:

```bash
sed -i '/^HOLD_EMAILS/d' .env
pm2 restart feedback
```

---

## Step 7 — Monitor delivery

The drain loop runs every 60 seconds. After Step 6 release it will immediately begin pushing.

```bash
watch -n5 'sqlite3 db/feedback.db \
  "SELECT status, COUNT(*) as n FROM email_queue WHERE assignment='"'"'bst'"'"' GROUP BY status;"'
```

Expected progression over ~5 minutes (for ~20 students):
```
pending  | 20   →   sending | 1 / sent | 1 / pending | 19   →   sent | 20
```

Each email takes ~5s via Outlook COM. If any land in `failed` or `dead`:

```bash
sqlite3 db/feedback.db \
  "SELECT eq.id, t.student_id, eq.status, eq.attempts, eq.error_msg \
   FROM email_queue eq JOIN tokens t ON eq.token = t.token \
   WHERE eq.assignment='bst' AND eq.status IN ('failed','dead');"

# Reset dead emails to retry:
sqlite3 db/feedback.db \
  "UPDATE email_queue SET status='pending', attempts=0 \
   WHERE assignment='bst' AND status='dead';"
```

---

## Step 8 — Confirm delivery

With dev redirect removed, you won't receive a copy. You will receive one via your own roster
entry (`gajavegs`). Also check the sent timestamp in the DB:

```bash
sqlite3 db/feedback.db \
  "SELECT t.student_id, eq.status, eq.sent_at \
   FROM email_queue eq JOIN tokens t ON eq.token = t.token \
   WHERE eq.assignment='bst' ORDER BY eq.sent_at DESC LIMIT 5;"
```

---

## Between send and nudge — if a student uploads their tar

If a `missing_tar` student uploads their run.tar after receiving the initial email, the server
runs the pipeline and queues a `regeneration_ready` email automatically. No action needed from
you unless the pipeline errors (check `pipeline_runs` table if a student reports not receiving
an update).

If you manually change the assessment config or report template in the window between initial
send and nudge day, regenerate all PDFs before the nudge goes out:

```bash
node scripts/regenerate-reports.js bst
# Then re-check one report PDF in the browser before releasing nudges
```

---

## Step 9 — Schedule nudges (2–3 days before Exam 2)

Nudges target:
- Students who got a `feedback_ready` email but have no `page_view` event
- Students who got only a `missing_tar` email, also with no `page_view` event (different template)

```bash
echo "HOLD_EMAILS=true" >> .env
pm2 restart feedback

node scripts/queue-nudges.js bst
# → [nudge:feedback]    student1 → ... (N patterns)
# → [nudge:missing_tar] student2 → ... (+ review guide)
```

Preview nudge bodies before sending:

```bash
# feedback nudge
sqlite3 db/feedback.db \
  "SELECT body FROM email_queue WHERE assignment='bst' AND email_type='nudge' \
   AND token IN (SELECT token FROM email_queue WHERE email_type='feedback_ready' AND assignment='bst') \
   LIMIT 1;" > /tmp/nudge_feedback.html

# missing_tar nudge
sqlite3 db/feedback.db \
  "SELECT body FROM email_queue WHERE assignment='bst' AND email_type='nudge' \
   AND token IN (SELECT token FROM email_queue WHERE email_type='missing_tar' AND assignment='bst') \
   LIMIT 1;" > /tmp/nudge_missing.html
```

Check on Mac (`scp csse@feedback:/tmp/nudge_*.html /tmp/ && open /tmp/nudge_feedback.html /tmp/nudge_missing.html`):

- [ ] **feedback nudge**: mentions pattern count, links to report + feedback site, sans-serif, `<hr>` rules
- [ ] **missing_tar nudge**: mentions exam name + date, links to review guide (if exists) + upload prompt, no mention of "patterns"
- [ ] No encoding artifacts (`ΓÇô`, `ΓÇö`, or similar CP437 garbage) — the relay uses `$mail.HTMLBody` (UTF-8 charset) and templates use HTML entities (`&ndash;`, `&mdash;`) so this should never occur, but confirm on first send of each template type
- [ ] VPN note present in both

Release:
```bash
sed -i '/^HOLD_EMAILS/d' .env
pm2 restart feedback
```

---

## Edge cases to vet before each send

These are the things most likely to catch you off-guard. Check them during Step 4 preview.

### Email content
- [ ] **Subject line length**: subjects over ~60 chars get clipped in mobile preview panes. Check the longest one: `CSSE 230: Binary Search Tree Feedback Available (N patterns, Exam 2)` — if pattern count is double digits, it may push past 70 chars. The script already has a short-subject fallback (`CSSE 230: Binary Search Tree Feedback Available (N patterns)` without the exam name); verify it triggers if needed.
- [ ] **Zero patterns**: a student who submitted but had no detectable patterns gets `(0 patterns, Exam 2)` in the subject. Confirm this looks intentional, not broken. Consider whether the body copy still reads well with "0 patterns were identified."
- [ ] **Missing_tar with no assessment config**: `generateGenericReport` returns null, `reportLink` is null, email omits the review guide section. Confirm the email still makes sense without it — currently it just says "upload your tar" with no secondary link.
- [ ] **Student email addresses**: verify no addresses in the roster have trailing spaces, typos, or non-`@rose-hulman.edu` domains that slipped through. A bounce won't break the relay but will show as `dead` after 3 attempts and won't retry automatically.

### PDF report
- [ ] **Days-left badge**: if you're sending close to Exam 2, the badge may show "1d" or "0d". Check it doesn't show negative days (assessment already passed). The template already handles `daysLeft <= 0` gracefully but verify with the actual send date.
- [ ] **Token in PDF links**: every "Open drill ›" and "Open full feedback site ›" link in the PDF embeds the student's token. If a PDF was generated before `generate-tokens.js` ran (shouldn't happen with the current flow, but possible if you regenerate manually), the link uses a placeholder. Spot-check one PDF by opening the report URL and clicking a drill link.
- [ ] **Generic report drill content**: the generic PDF has 2 pages — page 1 is the summary (same layout as personalized), page 2 is the drill sheet with embedded `@Test` code blocks and numbered hints. Verify page 2 exists, drill cards have the maroon left border, and the code is selectable. There are no "Open drill ›" links (`drill_anchor: null`) — source badge links (e.g. "Exam 2 ↗") are the only external links on page 1.

### Feedback site
- [ ] **Stale build**: if `TestCard.jsx` or any other component was changed since the last `npm run build`, the feedback site will serve old code. The telemetry events (`page_view`, `drill_closed`, etc.) won't fire on the old bundle. Always run `npm run build && pm2 restart feedback` after any frontend change.
- [ ] **Token not in DB**: if a student's token link was somehow generated with a different `SECRET_KEY` than what's currently in `.env`, the feedback site will show "invalid token." This can happen if `.env` was regenerated. All tokens must be derived from the same `SECRET_KEY`. If this happens, re-run `generate-tokens.js` — tokens regenerate deterministically from the current key.

### Relay
- [ ] **Relay heartbeat age**: check `relayLastHeartbeat` in `/api/health` is within the last 5 minutes before releasing. A stale heartbeat means emails will queue but not send.
- [ ] **Outlook window open**: the relay spawns a PowerShell child per email that uses Outlook COM. Outlook must be open and signed in. After a Zenbook reboot, confirm Outlook launched automatically (check Startup folder) and is not showing a sign-in prompt.
- [ ] **Batch size**: the relay processes one email at a time, each taking ~5s. For 20 students that's ~2 minutes total. If the Zenbook goes to sleep or loses network mid-batch, some emails stall in `sending`. The 5-minute safety valve resets them to `pending` automatically.

### Research data
- [ ] **Your own events**: clear your `gajavegs` events from the DB before any analysis run (see Pre-conditions). Do this even if you didn't click around much — `page_view` fires on every load.
- [ ] **Canary rows**: if you used the `gajavegs_mt` canary, its cleanup is in Step 5d — no events to clear since it has no feedback site.
- [ ] **Nudge timing**: nudges sent too early (> 2 days before exam) are blocked by the calendar guard. Use `--force` only if you have a specific reason. Check `daysUntil` in the script output.

---

## Rollback / emergency stop

If something goes wrong mid-send and you need to stop immediately:

```bash
echo "HOLD_EMAILS=true" >> .env
pm2 restart feedback
```

This halts the drain loop. Emails already pushed to the relay may still send (the relay
processes them immediately on receipt). Emails still `pending` in the DB will not be pushed
until you restart without `HOLD_EMAILS`.

To cancel pending emails entirely:

```bash
sqlite3 db/feedback.db \
  "UPDATE email_queue SET status='dead', error_msg='cancelled by operator' \
   WHERE assignment='bst' AND status='pending';"
```
