# Feedback Delivery System — Full System Plan

This document complements `claude-code-plan.md` (server architecture, token system, pipeline integration). It covers the end-to-end system including the email delivery subsystem, the Asus Zenbook relay, reliability design, and operational procedures.

**Build order:** Complete Steps 1–6 of `claude-code-plan.md` first (server, tokens, landing page, events, upload/regeneration, batch scripts). Then build Step 7 (email relay endpoints) using this document as the spec for the Zenbook side. The server works without the email system — the landing page is a fully functional access path on its own.

---

## System Overview

Three machines. One job each.

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Ubuntu Server       │     │  Asus Zenbook UX370  │     │  Student Browser  │
│  (campus firewall)   │────▶│  (campus network)    │────▶│                  │
│                      │     │                      │     │  Reads feedback  │
│  - Express app       │     │  - Polls /api/emails │     │  via token URL   │
│  - Pipeline          │     │  - Sends via Outlook │     │  Uploads run.tar │
│  - SQLite DB         │     │  - Reports delivery  │     │  for regeneration│
│  - Email queue       │     │                      │     │                  │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
        ▲
        │  Dr. Krohn manually sends
        │  run.tar batch after deadline
```

**Server** (Ubuntu): Runs the feedback app, processes tars, generates tokens, queues emails, accepts student uploads, serves the landing page. This is the source of truth for everything.

**Zenbook** (Windows): A dumb relay. Polls the server for outbound emails, sends them through Outlook, reports back. It has no state of its own — if it dies, you replace it and nothing is lost.

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

1. **Server is the source of truth.** Every email starts as a row in SQLite with status `pending`. The Zenbook doesn't decide what to send — it asks the server.
2. **Idempotent delivery.** The server tracks state transitions. An email can only move `pending → sending → sent` or `pending → sending → failed → pending`. No double-sends.
3. **Relay is stateless.** The Zenbook holds nothing. If it crashes, the next poll picks up where it left off.
4. **Graceful degradation.** If the relay is unreachable for an extended period, you can fall back to manual sending without any data loss.

### Email Queue Schema

Defined in `claude-code-plan.md` Step 1 as part of the unified SQLite schema. The `email_queue` table has columns: `id`, `token`, `recipient`, `subject`, `body`, `email_type` (feedback_ready, regeneration_ready, nudge, missing_tar), `assignment`, `status` (pending, sending, sent, failed, dead), `attempts`, `last_attempt`, `sent_at`, `created_at`, `error_msg`. See that document for the full CREATE statement.

### Server API Endpoints (email relay)

Defined in `claude-code-plan.md` Step 7. All endpoints require `Authorization: Bearer <RELAY_SECRET>`.

```
GET  /api/emails/pending          → Returns next batch of pending emails (max 5)
POST /api/emails/:id/sending      → Marks email as 'sending' (relay claims it)
POST /api/emails/:id/sent         → Marks email as 'sent' with timestamp
POST /api/emails/:id/failed       → Marks email as 'failed', increments attempts
GET  /api/emails/stats            → { pending: N, sending: N, sent: N, failed: N, dead: N }
GET  /api/relay/heartbeat         → Relay calls this every poll; server logs timestamp
```

**Claim-before-send pattern:** The Zenbook GETs pending emails, POSTs `/sending` to claim one, sends it via Outlook, then POSTs `/sent` or `/failed`. This prevents double-sends if polling overlaps (unlikely at 20s intervals with one relay, but good hygiene).

**Retry logic:** Failed emails return to `pending` after 5 minutes (server-side). After 3 failed attempts, status moves to `dead` and you get alerted. Manual intervention required.

### Zenbook Polling Script

The core loop running on the Zenbook:

```
Every 20 seconds:
  1. GET /api/relay/heartbeat           → server knows relay is alive
  2. GET /api/emails/pending            → get next batch
  3. For each email:
     a. POST /api/emails/:id/sending    → claim it
     b. Send via Outlook COM
     c. POST /api/emails/:id/sent       → confirm delivery
     d. On Outlook error:
        POST /api/emails/:id/failed     → release it
  4. Sleep 20 seconds
