# Feedback Delivery System — Full System Plan

This document complements `claude-code-plan.md` (server architecture, token system, pipeline integration). It covers the end-to-end system including the email delivery subsystem, the Asus Zenbook relay, reliability design, and operational procedures.

**Build status:** Server-side email infrastructure is complete. The Zenbook relay script (`scripts/relay-server.ps1`) is written. Remaining work is physical Zenbook setup and a full round-trip test.

---

## System Overview

Three machines. One job each.

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Ubuntu Server       │     │  Asus Zenbook UX370  │     │  Student Browser  │
│  (campus firewall)   │────▶│  (campus network)    │────▶│                  │
│                      │     │                      │     │  Reads feedback  │
│  - Express app       │     │  - HTTP server       │     │  via token URL   │
│  - Pipeline          │     │  - Receives pushes   │     │  Uploads run.tar │
│  - SQLite DB         │     │  - Sends via Outlook │     │  for regeneration│
│  - Email queue       │     │  - Reports delivery  │     │                  │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
        ▲
        │  Dr. Krohn manually sends
        │  run.tar batch after deadline
```

**Server** (Ubuntu): Runs the feedback app, processes tars, generates tokens, queues emails, accepts student uploads, serves the landing page. This is the source of truth for everything. When an email is queued, the server immediately pushes it to the Zenbook; the background job retries any that fail.

**Zenbook** (Windows): A push-based relay. Runs a PowerShell HTTP server (`relay-server.ps1`) that receives send requests from Ubuntu, forwards them through Outlook COM, and returns the result synchronously. It has no state of its own — if it dies, emails sit safely as `pending` on the server until it comes back.

**Student browser**: Hits the server directly (campus network required). Views feedback, uploads `run.tar` for regeneration if needed.

### Data Collection Flow

You do NOT have direct access to student repos. Per-assignment workflow:

1. Assignment deadline passes
2. Message Dr. Krohn → she pulls and sends you the `run.tar` batch (expect next morning/midday)
3. Place tars in `data/{assignment}/tars/`, run batch pipeline, queue emails
4. Feedback goes live within ~24 hours of the deadline

For regeneration, students upload `run.tar` directly through the web app — no Dr. Krohn involvement needed.

---

## Email Delivery Subsystem

### Architecture Principles

1. **Server is the source of truth.** Every email starts as a row in SQLite with status `pending`. The Zenbook doesn't decide what to send — the server pushes to it.
2. **Push, not poll.** The server immediately pushes to `http://{relay_ip}:{relay_port}/send` when an email is queued. No polling loop, no claim/confirm round-trips for the normal path. Delivery latency is milliseconds rather than up to 20 seconds.
3. **Synchronous outcome.** The Zenbook sends via Outlook and returns `200 {"ok":true}` or `500 {"error":"..."}` in the same HTTP response. The server marks `sent` or `failed` immediately — no second round-trip.
4. **Idempotent claiming.** The server atomically sets `status='sending'` before pushing. If `pushAllPending` is called concurrently (e.g., a new email queued while the background job is running), only one caller claims each row.
5. **Relay is stateless.** The Zenbook holds nothing. It registers its IP and port with the server on startup; if it reboots, it re-registers and the server resumes pushing.
6. **Graceful degradation.** If the relay is unreachable, emails stay `pending` and the 60-second background job retries. The manual fallback script works without any Zenbook involvement.

### Email Queue Schema

`email_queue` table in `db/feedback.db`:

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `token` | TEXT | FK → tokens |
| `recipient` | TEXT | Student email address |
| `subject` | TEXT | Rendered at queue time |
| `body` | TEXT | HTML, rendered at queue time |
| `email_type` | TEXT | `feedback_ready`, `regeneration_ready`, `missing_tar`, `nudge` |
| `assignment` | TEXT | e.g. `bst` |
| `status` | TEXT | `pending` → `sending` → `sent` / `failed` → `dead` |
| `attempts` | INTEGER | Incremented on each failure |
| `last_attempt` | TEXT | Timestamp of last push attempt |
| `sent_at` | TEXT | Set when confirmed sent |
| `created_at` | TEXT | |
| `error_msg` | TEXT | Last error from Outlook or network |

`relay_status` table (single row):

