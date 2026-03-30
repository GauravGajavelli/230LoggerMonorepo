# Feedback Service — Claude Code Implementation Plan

## Context

You are building a lightweight backend for a debugging feedback tool used in CSSE 230 (Data Structures). The system:

1. **Collects** `run.tar` log files — Dr. Krohn manually pulls and sends tars from student repos after each assignment deadline (no direct repo access). The current tar zip is here: /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline/testInputs/studentTars/allTar-WaS-Sp2026.zip
2. **Processes** those tars through an existing CLI pipeline (/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Pipeline) that produces `frontend.json` per student. See the runbook (/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/full_pipeline_runbook.md).
3. **Serves** a static web app that renders the feedback, with each student accessing only their own data via a pre-authenticated URL token or email lookup
4. **Accepts uploads** — students who forgot to commit `run.tar` can upload it directly through the web app to regenerate feedback

~45 students. It will be hosted on a single server behind a campus firewall (VPN/school wifi required). The first assignment providing feedback will be **BST (Binary Search Tree)**, due **April 6**, with feedback going live **April 7**. Subsequent assignments (e.g., StringHashSet, BinaryHeaps, GraphSurfing) follow the same flow — confirm the exact list with Dr. Krohn.

**Companion document:** /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Planning/system-plan-email-delivery.md covers the Zenbook email relay, reliability design, fallbacks, and operational procedures. Build the server (this plan, Steps 1–6) first. Then integrate the email queue endpoints (Step 7) which the Zenbook relay consumes.

---

## Data Collection Model

You do NOT have direct access to student repos. The workflow per assignment is:

1. Assignment deadline passes (e.g., April 6 at 11:59 PM)
2. You message Dr. Krohn asking her to pull the tars
3. She sends you a batch of `run.tar` files (expect morning or midday the next day)
4. You place them in `data/{assignment}/tars/{student_id}/run.tar`
5. Run `scripts/process-batch.js` to generate all `frontend.json` files
6. Run `scripts/queue-emails.js` to queue notification emails
7. Feedback goes live within ~24 hours of the deadline

For **regeneration** (student forgot to commit `run.tar`, or wants updated feedback):
- Student visits their feedback page, sees the null-feedback message
- Student uploads their `run.tar` directly through the web app
- Server saves it, runs the pipeline, queues a notification email
- No Dr. Krohn involvement needed for regeneration

---

## Architecture Decision: Thin Server + Existing Pipeline

Do NOT fold the pipeline into the server. Keep the pipeline as a CLI batch tool. Build a thin HTTP server that:

- Serves the static frontend app (`dist/`)
- Provides a landing page where students enter their email to access feedback
- Resolves URL tokens → student feedback JSON (for emailed links)
- Accepts `run.tar` uploads for regeneration
- Logs interaction events (views, time spent, features used)
- Queues outbound emails for the Zenbook relay to send
- Provides admin endpoints for batch operations

Think of this like a Bitly-style URL shortener: generate a short HMAC token per student, store the mapping, resolve on access. No user accounts, no passwords, no sessions.

### Two access paths for students

```
Path A — Email link (primary):
  Student receives email with link
    → GET /feedback?token=abc123
    → Server verifies token
    → App loads, fetches /api/data?token=abc123
    → Student views feedback

Path B — Landing page (fallback / LMS-driven):
  Student visits server URL from LMS announcement
    → GET /
    → Enters rose-hulman.edu email
    → POST /api/lookup with email
    → Server finds matching token, redirects to /feedback?token=abc123
    → Same flow as above
```

Both paths converge on the same token-based data endpoint. The landing page is the fallback if email delivery fails, but also a valid primary path via LMS announcement.

---

## Tech Stack

- **Runtime**: Node.js (since the frontend (/Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend) is already a JS app with `npm run build`)
- **Framework**: Express (minimal, well-known, sufficient for ~45 concurrent users)
- **Database**: SQLite via `better-sqlite3` (zero config, single file, plenty for this scale)
  - How will this be deployed in the web app versus for local development?
- **Token generation**: HMAC-SHA256 using Node's built-in `crypto` module
- **File uploads**: `multer` middleware for handling `run.tar` uploads

Do NOT use: Redis, Postgres, Docker, Nginx, any queue system, any ORM. This is a single-process server on a single machine for 45 students.

