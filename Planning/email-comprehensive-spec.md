# Feedback Email — Comprehensive Specification

> **Before implementing any changes from this document**, familiarize yourself with the current codebase. The feedback application, pipeline, and server may have had changes implemented that this spec doesn't account for. Read the existing code, understand what's already built, and identify any conflicts before writing new code. This spec describes the target design — adapt it to what exists rather than overwriting blindly.

## Purpose and Role in the System

The feedback email is a **transactional notification**. It tells the student their feedback exists, gives them just enough context to decide whether to click, and routes them to the summary report. It is not a persuasion tool, a tutorial, or a summary of findings.

The email competes for attention in a student inbox alongside Moodle submission confirmations, Gradescope notifications, professor announcements, and campus-wide emails. It must be recognized as course-related within 2 seconds of appearing in the inbox, and the entire body must be processable in under 30 seconds.

### Position in the Communication Chain

```
LMS Announcement (pre-deadline)
  → Sets expectations: "feedback is coming, commit run.tar"
  → Student mentally files: "I'll get something after BST"

Feedback Email (post-deadline, ~24 hours after)
  → Notification: "your feedback is ready"
  → Routes to the report via a single link

Summary Report (linked from email)
  → Triage surface: assessment cards for 10-second scan, drill columns for 3–5 min review
  → Routes to the feedback site via per-drill links

Feedback Site (linked from report)
  → Deep engagement: interactive drills, code replay, 10–15 min
```

The email's job is to bridge the LMS announcement (which set expectations) to the report (which delivers value). It is not the report. It is not the site. It is the notification that connects them.

---

## Conceptual Underpinnings

### Format Mimicry

The email is deliberately styled to match Moodle's automated notifications, which are the most common system emails Rose-Hulman students receive. This is not aesthetic imitation — it's a behavioral design choice.

Students have **trained muscle memory** for Moodle emails: see subject, parse course name, decide relevance, click or skip. By matching this format, the feedback email enters the same cognitive pipeline. The student doesn't need to figure out "what kind of email is this" — their brain categorizes it as "course notification" and processes it accordingly.

Specific elements borrowed from Moodle:
- **Breadcrumb at top** (`2526S CSSE230 -> Debugging Feedback -> Binary Search Tree`) — mirrors Moodle's `2526F CSSE313-01 -> Assignment -> CNN - Milestone 1`
- **Dashed-line separators** — Moodle wraps its body in `---------------------------------------------------------------------`
- **Single link with a leading phrase** — Moodle says "You can see it appended to your assignment submission:" then the URL. We say "You can view your feedback summary:" then the URL.
- **No greeting, no sign-off** — Moodle has neither
- **Plaintext only** — Moodle sends plaintext

### The Apathy Nudge (Transactional Framing)

The email does not try to convince the student to engage. It states facts: your feedback was processed, N patterns found, relevant to Exam 2. The student decides. This avoids **psychological reactance** — the tendency to resist when you feel someone is trying to manipulate you into action. A neutral notification is harder to rebel against than an enthusiastic pitch.

### Personalization Through Data, Not Tone

The email contains two personalized data points: pattern count and the nearest assessment. These are substantive — they come from the student's actual submission data and the course calendar. There is no superficial personalization (no "Hi [Name]", no "Great job submitting!"). The personalization is in the *content*, not the *greeting*.

### Single Link Design

The original design had two links (Quick Review / Full Feedback). This was removed because:
1. **Decision fatigue.** Two links forces the student to choose before clicking. Most will choose neither.
2. **Format violation.** Neither Moodle nor Gradescope present multiple action links. One link is the pattern.
3. **The report handles routing.** The report's visual hierarchy (assessment cards at top = quick scan, drill columns below = deep review) provides the same triage that two email links attempted — but in a richer medium where the student has already committed a click.

---

## Template Specifications

### Initial Notification

**When sent:** After the batch pipeline processes an assignment (typically the day after the deadline).