| Column | Notes |
|---|---|
| `relay_ip` | Set by `/api/relay/register` |
| `relay_port` | Set by `/api/relay/register` |
| `last_heartbeat` | Updated on every register call |

### Server API Endpoints

All endpoints require `Authorization: Bearer <RELAY_SECRET>`.

```
POST /api/relay/register          → Zenbook registers its IP and port on startup;
                                    triggers immediate drain of pending emails
GET  /api/emails/stats            → { pending, sending, sent, failed, dead }

# Manual-fallback endpoints (used by manual-send.ps1 only — not by relay-server.ps1)
GET  /api/emails/pending          → Returns next batch of pending emails
POST /api/emails/:id/sending      → Claims an email (pending → sending)
POST /api/emails/:id/sent         → Confirms delivery (sending → sent)
POST /api/emails/:id/failed       → Records failure, increments attempts
```

### Normal Delivery Flow

```
1. queueEmail() inserts row (status: pending)
2. setImmediate(pushAllPending) — fires within the same event loop turn
3. pushEmail() sets status='sending', POSTs to http://{relay_ip}:{relay_port}/send
4. relay-server.ps1 receives { recipient, subject, body }
5. Outlook COM: mail.HTMLBody = body; mail.Send()
6. relay-server.ps1 returns 200 {"ok":true}
7. Server sets status='sent', logs delivery
```

On Outlook failure, relay returns `500 {"error":"..."}`, server records failure and increments `attempts`. After 3 failures, status becomes `dead`.

### Background Job (every 60 seconds)

```
1. Unstick emails stuck in 'sending' for >5 min (server crash safety valve) → pending
2. Reset 'failed' emails after 5-min backoff → pending
3. pushAllPending() — drains up to 20 pending rows
4. Alert if relay_status.last_heartbeat is stale >5 min
```

### Zenbook Relay Server (`scripts/relay-server.ps1`)

```
On startup:
  1. Connect to Outlook COM (held open for lifetime of script)
  2. Start System.Net.HttpListener on port 3001
  3. POST /api/relay/register to Ubuntu server
     → server immediately pushes any pending emails

Per request:
  POST /send  { recipient, subject, body }
    → mail.HTMLBody = body (HTML rendered by server at queue time)
    → mail.Send()
    → return 200 {"ok":true} or 500 {"error":"..."}

  GET /status
    → return 200 {"ok":true}  (probe endpoint)
```

All routes require `Authorization: Bearer <RELAY_SECRET>`.

### Zenbook Setup

**One-time (run PowerShell as Administrator):**
```powershell
netsh http add urlacl url=http://+:3001/ user=RHIT\gajavegs
```

**Environment variables** (set in Windows System Properties → Environment Variables):
```
FEEDBACK_SERVER_URL = http://<ubuntu-server-ip>:3000
RELAY_SECRET        = <value from server .env>
```

**Task Scheduler trigger** (On logon, run as your user):
```
powershell -WindowStyle Hidden -File C:\path\to\relay-server.ps1
```

