# GraphSurfing Rollout — Server Runbook

A phased sequence for rolling out the GraphSurfing feedback batch to the production
server. **No emails leave the server before Phase J.** Phases A–H produce all
artifacts (frontend.json, tokens, PDFs) without touching the email queue; Phase I
queues to a dev address only; Phase K is the actual real send.

**Copy-paste convention:** every command block below is **one logical line** (joined
with `;` or `&&`). Triple-click to select the full line, then paste — no shell
continuation backslashes, no risk of a stray newline mid-pipeline breaking the
command. Long lines wrap visually in your editor; that's fine, the shell sees
one line.

Cross-references:
- Conceptual context: `Planning/graphsurfing_kickoff.md`
- Canonical how-to: `Planning/assignment_context_protocol.md` (Phase 0 staging,
  dress rehearsal, real-send templates)
- Configs: `Pipeline/assignments/graphsurfing*.json`
- Recovered tar zip: `Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip`
  (NOT the malformed `-19May.zip`)

Server cwd is `/home/csse/230LoggerMonorepo` unless noted. DB is at
`Frontend/db/feedback.db`. pm2 process is `feedback`.

---

## Phase A — Snapshot before touching anything

Backup DB + .env (pm2 stop so SQLite is quiescent during the copy):

```
pm2 stop feedback; DATE=$(date +%Y%m%d-%H%M); cp Frontend/db/feedback.db Frontend/db/feedback.db.pre-graphsurfing-${DATE}.bak; cp Frontend/db/feedback.db-wal Frontend/db/feedback.db-wal.pre-graphsurfing-${DATE}.bak 2>/dev/null || true; cp Frontend/db/feedback.db-shm Frontend/db/feedback.db-shm.pre-graphsurfing-${DATE}.bak 2>/dev/null || true; cp Frontend/.env Frontend/.env.pre-graphsurfing-${DATE}.bak; pm2 start feedback; echo "Backup tag: ${DATE}"
```

**Gate:** the echo prints a `YYYYMMDD-HHMM` tag AND `pm2 list` shows `feedback`
online. Note the tag — you'll need it for emergency rollback.

---

## Phase B — Bring code + tars to the server

From your **local** machine, commit and push:

```
cd /Users/gauravgajavelli/Documents/GitHub/230LoggerMonorepo && git status
```

