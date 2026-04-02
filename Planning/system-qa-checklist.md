# System QA Checklist

Comprehensive checklist covering all functionality before going live with BST feedback on April 7. Organized by system component. Each item should be tested with real or realistic data.

---

## 1. Pipeline

### 1.1 Tar Processing
- [ ] Pipeline processes a valid WuaS `run.tar` without errors
- [ ] Pipeline processes a valid BST `run.tar` without errors
- [ ] Pipeline handles a student who never ran tests (empty or minimal tar)
- [ ] Pipeline handles a student who ran tests hundreds of times (large tar)
- [ ] Pipeline handles Windows-generated tars (path separator differences)
- [ ] Pipeline handles Mac-generated tars
- [ ] Pipeline handles a tar with modified/missing `testSupport` files
- [ ] Pipeline handles a corrupted or truncated tar gracefully (error, not crash)
- [ ] Pipeline produces valid `frontend.json` for each successful run
- [ ] Pipeline produces valid `report.json` for each successful run
- [ ] `@ExtendWith(LoggingExtension.class)` is confirmed on the manual testing class in the BST repo

### 1.2 Report Data Generation
- [ ] Report generator reads `frontend.json` and `assessment-config.json` correctly
- [ ] Patterns are mapped to the correct assessments based on concept tags
- [ ] Patterns that map to multiple assessments appear in all relevant columns
- [ ] Overlap percentages are calculated correctly (sum of concept weights)
- [ ] Overlap percentages are capped at 50% for display
- [ ] Drills are sorted by weight (highest first) within each column
- [ ] `total_unique_drills` correctly deduplicates across columns
- [ ] `total_time` reflects unique drill time, not summed across columns
- [ ] Test method names in `report.json` match actual JUnit test names
- [ ] Report generator handles a student with zero patterns (edge case)
- [ ] Report generator handles a student whose patterns don't map to any assessment (missing config)

### 1.3 Batch Processing Script
- [ ] `scripts/process-batch.js bst` processes all tars in `data/bst/tars/`
- [ ] Each student gets a `pipeline_runs` record with correct status
- [ ] Failed runs have meaningful `error_msg` values
- [ ] Timing information is logged
- [ ] Summary output shows correct counts (N succeeded, M failed)
- [ ] Script is idempotent — running twice doesn't create duplicate records

---

## 2. Server

### 2.1 Token System
- [ ] `scripts/generate-tokens.js` reads `data/roster.csv` correctly
- [ ] Tokens are deterministic (same student ID + secret = same token every time)
- [ ] Tokens are inserted into SQLite (upsert on conflict)
- [ ] No token collisions across the roster
- [ ] Token lookup by token string returns correct student_id
- [ ] Token lookup by email returns correct token (for landing page)
- [ ] Invalid token returns appropriate error (not a crash)

### 2.2 Landing Page
- [ ] `GET /` serves `public/landing.html`
- [ ] Email form accepts `@rose-hulman.edu` addresses
- [ ] Valid email → redirects to `/feedback?token=XXX`
- [ ] Invalid email → shows "no feedback for that email" message
- [ ] Non-Rose-Hulman email → shows appropriate message
- [ ] Rate limiting works (6th request in a minute is rejected)
- [ ] Rate limiting resets after the window passes

### 2.3 Feedback Page
- [ ] `GET /feedback?token=XXX` with valid token → serves the app
- [ ] `GET /feedback?token=XXX` with invalid token → shows friendly error
- [ ] `GET /feedback?token=XXX` with expired/malformed token → shows friendly error
- [ ] `GET /api/data?token=XXX` returns correct `frontend.json` for that student
- [ ] `GET /api/data?token=XXX` returns correct `report.json` for that student

### 2.4 Null Feedback Cases
- [ ] Student with no `run.tar` and no `frontend.json` → sees upload prompt with `allowUpload: true`
- [ ] Student with `run.tar` but pipeline failed → sees processing error message
- [ ] Student with pipeline currently running → sees "generating, check back" message
- [ ] Upload prompt UI is functional (file picker, submit button)