**Setup checklist:**
- [ ] Charge and power on the Zenbook
- [ ] Run Windows Update (it's been off since 2023 — expect a long update cycle)
- [ ] Sign into Outlook with gajavegs@rose-hulman.edu
- [ ] Disable sleep/hibernate: Settings → System → Power → "Screen and sleep" → Never (battery and plugged in)
- [ ] Disable Windows auto-updates during critical periods (April 6–10): Settings → Windows Update → Pause updates
- [ ] Connect to campus network (see Network section)
- [ ] Run `netsh` URL reservation (as Administrator, one time)
- [ ] Set `FEEDBACK_SERVER_URL` and `RELAY_SECRET` environment variables
- [ ] Create Task Scheduler entry to run `relay-server.ps1` on logon
- [ ] Plug in power adapter — leave plugged in permanently
- [ ] Test a full round-trip: queue a test email on the server → confirm it arrives

---

## Network Connectivity

### Primary: Ethernet (recommended)

**Yes, use ethernet if possible.** Most campus offices and labs have ethernet jacks. Wired connections don't drop, don't require re-authentication, and aren't affected by wifi congestion.

To check:
- Does your office/room have an ethernet port?
- Does the Zenbook have an ethernet port? (The UX370 likely doesn't — it's a thin ultrabook. You'll need a USB-C to Ethernet adapter, ~$15.)
- Does the port require IT activation? Some campus jacks are disabled by default. Ask EIT if needed.

Ethernet puts you on the campus network with no wifi reliability concerns. If you can get this working, the wifi fallback section becomes a backup plan you'll likely never need.

### Secondary: Eduroam wifi

If ethernet isn't available, connect to eduroam. It's the enterprise-grade campus network — more reliable than RHIT-Open, WPA2-Enterprise authenticated. The Zenbook should remember credentials after the first setup.

Eduroam drops are typically seconds-long. The push model handles this natively — a failed push leaves the email `pending`, the background job retries 60 seconds later.

### Why not RHIT-Open

RHIT-Open requires periodic web portal re-authentication. If the session expires, HTTP requests silently redirect to the captive portal HTML page. Both the server (pushing to the Zenbook) and the Zenbook (registered IP) would be affected. Eduroam doesn't have this problem.

---

## Reliability Design

### Failure Mode Analysis

| What fails | What happens | Recovery |
|---|---|---|
| Zenbook loses wifi (seconds) | Push fails, email stays `pending` | Background job retries in ≤60s |
| Zenbook loses wifi (minutes) | Emails queue up on server | Automatic on reconnect + re-register |
| Zenbook loses wifi (hours) | Server alerts on stale heartbeat | Manual intervention (see Fallback 1) |
| Zenbook crashes/freezes | Push fails; server sees no registration | Reboot; `relay-server.ps1` auto-starts, re-registers, server drains pending |
| Zenbook Outlook hangs | `/send` returns 500 | Email marked `failed`; auto-retry after 5 min |
| Windows forces restart | Script stops, Outlook closes | Task Scheduler re-runs on next logon |
| Server goes down | Students can't access site; Zenbook unreachable | Fix server; emails still safely queued in SQLite |
| Power outage (Zenbook) | Battery lasts a few hours | Plug back in; script auto-starts on logon |
| Dr. Krohn slow to send tars | Feedback delayed past 24 hours | Follow up; students can self-serve via upload |

### Relay Registration and IP Discovery

The Zenbook's IP may change on reconnect (DHCP). `relay-server.ps1` calls `POST /api/relay/register` on every startup, updating `relay_status.relay_ip` and `relay_status.relay_port`. The server reads the current IP before each push — no stale IP problem.

### Fallback 1: Manual Send from Laptop

If the Zenbook is down and emails need to go out immediately:

```powershell
# manual-send.ps1 — run from any Windows machine with Outlook signed in
param([string]$ServerUrl, [string]$RelaySecret)
$headers = @{ "Authorization" = "Bearer $RelaySecret"; "Content-Type" = "application/json" }
$pending = Invoke-RestMethod "$ServerUrl/api/emails/pending?limit=50" -Headers $headers
$outlook = New-Object -ComObject Outlook.Application

foreach ($email in $pending) {
    Invoke-RestMethod -Method Post "$ServerUrl/api/emails/$($email.id)/sending" -Headers $headers
    try {
        $mail = $outlook.CreateItem(0)
        $mail.To                = $email.recipient
        $mail.Subject           = $email.subject
        $mail.Body              = $email.body     # plaintext — Moodle-style format
        $mail.DeleteAfterSubmit = $true           # MANDATORY: suppress Sent Items copy
        $mail.Send()
        Invoke-RestMethod -Method Post "$ServerUrl/api/emails/$($email.id)/sent" -Headers $headers
        Write-Host "Sent: $($email.recipient)"
    } catch {
        Invoke-RestMethod -Method Post "$ServerUrl/api/emails/$($email.id)/failed" -Headers $headers -Body (@{error_msg="$_"} | ConvertTo-Json)
        Write-Host "Failed: $($email.recipient) - $_"
    }
}
```

This uses the same polling endpoints that `relay-server.ps1` bypasses in the normal push path — they're kept for exactly this purpose.

### Fallback 2: Landing Page (no email needed)

If email delivery is completely broken, students can still access their feedback:

- The landing page on the server accepts a student's email via RoseFire login
- Dr. Krohn posts an LMS announcement with the server URL
- Students log in and are redirected to their token URL

This works independently of the email system. Even if zero emails go out, students can still get their feedback.

---

## Operational Timeline

### Week of March 30 – April 5
- [x] Server-side email infrastructure complete (`email_queue`, push logic, relay API)
- [x] `relay-server.ps1` written
- [x] HTML email templates in place
- [ ] Physical Zenbook setup (Windows Update, Outlook sign-in, disable sleep)
- [ ] `netsh` URL reservation on Zenbook
- [ ] Set environment variables on Zenbook
- [ ] Task Scheduler entry created
- [ ] Full round-trip test: queue email → Zenbook sends → email arrives
- [ ] Manual fallback script tested from laptop
- [ ] Pipeline validation complete — WuaS and BST configs ready
- [ ] Dr. Krohn's LMS announcement drafted and sent to her
- [ ] Send pre-feedback reminder via LMS (April 5–6)

### April 7 (BST launch day)
- [ ] Message Dr. Krohn to pull BST tars
- [ ] Receive tars, place in `data/bst/tars/`
- [ ] Run `scripts/process-batch.js bst "Binary Search Tree"`
- [ ] Run `scripts/generate-tokens.js bst` (if not already done)
- [ ] Run `scripts/queue-emails.js bst "Binary Search Tree"`
- [ ] Confirm emails pushed via `GET /api/emails/stats`
- [ ] Monitor student access via `GET /api/events`
- [ ] Have `manual-send.ps1` ready on your laptop just in case

### April 8+ (ongoing)
- [ ] Monitor uploads and regeneration requests
- [ ] Check `/api/emails/stats` and heartbeat alerts daily
- [ ] Run nudge emails for students who haven't viewed feedback (after ~3 days)
- [ ] Repeat the cycle for subsequent assignments (confirm list with Dr. Krohn)

---

## Email Templates

Templates are rendered to HTML at queue time in `server.js`. The `body` field stored in `email_queue` is already HTML — `relay-server.ps1` assigns it directly to `mail.HTMLBody`.

### Feedback Ready

**Subject:** `Your {assignment} debugging feedback is ready`

```html
<p>Hi,</p>
<p>Your debugging feedback for the <strong>{assignment}</strong> assignment is ready to view:</p>
<p><a href="{link}">{link}</a></p>
<p>This link is private to you — please don't share it.</p>
<p>If you have questions, contact <a href="mailto:gajavegs@rose-hulman.edu">gajavegs@rose-hulman.edu</a>.</p>
```

### Regeneration Ready

**Subject:** `Your updated {assignment} feedback is ready`

```html
<p>Hi,</p>
<p>Your regenerated debugging feedback for <strong>{assignment}</strong> is ready:</p>
<p><a href="{link}">{link}</a></p>
<p>Same link as before — just refreshed with your latest data.</p>
```

### Missing run.tar

**Subject:** `Your {assignment} debugging feedback — action needed`

```html
<p>Hi,</p>
<p>We tried to generate your debugging feedback for <strong>{assignment}</strong>, but couldn't find a <code>run.tar</code> file in your submission.</p>
<p>If you have your <code>run.tar</code> file locally, you can upload it directly at:</p>
<p><a href="{link}">{link}</a></p>
<p>If you're not sure where to find it, it's in your assignment project directory under the <code>testSupport</code> folder.</p>
```

### Nudge (3 days post-launch)

**Subject:** `Reminder — your {assignment} debugging feedback is available`

```html
<p>Hi,</p>
<p>Just a reminder that your <strong>{assignment}</strong> debugging feedback is available:</p>
<p><a href="{link}">{link}</a></p>
<p>It takes about 5 minutes to review and may help with upcoming assignments.</p>
```

---

## Security Notes

- Email queue contains student emails and feedback links. This is operational data, not research data. Stored in the same SQLite DB on the password-protected institutional server per the IRB application.
- The Zenbook stores nothing persistently. Emails pass through Outlook and appear in your Sent folder (fine — you're the PI, and the links alone don't reveal feedback content).
- Token-to-student mappings are destroyed after data cleaning as promised in the IRB application.
- All relay endpoints require `Authorization: Bearer <RELAY_SECRET>`. The Zenbook's server also checks this header on incoming pushes, so a rogue client on the campus network can't trigger sends.
- The landing page email-lookup endpoint is rate-limited (5 requests per minute per IP) to prevent enumeration.
- The upload endpoint validates file type (`.tar` only), size (<50 MB), and rate-limits to 1 upload per hour per token.
- Uploaded tars are stored on the same institutional server as all other research data.
