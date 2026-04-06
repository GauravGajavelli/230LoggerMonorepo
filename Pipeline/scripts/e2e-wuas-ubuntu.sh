#!/usr/bin/env bash
# e2e-wuas-ubuntu.sh — WaS end-to-end test (Ubuntu server side)
#
# Default (rerun path): regenerate reports from existing frontend.json — no LLM calls.
# With --fresh:         clear LLM cache + student output, re-run pipeline for one student.
#
# Usage (from repo root):
#   bash Pipeline/scripts/e2e-wuas-ubuntu.sh [--fresh] [test-student-id]
#
# Default test student: plant4040  (has still-failing tests — most interesting for QA)

FRESH=0
STUDENT=""

for arg in "$@"; do
    if [ "$arg" = "--fresh" ]; then
        FRESH=1
    else
        STUDENT="$arg"
    fi
done

STUDENT=${STUDENT:-plant4040}
ASSIGNMENT=wuas
DISPLAY_NAME="Warmup and Stretching"
PROD_URL=https://feedback.csse.rose-hulman.edu
DEV_EMAIL=gajavegs@rose-hulman.edu

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$REPO_ROOT/Frontend"
LLM_CACHE="$REPO_ROOT/Pipeline/cache/llm"

pass() { echo "  ✓  $*"; }
fail() { echo "  ✗  $*" >&2; FAILURES=$((FAILURES+1)); }
header() { echo ""; echo "── $* ──────────────────────────────────────────────────────────"; }

FAILURES=0

cd "$FRONTEND"

# ── A5. Pipeline / regenerate ─────────────────────────────────────────────────

