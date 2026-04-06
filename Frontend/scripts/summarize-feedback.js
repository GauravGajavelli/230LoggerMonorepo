#!/usr/bin/env node
/**
 * summarize-feedback.js <assignment-slug>
 *
 * Reads all data/{assignment}/output/{student}/frontend.json files and prints
 * a structured quality-review table to stdout.  Useful for stratified sampling
 * before reading individual PDFs.
 *
 * Columns per student:
 *   student_id | runs | episodes | highlights (categories) | feedback items | drills | warnings
 *
 * Usage (run from Frontend/):
 *   node scripts/summarize-feedback.js wuas
 *   node scripts/summarize-feedback.js bst 2>/dev/null | column -t -s $'\t'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const assignment = process.argv[2];
if (!assignment) {
  console.error('Usage: node scripts/summarize-feedback.js <assignment-slug>');
  process.exit(1);
}

const outputDir = path.join(DATA_DIR, assignment, 'output');
if (!fs.existsSync(outputDir)) {
  console.error(`No output directory found: ${outputDir}`);
  process.exit(1);
}

const students = fs.readdirSync(outputDir)
  .filter(s => fs.existsSync(path.join(outputDir, s, 'frontend.json')));

if (students.length === 0) {
  console.error(`No frontend.json files found under ${outputDir}`);
  process.exit(1);
}

// ── TSV header ───────────────────────────────────────────────────────────────
const cols = [
  'student_id', 'runs', 'episodes', 'still_failing', 'regression',
  'costly_detour', 'sustained_struggle', 'feedback_items', 'drills', 'has_semantics', 'notes'
];
console.log(cols.join('\t'));

const rows = [];

for (const studentId of students.sort()) {
  const fp = path.join(outputDir, studentId, 'frontend.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error(`  WARN: ${studentId} — could not parse frontend.json: ${e.message}`);
    continue;
  }

  const runs = data.submissionContext?.totalRuns ?? '?';
  const episodes = (data.episodes ?? []).length;

  // Highlight counts
  const hl = data.failureHighlights ?? {};
  const stillFailing = (hl.stillFailing ?? []).length;
  const regression   = (hl.regression ?? []).length;
  const costlyDetour = (hl.costlyDetour ?? []).length;
  const sustained    = (hl.sustainedStruggle ?? []).length;

  const feedbackItems = (data.feedback ?? []).length;
  const drills        = (data.practiceDrills ?? []).length;
  const hasSemantics  = data.semanticLog != null ? 'yes' : 'no';

  // Derive a one-word note for stratified review
  let note = 'ok';
  if (stillFailing > 0)           note = 'still-failing';
  else if (regression > 0)        note = 'regression';
  else if (costlyDetour > 0)      note = 'costly-detour';
  else if (sustained > 0)         note = 'struggled';
  else if (episodes === 0)        note = 'no-episodes';
  else if (feedbackItems === 0)   note = 'no-feedback';

  rows.push({
    studentId, runs, episodes, stillFailing, regression, costlyDetour,
    sustained, feedbackItems, drills, hasSemantics, note
  });
}

// Sort: most feedback first (best candidates for manual review at the top)
rows.sort((a, b) =>
  (b.stillFailing + b.regression + b.feedbackItems) -
  (a.stillFailing + a.regression + a.feedbackItems)
);

for (const r of rows) {
  console.log([
    r.studentId, r.runs, r.episodes,
    r.stillFailing, r.regression, r.costlyDetour, r.sustained,
    r.feedbackItems, r.drills, r.hasSemantics, r.note
  ].join('\t'));
}

// ── Summary stats ─────────────────────────────────────────────────────────────
const total = rows.length;
const withFeedback  = rows.filter(r => r.feedbackItems > 0).length;
const withSemantics = rows.filter(r => r.hasSemantics === 'yes').length;
const reviewPicks   = rows.filter(r => r.note !== 'ok' && r.note !== 'no-feedback').slice(0, 5);

process.stderr.write(`\n── ${assignment} feedback summary (${total} students) ──────────────────\n`);
process.stderr.write(`  with feedback items : ${withFeedback}/${total}\n`);
process.stderr.write(`  with LLM semantics  : ${withSemantics}/${total}\n`);
process.stderr.write(`\nSuggested PDFs to read manually (top ${reviewPicks.length} by highlight priority):\n`);
for (const r of reviewPicks) {
  process.stderr.write(`  ${r.studentId.padEnd(20)} ${r.note}  (${r.feedbackItems} feedback, ${r.stillFailing} still-failing, ${r.regression} regression)\n`);
}
