# BST Demo — End-to-End Test Runbook

Tests the full pipeline from a single `.tar` file through to a received email with working
report and feedback links. Assumes setup in `deployment-test-guide.md` is complete
(Ubuntu server running via pm2, nginx configured, JAR built, DB initialized, Zenbook relay
running via pm2 with `relay-server.js`).

**For WaS batch testing use the automated scripts instead:**
```bash
bash Pipeline/scripts/e2e-wuas-ubuntu.sh          # Ubuntu side
bash Pipeline/scripts/e2e-wuas-mac.sh             # Mac side
```

---

## Where to run what

| Task | Where |
|---|---|
| Pipeline (ingest + prepare) | Ubuntu server |
| Report design iteration | **Local Mac** — edit in IDE, instant feedback |
| Email copy iteration | Ubuntu server (read body from SQLite — no relay needed) |
| Full e2e send test | Ubuntu server + Zenbook relay |

---

## Part A — Run the pipeline (Ubuntu server)

All commands in this section run from `Frontend/` on Ubuntu.

### A1. Full reset (start clean)

```bash
# Clear pipeline outputs
rm -rf data/bst/output/gajavegs
rm -rf ../Pipeline/cache/llm/*

# Clear DB state for gajavegs/bst
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue   WHERE assignment='bst'").run();
db.prepare("DELETE FROM pipeline_runs WHERE assignment='bst'").run();
db.prepare("DELETE FROM tokens        WHERE assignment='bst'").run();
db.close();
console.log('DB cleared for bst');
EOF
```

### A2. Place the tar file

`process-batch.js` discovers students by scanning `data/bst/tars/` for subdirectories with a
`run.tar` — it does **not** use the roster. Remove any leftover directories from previous runs first.

```bash
# Remove any leftover tars from previous runs (e.g. teststu from a prior demo)
rm -rf data/bst/tars/teststu

mkdir -p data/bst/tars/gajavegs
cp /path/to/Pipeline/testInputs/run-demo.tar data/bst/tars/gajavegs/run.tar
```

### A3. Create a dev roster and generate a token

```bash
echo "gajavegs,gajavegs@rose-hulman.edu" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv
# → gajavegs → <token>  (gajavegs@rose-hulman.edu)
```

**Token stability:** The token is a deterministic HMAC of `studentId:assignment` and `SECRET_KEY`.
Re-running `generate-tokens.js` always produces the same value — it upserts, never changes.
If you delete the DB row and re-run, you get the same token, so existing PDF links stay valid.
The only way tokens change is if `SECRET_KEY` changes in `.env`.

### A4. Run the pipeline

```bash
node scripts/process-batch.js bst "Binary Search Tree"
```

Runs ingest → prepare → generateReport for `gajavegs`. Since A3 generated the token first,
`process-batch.js` also generates the PDF via `generateReportForToken`. Expect:
- First run: ~1–3 min (LLM calls); subsequent runs near-instant (cached)
- Success log: `  ✓  gajavegs  (Ns)` followed by `     PDF generated with token`

Verify outputs:

```bash
ls data/bst/output/gajavegs/
# frontend.json  report.json  report.pdf  (plus ingest artifacts)
```

If `report.pdf` is missing (e.g. A3 was skipped, or you need to regenerate after a URL change),
run A5.

### A5. Regenerate the PDF with the real token

Only needed if A4 didn't produce a PDF, or you want to force-regenerate with `BASE_URL` changes:

```bash
export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst'").get();
db.close();
console.log(row?.token ?? '');
EOF
)
echo "Token: $TOKEN"

rm -f data/bst/output/gajavegs/report.pdf
node --input-type=module << EOF
import { generateReportForToken } from './lib/report.js';
import path from 'path';
const result = await generateReportForToken('gajavegs', 'bst', '$TOKEN', path.resolve('data'), 'https://feedback.csse.rose-hulman.edu');
console.log('PDF written:', result);
EOF
```

### A6. Copy outputs to local Mac for report iteration

```bash
# Run on your Mac — pull pipeline outputs AND assessment config down
rsync -av csse@feedback:~/230LoggerMonorepo/Frontend/data/bst/ \
  /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/bst/
```

