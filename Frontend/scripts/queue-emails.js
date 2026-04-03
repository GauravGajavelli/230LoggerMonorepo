#!/usr/bin/env node
/**
 * queue-emails.js <assignment-slug> [display-name]
 *
 * Queues 'feedback_ready' emails for students with a successful pipeline run,
 * and 'missing_tar' emails for students with no run.tar.
 *
 * Reads data/{assignment}/assessment-config.json for short_name, full_name,
 * nearest_assessment, and assessment_date.
 * Reads data/{assignment}/output/{student_id}/frontend.json for pattern_count.
 *
 * Usage (run from Frontend/):
 *   node scripts/queue-emails.js bst "Binary Search Tree"
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assignment  = process.argv[2];
const displayName = process.argv[3] || process.env.ASSIGNMENT_DISPLAY_NAME || assignment;

if (!assignment) {
  console.error('Usage: node scripts/queue-emails.js <assignment-slug> [display-name]');
  process.exit(1);
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── Assessment config ─────────────────────────────────────────────────────────

const cfgPath = path.join(DATA_DIR, assignment, 'assessment-config.json');
if (!fs.existsSync(cfgPath)) {
  console.error(`Missing assessment config: ${cfgPath}`);
  console.error('Create data/{assignment}/assessment-config.json before queueing emails.');
  process.exit(1);
}

const assessmentConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const fullName  = assessmentConfig.full_name  || displayName;
const shortName = assessmentConfig.short_name || displayName;

// Resolve nearest assessment: earliest date, exam > assignment > homework on ties
const TYPE_PRIORITY = { exam: 3, assignment: 2, homework: 1 };
const nearest = (assessmentConfig.assessments || [])
  .sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
  })[0] || null;

if (!nearest) {
  console.error('No assessments found in assessment-config.json.');
  process.exit(1);
}

const nearestAssessment = nearest.name;
const assessmentDate    = nearest.date_display;

// ── Template rendering ────────────────────────────────────────────────────────

const SEP        = '---------------------------------------------------------------------';
const BREADCRUMB = `2526S CSSE230 -> Debugging Feedback -> ${fullName}`;
const AUTOMATED_FOOTER = [
  '',
  SEP,
  'This email was sent automatically \u2014 replies are not monitored.',
  'For questions, contact gajavegs@rose-hulman.edu.',
].join('\n');

function renderFeedbackReady(patternCount, reportLink, feedbackLink) {
  const fullSubject  = `CSSE 230 \u2014 ${shortName} feedback available (${patternCount} patterns, ${nearestAssessment})`;
  const shortSubject = `CSSE 230 \u2014 ${shortName} feedback available (${patternCount} patterns)`;
  const subject = fullSubject.length <= 60 ? fullSubject : shortSubject;
  const body = [
    BREADCRUMB,
    SEP,
    `Your debugging feedback for '${fullName}' has been`,
    `processed. ${patternCount} patterns were identified, relevant to`,
    `${nearestAssessment} (${assessmentDate}).`,
    '',
    'View your feedback summary (PDF):',
    '',
    reportLink,
    '',
    'Or open the interactive feedback site:',
    '',
    feedbackLink,
    '',
    'This feedback is private to you and is not shared with course staff.',
    SEP,
    AUTOMATED_FOOTER,
  ].join('\n');
  return { subject, body };
}

function renderMissingTar(link) {
  const subject = `CSSE 230 \u2014 ${shortName} feedback: action needed`;
  const body = [
    BREADCRUMB,
    SEP,
    `Your debugging feedback for '${fullName}' could not`,
    'be generated because no run.tar file was found in your',
    'submission.',
    '',
    'If you have your run.tar file, you can upload it to generate',
    'feedback:',
    '',
    link,
    '',
    SEP,
    AUTOMATED_FOOTER,
  ].join('\n');
  return { subject, body };
}

// ── Queue emails ──────────────────────────────────────────────────────────────

const tokenRows = db.prepare('SELECT token, student_id, email FROM tokens WHERE assignment=?').all(assignment);
if (!tokenRows.length) {
  console.error(`No tokens for "${assignment}". Run generate-tokens.js first.`);
  process.exit(1);
}

let feedbackQueued = 0, missingQueued = 0, skipped = 0;

for (const { token, student_id, email } of tokenRows) {
  const hasTar = fs.existsSync(path.join(DATA_DIR, assignment, 'tars', student_id, 'run.tar'));
  const hasSuccess = db.prepare(
    "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='success' ORDER BY id DESC LIMIT 1"
  ).get(student_id, assignment);

  const emailType = hasSuccess ? 'feedback_ready' : (!hasTar ? 'missing_tar' : null);
  if (!emailType) {
    console.log(`  [skip] ${student_id} — tar exists but pipeline not successful yet`);
    skipped++;
    continue;
  }

  const alreadyQueued = db.prepare(
    "SELECT id FROM email_queue WHERE token=? AND email_type=? AND assignment=?"
  ).get(token, emailType, assignment);
  if (alreadyQueued) {
    console.log(`  [skip] ${student_id} — already queued`);
    skipped++;
    continue;
  }

  const feedbackLink = `${BASE_URL}/feedback?token=${token}`;
  const reportLink   = `${BASE_URL}/report?token=${token}`;
  let subject, body;

  if (emailType === 'feedback_ready') {
    const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
    let patternCount = 0;
    if (fs.existsSync(frontendJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
        patternCount = data.feedback?.length || 0;
      } catch { /* leave patternCount = 0 */ }
    }
    ({ subject, body } = renderFeedbackReady(patternCount, reportLink, feedbackLink));
    console.log(`  [feedback_ready] ${student_id} → ${email} (${patternCount} patterns)`);
    feedbackQueued++;
  } else {
    ({ subject, body } = renderMissingTar(feedbackLink));
    console.log(`  [missing_tar]    ${student_id} → ${email}`);
    missingQueued++;
  }

  db.prepare(
    'INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)'
  ).run(token, email, subject, body, emailType, assignment);
}

console.log(`\nDone. ${feedbackQueued} feedback_ready, ${missingQueued} missing_tar queued; ${skipped} skipped.`);