```

If the GET fails (network down), the script logs the failure locally and retries on the next cycle. No state is lost — everything is still `pending` on the server.

### Zenbook Setup Checklist

- [ ] Charge and power on the Zenbook
- [ ] Run Windows Update (it's been off since 2023 — expect a long update cycle)
- [ ] Sign into Outlook with gajavegs@rose-hulman.edu
- [ ] Send a test email to yourself using test-email.ps1
- [ ] Disable sleep/hibernate: Settings → System → Power → set "Screen and sleep" to Never on both battery and plugged in
- [ ] Disable Windows auto-updates during critical periods (April 6–10): Settings → Windows Update → Pause updates
- [ ] Connect to campus network (see Network section below)
- [ ] Place the script in a Startup folder or create a Scheduled Task to auto-run on boot
- [ ] Plug in power adapter — leave it plugged in permanently
- [ ] Test a full round-trip: server queues email → Zenbook picks it up → email arrives

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

Eduroam drops are typically seconds-long. The polling script handles this natively — a failed poll just retries 20 seconds later, and emails sit safely in `pending` on the server.

### Why not RHIT-Open

RHIT-Open is an open network that requires periodic web portal re-authentication. If the Zenbook's browser session expires, all HTTP requests silently redirect to the captive portal. The polling script would get 200 responses containing HTML login pages instead of JSON — it would think the server is returning garbage, not that the network needs re-auth. Eduroam doesn't have this problem.

---

## Reliability Design

### Failure Mode Analysis

| What fails | What happens | Recovery |
|---|---|---|
| Zenbook loses wifi (seconds) | Poll fails, retries next cycle | Automatic — emails stay `pending` |
| Zenbook loses wifi (minutes) | Emails queue up on server | Automatic on reconnect |
| Zenbook loses wifi (hours) | Server detects missing heartbeat | Alert triggers; manual intervention (see Fallback 1) |
| Zenbook crashes/freezes | Same as hours-long wifi loss | Reboot, script auto-starts |
| Zenbook Outlook hangs | Send fails, email marked `failed` | Auto-retry after 5 min |
| Windows forces restart | Script stops, Outlook closes | Script auto-starts on boot, Outlook re-signs in |
| Server goes down | Zenbook polls fail, students can't access site | Fix server; emails still queued in SQLite |
| Power outage (Zenbook) | Battery lasts a few hours, then shuts down | Plug back in, script auto-starts |
| Dr. Krohn slow to send tars | Feedback delayed past 24 hours | Follow up; students can self-serve via upload if they have their run.tar locally |

### Heartbeat Monitoring

The server tracks the last heartbeat from the Zenbook:

```sql
CREATE TABLE IF NOT EXISTS relay_status (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  last_heartbeat  TEXT,
  relay_ip        TEXT
);
```

When the heartbeat gap exceeds 5 minutes, the server could:
- Log a warning
- Send you a push notification (via Pushover, Ntfy, or similar — a simple HTTP POST from the server, no Outlook needed)
- Display a warning on your admin stats endpoint

### Synchronous Fallback 1: Manual Batch from Laptop

If the Zenbook is down and emails need to go out:

1. From your main laptop, hit `GET /api/emails/pending` (you're on the campus network)
2. Save the JSON response to a file
3. Run a PowerShell script that reads the file and sends each email via your laptop's Outlook
4. POST results back to the server

This is the "break glass" option. The PowerShell script is almost identical to the Zenbook's, just reading from a local file instead of polling.

```powershell
# manual-send.ps1 — run from your laptop
$serverUrl = "http://your-server:3000"
$headers = @{ "Authorization" = "Bearer YOUR_RELAY_SECRET" }
$pending = Invoke-RestMethod "$serverUrl/api/emails/pending?limit=50" -Headers $headers
$outlook = New-Object -ComObject Outlook.Application