**Subject line format:**
```
CSSE 230 — {short_assignment_name} feedback available ({pattern_count} patterns, {nearest_assessment})
```

**Example:**
```
CSSE 230 — BST feedback available (3 patterns, Exam 2)
```

**Subject line rules:**
- Use the short assignment name (BST, not Binary Search Tree) to stay under 60 characters
- Pattern count is always included — it's the personalization signal
- Nearest assessment name is always included — it's the relevance signal
- If subject exceeds 60 characters, drop the assessment: `CSSE 230 — BST feedback available (3 patterns)`
- The prefix `CSSE 230 —` is constant across all emails for filtering/recognition

**Body:**
```
2526S CSSE230 -> Debugging Feedback -> {full_assignment_name}
---------------------------------------------------------------------
Your debugging feedback for '{full_assignment_name}' has been
processed. {pattern_count} patterns were identified, relevant to
{nearest_assessment} ({assessment_date}).

You can view your feedback summary:

{report_link}

This feedback is private to you and is not shared with course staff.
---------------------------------------------------------------------
```

**Field definitions:**
- `{full_assignment_name}` — Full name in single quotes, matching the course syllabus: `Binary Search Tree`, `StringHashSet`, etc.
- `{pattern_count}` — Integer. Number of debugging patterns identified for this student.
- `{nearest_assessment}` — Name of the highest-priority upcoming assessment these patterns map to.
- `{assessment_date}` — Date of that assessment, formatted as `Month Day` (e.g., `April 10`).
- `{report_link}` — Full URL to the student's report page. This is the token-authenticated URL: `https://feedback.csse.rose-hulman.edu/feedback?token=abc123`

**Character count:** Body is approximately 350–400 characters depending on field lengths. Well within single-screen display on mobile.

### Pre-Exam Nudge

**When sent:** 2–3 days before the nearest relevant assessment, only for students who have not viewed their report (no `page_view` event logged for their token).

**Subject:**
```
CSSE 230 — {short_name} feedback reminder ({nearest_assessment}, {assessment_date})
```

**Body:**
```
2526S CSSE230 -> Debugging Feedback -> {full_assignment_name}
---------------------------------------------------------------------
Your debugging feedback for '{full_assignment_name}' is still
available. {high_urgency_count} patterns were flagged as relevant
to {nearest_assessment} ({assessment_date}).

You can view your feedback summary:

{report_link}

---------------------------------------------------------------------
```

**Differences from initial notification:**
- "is still available" instead of "has been processed" — signals this is a follow-up
- "were flagged as relevant" instead of "were identified, relevant to" — slightly more direct
- No privacy line — they've already seen it in the first email
- Only sent to non-viewers — the system checks the `events` table for a `page_view` event associated with this token

### Regeneration Ready

**When sent:** After a student uploads a `run.tar` and the pipeline successfully reprocesses their feedback.

**Subject:**
```
CSSE 230 — Updated {short_name} feedback available
```

**Body:**
```
2526S CSSE230 -> Debugging Feedback -> {full_assignment_name}
---------------------------------------------------------------------
Your debugging feedback for '{full_assignment_name}' has been
regenerated with your latest data.

You can view your updated feedback summary:

{report_link}

---------------------------------------------------------------------
```

**Notes:**
- Same link as before (HMAC tokens are deterministic per student)
- No pattern count — the student already knows their situation from the upload flow
- "updated" in both subject and link label signals this is a refresh, not a first notification

### Missing run.tar

**When sent:** During the batch email queue, for students whose repos had no `run.tar`.

**Subject:**
```
CSSE 230 — {short_name} feedback: action needed
```

**Body:**
```
2526S CSSE230 -> Debugging Feedback -> {full_assignment_name}
---------------------------------------------------------------------
Your debugging feedback for '{full_assignment_name}' could not
be generated because no run.tar file was found in your
submission.

If you have your run.tar file, you can upload it to generate
feedback:

{upload_link}

---------------------------------------------------------------------
```