### 2.5 File Upload and Regeneration
- [ ] `POST /api/upload?token=XXX` accepts a valid `.tar` file
- [ ] Upload rejects non-tar files (returns error, not crash)
- [ ] Upload rejects files over 50MB
- [ ] Upload rate limit works (second upload within 1 hour is rejected)
- [ ] Uploaded tar is saved to correct path: `data/{assignment}/tars/{student_id}/run.tar`
- [ ] Pipeline runs on uploaded tar and produces `frontend.json`
- [ ] Report generator runs and produces `report.json`
- [ ] `pipeline_runs` record is created with `source: 'upload'`
- [ ] `regeneration_ready` email is queued in `email_queue`
- [ ] Student can view their regenerated feedback immediately (or after refresh)

### 2.6 Interaction Event Logging
- [ ] `POST /api/events` accepts a valid event batch
- [ ] Events are inserted into the `events` table with correct token and timestamp
- [ ] Invalid token in event POST is rejected (not logged)
- [ ] Frontend beacon module flushes events every 30 seconds
- [ ] Frontend beacon fires on page unload (`navigator.sendBeacon`)
- [ ] Event types logged include: `page_view`, `expand_episode`, `click_timeline`, `time_spent`
- [ ] Events can be queried later for nudge email targeting (students without `page_view`)

### 2.7 Static File Serving
- [ ] `GET /app` serves the frontend app's `index.html`
- [ ] `GET /app/main.js` (or equivalent) serves static assets from `dist/`
- [ ] CSS, JS, and other assets load correctly
- [ ] No CORS errors in browser console

### 2.8 Health and Admin
- [ ] `GET /api/health` returns `{ status: "ok", students: N, assignment: "bst" }`
- [ ] Health endpoint is accessible without authentication
- [ ] Server starts cleanly with `node server.js`
- [ ] Server restarts cleanly after a crash (pm2 or systemd configured)
- [ ] SQLite database is created automatically on first run
- [ ] `.env` configuration is loaded correctly

---

## 3. Email System

### 3.1 Email Queue Generation
- [ ] `scripts/queue-emails.js bst` creates `feedback_ready` emails for students with successful pipelines
- [ ] `scripts/queue-emails.js bst` creates `missing_tar` emails for students with no tar
- [ ] Email subject lines are correctly templated with assignment name, pattern count, assessment
- [ ] Email bodies contain the correct Moodle-style breadcrumb
- [ ] Email bodies contain the correct token-authenticated link
- [ ] Email bodies contain the privacy line
- [ ] Subject line is under 60 characters (or as close as possible)
- [ ] No duplicate emails are created for the same student + assignment + type

### 3.2 Email Templates
- [ ] Initial notification template renders correctly with all fields
- [ ] Nudge template renders correctly
- [ ] Regeneration ready template renders correctly
- [ ] Missing run.tar template renders correctly with upload link
- [ ] Breadcrumb format matches Moodle's format exactly
- [ ] Dashed line separators are present and correct
- [ ] All links in email bodies are valid and lead to the correct pages

### 3.3 Nudge Email Targeting
- [ ] `scripts/queue-nudges.js` correctly identifies students without a `page_view` event
- [ ] Students who HAVE viewed their feedback are NOT sent a nudge
- [ ] Students who already have a nudge queued or sent are NOT sent a duplicate
- [ ] Nudge email template uses "still available" wording, not "has been processed"

### 3.4 Email Relay API
- [ ] `GET /api/emails/pending` returns pending emails (max 5)
- [ ] `GET /api/emails/pending` returns empty array when no pending emails
- [ ] `POST /api/emails/:id/sending` marks email as `sending`
- [ ] `POST /api/emails/:id/sent` marks email as `sent` with timestamp
- [ ] `POST /api/emails/:id/failed` marks email as `failed`, increments attempts
- [ ] All relay endpoints require `Authorization: Bearer <RELAY_SECRET>`
- [ ] Unauthorized requests to relay endpoints return 401
- [ ] `GET /api/emails/stats` returns correct counts per status
- [ ] `GET /api/relay/heartbeat` updates `relay_status.last_heartbeat`