foreach ($email in $pending) {
    Invoke-RestMethod -Method Post "$serverUrl/api/emails/$($email.id)/sending" -Headers $headers
    try {
        $mail = $outlook.CreateItem(0)
        $mail.To = $email.recipient
        $mail.Subject = $email.subject
        $mail.Body = $email.body
        $mail.Send()
        Invoke-RestMethod -Method Post "$serverUrl/api/emails/$($email.id)/sent" -Headers $headers
        Write-Host "Sent to $($email.recipient)"
    } catch {
        Invoke-RestMethod -Method Post "$serverUrl/api/emails/$($email.id)/failed" -Headers $headers
        Write-Host "Failed: $($email.recipient) - $_"
    }
}
```

### Synchronous Fallback 2: USB Sneakernet

If both wifi and your laptop's network are down (campus-wide outage):

1. SSH into the server (or access it directly if you have physical access)
2. Export pending emails to a JSON file on a USB drive
3. Plug USB into any Windows machine with Outlook signed in
4. Run the PowerShell script pointing at the local file
5. Later, bring the results file back to the server to update statuses

This is the most offline-resilient option. It requires no network between the server and the sending machine.

### Synchronous Fallback 3: Landing Page (no email needed)

If email delivery is completely broken, students can still access their feedback:

- The landing page on the server accepts a student's email address
- If it matches the roster, redirect to their feedback
- Dr. Krohn posts an LMS announcement with the URL

This is already part of the server design (see claude-code-plan.md). It works independently of the email system. Even if zero emails ever go out, students can still get their feedback through the LMS post.

---

## Operational Timeline

### This week (March 26–29)
- [ ] Set up the Zenbook (Windows Update, Outlook sign-in, disable sleep)
- [ ] Test Outlook COM automation on the Zenbook (test-email.ps1 — already verified)
- [ ] Acquire USB-C to Ethernet adapter if going the wired route
- [ ] Test ethernet jack activation (ask EIT if needed)
- [ ] Build server Steps 1–4 from claude-code-plan.md
- [ ] Begin pipeline validation on WuaS tars (logs received from Dr. Hollingsworth)

### Next week (March 30–April 5)
- [ ] Complete server Steps 5–7 from claude-code-plan.md
- [ ] Build the Zenbook polling script
- [ ] Test full round-trip: queue email → Zenbook sends → confirm delivery
- [ ] Heartbeat monitoring active
- [ ] Manual fallback script tested on your laptop
- [ ] Pipeline validation complete — all edge cases handled
- [ ] Landing page live as a fallback
- [ ] Email templates finalized
- [ ] Dr. Krohn's LMS announcement drafted and sent to her
- [ ] Send pre-feedback reminder via LMS (April 5–6)

### April 7 (launch day)
- [ ] Message Dr. Krohn to pull BST tars
- [ ] Receive tars, place in `data/bst/tars/`
- [ ] Run `scripts/process-batch.js bst`
- [ ] Run `scripts/generate-tokens.js` (if not already done)
- [ ] Run `scripts/queue-emails.js bst`
- [ ] Monitor Zenbook delivery in real time via /api/emails/stats
- [ ] Monitor student access via /api/events
- [ ] Have manual fallback script ready on your laptop just in case

### April 8+ (ongoing)
- [ ] Monitor uploads and regeneration requests
- [ ] Check heartbeat alerts daily
- [ ] Run nudge emails for students who haven't viewed feedback (after ~3 days)
- [ ] Repeat the cycle for subsequent assignments (confirm list with Dr. Krohn)

---

## Email Templates

Templates use `{assignment}` and `{link}` placeholders, replaced at queue time by `scripts/queue-emails.js`.

### Feedback Ready

```
Subject: Your {assignment} debugging feedback is ready

Hi,

Your debugging feedback for the {assignment} assignment is ready to view:

{link}

This link is private to you — please don't share it. The feedback walks
through your debugging process and suggests next steps for the issues
you encountered.

If you have questions about the feedback, contact gajavegs@rose-hulman.edu.
```

### Regeneration Ready

```
Subject: Your updated {assignment} feedback is ready

Hi,

Your regenerated debugging feedback for {assignment} is ready:

{link}

Same link as before — just refreshed with your latest data.
```

### Missing run.tar

```
Subject: Your {assignment} debugging feedback — action needed

Hi,

We tried to generate your debugging feedback for {assignment}, but
couldn't find a run.tar file in your submission. This file is created
automatically when you run tests with the logger enabled.

If you have your run.tar file locally, you can upload it directly at:

{link}

If you're not sure where to find it, it's in your assignment project
directory under the testSupport folder.
```

### Nudge (3 days post-launch)

```
Subject: Reminder — your {assignment} debugging feedback is available

Hi,

Just a reminder that your {assignment} debugging feedback is available
if you haven't had a chance to check it out yet:

{link}

It takes about 5 minutes to review and may help with upcoming
assignments.
```

---

## Security Notes

- Email queue contains student emails and feedback links. This is operational data, not research data. Store it in the same SQLite DB on the password-protected institutional server per the IRB application.
- The Zenbook stores nothing persistently. Emails pass through Outlook and appear in your Sent folder (this is fine — you're the PI, and the links alone don't reveal feedback content).
- Token-to-student mappings are destroyed after data cleaning as promised in the IRB application.
- The polling endpoint should require a shared secret (API key in the Zenbook's script config) so random clients can't pull the email queue. A simple `Authorization: Bearer <relay-secret>` header is sufficient.
- The landing page email-lookup endpoint should be rate-limited (5 requests per minute per IP) to prevent enumeration.
- The upload endpoint should validate file type and size (tar only, under 50MB) and rate-limit to 1 upload per hour per token.
- Uploaded tars are stored on the same institutional server as all other research data.
