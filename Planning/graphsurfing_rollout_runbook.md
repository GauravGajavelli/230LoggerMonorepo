# GraphSurfing Rollout — Server Runbook

A phased sequence for rolling out the GraphSurfing feedback batch to the production
server. **No emails leave the server before Phase J.** Phases A–H produce all
artifacts (frontend.json, tokens, PDFs) without touching the email queue; Phase I
queues to a dev address only; Phase K is the actual real send.

Cross-references:
- Conceptual context: `Planning/graphsurfing_kickoff.md`
- Canonical how-to: `Planning/assignment_context_protocol.md` (Phase 0 staging,
  dress rehearsal, real-send templates)
- Configs: `Pipeline/assignments/graphsurfing*.json`
- Recovered tar zip: `Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip`
  (NOT the malformed `-19May.zip` — see Phase B)

Server cwd is `/home/csse/230LoggerMonorepo` unless noted. DB is at
`Frontend/db/feedback.db`. pm2 process is `feedback`.

---

## Phase A — Snapshot before touching anything

```bash
# Stop the relay so the SQLite file is quiescent (avoids WAL/SHM split during copy)
pm2 stop feedback

# Backup DB + .env
DATE=$(date +%Y%m%d-%H%M)
cp Frontend/db/feedback.db    Frontend/db/feedback.db.pre-graphsurfing-${DATE}.bak
cp Frontend/db/feedback.db-wal Frontend/db/feedback.db-wal.pre-graphsurfing-${DATE}.bak 2>/dev/null || true
cp Frontend/db/feedback.db-shm Frontend/db/feedback.db-shm.pre-graphsurfing-${DATE}.bak 2>/dev/null || true
cp Frontend/.env              Frontend/.env.pre-graphsurfing-${DATE}.bak

pm2 start feedback
```

**Gate:** `ls -lh Frontend/db/feedback.db.pre-graphsurfing-${DATE}.bak` is non-empty
AND `pm2 list` shows `feedback` online.

---

## Phase B — Bring code + tars to the server

From your **local** machine first, commit the configs and the .md move:

```bash
# Local
cd /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo
git status   # confirm the 5+ new/moved files
git add Pipeline/assignments/graphsurfing.json \
        Pipeline/assignments/graphsurfing_test_categories.json \
        Pipeline/assignments/graphsurfing_drill_questions.json \
        Pipeline/assignments/graphsurfing_assessment_config.json \
        Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md \
        "Pipeline/testInputs/csse230/Exams/Final Exam/Final-202320-graph.md"
git commit -m "GraphSurfing pipeline configs: Final-Exam-targeted feedback"
git push
```