This syncs the whole `data/bst/` tree, which includes both `output/gajavegs/frontend.json`
and `assessment-config.json`. Without `assessment-config.json` the local report generates
with empty assessment cards.

---

## Part B — Iterate on the report (local Mac)

No relay, no Zenbook, no JAR needed. Just Node running locally against the files copied in A6.

All commands run from `Frontend/` on your Mac.

### B1. Local `.env`

Make sure your local `.env` has:

```env
BASE_URL=http://localhost:3000
DEV_BYPASS_AUTH=true
SECRET_KEY=<any hex string — can match prod or be different>
```

`DEV_BYPASS_AUTH=true` skips RoseFire so you can open `/feedback?token=…` directly without
a Rose-Hulman login.

### B2. Start the local server

```bash
node server.js
# → Server running on port 3000
```

### B3. Get the local token

The pipeline outputs are synced but the local DB has no token yet:

```bash
echo "gajavegs,gajavegs@rose-hulman.edu" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv

export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst'").get();
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

The browser opens the PDF inline. Verify:

- [ ] Assessment table shows 8 rows: Exam 2, HW5, EditorTrees M1, HW6, EditorTrees M2, EditorTrees M3, Exam 3, Final Exam
- [ ] Bar column present; Exam 2 bar is red, HW bars are blue
- [ ] Drill cards for Exam 2 show numbered sections (not card boxes)
- [ ] "Open drill" link uses `http://localhost:3000/feedback?token=<real-token>#drill-...`
- [ ] "Also on Exam 2" section lists study guide links
- [ ] Footer shows drill count, total time, and the feedback site link

### B5. Verify drill links work

```bash
open "http://localhost:3000/feedback?token=$TOKEN"
```

- [ ] Feedback site loads (not white screen — check browser console if blank)
- [ ] `DEV_BYPASS_AUTH=true` in `.env` means no RoseFire login required locally
- [ ] Drill anchors (`#drill-testcontainsnonbst--`) scroll to the right section

**Confirming drill links are correct in production:**
The "Open drill" href in the PDF is `BASE_URL/feedback?token=TOKEN#drill-...`.
`BASE_URL` is set from `.env` at PDF generation time. On Ubuntu, `BASE_URL=https://feedback.csse.rose-hulman.edu`.
So as long as the PDF is generated on Ubuntu (or regenerated via A5), the links point to prod.
If the PDF was generated locally with `localhost`, the links won't work on Ubuntu — always regenerate via A5 after pulling to Ubuntu.

### B6. Iterate on the report design

**Report layout/data only** (no LLM calls needed) — edit `lib/reportTemplate.js` or `lib/report.js`,
then:

```bash
rm data/bst/output/gajavegs/report.json data/bst/output/gajavegs/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
# Regenerates in ~4s (Puppeteer launch)
```

**Verify new drill intros or assessment config changes** — these are baked into `frontend.json`
at pipeline time, so deleting `report.json`/`report.pdf` alone is not enough. You need to
re-run the pipeline on Ubuntu with a cleared LLM cache:

```bash
# On Ubuntu — clear cache, delete all outputs, re-run pipeline
rm -rf ../Pipeline/cache/llm/*
rm -rf data/bst/output/gajavegs/
node scripts/process-batch.js bst "Binary Search Tree"

# Then pull results back to Mac
rsync -av csse@feedback:~/230LoggerMonorepo/Frontend/data/bst/ \
  /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/bst/

# Then regenerate the report
rm data/bst/output/gajavegs/report.json data/bst/output/gajavegs/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
```

Repeat until satisfied.

---

## Part C — Full e2e send test (Ubuntu server)

Once the report looks right, run the full send test on the Ubuntu server.
All commands from `Frontend/` on Ubuntu.

### C1. Pre-flight

```bash
# nginx + Express are up (check from Ubuntu — public domain won't loopback)
curl -s http://localhost:3000/api/health
# → {"status":"ok","relayLastHeartbeat":"<recent timestamp>","demo":true,...}

# Zenbook relay is registered and heartbeat is recent
sqlite3 db/feedback.db \
  "SELECT relay_ip, relay_port, last_heartbeat FROM relay_status;"
# → <zenbook-ip>|3001|<recent timestamp>
# If stale: on Zenbook run `pm2 restart relay`

# Dev redirect is active
grep EMAIL_DEV_REDIRECT .env
# → EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
```

