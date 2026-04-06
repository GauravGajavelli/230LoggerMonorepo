#!/usr/bin/env node
/**
 * regenerate-reports.js <assignment-slug>
 *
 * Re-generates report.json and report.pdf for every student that already has a
 * frontend.json in data/{assignment}/output/{student_id}/.  Skips the ingest
 * and prepare (LLM) steps entirely — useful after changing wuas_assessment_config.json
 * or the report template without wanting to re-run expensive LLM calls.
 *
 * Usage (run from Frontend/):
 *   node scripts/regenerate-reports.js wuas
 *   node scripts/regenerate-reports.js bst
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../lib/db.js';
import { generateReport, generateReportForToken } from '../lib/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assignment = process.argv[2];
if (!assignment) {
  console.error('Usage: node scripts/regenerate-reports.js <assignment-slug>');
  process.exit(1);
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const outputDir = path.join(DATA_DIR, assignment, 'output');
if (!fs.existsSync(outputDir)) {
  console.error(`No output directory: ${outputDir}`);
  process.exit(1);
}

const students = fs.readdirSync(outputDir).filter(s =>
  fs.existsSync(path.join(outputDir, s, 'frontend.json'))
);

if (students.length === 0) {
  console.error(`No frontend.json files found under ${outputDir}`);
  process.exit(1);
}

console.log(`Regenerating reports for ${students.length} student(s) — ${assignment}\n`);

let succeeded = 0;
const errors = [];

for (const studentId of students.sort()) {
  const t0 = Date.now();
  try {
    await generateReport(studentId, assignment, DATA_DIR, BASE_URL);

    const tokenRow = db.prepare(
      'SELECT token FROM tokens WHERE student_id=? AND assignment=?'
    ).get(studentId, assignment);

    if (tokenRow) {
      await generateReportForToken(studentId, assignment, tokenRow.token, DATA_DIR, BASE_URL);
      console.log(`  ✓  ${studentId}  (${Math.round((Date.now() - t0) / 1000)}s)`);
    } else {
      console.log(`  ✓  ${studentId}  (${Math.round((Date.now() - t0) / 1000)}s) — no token, PDF skipped`);
    }
    succeeded++;
  } catch (err) {
    console.log(`  ✗  ${studentId} — ${err.message}`);
    errors.push({ studentId, error: err.message });
  }
}

console.log(`\n── Summary ──────────────────────────`);
console.log(`  ${succeeded} succeeded,  ${errors.length} failed`);
if (errors.length) {
  for (const { studentId, error } of errors) console.log(`  ${studentId}: ${error}`);
  process.exit(1);
}