**Notes:**
- `{upload_link}` goes to the same token URL, which shows the upload UI when no `frontend.json` exists
- No tone of blame ("could not be generated because" — passive, system-focused)
- No explanation of what `run.tar` is — by this point, the LMS announcement already explained it

---

## Email Privacy and Account Usage

### How Sending Works

The PI's Outlook account (`gajavegs@rose-hulman.edu`) is used **solely for SMTP authentication** — it provides the credentials needed to send through Rose-Hulman's Exchange server. The PI does not compose, view, or have access to the emails that are delivered to students. The entire process is automated:

1. The server generates email content (recipient, subject, body) and stores it in the SQLite email queue
2. The Zenbook relay reads the queue via API and passes the data to Outlook COM
3. Outlook authenticates with the PI's credentials and delivers the email
4. The email is immediately deleted from the PI's account (see below) — no copy is retained anywhere accessible to the PI
5. The PI sees only delivery status metadata (sent/failed) reported back to the server, not email content or recipient-specific links

The PI cannot see which links were sent to which students through the email system. The token-to-student mapping exists in the server's SQLite database for operational purposes and is destroyed after data cleaning as specified in the IRB protocol.

### Sent Folder Suppression

Outlook COM objects have a `DeleteAfterSubmit` property. Setting this to `$true` before calling `Send()` prevents Outlook from saving a copy to Sent Items. The email is delivered normally to the recipient — no copy is retained in Sent Items, Deleted Items, or any other folder.

```powershell
$mail = $outlook.CreateItem(0)
$mail.To = $recipient
$mail.Subject = $subject
$mail.Body = $body
$mail.DeleteAfterSubmit = $true    # Suppresses all local copies
$mail.Send()
```

This is a **mandatory** property on every email sent by both the Zenbook polling script and the manual fallback script. It must never be omitted.

### Verification

After implementing, send a test email to yourself with `DeleteAfterSubmit = $true` and confirm:
1. The email arrives in the recipient's inbox normally
2. No copy appears in Sent Items
3. No copy appears in Deleted Items
4. No copy appears in any other Outlook folder (search for the subject line)

### Integration Points

`DeleteAfterSubmit = $true` must be set in both:
1. **Zenbook polling script** — every email sent in the relay loop
2. **Manual fallback script** (`manual-send.ps1`) — every email sent in the batch

Update the Zenbook polling script pseudocode in `system-plan-email-delivery.md` step 3b:

```
3. For each email:
   a. POST /api/emails/:id/sending    → claim it
   b. Create Outlook mail item
   c. Set To, Subject, Body
   d. Set DeleteAfterSubmit = true     ← MANDATORY
   e. Send via Outlook COM
   f. POST /api/emails/:id/sent       → confirm delivery
   g. On Outlook error:
      POST /api/emails/:id/failed     → release it
```

---

## Email Generation Pipeline

### How Emails Get Created

Emails are created as rows in the `email_queue` SQLite table by the batch script `scripts/queue-emails.js`. They are NOT generated at send time — the Zenbook relay just reads pre-built rows and sends them.

### Template Rendering

`scripts/queue-emails.js` contains the templates as string literals with placeholders. For each student:

1. Query the `tokens` table for the student's token, email, assignment
2. Query `pipeline_runs` for this student + assignment → determine if success, error, or missing
3. Look up the assessment config for this assignment to determine `nearest_assessment` and `assessment_date`
4. Read the pipeline output to get `pattern_count` and `high_urgency_count`
5. Select the appropriate template (initial, missing_tar)
6. Replace placeholders
7. Insert into `email_queue` with status `pending`

```javascript
// Pseudocode for queue-emails.js
const templates = {
  feedback_ready: {
    subject: 'CSSE 230 — {short_name} feedback available ({pattern_count} patterns, {nearest_assessment})',
    body: `2526S CSSE230 -> Debugging Feedback -> {full_name}