### 3.5 Retry and Dead Letter
- [ ] Emails stuck in `sending` for >5 minutes are returned to `pending`
- [ ] Emails with 3+ failed attempts are moved to `dead` status
- [ ] Dead emails are visible in `/api/emails/stats`
- [ ] Heartbeat gap >5 minutes triggers a warning log

### 3.6 DeleteAfterSubmit
- [ ] Test email sent with `DeleteAfterSubmit = $true` arrives in recipient inbox
- [ ] No copy appears in Sent Items
- [ ] No copy appears in Deleted Items
- [ ] No copy appears in any other Outlook folder (search by subject)
- [ ] `DeleteAfterSubmit` is set on EVERY email in the Zenbook polling script
- [ ] `DeleteAfterSubmit` is set on EVERY email in the manual fallback script

---

## 4. Zenbook Email Relay

### 4.1 Setup
- [ ] Zenbook powered on and fully updated (Windows Update complete)
- [ ] Outlook signed in with `gajavegs@rose-hulman.edu`
- [ ] Test email sent manually from Zenbook via `test-email.ps1`
- [ ] Sleep/hibernate disabled in power settings
- [ ] Windows auto-updates paused for April 6–10
- [ ] Power adapter connected
- [ ] Network connected (ethernet preferred, eduroam fallback)

### 4.2 Polling Script
- [ ] Script starts and connects to server successfully
- [ ] Script sends heartbeat on each cycle
- [ ] Script picks up a pending email from the queue
- [ ] Script claims the email (`POST /sending`)
- [ ] Script sends via Outlook COM with `DeleteAfterSubmit = $true`
- [ ] Script confirms delivery (`POST /sent`)
- [ ] Email arrives in recipient inbox
- [ ] No copy in sender's Sent Items
- [ ] Script handles Outlook COM errors gracefully (`POST /failed`)
- [ ] Script continues polling after a failed send
- [ ] Script handles network disconnection (logs error, retries next cycle)
- [ ] Script auto-starts on boot (Startup folder or Scheduled Task)

### 4.3 Full Round-Trip
- [ ] Queue an email on the server → Zenbook picks it up → email arrives in inbox → server shows `sent` status
- [ ] Time from queue to delivery is under 30 seconds
- [ ] Queue 5 emails simultaneously → all 5 are sent without duplicates
- [ ] Disconnect Zenbook from network → emails queue on server → reconnect → emails send successfully

### 4.4 Fallback: Manual Send from Laptop
- [ ] `manual-send.ps1` connects to server and pulls pending emails
- [ ] Script sends emails via laptop's Outlook
- [ ] Script reports delivery status back to server
- [ ] `DeleteAfterSubmit` is set on every email
- [ ] Script handles errors gracefully

---

## 5. Summary Report

### 5.1 Layout and Content
- [ ] Header shows assignment name and framing sentence
- [ ] No test pass rate shown in header (removed per design decision)
- [ ] Assessment cards appear at the top, ordered by priority (exam first)
- [ ] Each assessment card shows: name, date, proportion bar, overlap percentage, drill count, total time
- [ ] Proportion bar max visual width corresponds to ~50%
- [ ] Overlap label uses "overlaps with your practice drills" (not "weak areas")
- [ ] Drill columns appear below the cards, grouped by assessment
- [ ] Column headers show assessment name and date
- [ ] Each drill card shows: pattern name, test method names, weight percentage, time estimate, drill link
- [ ] Test names are actual JUnit method names students would recognize
- [ ] Drills that impact multiple assessments appear in each relevant column
- [ ] Footer shows deduplicated drill count and total time
- [ ] Footer includes "All drills are optional"
- [ ] Footer includes link to full feedback site
- [ ] Footer includes privacy statement and contact email