---

## Directory Structure

```
feedback-service/
├── server.js                 # Main Express server
├── lib/
│   ├── tokens.js             # HMAC token generation + verification
│   ├── db.js                 # SQLite schema + queries
│   └── events.js             # Interaction event logging
├── scripts/
│   ├── generate-tokens.js    # Batch: roster CSV → tokens in DB
│   ├── process-batch.js      # Batch: run pipeline on all tars for an assignment
│   └── queue-emails.js       # Batch: create email queue entries for an assignment
├── data/
│   ├── bst/                  # Per-assignment directory
│   │   ├── tars/             # Raw run.tar files from Dr. Krohn + student uploads
│   │   │   ├── student1/
│   │   │   │   └── run.tar
│   │   │   └── student2/
│   │   │       └── run.tar
│   │   └── output/           # Pipeline output
│   │       ├── student1/
│   │       │   └── frontend.json
│   │       └── student2/
│   │           └── frontend.json
│   └── roster.csv            # student_id, email (from Dr. Krohn)
├── db/
│   └── feedback.db           # SQLite database (auto-created)
├── dist/                     # Static frontend build (npm run build output)
├── public/
│   └── landing.html          # Email lookup landing page
├── .env                      # SECRET_KEY, PORT, DATA_DIR, BASE_URL, RELAY_SECRET
└── package.json
```

---

## Implementation Steps (in order)

### Step 1: Project scaffold and SQLite schema

Initialize the project and database layer first. Everything else depends on this.

```bash
mkdir feedback-service && cd feedback-service
npm init -y
npm install express better-sqlite3 dotenv multer
```

**SQLite schema** (in `lib/db.js`):

```sql
-- Token-to-student mapping
CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  assignment  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Interaction event log (append-only)
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  event_data  TEXT,
  timestamp   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (token) REFERENCES tokens(token)
);

-- Pipeline run status tracking
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment  TEXT NOT NULL,
  student_id  TEXT NOT NULL,
  status      TEXT NOT NULL,   -- 'pending', 'processing', 'success', 'error'
  source      TEXT NOT NULL DEFAULT 'batch',  -- 'batch' or 'upload'
  error_msg   TEXT,
  started_at  TEXT,
  finished_at TEXT
);

-- Email queue (consumed by the Zenbook relay)
CREATE TABLE IF NOT EXISTS email_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token         TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  email_type    TEXT NOT NULL,  -- 'feedback_ready', 'regeneration_ready', 'nudge', 'missing_tar'
  assignment    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending, sending, sent, failed, dead
  attempts      INTEGER DEFAULT 0,
  last_attempt  TEXT,
  sent_at       TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  error_msg     TEXT,
  FOREIGN KEY (token) REFERENCES tokens(token)
);

CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status);

-- Relay heartbeat tracking
CREATE TABLE IF NOT EXISTS relay_status (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  last_heartbeat  TEXT,
  relay_ip        TEXT
);
```

Expose the DB as a singleton module. Use `better-sqlite3` synchronous API (fine for 45 users, simpler code).

### Step 2: Token generation and verification

**`lib/tokens.js`** — two functions:

```js
// generateToken(studentId, secret) → token string
//   HMAC-SHA256(studentId, secret), take first 16 hex chars
//   16 hex chars = 8 bytes = 2^64 possibilities, collision-free for 45 students

// verifyToken(token, secret) → studentId or null
//   Look up token in DB, return associated student_id
//   (We don't reverse the HMAC; we just use the DB lookup)
```

Why HMAC instead of random UUIDs: tokens are deterministic per student, so regenerating them (e.g., for a re-send) produces the same link. Students can bookmark their link and it always works.

**`scripts/generate-tokens.js`**:
- Reads `data/roster.csv` (format: `student_id,email`)
- For each student, generates HMAC token
- Inserts into `tokens` table (upsert on conflict)
- Prints summary

### Step 3: Express server — static serving, landing page, token resolution

**`server.js`** — keep this lean:

```
GET  /                          → serve landing page (public/landing.html)
GET  /app                       → serve dist/index.html
GET  /app/*                     → serve static files from dist/
GET  /feedback?token=XXX        → validate token, serve the app with context
POST /api/lookup                → email lookup: find token, return redirect URL
GET  /api/data?token=XXX        → return the student's frontend.json
POST /api/events                → log interaction events
POST /api/upload?token=XXX      → accept run.tar upload, run pipeline, queue email
GET  /api/health                → { status: "ok", students: N, assignment: "bst" }
```