---------------------------------------------------------------------
Your debugging feedback for '{full_name}' has been
processed. {pattern_count} patterns were identified, relevant to
{nearest_assessment} ({assessment_date}).

You can view your feedback summary:

{link}

This feedback is private to you and is not shared with course staff.
---------------------------------------------------------------------`
  },
  // ... other templates
};

function renderTemplate(templateKey, vars) {
  let { subject, body } = templates[templateKey];
  for (const [key, value] of Object.entries(vars)) {
    subject = subject.replaceAll(`{${key}}`, value);
    body = body.replaceAll(`{${key}}`, value);
  }
  return { subject, body };
}
```

### Nudge Emails

Nudge emails are NOT created during the initial batch. They are created by a separate script (`scripts/queue-nudges.js`) run manually 2–3 days before the relevant assessment:

1. Query `events` table for tokens with a `page_view` event for this assignment
2. For all students WITHOUT a `page_view`, insert a nudge email into `email_queue`
3. Skip students who already have a nudge email queued or sent for this assignment

### Regeneration Emails

Regeneration emails are created inline by the server when a student uploads a `run.tar` and the pipeline succeeds:

1. Student uploads via `POST /api/upload?token=XXX`
2. Server runs pipeline
3. On success, server inserts a `regeneration_ready` email into `email_queue`
4. Zenbook picks it up on its next poll cycle

---

## Assessment Configuration

The email templates reference `{nearest_assessment}` and `{assessment_date}`. These come from a per-assignment config file that maps the assignment's concept groups to upcoming assessments.

**File:** `data/{assignment}/assessment-config.json`

```json
{
  "assignment": "Binary Search Tree",
  "short_name": "BST",
  "full_name": "Binary Search Tree",
  "assessments": [
    {
      "id": "exam_2",
      "name": "Exam 2",
      "date": "2026-04-10",
      "date_display": "April 10",
      "type": "exam",
      "concept_weights": {
        "bst_traversal": 0.12,
        "bst_insert_remove": 0.08,
        "tree_height_size": 0.08
      }
    },
    {
      "id": "hw5",
      "name": "HW5",
      "date": "2026-04-10",
      "date_display": "April 10",
      "type": "homework",
      "concept_weights": {
        "bst_insert_remove": 0.08
      }
    }
  ]
}
```

**Priority resolution for `nearest_assessment`:**
1. Pick the assessment with the earliest date
2. Among tied dates, pick the one with the highest type weight (exam > assignment > homework)
3. That's the assessment shown in the email subject and body

This config is written manually per assignment cycle — you create it once when you know what assessments are coming, based on the course calendar and syllabus.

---

## Spam and Deliverability Considerations

### Sender Identity and Authentication

The PI's Outlook account (`gajavegs@rose-hulman.edu`) provides SMTP authentication only. The account is used because Rose-Hulman's Exchange server requires authenticated sending — there is no unauthenticated relay or service account available (EIT confirmed SMTP client authentication cannot be provisioned separately). The PI's credentials authenticate the send; `DeleteAfterSubmit` ensures no copies are retained.

From the recipient's perspective, the email appears to come from `gajavegs@rose-hulman.edu`. This means:
- SPF passes (Outlook is an authorized sender for `@rose-hulman.edu`)
- DKIM is handled by Rose-Hulman's Exchange server
- The email is indistinguishable from any other `@rose-hulman.edu` email
- It will NOT be flagged as spam by Rose-Hulman's internal mail system

### Volume

~45 emails per assignment per batch. This is well under any rate limit concern. Even with nudges and regeneration emails, total volume per assignment cycle is under 100 emails.

### Student Recognition

The subject line prefix `CSSE 230 —` is consistent across all emails. Students can create an Outlook rule to highlight or folder these if they want. The Moodle-style breadcrumb inside the body reinforces course association.
