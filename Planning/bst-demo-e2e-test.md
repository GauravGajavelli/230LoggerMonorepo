# BST Demo — End-to-End Test Runbook

Tests the full pipeline from a single `.tar` file through to a received email with working
report and feedback links. Assumes setup in `deployment-test-guide.md` is complete
(Ubuntu server running, nginx configured, JAR built, DB initialized, Zenbook relay registered).

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

### A1. Place the tar file

```bash
mkdir -p data/bst/tars/teststu
cp /path/to/Pipeline/testInputs/run-demo.tar data/bst/tars/teststu/run.tar
```

### A2. Create a dev roster and generate a token

```bash
echo "teststu,gajavegs@rose-hulman.edu" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv
# → teststu → <token>  (gajavegs@rose-hulman.edu)
```

### A3. Run the pipeline

```bash
node scripts/process-batch.js bst "Binary Search Tree"
```

Runs ingest → prepare → generateReport for `teststu`. Expect:
- First run: ~1–3 min (LLM calls); subsequent runs near-instant (cached)
- Success log: `  ✓  teststu  (Ns)`

Verify outputs:

```bash
ls data/bst/output/teststu/
# frontend.json  report.json  report.pdf  (plus ingest artifacts)
```

### A4. Copy outputs to local Mac for report iteration

```bash
# Run on your Mac — pull the pipeline outputs down
rsync -av ubuntu-server:/path/to/Frontend/data/bst/ \
  /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/bst/
```

---

## Part B — Iterate on the report (local Mac)

No relay, no Zenbook, no JAR needed. Just Node running locally against the files copied in A4.

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
echo "teststu,gajavegs@rose-hulman.edu" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv

export TOKEN=$(sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='teststu' AND assignment='bst';")
echo $TOKEN
```

### B4. Open the report

```bash
open "http://localhost:3000/report?token=$TOKEN"
```

The browser downloads `report.pdf`. Verify:

- [ ] Assessment card shows **Exam 2** with a colored **"N days left"** badge
- [ ] Bar fill reflects overlap % between student's patterns and Exam 2 content
- [ ] Drill column(s) populated with pattern names and test method names
- [ ] Footer shows drill count, total time, and the feedback site link

### B5. Iterate on the report design

Edit `lib/reportTemplate.js` (HTML/CSS) or `lib/report.js` (data logic) in your IDE, then:

```bash
rm data/bst/output/teststu/report.json data/bst/output/teststu/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
# Regenerates in ~4s (Puppeteer launch)
```

Repeat until satisfied.

---

## Part C — Full e2e send test (Ubuntu server)

Once the report looks right, run the full send test on the Ubuntu server.
All commands from `Frontend/` on Ubuntu.

### C1. Pre-flight

```bash
# nginx + Express are up
curl -s https://feedback.csse.rose-hulman.edu/api/relay/register \
  -X POST \
  -H "Authorization: Bearer $RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"port":3001}' | cat
# → {"ok":true}

# Zenbook is registered
sqlite3 db/feedback.db \
  "SELECT relay_ip, relay_port, last_heartbeat FROM relay_status;"
# → <zenbook-ip>|3001|<recent timestamp>

# Dev redirect is active
grep EMAIL_DEV_REDIRECT .env
# → EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
```

### C2. Check the report link

```bash
export TOKEN=$(sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='teststu' AND assignment='bst';")
echo "https://feedback.csse.rose-hulman.edu/report?token=$TOKEN"
```

Open in browser — should download the same PDF you verified locally.

### C3. Check the feedback site

```bash
echo "https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN"
```

### C4. Queue the email

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] teststu → gajavegs@rose-hulman.edu (N patterns)
```

Inspect before it sends:

```bash
sqlite3 db/feedback.db \
  "SELECT subject, body FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1;"
```

Verify:
- [ ] Subject: `CSSE 230 — BST feedback available (N patterns, Exam 2)`
- [ ] Breadcrumb: `2526S CSSE230 -> Debugging Feedback -> Binary Search Tree`
- [ ] Report link: `https://feedback.csse.rose-hulman.edu/report?token=…`
- [ ] Feedback link: `https://feedback.csse.rose-hulman.edu/feedback?token=…`

### C5. Confirm delivery

```bash
sqlite3 db/feedback.db \
  "SELECT status, sent_at, error_msg FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1;"
# → sent|<timestamp>|
```

If still `pending` after 10 seconds, re-check C1 (relay not registered).

### C6. Verify the email in your inbox

Check `gajavegs@rose-hulman.edu`. Subject prefixed `[DEV → gajavegs@rose-hulman.edu]`.

- [ ] Email arrives
- [ ] Report PDF link downloads the PDF
- [ ] Feedback site link opens the interactive site
- [ ] Both links use the correct token

---

## Reset between iterations

**Report only** (local Mac):
```bash
rm data/bst/output/teststu/report.json data/bst/output/teststu/report.pdf
open "http://localhost:3000/report?token=$TOKEN"
```

**Email copy only** (Ubuntu):
```bash
sqlite3 db/feedback.db "DELETE FROM email_queue WHERE assignment='bst';"
node scripts/queue-emails.js bst "Binary Search Tree"
sqlite3 db/feedback.db \
  "SELECT subject, body FROM email_queue ORDER BY id DESC LIMIT 1;"
```

**Full reset** (Ubuntu):
```bash
sqlite3 db/feedback.db \
  "DELETE FROM email_queue WHERE assignment='bst';
   DELETE FROM pipeline_runs WHERE assignment='bst';
   DELETE FROM tokens WHERE assignment='bst';"
rm -rf data/bst/output/teststu
# Then repeat from A1
```

---

## Before sending to real students

- [ ] Remove or comment out `EMAIL_DEV_REDIRECT` in Ubuntu `.env`
- [ ] Restart the Ubuntu server
- [ ] Replace `roster.dev.csv` with the real class roster at `data/roster.csv`
- [ ] Re-run `generate-tokens.js bst` (no roster file arg → uses `data/roster.csv`)
- [ ] Re-run `queue-emails.js bst "Binary Search Tree"`