### 5.2 Edge Cases
- [ ] Single assessment: full-width card and column, no empty second column
- [ ] Many patterns (>5 per column): lower-priority ones are collapsed
- [ ] Zero patterns: shows "No debugging patterns identified" message
- [ ] Missing assessment config: drills shown without percentage weights, no assessment cards
- [ ] All patterns map to a past assessment: note suggests relevance to future work

### 5.3 Entry Points
- [ ] Arriving from email link: report loads with correct student data
- [ ] Arriving from landing page: framing sentence provides sufficient context
- [ ] Arriving from regeneration: updated data is shown (not stale cached version)

### 5.4 Drill Links
- [ ] Each "Open drill →" link navigates to the correct drill on the feedback site
- [ ] Drill link includes the token for authentication
- [ ] Drill link anchors to the specific section (e.g., `#drill-traversal`)
- [ ] "Open full feedback site →" footer link goes to the overview page

### 5.5 Responsiveness
- [ ] Two-column layout on desktop (>600px width)
- [ ] Single-column stacked layout on mobile (<600px width)
- [ ] Assessment cards stack vertically on mobile
- [ ] No horizontal scrolling on any device
- [ ] Text is readable without zooming on mobile

---

## 6. Assessment Configuration

- [ ] `data/bst/assessment-config.json` exists with correct structure
- [ ] Assessment dates match the course calendar
- [ ] Concept keys in config match concept tags produced by the pipeline
- [ ] Concept weights are reasonable estimates (not all zeros, not all 100%)
- [ ] At least one assessment is in the future relative to the feedback date

---

## 7. End-to-End Flows

### 7.1 Happy Path
- [ ] Student submits BST with `run.tar` → Dr. Krohn sends tars → you process batch → queue emails → Zenbook sends → student clicks email → sees report → clicks drill → does drill on feedback site → interaction events logged

### 7.2 Missing run.tar Path
- [ ] Student submits BST without `run.tar` → batch processing notes missing tar → `missing_tar` email sent → student clicks link → sees upload prompt → uploads `run.tar` → pipeline runs → `regeneration_ready` email sent → student clicks → sees report

### 7.3 Landing Page Path
- [ ] Dr. Krohn posts LMS announcement with server URL → student visits → enters email → redirected to report → views feedback

### 7.4 Nudge Path
- [ ] 3 days after feedback goes live → run nudge script → emails sent only to non-viewers → student clicks → sees report

### 7.5 Zenbook Failure Path
- [ ] Zenbook goes offline → emails queue on server → heartbeat alert fires → you run manual-send.ps1 from laptop → emails sent → status updated on server

---

## 8. Security and Privacy

- [ ] Invalid tokens cannot access any student data
- [ ] Landing page rate limiting prevents email enumeration
- [ ] Upload endpoint rate limiting prevents abuse
- [ ] Relay API endpoints reject requests without `RELAY_SECRET`
- [ ] `DeleteAfterSubmit` is confirmed on all email sending paths
- [ ] No student feedback links are visible in Sent Items, Deleted Items, or any Outlook folder
- [ ] SQLite database is on the password-protected institutional server
- [ ] Server is accessible only on campus network or VPN
- [ ] HTTPS certificate is installed and valid (pending Darryl's response)

---

## 9. Operational Readiness

- [ ] Server runs via pm2 or systemd with auto-restart
- [ ] Zenbook is plugged in, sleep disabled, script auto-starts on boot
- [ ] Roster CSV is populated with all students
- [ ] Assessment config is written for BST → Exam 2 / HW5 mapping
- [ ] Manual fallback script is tested and ready on your laptop
- [ ] LMS announcement is drafted and sent to Dr. Krohn
- [ ] You know how to: check email stats, check event logs, re-run a single student's pipeline, queue a nudge batch, check heartbeat status
- [ ] Responsible Conduct of Research course is completed (legal requirement)
- [ ] Daniel Morris has been contacted about second consent opportunity