if [ "$FRESH" -eq 1 ]; then
    header "A5. Fresh run — clearing cache + output, re-running pipeline"

    echo "  Clearing LLM cache…"
    rm -rf "$LLM_CACHE"/*
    echo "  Clearing output for $STUDENT…"
    rm -rf "data/$ASSIGNMENT/output/$STUDENT"

    node scripts/process-batch.js "$ASSIGNMENT" "$DISPLAY_NAME"
    if [ $? -eq 0 ]; then
        pass "process-batch.js completed"
    else
        fail "process-batch.js failed"
        exit 1
    fi
else
    header "A5. Regenerate reports (rerun path — skips LLM)"

    if [ ! -f "data/$ASSIGNMENT/output/$STUDENT/frontend.json" ]; then
        fail "No frontend.json for $STUDENT — run process-batch.js first, or use --fresh"
        exit 1
    fi

    node scripts/regenerate-reports.js "$ASSIGNMENT"
    if [ $? -eq 0 ]; then
        pass "regenerate-reports.js completed"
    else
        fail "regenerate-reports.js failed"
    fi
fi

if [ -f "data/$ASSIGNMENT/output/$STUDENT/report.pdf" ]; then
    SIZE=$(wc -c < "data/$ASSIGNMENT/output/$STUDENT/report.pdf")
    if [ "$SIZE" -gt 30000 ]; then
        pass "report.pdf present (${SIZE} bytes)"
    else
        fail "report.pdf suspiciously small (${SIZE} bytes — may be blank)"
    fi
else
    fail "report.pdf not generated for $STUDENT"
fi

# ── C1. Pre-flight ────────────────────────────────────────────────────────────

header "C1. Pre-flight checks"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/health" 2>/dev/null; echo)
HTTP_STATUS=$(echo "$HTTP_STATUS" | tr -d '[:space:]')
if [ "$HTTP_STATUS" = "200" ]; then
    pass "Server reachable ($PROD_URL/api/health → 200)"
else
    fail "Server not reachable ($PROD_URL/api/health → ${HTTP_STATUS:-000}) — is node server.js running?"
fi

RELAY_ROW=$(node --input-type=module << 'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT relay_ip, relay_port, last_heartbeat FROM relay_status").get();
db.close();
if (row) { process.stdout.write(JSON.stringify(row)); } else { process.stdout.write(''); }
EOF
)
if [ -n "$RELAY_ROW" ]; then
    pass "Relay registered: $RELAY_ROW"
else
    fail "No relay registered — Zenbook not connected"
fi

DEV_REDIRECT=$(grep -s EMAIL_DEV_REDIRECT .env | cut -d= -f2)
if [ -n "$DEV_REDIRECT" ]; then
    pass "EMAIL_DEV_REDIRECT=$DEV_REDIRECT"
else
    fail "EMAIL_DEV_REDIRECT not set in .env — emails will go to real students"
fi

# ── C2. Token + report link ───────────────────────────────────────────────────

header "C2. Report link"

TOKEN=$(node --input-type=module << EOF
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT token FROM tokens WHERE student_id=? AND assignment=?").get('$STUDENT', '$ASSIGNMENT');
db.close();
process.stdout.write(row?.token ?? '');
EOF
)

if [ -n "$TOKEN" ]; then
    pass "Token found: $TOKEN"
    echo "     Report:   $PROD_URL/report?token=$TOKEN"
    echo "     Feedback: $PROD_URL/feedback?token=$TOKEN"
else
    fail "No token for $STUDENT/$ASSIGNMENT — run generate-tokens.js first"
fi

# ── C3. HTTP checks ───────────────────────────────────────────────────────────

header "C3. HTTP check — report and feedback endpoints"

if [ -n "$TOKEN" ]; then
    REPORT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/report?token=$TOKEN" 2>/dev/null; echo)
    REPORT_STATUS=$(echo "$REPORT_STATUS" | tr -d '[:space:]')
    if [ "$REPORT_STATUS" = "200" ]; then
        pass "/report?token=… → 200"
    else
        fail "/report?token=… → ${REPORT_STATUS:-000}"
    fi

    FEEDBACK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/feedback?token=$TOKEN" 2>/dev/null; echo)
    FEEDBACK_STATUS=$(echo "$FEEDBACK_STATUS" | tr -d '[:space:]')
    if [ "$FEEDBACK_STATUS" = "200" ]; then
        pass "/feedback?token=… → 200"
    else
        fail "/feedback?token=… → ${FEEDBACK_STATUS:-000}"
    fi
else
    fail "Skipped — no token"
fi

# ── C4. Queue test email ──────────────────────────────────────────────────────

header "C4. Queue email (dev redirect → $DEV_EMAIL)"

node --input-type=module << EOF
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
db.prepare("DELETE FROM email_queue WHERE assignment=? AND token IN (SELECT token FROM tokens WHERE student_id=? AND assignment=?)").run('$ASSIGNMENT', '$STUDENT', '$ASSIGNMENT');
db.close();
EOF

node scripts/queue-emails.js "$ASSIGNMENT" "$DISPLAY_NAME"
if [ $? -eq 0 ]; then
    pass "queue-emails.js completed"
else
    fail "queue-emails.js failed"
fi

EMAIL_ROW=$(node --input-type=module << EOF
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT eq.subject, eq.body FROM email_queue eq JOIN tokens t ON eq.token=t.token WHERE eq.assignment=? AND t.student_id=? ORDER BY eq.id DESC LIMIT 1").get('$ASSIGNMENT', '$STUDENT');
db.close();
if (row) { process.stdout.write(JSON.stringify(row)); } else { process.stdout.write(''); }
EOF
)

if [ -n "$EMAIL_ROW" ]; then
    SUBJECT=$(echo "$EMAIL_ROW" | node --input-type=module -e "
process.stdin.setEncoding('utf8');
let d=''; process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{ try { console.log(JSON.parse(d).subject); } catch(e) { console.log('parse error'); } });
")
    pass "Email queued — Subject: $SUBJECT"
    echo ""
    echo "Email body preview:"
    echo "$EMAIL_ROW" | node --input-type=module -e "
process.stdin.setEncoding('utf8');
let d=''; process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{ try { const b=JSON.parse(d).body; console.log(b.slice(0,600)+'…'); } catch(e) {} });
"
else
    fail "No email queued for $STUDENT/$ASSIGNMENT"
fi

# ── C5. Confirm delivery ──────────────────────────────────────────────────────

header "C5. Delivery status (polling up to 15s)"

DELIVERED=0
for i in 1 2 3; do
    sleep 5
    STATUS=$(node --input-type=module << EOF
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('better-sqlite3')('db/feedback.db');
const row = db.prepare("SELECT eq.status, eq.sent_at, eq.error_msg FROM email_queue eq JOIN tokens t ON eq.token=t.token WHERE eq.assignment=? AND t.student_id=? ORDER BY eq.id DESC LIMIT 1").get('$ASSIGNMENT', '$STUDENT');
db.close();
process.stdout.write(row ? JSON.stringify(row) : '');
EOF
)
    SENT=$(echo "$STATUS" | grep -o '"status":"sent"' || true)
    if [ -n "$SENT" ]; then
        pass "Email delivered: $STATUS"
        DELIVERED=1
        break
    fi
    echo "     (${i}0s) still pending…"
done

if [ "$DELIVERED" -eq 0 ]; then
    fail "Email not delivered after 15s — check relay registration (C1)"
    echo "     Current status: $STATUS"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

header "Summary"

if [ "$FAILURES" -eq 0 ]; then
    echo "  All checks passed."
    echo ""
    echo "Next: check $DEV_EMAIL inbox for subject prefixed '[DEV → $DEV_EMAIL]'"
    echo "      Report link in email should open PDF inline."
    echo "      Drill 'Open drill' links should resolve to $PROD_URL/feedback?token=…#drill-…"
    echo ""
    echo "To pull outputs to Mac for local QA:"
    echo "  rsync -av csse@feedback:~/230LoggerMonorepo/Frontend/data/$ASSIGNMENT/ \\"
    echo "    /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo/Frontend/data/$ASSIGNMENT/"
else
    echo "  $FAILURES check(s) failed — see ✗ lines above."
    exit 1
fi
