# BST Demo — End-to-End Test Runbook

Tests the full pipeline from a single `.tar` file through to a received email with working
report and feedback links. Assumes setup in `deployment-test-guide.md` is complete
(server running, nginx configured, JAR built, DB initialized, Zenbook relay registered).

All commands run from `Frontend/` unless noted.

---

## 0. Pre-flight

Confirm the server is up and the Zenbook relay is registered:

```bash
# Server responds through nginx
curl -s https://feedback.csse.rose-hulman.edu/api/relay/register \
  -X POST \
  -H "Authorization: Bearer $RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"port":3001}' | cat
# → {"ok":true}

# Relay is registered with a recent heartbeat
sqlite3 db/feedback.db \
  "SELECT relay_ip, relay_port, last_heartbeat FROM relay_status;"
# → <zenbook-ip>|3001|<timestamp within last few minutes>
```

Confirm `EMAIL_DEV_REDIRECT` is set in `.env` so all emails land in your inbox:

```bash
grep EMAIL_DEV_REDIRECT .env
# → EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
```

If missing, add it and restart the server:

```bash
echo "EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu" >> .env
# restart node server.js
```

---

## 1. Place the tar file

```bash
mkdir -p data/bst/tars/teststu
cp /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline/testInputs/run-demo.tar \
   data/bst/tars/teststu/run.tar
```

---

## 2. Create a dev roster and generate a token

```bash
echo "teststu,gajavegs@rose-hulman.edu" > data/roster.dev.csv
node scripts/generate-tokens.js bst roster.dev.csv
# → teststu → <token>  (gajavegs@rose-hulman.edu)
```

Save the token for later:

```bash
export TOKEN=$(sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='teststu' AND assignment='bst';")
echo $TOKEN
```

---

## 3. Run the pipeline

```bash
node scripts/process-batch.js bst "Binary Search Tree"
```

This runs ingest → prepare → generateReport for `teststu`. Expect:
- LLM calls: ~1–3 min first run; near-instant on subsequent runs (cached)
- Success log: `  ✓  teststu  (Ns)`

Verify the outputs exist:

```bash
ls data/bst/output/teststu/
# frontend.json  report.json  report.pdf  (plus ingest artifacts)
```

---

## 4. Check the report PDF

Open the report in a browser:

```bash
echo "https://feedback.csse.rose-hulman.edu/report?token=$TOKEN"
```

Navigate to that URL — the browser downloads `report.pdf`. Verify:

- [ ] Assessment card shows **Exam 2** with a colored **"N days left"** badge
- [ ] Bar fill reflects overlap % between student's patterns and Exam 2 content
- [ ] Drill column(s) populated with pattern names and test method names
- [ ] Footer shows drill count, total time, and the feedback site link
- [ ] Clicking **"Open full feedback site →"** in the footer resolves to a valid URL

---

## 5. Check the feedback site

```bash
echo "https://feedback.csse.rose-hulman.edu/feedback?token=$TOKEN"
```

Open in browser — confirm the interactive feedback site loads with the student's data.

---

## 6. Queue the email

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] teststu → gajavegs@rose-hulman.edu (N patterns)
```

Inspect the queued email before it sends:

```bash
sqlite3 db/feedback.db \
  "SELECT subject, body FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1;"
```

Verify:
- [ ] Subject: `CSSE 230 — BST feedback available (N patterns, Exam 2)` (≤60 chars) or truncated form
- [ ] Breadcrumb: `2526S CSSE230 -> Debugging Feedback -> Binary Search Tree`
- [ ] Pattern count and assessment name in body
- [ ] Report link: `https://feedback.csse.rose-hulman.edu/report?token=…`
- [ ] Feedback link: `https://feedback.csse.rose-hulman.edu/feedback?token=…`

---

## 7. Confirm the email was sent

The email pushes automatically within a few seconds of queuing. Check delivery status:

```bash
sqlite3 db/feedback.db \
  "SELECT status, sent_at, error_msg FROM email_queue WHERE assignment='bst' ORDER BY id DESC LIMIT 1;"
# → sent|<timestamp>|
```

If still `pending` after 10 seconds, the relay is not registered — re-check Step 0.

---

## 8. Verify the email in your inbox

Check `gajavegs@rose-hulman.edu`. Subject will be prefixed `[DEV → gajavegs@rose-hulman.edu]`.

- [ ] Email arrives
- [ ] Report PDF link opens and downloads the PDF
- [ ] Feedback site link opens the interactive site
- [ ] Both links use the correct token (same one from Step 2)

---

## Reset between iterations

**Report only** (edit `lib/reportTemplate.js` or `lib/report.js`):
```bash
rm data/bst/output/teststu/report.json data/bst/output/teststu/report.pdf
# Refresh https://feedback.csse.rose-hulman.edu/report?token=$TOKEN — regenerates in ~4s
```

**Email copy only** (edit `scripts/queue-emails.js`):
```bash
sqlite3 db/feedback.db "DELETE FROM email_queue WHERE assignment='bst';"
node scripts/queue-emails.js bst "Binary Search Tree"
sqlite3 db/feedback.db \
  "SELECT subject, body FROM email_queue ORDER BY id DESC LIMIT 1;"
```

**Full reset** (re-run pipeline from scratch):
```bash
sqlite3 db/feedback.db \
  "DELETE FROM email_queue WHERE assignment='bst';
   DELETE FROM pipeline_runs WHERE assignment='bst';
   DELETE FROM tokens WHERE assignment='bst';"
rm -rf data/bst/output/teststu
# Then repeat from Step 2
```

---

## Before sending to real students

- [ ] Remove or comment out `EMAIL_DEV_REDIRECT` in `.env`
- [ ] Restart the server
- [ ] Replace `roster.dev.csv` with the real class roster
- [ ] Re-run `generate-tokens.js bst` (no roster file arg → uses `data/roster.csv`)
- [ ] Re-run `queue-emails.js bst "Binary Search Tree"`
