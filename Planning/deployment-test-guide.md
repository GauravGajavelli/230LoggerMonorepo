# Deployment & Test Guide — Email, Reports, and Relay

End-to-end setup for sending feedback emails with PDF report links to CSSE 230 students.
Covers the Ubuntu server (nginx + Express), the Windows Zenbook (Outlook COM relay),
and a step-by-step test sequence to verify everything before a real send.

---

## Architecture recap

```
Internet / campus browser
        ↓  HTTPS :443
nginx  (terminates SSL, proxies to Node)
        ↓  HTTP  :3000  (localhost only)
Express app
  ├── SQLite       db/feedback.db
  ├── Java JAR     Pipeline/target/csse230-feedback.jar
  └── Puppeteer    renders report.pdf per student
        ↓  POST /send
Zenbook UX370 (campus network, Outlook signed in)
  └── relay-server.ps1  (HTTP listener on port 3001)
        ↓  Outlook COM  ($mail.DeleteAfterSubmit = $true)
Student inbox
```

---

## Ubuntu Server

### 1. nginx setup

nginx handles SSL termination and proxies all traffic to the Node server on port 3000.

```nginx
# /etc/nginx/sites-available/feedback
server {
    listen 443 ssl;
    server_name feedback.csse.rose-hulman.edu;

    ssl_certificate     /etc/ssl/certs/feedback_csse.cer;
    ssl_certificate_key /etc/ssl/private/feedback_csse.key;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # For large file uploads (run.tar)
        client_max_body_size 500M;
        proxy_read_timeout   300s;
    }
}

server {
    listen 80;
    server_name feedback.csse.rose-hulman.edu;
    return 301 https://$host$request_uri;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 2. Environment setup

```bash
cd /path/to/230LoggerMonorepo/Frontend
cp .env.example .env
```

Edit `.env` — required fields:

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRET_KEY=<64-char hex>
RELAY_SECRET=<64-char hex — different from SECRET_KEY; paste same value on Zenbook>

PORT=3000
BASE_URL=https://feedback.csse.rose-hulman.edu
DATA_DIR=./data
DB_PATH=./db/feedback.db

# Pipeline paths (relative to Frontend/)
PIPELINE_JAR=../Pipeline/target/csse230-feedback.jar
LLM_CACHE_DIR=../Pipeline/cache/llm

# RoseFire auth — register at https://rosefire.csse.rose-hulman.edu
ROSEFIRE_SECRET=<from rosefire registration>
ROSEFIRE_REGISTRY_TOKEN=<UUID from rosefire>

# ── Dev/test only ────────────────────────────────────────────────────
# Redirect ALL outgoing emails to this address during testing.
# Subject is prefixed "[DEV → real@addr]" so you know who it was meant for.
# REMOVE before sending to real students.
EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
```

### 3. Build and install

```bash
# Build the pipeline JAR
mvn -f ../Pipeline/pom.xml package -q -DskipTests

# Install Node dependencies
# (first run downloads ~300 MB Chromium for Puppeteer — takes a few minutes)
npm install

# Build the React frontend (creates dist/ — served by Express for /feedback)
npm run build

# Create database directory
mkdir -p db
```

### 4. Start the server

```bash
node server.js
# → Server running on port 3000
```

The server auto-creates all database tables (`tokens`, `email_queue`, `pipeline_runs`,
`events`, `relay_status`) on first start. nginx forwards all public HTTPS traffic to it.

---

## Windows Zenbook — one-time setup

The relay is now a Node.js server (`relay-server.js`) managed by pm2.
`relay-server.ps1` is kept as a fallback but is no longer the primary relay.

### 1. Windows Update + Outlook

- Run Windows Update to completion; reboot.
- Open Outlook; sign in as `gajavegs@rose-hulman.edu`.
  Confirm a test email sends and receives before proceeding.
- Disable sleep so the relay stays alive:
  **Settings → System → Power & sleep → Sleep → Never** (both battery and plugged-in).
- Plug in the power adapter permanently.
- Pause Windows auto-updates during active send windows (Settings → Windows Update → Pause).

### 2. Set system environment variables

**System Properties → Advanced → Environment Variables → System Variables → New:**