**Landing page (`public/landing.html`):**
- Simple form: "Enter your Rose-Hulman email to view your feedback"
- On submit, POST to `/api/lookup` with `{ email: "..." }`
- Server finds the token for that email, redirects to `/feedback?token=XXX`
- If email not found: "We don't have feedback for that email. Make sure you're using your @rose-hulman.edu address."
- Rate limit: 5 requests per minute per IP to prevent enumeration

**Token-based access (`/feedback?token=XXX`):**
1. Look up token in DB → get student_id and assignment
2. If invalid token → serve a friendly error page
3. If valid → serve the app's `index.html`
4. The app on load calls `GET /api/data?token=XXX` to fetch its feedback JSON

**The null-feedback case (`/api/data` when no frontend.json exists):**
- If no tar and no output: return `{ error: "no_data", message: "We didn't find test run data in your submission. You can upload your run.tar file below to generate feedback.", allowUpload: true }`
- If tar exists but pipeline failed: return `{ error: "processing_error", message: "Something went wrong generating your feedback. You can try uploading your run.tar again, or contact the research team.", allowUpload: true }`
- If pipeline is currently running: return `{ error: "processing", message: "Your feedback is being generated. Check back in a few minutes." }`
- Log all null-feedback cases so you can monitor how many students hit them

### Step 4: Interaction event logging

**`POST /api/events`** body:
```json
{
  "token": "abc123",
  "events": [
    { "type": "page_view", "data": {} },
    { "type": "expand_episode", "data": { "episode_id": 3 } },
    { "type": "time_spent", "data": { "seconds": 45, "section": "timeline" } }
  ]
}
```

Batch insert into the `events` table. Validate the token first. Keep this endpoint fast — don't block the UI.

The frontend needs a small addition: a JS module that collects events in a buffer and flushes them periodically (every 30s) and on page unload (`navigator.sendBeacon`). This is a ~30-line addition to the frontend.

### Step 5: Tar upload and regeneration endpoint

```
POST /api/upload?token=XXX
Content-Type: multipart/form-data
Body: file (run.tar)
```

This is how students who forgot to commit `run.tar` get feedback without needing Dr. Krohn's involvement.

- Validate token → get student_id and assignment
- Rate limit: 1 upload per hour per token
- Validate the uploaded file: must be a .tar file, reasonable size (under 50MB)
- Save to `data/{assignment}/tars/{student_id}/run.tar` (overwrite if exists)
- Shell out to pipeline: `PIPELINE_CMD --input data/{assignment}/tars/{student_id}/run.tar --output data/{assignment}/output/{student_id}/frontend.json`
- Insert a `pipeline_runs` record with `source: 'upload'`
- On success: queue a `regeneration_ready` email
- Return `{ status: "processing", message: "Your feedback is being generated. You'll receive an email when it's ready, or you can check back in a few minutes." }`
- On pipeline error: return `{ status: "error", message: "Something went wrong processing your data. The research team has been notified." }`

Use `multer` for file handling:
```js
const multer = require('multer');
const upload = multer({ dest: 'tmp/', limits: { fileSize: 50 * 1024 * 1024 } });
// Route: app.post('/api/upload', upload.single('file'), handler);
```

### Step 6: Batch processing script

**`scripts/process-batch.js`**:
- Takes an assignment name as argument (e.g., `bst`)
- Expects tars to already be in `data/{assignment}/tars/{student_id}/run.tar` (placed there manually after Dr. Krohn sends them)
- For each student directory:
  1. Insert a `pipeline_runs` record with status `pending`, source `batch`
  2. Shell out to your existing CLI pipeline
  3. Update status to `success` or `error`
  4. Log timing
- Print summary: N succeeded, M failed, with error details for failures

**`scripts/queue-emails.js`**:
- Takes an assignment name as argument
- For each student with a successful pipeline run, insert a `feedback_ready` email into `email_queue`
- For each student in the roster with no tar file, insert a `missing_tar` email
- Uses email templates (see system-plan-email-delivery.md for template text)
- Print summary: N feedback emails queued, M missing-tar emails queued

