# BST — End-to-End Test Runbook

Tests the full pipeline from real `.tar` files through to received emails with working report
and feedback links. Five students with tars and one missing-tar case. Assumes the Ubuntu server
is running via pm2, nginx configured, JAR built, DB initialized, and Zenbook relay running.

---

## Student IDs used in this runbook

Student IDs are now **email prefixes** (everything before `@rose-hulman.edu`), not GitHub usernames.
Set these once at the top of your shell session.

```bash
export STU1=baileyjn            # Jack-B-RHIT        (130 KB)
export STU2=mirandac            # rhit-mirandac      (116 KB)
export STU3=osujiun             # rhit-osujiun       (108 KB)
export STU4=gheorgg             # rhit-gheorgg       ( 81 KB)
export STU5=adusumn             # nirdeshadusumilli2007 (36 KB)
export STU_MT=gajavegs-mt       # missing-tar test case (no run.tar)
export EMAIL=gajavegs@rose-hulman.edu  # all dev emails redirect here
```

All tars are inside `Pipeline/testInputs/studentTars/allTar-BST-Sp2026-7April.zip`.
GitHub usernames (used in the zip) map to email-prefix directories as shown in A2.

---

## After a `git pull` — before running anything

Run these any time you pull new code. All commands from `Frontend/` on Ubuntu.

```bash
npm install
mvn -f ../Pipeline/pom.xml package -q -DskipTests
npm run build
pm2 restart feedback
curl -s http://localhost:3000/api/health
```

**DB schema**: `db.js` runs `CREATE TABLE IF NOT EXISTS` and idempotent `ALTER TABLE` on every
server start — new columns appear automatically. Only clear DB data (A1) when you want a
clean test run.

---

## Where to run what

| Task | Where |
|---|---|
| Pipeline (ingest + prepare) | Ubuntu server |
| Report design iteration | Local Mac — edit in IDE, instant feedback |
| Email copy iteration | Ubuntu server (read body from SQLite — no relay needed) |
| Full e2e send test | Ubuntu server + Zenbook relay |

---

## Part A — Run the pipeline (Ubuntu server)

All commands from `Frontend/` on Ubuntu.

### A1. Full reset (start clean)

**Quickest — wipe the entire DB:**
```bash
rm db/feedback.db
pm2 restart feedback   # schema recreates automatically; Zenbook re-registers within ~60s
rm -rf data/bst/output/$STU1 data/bst/output/$STU2 data/bst/output/$STU3 data/bst/output/$STU4 data/bst/output/$STU5 data/bst/output/$STU_MT
rm -rf ../Pipeline/cache/llm/*
```

**Per-assignment reset — preserves relay registration:**
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue   WHERE assignment='bst'").run();
db.prepare("DELETE FROM pipeline_runs WHERE assignment='bst'").run();
db.prepare("DELETE FROM events        WHERE token IN (SELECT token FROM tokens WHERE assignment='bst')").run();
db.prepare("DELETE FROM tokens        WHERE assignment='bst'").run();
db.close();
console.log('DB cleared for bst');
EOF