| Variable | Value |
|---|---|
| `FEEDBACK_SERVER_URL` | `https://feedback.csse.rose-hulman.edu` |
| `RELAY_SECRET` | same 64-char hex as `RELAY_SECRET` in Ubuntu `.env` |

Sign out and back in (or reboot) for the variables to take effect.

### 3. Install Node.js and pm2

Node.js 22+ is required. Verify:

```powershell
node --version   # should print v22.x.x
```

Install pm2 globally:

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### 4. Start the relay with pm2

**Important:** Run PowerShell as your normal user (not Administrator). Outlook must be open and signed in first.

```powershell
cd C:\path\to\230LoggerMonorepo\Frontend\scripts
pm2 start relay-server.js --name relay
pm2 save
pm2-startup install   # auto-starts pm2 (and the relay) on Windows login
```

Expected output after start:
```
[relay] Listening on port 3001
[relay] Registered with https://feedback.csse.rose-hulman.edu (HTTP 200)
```

To verify it's running:
```powershell
pm2 list
pm2 logs relay --lines 20
```

### 5. Updating the relay after a git pull

pm2 caches nothing — the script is read from disk on each start. After pulling:

```powershell
pm2 restart relay
```

If a restart doesn't take effect (e.g. the process was in a bad state):

```powershell
pm2 delete relay
pm2 start relay-server.js --name relay
pm2 save
```

---

## End-to-End Test Sequence

Run all commands from `Frontend/` on the Ubuntu server.

### Step 1 — Create a dev roster

```bash
cat > data/roster.dev.csv << 'EOF'
student_id,email
teststu,gajavegs@rose-hulman.edu
EOF
```

### Step 2 — Generate tokens

```bash
node scripts/generate-tokens.js bst roster.dev.csv
# → teststu → <token>  (gajavegs@rose-hulman.edu)
```

### Step 3 — Confirm relay registration

Ensure the relay is running on the Zenbook (`pm2 list` should show `relay` as `online`),
then on Ubuntu confirm it registered:

```bash
curl -s http://localhost:3000/api/health
# → {"status":"ok","relayLastHeartbeat":"<recent timestamp>","demo":true,...}
```

Or query the DB directly:

```bash
sqlite3 db/feedback.db \
  "SELECT relay_ip, relay_port, last_heartbeat FROM relay_status;"
# → <zenbook-ip>|3001|<recent timestamp>
```

If the heartbeat is stale or missing:
- Check `pm2 logs relay` on the Zenbook for errors
- Restart: `pm2 restart relay`
- Verify `FEEDBACK_SERVER_URL` and `RELAY_SECRET` env vars are set on the Zenbook

### Step 4 — Seed a test frontend.json

```bash
mkdir -p data/bst/output/teststu
# Copy any real frontend.json or the pipeline demo output:
cp ../Pipeline/output/run-demo/frontend.json data/bst/output/teststu/frontend.json
```

### Step 5 — Test the PDF report

Get the token and open the report URL in a browser:

```bash
sqlite3 db/feedback.db \
  "SELECT token FROM tokens WHERE student_id='teststu' AND assignment='bst';"
# Open: https://feedback.csse.rose-hulman.edu/report?token=<token>
```

The browser should download `report.pdf`. Open it and verify:
- Assessment card shows "Exam 2" with a colored "N days left" badge
- Drill column(s) are populated
- Footer shows the feedback site link

### Step 6 — Queue and send a test email

```bash
node scripts/queue-emails.js bst "Binary Search Tree"
# → [feedback_ready] teststu → gajavegs@rose-hulman.edu (N patterns)
```

Monitor delivery (emails push automatically within a few seconds):

```bash
sqlite3 db/feedback.db \
  "SELECT id, status, subject, sent_at FROM email_queue ORDER BY id DESC LIMIT 5;"
# status should move: pending → sending → sent
```

Check your inbox at `gajavegs@rose-hulman.edu`. The subject will be prefixed
`[DEV → gajavegs@rose-hulman.edu]` because of `EMAIL_DEV_REDIRECT`.

Verify the email body contains:
- Breadcrumb: `2526S CSSE230 -> Debugging Feedback -> Binary Search Tree`
- Dashed separator
- Pattern count + assessment name
- PDF report link (`https://feedback.csse.rose-hulman.edu/report?token=…`)
- Interactive feedback site link (`https://feedback.csse.rose-hulman.edu/feedback?token=…`)