### Step 7: Email relay API endpoints

These endpoints are consumed by the Zenbook polling script (see `system-plan-email-delivery.md` for the Zenbook setup and polling script).

```
GET  /api/emails/pending          → Returns next batch of pending emails (max 5)
POST /api/emails/:id/sending      → Marks email as 'sending' (relay claims it)
POST /api/emails/:id/sent         → Marks email as 'sent' with timestamp
POST /api/emails/:id/failed       → Marks email as 'failed', increments attempts
GET  /api/emails/stats            → { pending: N, sending: N, sent: N, failed: N, dead: N }
GET  /api/relay/heartbeat         → Relay calls this every poll; server logs timestamp
```

**Authentication:** All `/api/emails/*` and `/api/relay/*` endpoints check for `Authorization: Bearer <RELAY_SECRET>`. Reject with 401 otherwise.

**Retry logic (server-side):** A background `setInterval` (every 5 minutes) checks for emails stuck in `sending` for more than 5 minutes and returns them to `pending`. Emails with 3+ failed attempts move to `dead` status.

**Heartbeat alert:** Same `setInterval` checks `relay_status.last_heartbeat`. If older than 5 minutes, log a warning. Optionally send a push notification via Ntfy or Pushover (a single HTTP POST from the server).

---

## .env Configuration

```
SECRET_KEY=<random-64-char-hex-string>
RELAY_SECRET=<separate-random-64-char-hex-string>
PORT=3000
DATA_DIR=./data
BASE_URL=https://your-server.rose-hulman.edu:3000
PIPELINE_CMD=python3 /path/to/your/pipeline.py
```

Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Build Order for Claude Code

Work through these in order. Each step should be a working, testable increment.

1. **Step 1** → `npm init`, install deps, `lib/db.js` with full schema, test that DB creates correctly
2. **Step 2** → `lib/tokens.js` + `scripts/generate-tokens.js`, test with a dummy roster
3. **Step 3** → `server.js` with all routes, `public/landing.html`, test token flow end-to-end with a dummy `frontend.json`
4. **Step 4** → Event logging endpoint + frontend beacon module
5. **Step 5** → Upload endpoint with multer + pipeline integration, test with a real `run.tar`
6. **Step 6** → `scripts/process-batch.js` + `scripts/queue-emails.js` (needs actual pipeline + roster)
7. **Step 7** → Email relay endpoints (then test with the Zenbook polling script from `system-plan-email-delivery.md`)

Steps 1–4 are pure server work — no external dependencies. Step 5 needs your pipeline command. Step 6 needs tars from Dr. Krohn + the roster. Step 7 needs the Zenbook set up.

---

## Things NOT to Build

- No user registration or login (tokens are the auth, landing page is the fallback)
- No admin UI (use SQLite CLI or scripts for admin tasks)
- No direct repo access (Dr. Krohn provides tars manually; students upload for regeneration)
- No HTTPS termination in the app (campus firewall handles it, or use a self-signed cert)
- No rate limiting beyond upload and landing page lookup endpoints
- No caching layer (45 students, JSON files are small, disk reads are fine)
- No websockets or real-time anything
- No containerization (run directly with `node server.js` or use pm2 for process management)

---

## Testing Checklist Before April 7

- [ ] Generate tokens for all students from roster
- [ ] Place BST tars (from Dr. Krohn) into `data/bst/tars/`
- [ ] Process all BST tars through pipeline via `process-batch.js`
- [ ] Verify each student's frontend.json loads correctly via their token URL
- [ ] Test landing page email lookup flow end-to-end
- [ ] Test the null-feedback case (missing run.tar) — verify upload prompt appears
- [ ] Test tar upload and regeneration flow end-to-end
- [ ] Test invalid/expired token handling
- [ ] Verify interaction events are being logged to SQLite
- [ ] Queue feedback emails via `queue-emails.js` and verify they appear in `/api/emails/pending`
- [ ] Confirm Zenbook relay picks up, sends, and confirms delivery
- [ ] Test relay heartbeat monitoring and alert
- [ ] Test manual fallback script from your laptop
- [ ] Check server stays up under light load (`ab -n 100 -c 10 http://server/api/health`)
- [ ] Set up pm2 or systemd to auto-restart the server on crash
- [ ] LMS announcement drafted and sent to Dr. Krohn
