#!/usr/bin/env bash
# e2e-wuas-mac.sh — WaS end-to-end QA (local Mac side)
#
# Run after e2e-wuas-ubuntu.sh has regenerated reports on the Ubuntu server.
# Steps: rsync outputs → generate local token → start server → open report + feedback.
#
# Usage (from repo root):
#   bash Pipeline/scripts/e2e-wuas-mac.sh [test-student-id]
#
# Default test student: plant4040  (has still-failing tests — most interesting for QA)

STUDENT=${1:-plant4040}
ASSIGNMENT=wuas
DISPLAY_NAME="Warmup and Stretching"
UBUNTU_HOST=csse@feedback
LOCAL_URL=http://localhost:3000

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$REPO_ROOT/Frontend"

pass() { echo "  ✓  $*"; }
fail() { echo "  ✗  $*" >&2; FAILURES=$((FAILURES+1)); }
header() { echo ""; echo "── $* ──────────────────────────────────────────────────────────"; }

FAILURES=0

# ── A6. rsync outputs from Ubuntu ────────────────────────────────────────────

header "A6. rsync data/$ASSIGNMENT/ from Ubuntu"

rsync -av "$UBUNTU_HOST":~/230LoggerMonorepo/Frontend/data/"$ASSIGNMENT"/ \
  "$FRONTEND/data/$ASSIGNMENT"/
if [ $? -eq 0 ]; then
    pass "rsync complete"
else
    fail "rsync failed — is the Ubuntu server reachable as $UBUNTU_HOST?"
    exit 1
fi

# ── B1. Check local .env ──────────────────────────────────────────────────────

header "B1. Local .env checks"

cd "$FRONTEND"

if [ ! -f .env ]; then
    fail ".env not found in Frontend/"
    echo "     Create it with: BASE_URL=http://localhost:3000  DEV_BYPASS_AUTH=true  SECRET_KEY=<hex>"
    exit 1
fi

BASE_URL_LOCAL=$(grep -s BASE_URL .env | grep -v '^#' | cut -d= -f2)
if [ "$BASE_URL_LOCAL" = "$LOCAL_URL" ]; then
    pass "BASE_URL=$BASE_URL_LOCAL"
else
    fail "BASE_URL should be $LOCAL_URL for local QA (currently: $BASE_URL_LOCAL)"
fi

DEV_BYPASS=$(grep -s DEV_BYPASS_AUTH .env | grep -v '^#' | cut -d= -f2)
if [ "$DEV_BYPASS" = "true" ]; then
    pass "DEV_BYPASS_AUTH=true"
else
    fail "DEV_BYPASS_AUTH not set to true — RoseFire login will block local feedback pages"
fi

# ── B2. Start local server (background) ──────────────────────────────────────

header "B2. Start local server"

# Kill any existing server on port 3000
EXISTING_PID=$(lsof -ti tcp:3000 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo "     Killing existing process on port 3000 (pid $EXISTING_PID)"
    kill "$EXISTING_PID" 2>/dev/null || true
    sleep 1
fi

node server.js &
SERVER_PID=$!
echo "     Server started (pid $SERVER_PID)"
sleep 2

# Verify it's up
SERVER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$LOCAL_URL" 2>/dev/null || echo "000")
if [ "$SERVER_STATUS" != "000" ]; then
    pass "Server responding on $LOCAL_URL"
else
    fail "Server not responding on $LOCAL_URL"
fi

# ── B3. Generate local token ──────────────────────────────────────────────────

header "B3. Local token"

if [ ! -f "data/roster.dev.csv" ]; then
    echo "     Creating roster.dev.csv for $STUDENT"
    echo "$STUDENT,gajavegs@rose-hulman.edu" > data/roster.dev.csv
fi

node scripts/generate-tokens.js "$ASSIGNMENT" data/roster.dev.csv

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
    pass "Token: $TOKEN"
else
    fail "No token found for $STUDENT/$ASSIGNMENT"
    kill "$SERVER_PID" 2>/dev/null
    exit 1
fi

# ── B4. Open report ───────────────────────────────────────────────────────────

header "B4. Report PDF"

REPORT_URL="$LOCAL_URL/report?token=$TOKEN"
echo "     $REPORT_URL"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$REPORT_URL" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    pass "/report → 200"
else
    fail "/report → $HTTP_STATUS"
fi

echo ""
echo "     Opening in browser — verify:"
echo "     [ ] Assessment table shows Exam 2 (red bar), HW5, ET1, HW6, ET2 (blue bars)"
echo "     [ ] Drill cards present under at least one assessment"
echo "     [ ] Open drill links use $LOCAL_URL/feedback?token=<token>#drill-…"
echo "     [ ] Footer shows drill count and total time"
open "$REPORT_URL"

# ── B5. Open feedback site ────────────────────────────────────────────────────

header "B5. Feedback site"

FEEDBACK_URL="$LOCAL_URL/feedback?token=$TOKEN"
echo "     $FEEDBACK_URL"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FEEDBACK_URL" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    pass "/feedback → 200"
else
    fail "/feedback → $HTTP_STATUS"
fi

echo ""
echo "     Opening in browser — verify:"
echo "     [ ] Page loads (no white screen, no console errors)"
echo "     [ ] DEV_BYPASS_AUTH means no RoseFire login required"
echo "     [ ] Drill anchors (#drill-…) scroll to the correct section"
open "$FEEDBACK_URL"

# ── Summary ───────────────────────────────────────────────────────────────────

header "Summary"

echo "  Server running (pid $SERVER_PID) — Ctrl+C or kill $SERVER_PID when done"
echo ""
if [ "$FAILURES" -eq 0 ]; then
    echo "  All checks passed."
    echo ""
    echo "  To regenerate report after template edits:"
    echo "    rm data/$ASSIGNMENT/output/$STUDENT/report.json data/$ASSIGNMENT/output/$STUDENT/report.pdf"
    echo "    open \"$REPORT_URL\""
else
    echo "  $FAILURES check(s) failed — see ✗ lines above."
    kill "$SERVER_PID" 2>/dev/null
    exit 1
fi
