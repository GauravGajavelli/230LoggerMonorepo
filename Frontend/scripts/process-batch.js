#!/usr/bin/env node
/**
 * process-batch.js <assignment-slug> [display-name]
 *
 * Runs ingest → prepare for each student with a run.tar in data/{assignment}/tars/.
 * Writes frontend.json to data/{assignment}/output/{student_id}/.
 *
 * Usage (run from Frontend/):
 *   node scripts/process-batch.js bst "Binary Search Tree"
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import db from '../lib/db.js';
import { generateReport, generateReportForToken, generateGenericReport } from '../lib/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The pipeline JAR resolves prompt templates relative to cwd, which must be the repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const args        = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags       = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));
const assignment  = args[0];
const displayName = args[1] || process.env.ASSIGNMENT_DISPLAY_NAME || assignment;
const skipExisting = flags.has('--skip-existing');
const concurrencyFlag = [...process.argv].find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyFlag ? parseInt(concurrencyFlag.split('=')[1], 10) : 3;

if (!assignment) {
  console.error('Usage: node scripts/process-batch.js <assignment-slug> [display-name] [--skip-existing]');
  process.exit(1);
}

const DATA_DIR        = path.resolve(process.env.DATA_DIR    || path.join(__dirname, '..', 'data'));
const BASE_URL        = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PIPELINE_JAR    = path.resolve(process.env.PIPELINE_JAR || path.join(__dirname, '..', '..', 'Pipeline', 'target', 'csse230-feedback.jar'));
const LLM_CACHE_DIR   = path.resolve(process.env.LLM_CACHE_DIR || path.join(__dirname, '..', '..', 'Pipeline', 'cache', 'llm'));
const ASSIGNMENTS_DIR = path.resolve(path.join(__dirname, '..', '..', 'Pipeline', 'assignments'));
const tarsDir = path.join(DATA_DIR, assignment, 'tars');

if (!fs.existsSync(tarsDir)) {
  console.error(`ERROR: ${tarsDir} not found. Place run.tar files there first.`);
  process.exit(1);
}
if (!fs.existsSync(PIPELINE_JAR)) {
  console.error(`ERROR: Pipeline JAR not found: ${PIPELINE_JAR}`);
  console.error('Run: mvn -f ../Pipeline/pom.xml package -q -DskipTests');
  process.exit(1);
}

let students = fs.readdirSync(tarsDir).filter(entry =>
  fs.statSync(path.join(tarsDir, entry)).isDirectory()
  && fs.existsSync(path.join(tarsDir, entry, 'run.tar'))
);

if (skipExisting) {
  const before = students.length;
  students = students.filter(id =>
    !fs.existsSync(path.join(DATA_DIR, assignment, 'output', id, 'frontend.json'))
  );
  console.log(`--skip-existing: ${before - students.length} already processed, ${students.length} new`);
}

if (students.length === 0) {
  console.log(`No students to process.`); process.exit(0);
}
console.log(`Processing ${students.length} student(s) — ${assignment} (${displayName})\n`);

// Optional rerun deps directory. If RERUN_DEPS_DIR is set in .env (or as an env var),
// process-batch will run the rerun command between ingest and prepare so prepare gets
// enriched_runs/ (stack traces, exception types, per-test durations). This produces
// markedly higher-quality LLM feedback than --allow-basic-fallback. The directory must
// contain the JUnit/jackson/etc. jars matching the assignment's testSupport runtime —
// for HW7, that's the dir produced by unzipping stringhashset-202630.zip.
const RERUN_DEPS_DIR = process.env.RERUN_DEPS_DIR
  ? path.resolve(process.env.RERUN_DEPS_DIR)
  : null;

function runPipelineForStudent(studentId) {
  return new Promise((resolve, reject) => {
    const tarDir    = path.join(tarsDir, studentId);
    const outputDir = path.join(DATA_DIR, assignment, 'output', studentId);
    fs.mkdirSync(outputDir, { recursive: true });

    const onPrepareDone = (err2, _o2, stderr2) => {
      if (err2) return reject(new Error(`prepare: ${(stderr2 || err2.message).slice(0, 300)}`));
      resolve();
    };

    const startPrepare = () => {
      const assignmentConfigPath  = path.join(ASSIGNMENTS_DIR, `${assignment}.json`);
      const assessmentCalendarPath = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
      const enrichedDirExists = fs.existsSync(path.join(outputDir, 'enriched_runs'));
      const prepareArgs = ['-jar', PIPELINE_JAR, 'prepare',
        '-i', outputDir, '-o', path.join(outputDir, 'frontend.json'),
        '--assignment-name', displayName, '--student-id', studentId,
        '--cache-dir', LLM_CACHE_DIR];
      // Only allow basic fallback when rerun didn't produce enriched_runs/ — otherwise
      // we'd silently lose the enrichment we just generated.
      if (!enrichedDirExists) prepareArgs.push('--allow-basic-fallback');
      if (fs.existsSync(assignmentConfigPath)) {
        prepareArgs.push('--assignment-config', assignmentConfigPath);
      }
      if (fs.existsSync(assessmentCalendarPath)) {
        prepareArgs.push('--assessment-calendar', assessmentCalendarPath);
      }
      execFile('java', prepareArgs, { timeout: 0, cwd: REPO_ROOT }, onPrepareDone);
    };

    execFile('java', ['-jar', PIPELINE_JAR, 'ingest', '-i', tarDir, '-o', outputDir],
      { timeout: 120_000, cwd: REPO_ROOT }, (err, _o, stderr) => {
        if (err) return reject(new Error(`ingest: ${(stderr || err.message).slice(0, 300)}`));

        if (RERUN_DEPS_DIR && fs.existsSync(RERUN_DEPS_DIR)) {
          execFile('java', ['-jar', PIPELINE_JAR, 'rerun',
              '-i', outputDir, '-o', outputDir, '--deps', RERUN_DEPS_DIR],
            { timeout: 600_000, cwd: REPO_ROOT }, (errR, _oR, stderrR) => {
              if (errR) {
                // Don't hard-fail the whole student on rerun failure — fall back to basic prepare
                // and let the warning be visible in the batch log.
                console.warn(`  ⚠  ${studentId} rerun failed (${(stderrR || errR.message).slice(0, 200)}); continuing with --allow-basic-fallback`);
              }
              startPrepare();
            });
        } else {
          startPrepare();
        }
      });
  });
}

const logPath = path.join(DATA_DIR, assignment, 'batch.log');
function logLine(line) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  fs.appendFileSync(logPath, `${ts}  ${line}\n`);
}
logLine(`START  ${students.length} students  (${skipExisting ? '--skip-existing' : 'full batch'})`);

let succeeded = 0;
const errors = [];

async function processStudent(studentId) {
  const runId = db.prepare(
    "INSERT INTO pipeline_runs (assignment,student_id,status,source,started_at) VALUES (?,?,'processing','batch',datetime('now'))"
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

    const tokenRow = db.prepare(
      "SELECT token FROM tokens WHERE student_id=? AND assignment=?"
    ).get(studentId, assignment);

    if (patternCount > 0) {
      try {
        await generateReport(studentId, assignment, DATA_DIR, BASE_URL);
      } catch (reportErr) {
        console.warn(`  ⚠  ${studentId} report.json generation failed: ${reportErr.message}`);
        console.warn(reportErr.stack);
      }
      if (tokenRow) {
        try {
          await generateReportForToken(studentId, assignment, tokenRow.token, DATA_DIR, BASE_URL);
          console.log(`     PDF generated with token (personalized, ${patternCount} pattern${patternCount !== 1 ? 's' : ''})`);
        } catch (pdfErr) {
          console.warn(`  ⚠  ${studentId} PDF generation failed: ${pdfErr.message}`);
          console.warn(pdfErr.stack);
        }
      } else {
        console.log(`     No token found for ${studentId}/${assignment} — skipping PDF (run generate-tokens.js first)`);
      }
    } else {
      if (tokenRow) {
        try {
          await generateGenericReport(studentId, assignment, tokenRow.token, DATA_DIR, BASE_URL);
          console.log(`     PDF generated with token (generic review guide — 0 patterns)`);
        } catch (pdfErr) {
          console.warn(`  ⚠  ${studentId} generic PDF generation failed: ${pdfErr.message}`);
          console.warn(pdfErr.stack);
        }
      } else {
        console.log(`     No token found for ${studentId}/${assignment} — skipping generic PDF (run generate-tokens.js first)`);
      }
    }
    const elapsed = Math.round((Date.now()-t0)/1000);
    console.log(`  ✓  ${studentId}  (${elapsed}s)`);
    logLine(`SUCCESS  ${studentId}  (${elapsed}s)`);
    succeeded++;
  } catch (err) {
    db.prepare("UPDATE pipeline_runs SET status='error',error_msg=?,finished_at=datetime('now') WHERE id=?")
      .run(err.message.slice(0, 500), runId);
    const elapsed = Math.round((Date.now()-t0)/1000);
    console.log(`  ✗  ${studentId}  (${elapsed}s) — ${err.message}`);
    logLine(`ERROR    ${studentId}  (${elapsed}s)  ${err.message.split('\n')[0]}`);
    errors.push({ studentId, error: err.message });
  }
}

// Process students with a concurrency cap to avoid hitting LLM rate limits.
// Default CONCURRENCY=3; override with --concurrency=N.
console.log(`  concurrency: ${CONCURRENCY}\n`);
const queue = [...students];
async function worker() {
  while (queue.length) {
    const studentId = queue.shift();
    if (studentId) await processStudent(studentId);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, students.length) }, worker));

logLine(`DONE   ${succeeded} succeeded,  ${errors.length} failed`);

console.log(`\n── Summary ──────────────────────────`);
console.log(`  ${succeeded} succeeded,  ${errors.length} failed`);
console.log(`  Log: ${logPath}`);
if (errors.length) {
  console.log('\nFailed:');
  for (const { studentId, error } of errors) console.log(`  ${studentId}: ${error}`);
  process.exit(1);
}