rm -rf data/bst/output/$STU1 data/bst/output/$STU2 data/bst/output/$STU3 data/bst/output/$STU4 data/bst/output/$STU5 data/bst/output/$STU_MT
rm -rf ../Pipeline/cache/llm/*
pm2 restart feedback
```

### A2. Place the tar files

`process-batch.js` discovers students by scanning `data/bst/tars/` for subdirectories with a
`run.tar`. Directories must be named by **email prefix** (= student ID).

All tars live in one zip. Extract them in a single block:

```bash
ZIPFILE="../Pipeline/testInputs/studentTars/allTar-BST-Sp2026-7April.zip"

# Remove any leftover tars from previous runs
rm -rf data/bst/tars/$STU1 data/bst/tars/$STU2 data/bst/tars/$STU3 data/bst/tars/$STU4 data/bst/tars/$STU5

for entry in \
  "Jack-B-RHIT:$STU1" \
  "rhit-mirandac:$STU2" \
  "rhit-osujiun:$STU3" \
  "rhit-gheorgg:$STU4" \
  "nirdeshadusumilli2007:$STU5"; do
  github="${entry%%:*}"
  id="${entry##*:}"
  mkdir -p data/bst/tars/$id
  unzip -p "$ZIPFILE" "allTar-BST-Sp2026-7April/run-${github}.tar" > data/bst/tars/$id/run.tar
done

# STU_MT — intentionally no tar (missing_tar email path)
# Do NOT create data/bst/tars/$STU_MT

# Confirm exactly 5 directories, each with a non-empty run.tar
find data/bst/tars -name run.tar -size +0c
# → data/bst/tars/baileyjn/run.tar
# → data/bst/tars/mirandac/run.tar
# → data/bst/tars/osujiun/run.tar
# → data/bst/tars/gheorgg/run.tar
# → data/bst/tars/adusumn/run.tar
```

### A3. Create the dev roster and generate tokens

Student IDs are derived from the email column (prefix before `@`). The first column is a
reference label only — put anything there.

```bash
printf ",$STU1@rose-hulman.edu\n,$STU2@rose-hulman.edu\n,$STU3@rose-hulman.edu\n,$STU4@rose-hulman.edu\n,$STU5@rose-hulman.edu\n,$STU_MT@rose-hulman.edu\n" \
  > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv
# → baileyjn  → <token>  (baileyjn@rose-hulman.edu)
# → mirandac  → <token>  (mirandac@rose-hulman.edu)
# → osujiun   → <token>  (osujiun@rose-hulman.edu)
# → gheorgg   → <token>  (gheorgg@rose-hulman.edu)
# → adusumn   → <token>  (adusumn@rose-hulman.edu)
# → gajavegs-mt → <token>  (gajavegs-mt@rose-hulman.edu)
```

All six emails will be redirected to `$EMAIL` via `EMAIL_DEV_REDIRECT`.

**Token stability:** Re-running `generate-tokens.js` always produces the same value. Deleting
the DB row and re-running gives the same token, so existing PDF links stay valid. Only
`SECRET_KEY` changes invalidate tokens.

### A4. Build the JAR and run the pipeline

```bash
mvn -f ../Pipeline/pom.xml package -q -DskipTests
ls ../Pipeline/target/csse230-feedback.jar  # confirm JAR exists

node scripts/process-batch.js bst "Binary Search Tree"
```

Processes all five students with tars (`$STU_MT` is skipped — no tar). Expect:
- First run: ~1–3 min per student (LLM calls); LLM cache carries over from prior runs so
  any student whose diffs were already seen will be near-instant
- Success: `  ✓  <student-id>  (Ns)` followed by `     PDF generated with token`

Verify:

```bash
for s in $STU1 $STU2 $STU3 $STU4 $STU5; do
  echo "=== $s ==="; ls data/bst/output/$s/; echo
done
# Each should show: frontend.json  report.json  report.pdf  (plus ingest artifacts)

ls data/bst/output/$STU_MT/ 2>/dev/null || echo "$STU_MT absent — expected"
```

Check the batch log for any failures:
```bash
tail -20 data/bst/batch.log
# → DONE   5 succeeded,  0 failed
```

### A5. Regenerate a PDF with the real token (if needed)

Only needed if A4 didn't produce a PDF, or after a `BASE_URL` change:

```bash
# Example for STU1 — repeat for any student
export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment='bst'").get(process.env.STU1);
db.close();
console.log(row?.token ?? '');
EOF
)
echo "Token: $TOKEN"

rm -f data/bst/output/$STU1/report.pdf
node --input-type=module << EOF
import { generateReportForToken } from './lib/report.js';
import path from 'path';
const result = await generateReportForToken('$STU1', 'bst', '$TOKEN', path.resolve('data'), 'https://feedback.csse.rose-hulman.edu');
console.log('PDF written:', result);
EOF
```

### A6. Copy outputs to local Mac for report iteration

```bash
# Run on your Mac
rsync -av csse@feedback:~/230LoggerMonorepo/Frontend/data/bst/ \
  /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/bst/
```

---

## Part B — Iterate on the report (local Mac)

All commands from `Frontend/` on your Mac.

### B1. Local `.env`

```env
BASE_URL=http://localhost:3000
DEV_BYPASS_AUTH=true
SECRET_KEY=<match prod value>
```

Verify:
```bash
grep -E "^(BASE_URL|SECRET_KEY|DEV_BYPASS_AUTH)" .env
grep "^HOLD_EMAILS" .env && echo "WARNING: remove HOLD_EMAILS" || echo "OK"
```

### B2. Build and start the local server

```bash
npm run build
node server.js
```

### B3. Get local tokens

```bash
printf "$STU1,$EMAIL\n$STU_MT,$EMAIL\n" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv

export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment='bst'").get(process.env.STU1);
db.close();
console.log(row?.token ?? '');
EOF
)
echo "Token: $TOKEN"
```

### B4. Open the report

```bash
open "http://localhost:3000/report?token=$TOKEN"
```

- [ ] Assessment table shows upcoming exams/assignments
- [ ] Bar column present; Exam 2 bar is red, HW bars blue
- [ ] Drill cards present with name + source badge + time/weight meta + code block
- [ ] "Open drill" link: `http://localhost:3000/feedback?token=<token>#drill-...`
- [ ] Footer: drill count, total time, feedback site link

### B5. Verify the feedback site

```bash
open "http://localhost:3000/feedback?token=$TOKEN"
```

- [ ] Assignment list loads with BST card showing correct passing/failing counts
- [ ] Click BST card → detail view loads
- [ ] Drill anchor links (`#drill-...`) scroll to correct section
- [ ] "All assignments" back button returns to list

### B6. Check the generic report (missing_tar path)

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] $STU1  → $EMAIL (N patterns)
# → [missing_tar]    $STU_MT → $EMAIL (+ review guide)

open "http://localhost:3000/report?token=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment='bst'").get(process.env.STU_MT);
db.close();
process.stdout.write(row?.token ?? '');
EOF
)"
```

- [ ] **Page 1**: generic notice strip, assessment table, drill names, practice resource links, footer with feedback link
- [ ] **Page 2**: "Drill Sheet" header, drill cards with source badge + code blocks, no footer "Only you can see..."
- [ ] Code blocks are selectable

**To re-iterate on the generic report:**
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue WHERE token IN (SELECT token FROM tokens WHERE student_id=? AND assignment='bst')").run(process.env.STU_MT);
db.close();
EOF
rm -rf data/bst/output/$STU_MT
node scripts/queue-emails.js bst "Binary Search Tree"
```

### B7. Iterate on report design

**Layout only** (no LLM calls):
```bash
rm data/bst/output/$STU1/report.json data/bst/output/$STU1/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
# Regenerates in ~4s
```

**Drill content / assessment config changes** (re-runs pipeline on Ubuntu):
```bash
# On Ubuntu
rm -rf ../Pipeline/cache/llm/*
rm -rf data/bst/output/$STU1/
node scripts/process-batch.js bst "Binary Search Tree"

# Pull to Mac
rsync -av csse@feedback:~/230LoggerMonorepo/Frontend/data/bst/ \
  /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/bst/

rm data/bst/output/$STU1/report.json data/bst/output/$STU1/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
```

---

## Part C — Full e2e send test (Ubuntu server)

All commands from `Frontend/` on Ubuntu.

### C1. Pre-flight

```bash
grep -E "^(EMAIL_DEV_REDIRECT|BASE_URL|SECRET_KEY|ROSEFIRE_SECRET|ROSEFIRE_REGISTRY_TOKEN)" .env
# BASE_URL=https://feedback.csse.rose-hulman.edu
# EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
# ROSEFIRE_SECRET=<value>  (kept even though login page is disabled)
# SECRET_KEY=<value>

grep -E "^(HOLD_EMAILS|DEV_BYPASS_AUTH)" .env \
  && echo "ERROR: remove before e2e" || echo "OK"

curl -s http://localhost:3000/api/health
# → {"status":"ok","relayLastHeartbeat":"<recent>","students":<n>,...}

sqlite3 db/feedback.db \
  "SELECT relay_ip, relay_port, last_heartbeat FROM relay_status;"
# → <zenbook-ip>|3001|<recent timestamp>
# If stale: on Zenbook run `pm2 restart relay`
```

### C2. Get tokens for all students

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
for (const id of [process.env.STU1, process.env.STU2, process.env.STU3, process.env.STU4, process.env.STU5, process.env.STU_MT]) {
  const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment='bst'").get(id);
  console.log(`${id}: ${row?.token ?? 'NO TOKEN'}`);
}
db.close();
EOF
```

Export STU1's token for subsequent commands:
```bash
export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment='bst'").get(process.env.STU1);
db.close();
console.log(row?.token ?? '');
EOF
)
```

### C3. Spot-check two feedback sites

Open these in browser:
```bash
echo "https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN"
```

- [ ] Assignment list shows BST card with correct passing/failing counts
- [ ] Click BST → detail view loads with test cards and timeline
- [ ] Back button returns to list

Repeat for `$STU3`'s token — confirm different feedback data loads (spot-check two is enough).

### C4. Queue emails for all students

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] $STU1  → $EMAIL (N patterns)
# → [feedback_ready] $STU2  → $EMAIL (N patterns)
# → [feedback_ready] $STU3  → $EMAIL (N patterns)
# → [feedback_ready] $STU4  → $EMAIL (N patterns)
# → [feedback_ready] $STU5  → $EMAIL (N patterns)
# → [missing_tar]    $STU_MT → $EMAIL (+ review guide)
```

Inspect before send:
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const rows = db.prepare("SELECT subject, email_type, recipient FROM email_queue WHERE assignment='bst' ORDER BY id").all();
db.close();
for (const r of rows) console.log(`[${r.email_type}] ${r.subject}  →  ${r.recipient}`);
EOF
```

Verify:
- [ ] 5× `feedback_ready`: `CSSE 230: Binary Search Tree Feedback Available (N patterns, Exam 2)`
- [ ] 1× `missing_tar`: `CSSE 230: Binary Search Tree Feedback, Action Needed`
- [ ] All recipients show `$EMAIL` (dev redirect active)

### C5. Confirm delivery

```bash
sqlite3 db/feedback.db \
  "SELECT email_type, student_id, status, sent_at FROM email_queue eq JOIN tokens t ON eq.token=t.token WHERE eq.assignment='bst' ORDER BY eq.id;"
# All rows should reach status='sent' within ~30s
```

If still `pending` after 30s, re-check C1 (relay not registered or Zenbook asleep).

### C6. Verify emails in inbox

Check `gajavegs@rose-hulman.edu`. All subjects prefixed `[DEV to gajavegs@rose-hulman.edu]`.

**feedback_ready email (check STU1's):**
- [ ] Arrives and renders HTML — sans-serif font, `<hr>` as lines, no raw tags
- [ ] Report PDF link: opens personalized report, shows assessment table and drill column
- [ ] "Open drill ›" links in PDF use `https://feedback.csse.rose-hulman.edu/feedback?token=…#drill-…`
- [ ] Feedback site link: loads interactive site with STU1's test card data
- [ ] Time estimates under each link (~2 min report, ~5–10 min site)

**missing_tar email:**
- [ ] Arrives and renders HTML
- [ ] Upload link opens the feedback site showing the upload widget (not a 404 or crash)
- [ ] Review guide PDF link: 2-page generic report
  - [ ] Page 1: assessment table, drill names, practice resource links
  - [ ] Page 2: Drill Sheet with code blocks, no "Only you can see this feedback" in footer

---

## Part D — Non-happy-path tests

Run once before the first real send on a live browser hitting
`https://feedback.csse.rose-hulman.edu`.

### D1 — Landing page and token routing

**No token:**
1. Open `https://feedback.csse.rose-hulman.edu/`
   - [ ] Shows "Check your email" card — not a crash, not a login form

2. Open `https://feedback.csse.rose-hulman.edu/login`
   - [ ] Same "Check your email" card

**Invalid token:**
3. Open `https://feedback.csse.rose-hulman.edu/feedback?token=badtoken`
   - [ ] Redirects to `/login?error=invalid`
   - [ ] Page shows "That link has expired or is invalid. Use the link from your feedback email."

**Missing token on feedback:**
4. Open `https://feedback.csse.rose-hulman.edu/feedback` (no query string)
   - [ ] Redirects to `/login` (shows "Check your email")

**Valid token:**
5. Open `https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN`
   - [ ] Assignment list loads with BST card

---

### D2 — Assignment list and reviewed state

1. Open `https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN`
   - [ ] BST card appears under "New feedback"
   - [ ] Status pill shows correct count ("N to review" or "All passing")
   - [ ] Mini-bar colors match test counts
   - [ ] **Only STU1's assignments appear** — no other students' cards visible
   - [ ] **No 0/0 cards** — pending assignments (no pipeline data) are hidden

2. Click BST card → detail view
   - [ ] Back button ("All assignments") returns to list

3. Open every feedback card (all tabs — Issues, Improved, Passing)
   - [ ] Each tab's dot disappears as cards are opened
   - [ ] When the last card is opened: green "✓ You've reviewed all feedback" banner appears
   - [ ] Tab checkmarks (✓) appear
   - [ ] **Card is still closeable** after opening (click header to collapse)

4. Open a drill modal ("✦ practice drill" button)
   - [ ] Drill modal appears
   - [ ] Close the drill (✕ or Escape)
   - [ ] **Feedback card is still closeable after closing the drill** (click header to collapse)

5. From STU1's **PDF report**: click an "Open drill ›" link (links to `#drill-…`)
   - [ ] Feedback site opens, scrolls to the correct test card, drill modal auto-opens
   - [ ] Close the drill
   - [ ] **Feedback card is still closeable** (was permanently stuck open before fix)

6. Click "All assignments"
   - [ ] BST card has moved to "Previously reviewed" section

7. Open a new tab with the same URL
   - [ ] Assignment list immediately shows BST under "Previously reviewed" (server-persisted)
   - [ ] Click BST → detail view shows all tab checkmarks already set (no dots)

8. Close and reopen the browser entirely, revisit the same URL
   - [ ] Same result — "Previously reviewed" and all checkmarks intact

---

### D3 — Study materials links

From STU1's feedback site, find a test card with a course appearance pill or a drill with a
source badge.

1. Click a **course appearance pill** (e.g. "Exam 2 ↗") on a collapsed or expanded test card
   - [ ] Opens in a new tab
   - [ ] `.md` files render as **styled HTML** via `/view?file=…` — not raw text
   - [ ] `.pdf` files open or download directly

2. Open a drill modal → click the **source badge** (e.g. "Exam 2 · 3d ↗")
   - [ ] Same checks as above
   - [ ] No token required (study materials are public)

3. Quick URL check — `.md` links should go to `/view?file=…`, not `/study-materials/…`:
   - Right-click a pill → Copy Link → confirm URL starts with `/view?file=`

---

### D4 — Upload / reprocessing flow

```bash
# Create a clean token with no pipeline data
echo "uploadtest,$EMAIL" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv

export UTOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id='uploadtest' AND assignment='bst'").get();
db.close();
console.log(row?.token ?? '');
EOF
)
echo "https://feedback.csse.rose-hulman.edu/feedback?token=$UTOKEN"
```

1. Open the URL — shows "no run.tar found" message with file upload widget
2. Upload `Pipeline/testInputs/run-demo.tar`
   - [ ] Status changes to uploading, then success message
3. Poll pipeline:
   ```bash
   sqlite3 db/feedback.db \
     "SELECT student_id, status, source FROM pipeline_runs WHERE student_id='uploadtest' ORDER BY id DESC LIMIT 1;"
   # → uploadtest|success|upload
   ```
4. Check for regeneration email:
   ```bash
   sqlite3 db/feedback.db \
     "SELECT status, subject FROM email_queue WHERE token='$UTOKEN' ORDER BY id DESC LIMIT 1;"
   # status='sent', subject contains "updated feedback"
   ```
   - [ ] Email arrives with "updated feedback" in subject
5. Open `https://feedback.csse.rose-hulman.edu/feedback?token=$UTOKEN`
   - [ ] Now shows the feedback list (not the upload prompt)

**Rejection cases:**
6. Upload a `.zip` file renamed `.tar` → server rejects with error message
7. Upload a second tar for `uploadtest` immediately → rate-limit message (max 3)

---

### D5 — Telemetry

Click through STU1's feedback site (open a card, switch tabs, open a drill, open all feedback
cards). Then run this script on Ubuntu to verify everything landed:

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const token = process.env.TOKEN;
const rows = db.prepare(
  'SELECT event_type, event_data, timestamp FROM events WHERE token=? ORDER BY id'
).all(token);
db.close();

const counts = {};
const feedbackOpened = [];
for (const r of rows) {
  counts[r.event_type] = (counts[r.event_type] || 0) + 1;
  if (r.event_type === 'feedback_opened') {
    try { feedbackOpened.push(JSON.parse(r.event_data)?.test_id); } catch {}
  }
}

console.log('Event counts:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
if (feedbackOpened.length) console.log('\nfeedback_opened test_ids:', feedbackOpened);

const missing = [];
if (!counts.page_view)        missing.push('page_view');
if (!counts.card_expanded)    missing.push('card_expanded');
if (!counts.feedback_opened)  missing.push('feedback_opened');
if (!counts.feedback_reviewed) missing.push('feedback_reviewed (open all feedback cards first)');
if (missing.length) console.log('\n⚠  Missing:', missing.join(', '));
else                console.log('\n✓  All expected event types present');
EOF
```

Expected after a full click-through:
- [ ] `page_view: 1`
- [ ] `card_expanded: ≥1`
- [ ] `feedback_opened: N` — one per feedback card, each with a distinct `test_id`
- [ ] `tab_switch: ≥1`
- [ ] `drill_opened: ≥1` (if you opened a drill)
- [ ] `feedback_reviewed: 1` — auto-fires when the last feedback card is opened

**Clean up test events before real send:**
```bash
sqlite3 db/feedback.db "DELETE FROM events WHERE token='$TOKEN';"
```

---

### D6 — HTML email rendering

With `EMAIL_DEV_REDIRECT` active (Part C), check the received email in Outlook:

- [ ] Renders HTML — sans-serif font, `<hr>` as lines, no raw `<div>` tags visible
- [ ] Links are clickable hyperlinks
- [ ] No mid-sentence line breaks
- [ ] Report and feedback links are distinct and correct
- [ ] Footer: `gajavegs@rose-hulman.edu` contact, no "replies not monitored" double line

If Outlook shows raw tags:
```bash
grep HTMLBody Frontend/scripts/relay-server.js
# → '$m.HTMLBody = $p.body',
```

---

## Reset between iterations

**Report layout only** (Mac, no pipeline re-run):
```bash
rm data/bst/output/$STU1/report.json data/bst/output/$STU1/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
```

**Pipeline re-run, reuse LLM cache** (Ubuntu):
```bash
rm -rf data/bst/output/$STU1/ data/bst/output/$STU2/ data/bst/output/$STU3/ data/bst/output/$STU4/ data/bst/output/$STU5/
node scripts/process-batch.js bst "Binary Search Tree"
```

**Pipeline re-run, fresh LLM calls** (Ubuntu, costs ~$0.07/student):
```bash
rm -rf ../Pipeline/cache/llm/*
rm -rf data/bst/output/$STU1/ data/bst/output/$STU2/ data/bst/output/$STU3/ data/bst/output/$STU4/ data/bst/output/$STU5/
node scripts/process-batch.js bst "Binary Search Tree"
```

**Email copy only** (Ubuntu):
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue WHERE assignment='bst'").run();
db.close();
EOF
node scripts/queue-emails.js bst "Binary Search Tree"
```

**Generic report only**:
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue WHERE token IN (SELECT token FROM tokens WHERE student_id=? AND assignment='bst')").run(process.env.STU_MT);
db.close();
EOF
rm -rf data/bst/output/$STU_MT
node scripts/queue-emails.js bst "Binary Search Tree"
```

**Full reset — nuke DB** (fastest):
```bash
rm db/feedback.db
pm2 restart feedback
rm -rf data/bst/output/$STU1 data/bst/output/$STU2 data/bst/output/$STU3 data/bst/output/$STU4 data/bst/output/$STU5 data/bst/output/$STU_MT
rm -rf ../Pipeline/cache/llm/*
# Repeat from A2
```

**Full reset — per-assignment, preserve relay**:
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue   WHERE assignment='bst'").run();
db.prepare("DELETE FROM pipeline_runs WHERE assignment='bst'").run();
db.prepare("DELETE FROM events        WHERE token IN (SELECT token FROM tokens WHERE assignment='bst')").run();
db.prepare("DELETE FROM tokens        WHERE assignment='bst'").run();
db.close();
console.log('DB cleared for bst');
EOF
rm -rf data/bst/output/$STU1 data/bst/output/$STU2 data/bst/output/$STU3 data/bst/output/$STU4 data/bst/output/$STU5 data/bst/output/$STU_MT
rm -rf ../Pipeline/cache/llm/*
pm2 restart feedback
# Repeat from A2
```

---

## Before sending to real students

- [ ] Part D complete — all non-happy-path checks passed
- [ ] All 5 students' reports verified in browser (one PDF per student, correct token in links)
- [ ] Both email types received and HTML-rendered correctly in Outlook (C6)
- [ ] `EMAIL_DEV_REDIRECT` removed (or commented out) from Ubuntu `.env`
- [ ] `pm2 restart feedback` after `.env` change
- [ ] Replace `roster.dev.csv` with real class roster at `data/roster.csv`
- [ ] Re-run `node scripts/generate-tokens.js bst` (no roster arg → uses `data/roster.csv`)
- [ ] Back up DB: `cp db/feedback.db db/feedback-pre-bst-send-$(date +%F).db`
- [ ] Re-run `node scripts/queue-emails.js bst "Binary Search Tree"`
- [ ] Verify `BASE_URL=https://feedback.csse.rose-hulman.edu` is set (check one PDF link)
- [ ] Delete your own test events: `sqlite3 db/feedback.db "DELETE FROM events WHERE token='$TOKEN';"`
- [ ] `npm run build` if any React source changed since last build
- [ ] Zenbook: sleep disabled, power adapter connected, `pm2 list` shows relay online
