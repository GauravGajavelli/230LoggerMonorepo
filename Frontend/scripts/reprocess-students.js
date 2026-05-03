#!/usr/bin/env node
/**
 * reprocess-students.js <assignment-slug> <student_id> [student_id ...]
 *
 * For each named student:
 *   1. Deletes their pipeline output (forces fresh ingest + prepare)
 *   2. Cancels any queued email (so queue-emails.js will re-queue with new data)
 *   3. Re-runs the pipeline
 *
 * Use this when a student resubmits and their run.tar has changed.
 *
 * Usage (from Frontend/):
 *   node scripts/reprocess-students.js bst rhit-guffeygi rhit-wakefib
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import db from '../lib/db.js';
import { generateReport, generateReportForToken, generateGenericReport } from '../lib/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..');

const rawArgs = process.argv.slice(2);
const clearCache = rawArgs.includes('--clear-cache');
const positional = rawArgs.filter(a => !a.startsWith('--'));
const [assignment, ...students] = positional;

if (!assignment || students.length === 0) {
  console.error('Usage: node scripts/reprocess-students.js <assignment> <student_id> [...] [--clear-cache]');
  console.error('  --clear-cache  Wipe Pipeline/cache/llm before reprocessing. Use after a Pipeline');
  console.error('                 code/prompt change so the new logic actually runs (otherwise prepare');
  console.error('                 reuses cached LLM responses and your fix has no visible effect).');
  process.exit(1);
}

const DATA_DIR      = path.resolve(process.env.DATA_DIR    || path.join(__dirname, '..', 'data'));
const BASE_URL      = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PIPELINE_JAR  = path.resolve(process.env.PIPELINE_JAR || path.join(__dirname, '..', '..', 'Pipeline', 'target', 'csse230-feedback.jar'));
const LLM_CACHE_DIR = path.resolve(process.env.LLM_CACHE_DIR || path.join(__dirname, '..', '..', 'Pipeline', 'cache', 'llm'));
const ASSIGNMENTS_DIR = path.resolve(path.join(__dirname, '..', '..', 'Pipeline', 'assignments'));

if (!fs.existsSync(PIPELINE_JAR)) {
  console.error(`ERROR: Pipeline JAR not found: ${PIPELINE_JAR}`);
  process.exit(1);
}

// One-time cache wipe (not per-student) when --clear-cache is passed. Avoids
// the bug where prepare's --clear-cache flag wipes the cache before each
// student's run — that would re-wipe entries the previous student just cached
// and double-charge for shared LLM calls (drill_category_map, etc.).
if (clearCache && fs.existsSync(LLM_CACHE_DIR)) {
  const entries = fs.readdirSync(LLM_CACHE_DIR);
  for (const e of entries) {
    fs.rmSync(path.join(LLM_CACHE_DIR, e), { recursive: true, force: true });
  }
  console.log(`[clear-cache] Removed ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from ${LLM_CACHE_DIR}`);
}

function runPipelineForStudent(studentId) {
  return new Promise((resolve, reject) => {
    const tarDir    = path.join(DATA_DIR, assignment, 'tars', studentId);
    const outputDir = path.join(DATA_DIR, assignment, 'output', studentId);
    fs.mkdirSync(outputDir, { recursive: true });

    execFile('java', ['-jar', PIPELINE_JAR, 'ingest', '-i', tarDir, '-o', outputDir],
      { timeout: 120_000, cwd: REPO_ROOT }, (err, _o, stderr) => {
        if (err) return reject(new Error(`ingest: ${(stderr || err.message).slice(0, 300)}`));
        const assignmentConfigPath   = path.join(ASSIGNMENTS_DIR, `${assignment}.json`);
        const assessmentCalendarPath = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
        const prepareArgs = ['-jar', PIPELINE_JAR, 'prepare',
          '-i', outputDir, '-o', path.join(outputDir, 'frontend.json'),
          '--assignment-name', assignment, '--student-id', studentId,
          '--cache-dir', LLM_CACHE_DIR, '--allow-basic-fallback'];
        if (fs.existsSync(assignmentConfigPath))   prepareArgs.push('--assignment-config', assignmentConfigPath);
        if (fs.existsSync(assessmentCalendarPath)) prepareArgs.push('--assessment-calendar', assessmentCalendarPath);
        execFile('java', prepareArgs,
          { timeout: 0, cwd: REPO_ROOT }, (err2, _o2, stderr2) => {
            if (err2) return reject(new Error(`prepare: ${(stderr2 || err2.message).slice(0, 300)}`));
            resolve();
          });
      });
  });
}

console.log(`Reprocessing ${students.length} student(s) for ${assignment}\n`);

let succeeded = 0;
const errors = [];

for (const studentId of students) {
  const tarPath = path.join(DATA_DIR, assignment, 'tars', studentId, 'run.tar');
  if (!fs.existsSync(tarPath)) {
    console.log(`  ✗  ${studentId} — no run.tar found, skipping`);
    errors.push({ studentId, error: 'no run.tar' });
    continue;
  }

  // 1. Clear pipeline output
  const outputDir = path.join(DATA_DIR, assignment, 'output', studentId);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
    console.log(`  ✦  ${studentId} — cleared output dir`);
  }

  // 2. Cancel any pending/sent queued email so queue-emails.js will re-queue
  const tokenRow = db.prepare(
    "SELECT token FROM tokens WHERE student_id=? AND assignment=?"
  ).get(studentId, assignment);
  if (tokenRow) {
    const cancelled = db.prepare(
      "UPDATE email_queue SET status='cancelled', error_msg='reprocess: tar updated' WHERE token=? AND status IN ('pending','failed')"
    ).run(tokenRow.token).changes;
    if (cancelled > 0) console.log(`  ✦  ${studentId} — cancelled ${cancelled} queued email(s)`);
  }

  // 3. Run pipeline
  const runId = db.prepare(
    "INSERT INTO pipeline_runs (assignment,student_id,status,source,started_at) VALUES (?,?,'processing','reprocess',datetime('now'))"
  ).run(assignment, studentId).lastInsertRowid;

  const t0 = Date.now();
  try {
    await runPipelineForStudent(studentId);
    db.prepare("UPDATE pipeline_runs SET status='success',finished_at=datetime('now') WHERE id=?").run(runId);

    const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', studentId, 'frontend.json');
    let patternCount = 0;
    if (fs.existsSync(frontendJsonPath)) {
      try {
        patternCount = (JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8')).feedback || []).length;
      } catch { /* leave at 0 */ }
    }

    if (patternCount > 0) {
      try { await generateReport(studentId, assignment, DATA_DIR, BASE_URL); } catch {}
      if (tokenRow) {
        try {
          await generateReportForToken(studentId, assignment, tokenRow.token, DATA_DIR, BASE_URL);
          console.log(`     PDF regenerated (personalized, ${patternCount} pattern${patternCount !== 1 ? 's' : ''})`);
        } catch (e) {
          console.warn(`  ⚠  ${studentId} PDF failed: ${e.message}`);
        }
      }
    } else if (tokenRow) {
      try {
        await generateGenericReport(studentId, assignment, tokenRow.token, DATA_DIR, BASE_URL);
        console.log(`     PDF regenerated (generic review guide — 0 patterns)`);
      } catch (e) {
        console.warn(`  ⚠  ${studentId} generic PDF failed: ${e.message}`);
      }
    }
    console.log(`  ✓  ${studentId}  (${Math.round((Date.now()-t0)/1000)}s)`);
    console.log(`     Re-run queue-emails.js to send updated email`);
    succeeded++;
  } catch (err) {
    db.prepare("UPDATE pipeline_runs SET status='error',error_msg=?,finished_at=datetime('now') WHERE id=?")
      .run(err.message.slice(0, 500), runId);
    console.log(`  ✗  ${studentId}  — ${err.message}`);
    errors.push({ studentId, error: err.message });
  }
}

console.log(`\n── Summary ──────────────────────────`);
console.log(`  ${succeeded} reprocessed,  ${errors.length} failed`);
console.log(`\nNext: node scripts/queue-emails.js ${assignment} — will re-queue updated students`);
if (errors.length) process.exit(1);