### C2. Check the report link

```bash
export TOKEN=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id='gajavegs' AND assignment='bst'").get();
db.close();
console.log(row?.token ?? '');
EOF
)
echo "https://feedback.csse.rose-hulman.edu/report?token=$TOKEN"
```

Open in browser — should download the same PDF you verified locally.

### C3. Check the feedback site

```bash
echo "https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN"
```

Open in browser:
- [ ] Feedback site loads (not white screen)
- [ ] Drill sections visible, anchors match PDF links

### C4. Queue the email

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] gajavegs → gajavegs@rose-hulman.edu (N patterns)
```

Inspect before it sends:

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT subject, body FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1").get();
db.close();
console.log('Subject:', row?.subject);
console.log('Body:\n', row?.body);
EOF
```

Verify:
- [ ] Subject: `CSSE 230 — BST feedback available (N patterns, Exam 2)`
- [ ] Breadcrumb: `2526S CSSE230 -> Debugging Feedback -> Binary Search Tree`
- [ ] Report link: `https://feedback.csse.rose-hulman.edu/report?token=…`
- [ ] Feedback link: `https://feedback.csse.rose-hulman.edu/feedback?token=…`

### C5. Confirm delivery

```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT status, sent_at, error_msg FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1").get();
db.close();
console.log(row);
EOF
# → { status: 'sent', sent_at: '<timestamp>', error_msg: null }
```

If still `pending` after 10 seconds, re-check C1 (relay not registered).

### C6. Verify the email in your inbox

Check `gajavegs@rose-hulman.edu`. Subject prefixed `[DEV → gajavegs@rose-hulman.edu]`.

- [ ] Email arrives
- [ ] Report PDF link opens the PDF inline
- [ ] "Open drill" links in PDF use `https://feedback.csse.rose-hulman.edu/feedback?token=…#drill-…`
- [ ] Feedback site link opens the interactive site
- [ ] Both links use the correct token

---

## Reset between iterations

**Report layout only** (local Mac — no pipeline re-run):
```bash
rm data/bst/output/gajavegs/report.json data/bst/output/gajavegs/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
```

**Drill intros / assessment config changes** (Ubuntu — re-runs pipeline with fresh LLM calls):
```bash
rm -rf ../Pipeline/cache/llm/*
rm -rf data/bst/output/gajavegs/
node scripts/process-batch.js bst "Binary Search Tree"
# Then rsync to Mac and delete report.json/report.pdf as in B6
```

**Cached pipeline re-run** (Ubuntu — re-runs pipeline, reuses LLM cache):
```bash
rm -rf data/bst/output/gajavegs/
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
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT subject, body FROM email_queue ORDER BY id DESC LIMIT 1").get();
db.close();
console.log('Subject:', row?.subject);
console.log('Body:\n', row?.body);
EOF
```

**Full reset** (Ubuntu):
```bash
node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue   WHERE assignment='bst'").run();
db.prepare("DELETE FROM pipeline_runs WHERE assignment='bst'").run();
db.prepare("DELETE FROM tokens        WHERE assignment='bst'").run();
db.close();
console.log('DB cleared for bst');
EOF
rm -rf data/bst/output/gajavegs
rm -rf ../Pipeline/cache/llm/*
# Then repeat from A2
```

**After deleting tokens and re-running generate-tokens.js:** The token value will be **identical**
to before (HMAC is deterministic given the same SECRET_KEY). Any PDF links already sent remain valid.

---

## Before sending to real students

- [ ] Remove or comment out `EMAIL_DEV_REDIRECT` in Ubuntu `.env`
- [ ] Restart the Ubuntu server
- [ ] Replace `roster.dev.csv` with the real class roster at `data/roster.csv`
- [ ] Re-run `generate-tokens.js bst` (no roster file arg → uses `data/roster.csv`)
- [ ] Re-run `queue-emails.js bst "Binary Search Tree"`
- [ ] Confirm PDFs were generated with `BASE_URL=https://feedback.csse.rose-hulman.edu` (check a link in one PDF before bulk send)