Transfer the recovered tar zip out-of-band (don't commit a ~2.8 MB binary):

```bash
# Local
scp Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip \
    <user>@<server>:/home/csse/230LoggerMonorepo/Pipeline/testInputs/studentTars/
```

On the **server**:

```bash
git pull
git log -3 --oneline
ls Pipeline/assignments/graphsurfing*.json
ls Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md
ls "Pipeline/testInputs/csse230/Exams/Final Exam/Final-202320-graph.md"
ls -lh Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip
mvn -f Pipeline/pom.xml package -q -DskipTests
ls -lt Pipeline/target/csse230-feedback.jar
```

**Gate:** 4 configs present, both .md files at new paths, recovered zip present,
JAR newer than `Pipeline/src/main/java/`.

**Why `-recovered.zip` and not the original:** the 5/19 zip downloaded from the
source tool was malformed — its central directory only indexes a single `diffs`
status file, leaving the ~2.7 MB of tar payload orphaned at the start. `zip -FF`
rebuilt the central directory locally. The recovered version contains 22 real
non-empty student tars + 8 `_Error.txt` placeholders for students whose tars
couldn't be downloaded. The Phase 0 staging script's `find -name run-*.tar`
pattern picks up the 22 real tars and skips the error placeholders.

---

## Phase C — Lock down email sending BEFORE any pipeline work

```bash
# Frontend/.env should have:
#   HOLD_EMAILS=true
#   EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu
nano Frontend/.env
pm2 restart feedback   # server.js re-reads .env per relay-drain tick, but explicit restart is safer

# Confirm zero pending email_queue rows for graphsurfing
sqlite3 Frontend/db/feedback.db "SELECT status, COUNT(*) FROM email_queue WHERE assignment='graphsurfing' GROUP BY status;"
```

**Gate:** the query returns nothing (no rows for graphsurfing yet) AND
`grep -E 'HOLD_EMAILS|EMAIL_DEV_REDIRECT' Frontend/.env` shows both set.

Belt and suspenders: `HOLD_EMAILS=true` stops the relay even if rows exist;
`EMAIL_DEV_REDIRECT` bakes the dev address into any rows that do appear, so even
an accidental flip can't send to real students.

---

## Phase D — Validate configs (no DB writes)

```bash
cd Frontend
node scripts/validate-assignment-config.js graphsurfing
cd ..
```

**Gate:** "Passed with 1 warning(s)" — the warning should be exactly
`neighbor_sets` (intentionally left for LLM-synthesis fallback because it's only
0.01 weight). If you see additional warnings or any errors, stop and re-check
the configs.

---

## Phase E — Stage tars (writes filesystem only, no DB)

```bash
cd Frontend
rm -rf data/graphsurfing/output data/graphsurfing/tars
mkdir -p data/graphsurfing/tars
unzip -o ../Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip -d /tmp/graphsurfing-tars

while IFS=, read -r COL1 EMAIL; do
  [ "$COL1" = "student_id" ] && continue
  COL1="${COL1//$'\r'/}"; EMAIL="${EMAIL//$'\r'/}"
  SID="${EMAIL%@*}"
  TAR=""
  for CANDIDATE in "$COL1" "${COL1#rhit-}" "${COL1%-rhit}" "$SID"; do
    [ -z "$CANDIDATE" ] && continue
    T=$(find /tmp/graphsurfing-tars -maxdepth 2 -name "run-${CANDIDATE}.tar" 2>/dev/null | head -1)
    if [ -n "$T" ] && [ -s "$T" ]; then TAR="$T"; break; fi
  done
  if [ -z "$TAR" ]; then
    echo "  [no-tar] ${SID} (gh:${COL1}) — will land in missing_tar email path"
    continue
  fi
  mkdir -p "data/graphsurfing/tars/${SID}"
  cp "$TAR" "data/graphsurfing/tars/${SID}/run.tar"
done < data/roster.csv

ls data/graphsurfing/tars/ | wc -l
cd ..
```

**Gate:** the `[no-tar]` echoes match the 8 errored students from the recovered
zip (`nirdeshadusumilli2007`, `plant4040`, `rhit-beloremd`, `rhit-greenlrm-1`,
`rhit-mccordca`, `rhit-millern`, `rhit-neawedba`, `rhit-riedliso`) plus any
roster members not in the zip at all. The student-dir count should be ~22.

---

## Phase F — Confirm process-batch will use basic-fallback

Skipping rerun (no `RERUN_DEPS_DIR`) and passing `--allow-basic-fallback` to
prepare. Verify the script supports this:

```bash
grep -n -E 'allow-basic-fallback|RERUN_DEPS_DIR|--no-code' Frontend/scripts/process-batch.js | head -20
```

If `process-batch.js` already conditionally adds `--allow-basic-fallback` when
`RERUN_DEPS_DIR` is unset, you're good — just don't set that env var. If it
doesn't, either:

- (Simpler) Temporarily edit `process-batch.js` to append the flag to its
  prepare-step invocation, or
- (Cleaner) Run prepare manually per-student

Confirm with a one-student dry run first:

```bash
# Pick one student you trust (yourself: gajavegs)
java -jar Pipeline/target/csse230-feedback.jar ingest \
  -i Frontend/data/graphsurfing/tars/gajavegs \
  -o Pipeline/output/gajavegs-graphsurfing-test

java -jar Pipeline/target/csse230-feedback.jar prepare \
  -i Pipeline/output/gajavegs-graphsurfing-test \
  -o /tmp/gajavegs-graphsurfing-test.json \
  --assignment-name "Graph Surfing" \
  --student-id "gajavegs" \
  --cache-dir Pipeline/cache/llm \
  --allow-basic-fallback

jq '.feedback | length, [.feedback[].pattern_name]' /tmp/gajavegs-graphsurfing-test.json
jq '.drills | length, [.drills[].id]' /tmp/gajavegs-graphsurfing-test.json
jq '.courseAppearances | length' /tmp/gajavegs-graphsurfing-test.json
```

**Gate:** feedback array non-empty (≤5 items, per the kickoff's Phase 1 cap),
drill IDs include the `final-numDirectedTriangles-*` /
`final-countReachableWithinKHops-*` / `final-isStronglyConnected-*` /
`final2023-findUnknownBalloons-*` ones for relevant categories,
courseAppearances reference Final materials.

---

## Phase G — Full batch (writes pipeline_runs rows, no email_queue)

```bash
cd Frontend
node scripts/process-batch.js graphsurfing "Graph Surfing" 2>&1 | tee data/graphsurfing/batch.log
cd ..

# Distribution check
sqlite3 Frontend/db/feedback.db \
  "SELECT status, COUNT(*) FROM pipeline_runs WHERE assignment='graphsurfing' GROUP BY status;"
```

**Gate:** mostly `success` rows, few or zero `error` rows. If errors > a couple,
`tail -200 Frontend/data/graphsurfing/batch.log` and stop.

---

## Phase H — Manual feedback verification (no email_queue interaction)

Generate tokens NOW (cheap to undo if needed):

```bash
cd Frontend
node scripts/generate-tokens.js graphsurfing data/roster.csv
sqlite3 db/feedback.db \
  "SELECT COUNT(*) FROM tokens WHERE assignment='graphsurfing';"
sqlite3 db/feedback.db \
  "SELECT token, student_id FROM tokens WHERE assignment='graphsurfing' AND student_id IN ('gajavegs','culottjm','mirandac','neawedba') LIMIT 10;"
cd ..
```

For each spot-check student, open in a browser:

```
http://<server>:<port>/?token=<TOKEN>&assignment=graphsurfing
```

**Coverage — minimum 6 students:**

1. **gajavegs (yourself)** — easy end-to-end click test
2. **A high-drill student** — e.g. `rhit-culottjm` (~264 KB tar, most runs) — verifies the drill bank fires and drill quotes don't leak answers
3. **A review-only student** — anyone whose failures land only in
   `shortest_path` / `strongly_connected_component` / `neighbor_sets` — verifies
   the concept-review-orphan path renders Final-prep references when no drill
   fires for a category
4. **A small-report student** — anyone with 1–2 patterns total — verifies no
   overflow tail in the report
5. **A mostly-passing student** — verifies the generic-review-guide path
6. **A `[no-tar]` student** (e.g. `rhit-neawedba`) — visit their token, verify
   the missing_tar landing page renders and doesn't crash

**For each student, check:**
- Report PDF renders; concept names match the `graphsurfing.json` concepts
- Drill cards show source labels like `From: Final Exam — practice (computer part)`,
  `From: Final Exam — 2023 (findUnknownBalloons)`, `From: Final Exam — extension drill`
- `practice_numDirectedTriangles_*` / `practice_countReachableWithinKHops_*` /
  `practice_isStronglyConnected_*` / `practice_findUnknownBalloons_*` testCode
  is syntactically clean (no broken JSON-escape rendering of `\n`)
- Drill intros frame Final-prep, never "go finish your assignment"
- courseAppearances point at `Exams/Final Exam/...` paths and external
  Iterator/Set/List docs
- External `docs.oracle.com` links route through `/external?token=...&url=...`
  (302 to docs.oracle.com) — clicking should NOT 404 on
  `/study-materials/https%3A//...`
- The `GraphSurfing/GraphSurfing.md` link (M2 concept rows only) opens via
  `/study-materials/`
- The new `Final-202320-graph.md` link (SCC concept row + balloon drill cards)
  opens via `/study-materials/` and shows the non-solution balloon reference
- Footer counts: `N drills · M concept reviews · X min`
- Real drills sort before review-only rows

**STOP HERE if anything is off.** Fix configs, re-run process-batch (existing
pipeline_runs rows overwrite), re-check. Nothing has reached the email queue yet.

If a config edit needed: edit on local, `git push`, `git pull` on server,
optionally `pm2 restart feedback` if it was a server.js/lib change (not needed
for `Pipeline/assignments/*.json` or `Pipeline/testInputs/csse230/**/*.md`
edits — those are read fresh on each prepare invocation).

---

## Phase I — Queue emails to dev address only (still no real sends)

```bash
# Confirm safety levers haven't drifted
grep -E 'HOLD_EMAILS|EMAIL_DEV_REDIRECT' Frontend/.env
# HOLD_EMAILS=true and EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu

cd Frontend
node scripts/queue-emails.js graphsurfing "Graph Surfing"
cd ..

# Verify dev redirect baked in
sqlite3 Frontend/db/feedback.db <<'SQL'
SELECT recipient, email_type, substr(subject,1,70) AS subject
FROM email_queue WHERE assignment='graphsurfing' AND status='pending' LIMIT 10;
SQL
```

**Gate:** EVERY `recipient` is `gajavegs@rose-hulman.edu` AND every `subject`
starts with `[DEV to <real-email>]`. If you see real student emails as
recipients, `EMAIL_DEV_REDIRECT` wasn't honored — STOP, cancel the rows, fix
.env, re-queue.

```bash
# Emergency cancel if dev redirect failed
sqlite3 Frontend/db/feedback.db "UPDATE email_queue SET status='cancelled', error_msg='env redirect missing' WHERE assignment='graphsurfing' AND status='pending';"
```

---

## Phase J — Release to dev inbox only

```bash
nano Frontend/.env   # HOLD_EMAILS=true → HOLD_EMAILS=false
# Wait ~60s for the relay drain tick
```

Watch your dev inbox. Click every link in each rehearsal email:
- Subject prefix `[DEV to <real-email>]` present
- Report PDF link opens the right student's content
- Feedback site link loads the right student's frontend.json
- External `futureAppearances` links 302 correctly
- No "Apologies for the earlier email" leftover paragraph

After spot-checks done:

```bash
nano Frontend/.env   # HOLD_EMAILS=false → HOLD_EMAILS=true
```

For each token you clicked through, return it to "first-view" state for the
real student:

```bash
TOKEN='<token-string>'
sqlite3 Frontend/db/feedback.db <<SQL
DELETE FROM events      WHERE token='${TOKEN}';
DELETE FROM email_queue WHERE token='${TOKEN}' AND assignment='graphsurfing';
SQL
```

---

## Phase K — Real send (only when fully satisfied)

```bash
# 1. Cancel all dev-redirected rows so re-queue creates fresh ones with real recipients
sqlite3 Frontend/db/feedback.db "UPDATE email_queue SET status='cancelled', error_msg='dress rehearsal complete' WHERE assignment='graphsurfing' AND status='pending';"

# 2. Remove the dev redirect; keep HOLD_EMAILS=true initially
nano Frontend/.env
# - Remove or comment out EMAIL_DEV_REDIRECT
# - Keep HOLD_EMAILS=true

# 3. Re-queue
cd Frontend && node scripts/queue-emails.js graphsurfing "Graph Surfing" && cd ..

# 4. CRITICAL CHECK — recipients must be REAL student emails now
sqlite3 Frontend/db/feedback.db "SELECT recipient, email_type FROM email_queue WHERE assignment='graphsurfing' AND status='pending' LIMIT 10;"
# Subjects must NOT start with [DEV to...]
```

**Final gate before release:** every recipient is `<student>@rose-hulman.edu`
AND no subject starts with `[DEV to`. If anything still says `[DEV to`,
`EMAIL_DEV_REDIRECT` is still active — repeat steps 1–3.

```bash
# 5. Release
nano Frontend/.env   # HOLD_EMAILS=true → false

# 6. Watch the queue drain
watch -n 5 "sqlite3 Frontend/db/feedback.db 'SELECT status, COUNT(*) FROM email_queue WHERE assignment=\"graphsurfing\" GROUP BY status;'"
# Ctrl-C when pending=0
```

---

## Emergency rollback (any phase before K)

```bash
pm2 stop feedback
cp Frontend/db/feedback.db.pre-graphsurfing-<DATE>.bak Frontend/db/feedback.db
rm -f Frontend/db/feedback.db-wal Frontend/db/feedback.db-shm
cp Frontend/.env.pre-graphsurfing-<DATE>.bak Frontend/.env
pm2 start feedback
```

The DB is back to its pre-GraphSurfing state. Tar staging in
`Frontend/data/graphsurfing/` and pipeline outputs in `Pipeline/output/` are
not destructive to other assignments — safe to leave or `rm -rf` after
rollback.
