#!/usr/bin/env node
/**
 * queue-nudges.js <assignment-slug>
 *
 * Queues pre-exam nudge emails for students who have not viewed their feedback
 * (no page_view event recorded). Run manually 2–3 days before the nearest
 * relevant assessment.
 *
 * Skips students who:
 *   - Have a page_view event for their token
 *   - Already have a nudge email queued or sent for this assignment
 *
 * Usage (run from Frontend/):
 *   node scripts/queue-nudges.js bst
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assignment = process.argv[2];
if (!assignment) {
  console.error('Usage: node scripts/queue-nudges.js <assignment-slug>');
  process.exit(1);
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── Assessment config ─────────────────────────────────────────────────────────

const cfgPath = path.join(DATA_DIR, assignment, 'assessment-config.json');
if (!fs.existsSync(cfgPath)) {
  console.error(`Missing assessment config: ${cfgPath}`);
  process.exit(1);
}

const assessmentConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const fullName  = assessmentConfig.full_name  || assignment;
const shortName = assessmentConfig.short_name || assignment;

const TYPE_PRIORITY = { exam: 3, assignment: 2, homework: 1 };
const force = process.argv.includes('--force');
const todayMs = Date.now();

// Only consider upcoming assessments (date >= today) so past exams don't drive nudges.
const nearest = (assessmentConfig.assessments || [])
  .filter(a => new Date(a.date + 'T12:00:00Z') >= new Date(new Date().toDateString()))
  .sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
  })[0] || null;

if (!nearest) {
  console.log('No upcoming assessments in assessment-config.json — no nudge sent.');
  process.exit(0);
}

const nearestAssessment = nearest.name;
const assessmentDate    = nearest.date_display;

// Calendar guard: when the nearest assessment is an exam, only send nudges ≤ 2 days before it.
// Run this script daily via cron — it exits quietly on non-exam days that are too early.
// When the nearest assessment is homework or an assignment, skip the guard and send whenever called.
const daysUntil = Math.ceil((new Date(nearest.date + 'T12:00:00Z') - todayMs) / 86_400_000);
if (nearest.type === 'exam' && daysUntil > 2 && !force) {
  console.log(`Next assessment: ${nearestAssessment} (${assessmentDate}), ${daysUntil} day(s) away — no nudge sent (exam guard).`);
  console.log('Run with --force to send nudges regardless of date.');
  process.exit(0);
}

// ── Template ──────────────────────────────────────────────────────────────────

const SEP        = '---------------------------------------------------------------------';
const BREADCRUMB = `2526S CSSE230 -> Debugging Feedback -> ${fullName}`;
const AUTOMATED_FOOTER = [
  '',
  SEP,
  'This email was sent automatically \u2014 replies are not monitored.',
  'For questions, contact gajavegs@rose-hulman.edu.',
].join('\n');

function renderNudge(highUrgencyCount, reportLink, feedbackLink) {
  const subject = `CSSE 230 \u2014 ${shortName} feedback reminder (${nearestAssessment}, ${assessmentDate})`;
  const body = [
    BREADCRUMB,
    SEP,
    `Your debugging feedback for '${fullName}' is still`,
    `available. ${highUrgencyCount} patterns were flagged as relevant`,
    `to ${nearestAssessment} (${assessmentDate}).`,
    '',
    'View your feedback summary (PDF):',
    '',
    reportLink,
    '',
    'Or open the interactive feedback site:',
    '',
    feedbackLink,
    '',
    SEP,
    AUTOMATED_FOOTER,
  ].join('\n');
  return { subject, body };
}

// ── Find candidates ───────────────────────────────────────────────────────────

// Students with a sent feedback_ready or regeneration_ready email for this
// assignment, no page_view event, and no nudge already queued/sent.
const candidates = db.prepare(`
  SELECT eq.token, eq.recipient, t.student_id
  FROM email_queue eq
  JOIN tokens t ON t.token = eq.token
  WHERE eq.assignment = ?
    AND eq.email_type IN ('feedback_ready', 'regeneration_ready')
    AND eq.status = 'sent'
    AND NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.token = eq.token AND e.event_type = 'page_view'
    )
    AND NOT EXISTS (
      SELECT 1 FROM email_queue n
      WHERE n.token = eq.token AND n.assignment = eq.assignment AND n.email_type = 'nudge'
    )
`).all(assignment);

if (!candidates.length) {
  console.log('No eligible students for nudge (all have viewed feedback or already nudged).');
  process.exit(0);
}

console.log(`Found ${candidates.length} student(s) without page_view — queueing nudges.\n`);

let queued = 0;

for (const { token, recipient, student_id } of candidates) {
  const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
  let highUrgencyCount = 0;
  if (fs.existsSync(frontendJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
      highUrgencyCount = data.feedback?.length || 0;
    } catch { /* leave 0 */ }
  }

  const feedbackLink = `${BASE_URL}/feedback?token=${token}`;
  const reportLink   = `${BASE_URL}/report?token=${token}`;
  const { subject, body } = renderNudge(highUrgencyCount, reportLink, feedbackLink);

  db.prepare(
    'INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)'
  ).run(token, recipient, subject, body, 'nudge', assignment);

  console.log(`  [nudge] ${student_id} → ${recipient} (${highUrgencyCount} patterns, ${nearestAssessment})`);
  queued++;
}

console.log(`\nDone. ${queued} nudge email(s) queued.`);