Then add and push (adjust file list to what's actually changed):

```
git add Pipeline/assignments/graphsurfing.json Pipeline/assignments/graphsurfing_test_categories.json Pipeline/assignments/graphsurfing_drill_questions.json Pipeline/assignments/graphsurfing_assessment_config.json Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md "Pipeline/testInputs/csse230/Exams/Final Exam/Final-202320-graph.md" Planning/graphsurfing_kickoff.md Planning/graphsurfing_rollout_runbook.md Planning/assignment_context_protocol.md && git commit -m "GraphSurfing pipeline configs: Final-Exam-targeted feedback" && git push
```

Transfer the recovered tar zip (don't commit a ~2.8 MB binary):

```
scp Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip <user>@<server>:/home/csse/230LoggerMonorepo/Pipeline/testInputs/studentTars/
```

On the **server**, pull and rebuild:

```
git pull && git log -3 --oneline && ls Pipeline/assignments/graphsurfing*.json && ls Pipeline/testInputs/csse230/GraphSurfing/GraphSurfing.md && ls "Pipeline/testInputs/csse230/Exams/Final Exam/Final-202320-graph.md" && ls -lh Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip && mvn -f Pipeline/pom.xml package -q -DskipTests && ls -lt Pipeline/target/csse230-feedback.jar | head -1
```

**Gate:** all 4 config files present, both .md files at new paths, recovered
zip present, JAR newer than `Pipeline/src/main/java/`.

**Why `-recovered.zip` and not the original:** the 5/19 zip downloaded from the
source tool was malformed — its central directory only indexes a single `diffs`
status file, leaving the ~2.7 MB of tar payload orphaned at the start. `zip -FF`
rebuilt the central directory locally. The recovered version contains 22 real
non-empty student tars + 8 `_Error.txt` placeholders for students whose tars
couldn't be downloaded. The Phase E staging script's `find -name run-*.tar`
pattern picks up the 22 real tars and skips the error placeholders.

---

## Phase C — Lock down email sending BEFORE any pipeline work

Edit `.env` so `HOLD_EMAILS=true` and `EMAIL_DEV_REDIRECT=gajavegs@rose-hulman.edu`:

```
nano Frontend/.env
```

Restart and verify both safety levers + that no graphsurfing rows exist yet:

```
pm2 restart feedback && grep -E 'HOLD_EMAILS|EMAIL_DEV_REDIRECT' Frontend/.env && sqlite3 Frontend/db/feedback.db "SELECT status, COUNT(*) FROM email_queue WHERE assignment='graphsurfing' GROUP BY status;"
```

**Gate:** grep shows both env vars set; the sqlite query returns nothing (no
rows for graphsurfing yet). Belt and suspenders: `HOLD_EMAILS=true` stops the
relay even if rows exist; `EMAIL_DEV_REDIRECT` bakes the dev address into any
rows that do appear.

---

## Phase D — Validate configs (no DB writes)

```
cd Frontend && node scripts/validate-assignment-config.js graphsurfing; cd ..
```

**Gate:** "Passed with 1 warning(s)" — the warning should be exactly
`neighbor_sets` (intentionally left for LLM-synthesis fallback because it's only
0.01 weight). If you see additional warnings or any errors, stop and fix the
configs.

---

## Phase E — Stage tars (writes filesystem only, no DB)

Reset staging and unzip:

```
cd Frontend && rm -rf data/graphsurfing/output data/graphsurfing/tars && mkdir -p data/graphsurfing/tars && unzip -o ../Pipeline/testInputs/studentTars/allTar-GraphSurfing-Sp2026-19May-recovered.zip -d /tmp/graphsurfing-tars > /dev/null && cd ..
```

Run the matching loop (this is the protocol's Phase 0 script with the
GitHub-Classroom-`-N`-suffix fix; one-liner so leading whitespace can't break the
paste):

```
cd Frontend && while IFS=, read -r COL1 EMAIL; do [ "$COL1" = "student_id" ] && continue; COL1="${COL1//$'\r'/}"; EMAIL="${EMAIL//$'\r'/}"; SID="${EMAIL%@*}"; TAR=""; for CANDIDATE in "$COL1" "${COL1#rhit-}" "${COL1%-rhit}" "$SID" "${COL1}-1" "${COL1}-2" "${COL1}-3" "${COL1#rhit-}-1" "${COL1#rhit-}-2" "${COL1#rhit-}-3"; do [ -z "$CANDIDATE" ] && continue; T=$(find /tmp/graphsurfing-tars -maxdepth 2 -name "run-${CANDIDATE}.tar" 2>/dev/null | head -1); if [ -n "$T" ] && [ -s "$T" ]; then TAR="$T"; break; fi; done; if [ -z "$TAR" ]; then echo "  [no-tar] ${SID} (gh:${COL1}) — will land in missing_tar email path"; continue; fi; mkdir -p "data/graphsurfing/tars/${SID}"; cp "$TAR" "data/graphsurfing/tars/${SID}/run.tar"; done < data/roster.csv; echo "---"; echo "Dirs created: $(ls data/graphsurfing/tars/ | wc -l)"; cd ..
```

**Gate:** student-dir count should be **22**. The `[no-tar]` echoes should be
**~19 total**: the 8 errored students from the recovered zip
(`nirdeshadusumilli2007`, `plant4040`, `rhit-beloremd`, `rhit-greenlrm-1`,
`rhit-mccordca`, `rhit-millern`, `rhit-neawedba`, `rhit-riedliso`) plus 11
roster members whose tar isn't in the zip at all (`barczear`, `carynd`,
`kangt`, `blocksl`, `cherukbj`, `cravenbr`, `graysolt`, `guffeygi`, `robinscp`,
`tuckercm`, `gajavegs`).

If you see only **19 dirs** and `Jack-B-RHIT` / `rhit-hans` / `rhit-osujiun` in
the missing list, the `-1` / `-2` / `-3` suffix block in the candidate loop got
dropped during paste — re-paste the one-liner above.

---

## Phase F — Confirm basic-fallback wiring (and optional one-student sanity check)

`process-batch.js` already auto-detects this case: when `RERUN_DEPS_DIR` is
unset, `rerun` is skipped, no `enriched_runs/` is produced, and the script
auto-appends `--allow-basic-fallback` to the prepare invocation
(`Frontend/scripts/process-batch.js:100`, `:114`, `:121`). So the only thing
you need to confirm is that `RERUN_DEPS_DIR` is NOT set:

```
grep -E '^RERUN_DEPS_DIR' Frontend/.env || echo "RERUN_DEPS_DIR is unset — basic-fallback will engage automatically"
```

**Gate:** the grep matches nothing AND prints the "RERUN_DEPS_DIR is unset"
message. If it does match (a prior rollout left the var set), comment it out
or remove it before continuing.

**Optional dry-run (skip if you trust the configs):** sanity-check one student
end-to-end before running the full batch. Pick a student with a substantive
tar so drill matching gets exercised. `culottjm` (~264 KB) is a good choice;
`theslikj` (~268 KB) and `mirandac` (~295 KB) are also fine:

```
java -jar Pipeline/target/csse230-feedback.jar ingest -i Frontend/data/graphsurfing/tars/culottjm -o Pipeline/output/culottjm-graphsurfing-test && java -jar Pipeline/target/csse230-feedback.jar prepare -i Pipeline/output/culottjm-graphsurfing-test -o /tmp/culottjm-graphsurfing-test.json --assignment-name "Graph Surfing" --student-id "culottjm" --cache-dir Pipeline/cache/llm --allow-basic-fallback
```

Inspect the resulting frontend.json shape:

```
jq '{feedback_count: (.feedback | length), patterns: [.feedback[].pattern_name], drill_count: (.drills | length), drill_ids: [.drills[].id], courseAppearances: (.courseAppearances | length)}' /tmp/culottjm-graphsurfing-test.json
```

**Gate (if you ran the dry-run):** `feedback_count` ≤ 5 (per the Phase 1 cap),
`drill_ids` includes some `final-numDirectedTriangles-*` /
`final-countReachableWithinKHops-*` / `final-isStronglyConnected-*` /
`final2023-findUnknownBalloons-*` entries depending on which categories
culottjm failed, `courseAppearances` non-zero.

Don't use `gajavegs` for this dry-run — you didn't submit a GraphSurfing tar
this batch (you're in the `[no-tar]` list), and `Frontend/data/graphsurfing/tars/gajavegs/run.tar`
doesn't exist.

---

## Phase G — Full batch (writes pipeline_runs rows, no email_queue)

```
cd Frontend && node scripts/process-batch.js graphsurfing "Graph Surfing" 2>&1 | tee data/graphsurfing/batch.log; cd ..
```

Distribution check:

```
sqlite3 Frontend/db/feedback.db "SELECT status, COUNT(*) FROM pipeline_runs WHERE assignment='graphsurfing' GROUP BY status;"
```

**Gate:** mostly `success` rows, few or zero `error` rows. If errors > a couple,
investigate before continuing:

```
tail -200 Frontend/data/graphsurfing/batch.log
```

---

## Phase H — Manual feedback verification (no email_queue interaction)

Generate tokens (cheap to undo: `DELETE FROM tokens WHERE assignment='graphsurfing';`):

```
cd Frontend && node scripts/generate-tokens.js graphsurfing data/roster.csv && sqlite3 db/feedback.db "SELECT COUNT(*) AS tokens FROM tokens WHERE assignment='graphsurfing';"; cd ..
```

Get spot-check tokens for the students you'll click through:

```
sqlite3 Frontend/db/feedback.db "SELECT student_id, token FROM tokens WHERE assignment='graphsurfing' AND student_id IN ('gajavegs','culottjm','mirandac','neawedba','theslikj','clutteda') ORDER BY student_id;"
```

For each spot-check student, open in a browser:

```
http://<server>:<port>/?token=<TOKEN>&assignment=graphsurfing
```

**Coverage — minimum 6 students:**

1. **A high-drill student** — `culottjm` (largest tar, ~264 KB) — verifies the
   drill bank fires and drill quotes don't leak answers
2. **Another high-drill student** — `mirandac` or `theslikj` — confirms
   consistency
3. **A review-only student** — anyone whose failures land only in
   `shortest_path` / `strongly_connected_component` / `neighbor_sets` — verifies
   the concept-review-orphan path renders Final-prep references when no drill
   fires for a category (check the rendered concept rows for `Final-202320-graph.md`
   and the practice PDF links)
4. **A small-report student** — anyone with 1–2 patterns total — verifies no
   overflow tail in the report (`clutteda` is small at ~50 KB)
5. **A mostly-passing student** — verifies the generic-review-guide path
6. **`gajavegs` (yourself, no-tar case)** — verifies the missing_tar landing
   page renders and doesn't crash. This is the right way to spot-check your
   own UX since you don't have a tar this batch.

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

If a config edit is needed: edit on local, `git push`, `git pull` on server;
no `pm2 restart` needed for `Pipeline/assignments/*.json` or
`Pipeline/testInputs/csse230/**/*.md` edits (those are read fresh on each
prepare invocation). `pm2 restart feedback` IS needed for any `server.js` or
`lib/*.js` change.

---

## Phase I — Queue emails to dev address only (still no real sends)

Confirm safety levers haven't drifted, then queue:

```
grep -E 'HOLD_EMAILS|EMAIL_DEV_REDIRECT' Frontend/.env && cd Frontend && node scripts/queue-emails.js graphsurfing "Graph Surfing"; cd ..
```

Verify dev redirect baked in:

```
sqlite3 Frontend/db/feedback.db "SELECT recipient, email_type, substr(subject,1,70) AS subject FROM email_queue WHERE assignment='graphsurfing' AND status='pending' LIMIT 10;"
```

**Gate:** EVERY `recipient` is `gajavegs@rose-hulman.edu` AND every `subject`
starts with `[DEV to <real-email>]`. If you see real student emails as
recipients, `EMAIL_DEV_REDIRECT` wasn't honored — STOP and emergency cancel:

```
sqlite3 Frontend/db/feedback.db "UPDATE email_queue SET status='cancelled', error_msg='env redirect missing' WHERE assignment='graphsurfing' AND status='pending';"
```

Then fix `.env` and re-queue.

---

## Phase J — Release to dev inbox only

```
nano Frontend/.env
```

Change `HOLD_EMAILS=true` to `HOLD_EMAILS=false`. Wait ~60s for the relay drain tick.

Watch your dev inbox. Click every link in each rehearsal email:
- Subject prefix `[DEV to <real-email>]` present
- Report PDF link opens the right student's content
- Feedback site link loads the right student's frontend.json
- External `futureAppearances` links 302 correctly
- No "Apologies for the earlier email" leftover paragraph

After spot-checks done, re-hold:

```
nano Frontend/.env
```

Change `HOLD_EMAILS=false` back to `HOLD_EMAILS=true`.

For each token you clicked through, return it to "first-view" state for the
real student (replace TOKEN):

```
TOKEN='<token-string>'; sqlite3 Frontend/db/feedback.db "DELETE FROM events WHERE token='${TOKEN}'; DELETE FROM email_queue WHERE token='${TOKEN}' AND assignment='graphsurfing';"
```

---

## Phase K — Real send (only when fully satisfied)

Cancel all dev-redirected rows so re-queue creates fresh ones with real recipients:

```
sqlite3 Frontend/db/feedback.db "UPDATE email_queue SET status='cancelled', error_msg='dress rehearsal complete' WHERE assignment='graphsurfing' AND status='pending';"
```

Remove the dev redirect (keep `HOLD_EMAILS=true` initially):

```
nano Frontend/.env
```

Remove or comment out `EMAIL_DEV_REDIRECT`. Keep `HOLD_EMAILS=true`.

Re-queue and verify recipients are now REAL student emails:

```
cd Frontend && node scripts/queue-emails.js graphsurfing "Graph Surfing"; cd ..; sqlite3 Frontend/db/feedback.db "SELECT recipient, email_type, substr(subject,1,70) AS subject FROM email_queue WHERE assignment='graphsurfing' AND status='pending' LIMIT 10;"
```

**Final gate before release:** every recipient is `<student>@rose-hulman.edu`
AND no subject starts with `[DEV to`. If anything still says `[DEV to`,
`EMAIL_DEV_REDIRECT` is still active — repeat the cancel + .env-edit + re-queue.

Release:

```
nano Frontend/.env
```

Change `HOLD_EMAILS=true` to `HOLD_EMAILS=false`.

Watch the queue drain (Ctrl-C when `pending=0`):

```
watch -n 5 'sqlite3 Frontend/db/feedback.db "SELECT status, COUNT(*) FROM email_queue WHERE assignment=\"graphsurfing\" GROUP BY status;"'
```

---

## Emergency rollback (any phase before K)

Replace `<DATE>` with the tag echoed at the end of Phase A:

```
pm2 stop feedback; cp Frontend/db/feedback.db.pre-graphsurfing-<DATE>.bak Frontend/db/feedback.db; rm -f Frontend/db/feedback.db-wal Frontend/db/feedback.db-shm; cp Frontend/.env.pre-graphsurfing-<DATE>.bak Frontend/.env; pm2 start feedback
```

The DB is back to its pre-GraphSurfing state. Tar staging in
`Frontend/data/graphsurfing/` and pipeline outputs in `Pipeline/output/` are
not destructive to other assignments — safe to leave or `rm -rf` after
rollback.