### Step 7 — Full batch run (real student data)

Once tars are in place:

```bash
# 1. Run the full pipeline for all students
node scripts/process-batch.js bst "Binary Search Tree"

# 2. Generate tokens for the real roster
node scripts/generate-tokens.js bst

# 3. Queue all feedback emails
node scripts/queue-emails.js bst "Binary Search Tree"

# 4. Monitor delivery
watch -n2 'sqlite3 db/feedback.db \
  "SELECT email_type, status, COUNT(*) \
   FROM email_queue WHERE assignment='"'"'bst'"'"' \
   GROUP BY email_type, status;"'
```

### Step 8 — Queue nudges (2–3 days before Exam 2)

```bash
node scripts/queue-nudges.js bst
# Targets students with a sent feedback email but no page_view event
```

---

## Pre-send checklist

Before removing `EMAIL_DEV_REDIRECT` and sending to real students:

- [ ] Run `bash Pipeline/scripts/e2e-wuas-ubuntu.sh` — all checks pass
- [ ] Test email arrives at `gajavegs@rose-hulman.edu` with `[DEV →` prefix
- [ ] PDF report downloads and renders correctly (assessment cards, days-left badge, drill columns)
- [ ] Feedback site loads without white screen or console errors
- [ ] Report and feedback links both resolve to `https://feedback.csse.rose-hulman.edu/…`
- [ ] `relay_status` shows a recent `last_heartbeat` (`pm2 logs relay` on Zenbook is clean)
- [ ] Zenbook sleep is disabled; power adapter is plugged in
- [ ] Windows auto-updates paused for the send window
- [ ] `EMAIL_DEV_REDIRECT` line removed (or commented out) from `.env`
- [ ] `pm2 restart feedback` run on Ubuntu after `.env` change
- [ ] `npm run build` run in `Frontend/` if React app was updated since last build

---

## Troubleshooting

### Emails stuck in `pending`

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
# check relayLastHeartbeat
```

- Stale or missing heartbeat → relay is offline. On Zenbook: `pm2 restart relay` or `pm2 logs relay` to see why it stopped.
- Relay restarts automatically flush pending emails.

### Emails stuck in `sending`

A server crash can leave rows in `sending`. The background job resets them to `pending` after 5 minutes. Or manually:

```bash
sqlite3 db/feedback.db \
  "UPDATE email_queue SET status='pending' WHERE status='sending';"
```

### Email marked `dead` (3 failed attempts)

```bash
sqlite3 db/feedback.db \
  "SELECT id, recipient, error_msg FROM email_queue WHERE status='dead';"
# Reset to retry:
sqlite3 db/feedback.db \
  "UPDATE email_queue SET status='pending', attempts=0 WHERE status='dead';"
```

### Relay rejects with 401

`RELAY_SECRET` on the Zenbook does not match `RELAY_SECRET` in Ubuntu `.env`.
Update the Windows system environment variable and restart: `pm2 restart relay`.

### Relay drops after a few minutes

This was a known issue with `relay-server.ps1` (PowerShell `HttpListener` instability).
The Node.js relay (`relay-server.js`) managed by pm2 does not have this problem —
pm2 will auto-restart it if it crashes. If drops persist, check `pm2 logs relay` for errors.

### Feedback site shows white screen

The React app needs to be (re)built:

```bash
cd ~/230LoggerMonorepo/Frontend && npm run build
pm2 restart feedback
```

### Report PDF is blank or missing assessment cards

- Check `data/{assignment}/output/{student_id}/frontend.json` exists and has a `feedback` array.
- Check `Pipeline/assignments/{assignment}_assessment_config.json` exists with at least one assessment.
- Delete `report.json` and retry — forces full regeneration:
  ```bash
  rm data/{assignment}/output/{student_id}/report.json
  cd Frontend && node scripts/regenerate-reports.js {assignment}
  ```

### Fallback: relay is down, emails must go out now

Use the manual send endpoints from any Windows machine with Outlook signed in:

```bash
# On Ubuntu: list pending emails as JSON
curl https://feedback.csse.rose-hulman.edu/api/emails/pending
```

Or run the manual PowerShell script on any signed-in Windows machine (see `system-plan-email-delivery.md`).
