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
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSIGNMENTS_DIR = path.join(REPO_ROOT, 'Pipeline', 'assignments');

// ── Assessment config ─────────────────────────────────────────────────────────

const cfgPath = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
if (!fs.existsSync(cfgPath)) {
  console.error(`Missing assessment config: ${cfgPath}`);
  console.error(`Create Pipeline/assignments/${assignment}_assessment_config.json first.`);
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

// ── Templates (HTML) ─────────────────────────────────────────────────────────

const FONT  = 'font-family: Arial, Helvetica, sans-serif;';
const CRUMB = `2526S CSSE230 &rsaquo; Debugging Feedback &rsaquo; ${fullName}`;
const HR    = '<hr style="border:none;border-top:1px solid #ddd;margin:14px 0;">';
const FOOTER_HTML = `
  ${HR}
  <p style="${FONT} font-size:12px; color:#888; margin:0;">
    This email was sent automatically -- replies are not monitored.<br>
    For questions, contact gajavegs@rose-hulman.edu.
  </p>`;

function wrap(inner) {
  return `<div style="${FONT} font-size:14px; color:#333; max-width:600px; line-height:1.5;">
  <p style="font-size:12px; color:#999; margin:0 0 4px;">${CRUMB}</p>
  ${HR}
  ${inner}
  ${FOOTER_HTML}
</div>`;
}

function renderNudge(patternCount, reportLink, feedbackLink) {
  const subject = `CSSE 230: ${shortName} Feedback Reminder (${nearestAssessment}, ${assessmentDate})`;
  const body = wrap(`
    <p>Your debugging feedback for <strong>${fullName}</strong> is still available.
       ${patternCount} pattern${patternCount !== 1 ? 's were' : ' was'} flagged as relevant
       to ${nearestAssessment} (${assessmentDate}).</p>
    <p><strong>View your feedback summary (PDF):</strong><br>
       <a href="${reportLink}">${reportLink}</a></p>
    <p><strong>Or open the interactive feedback site:</strong><br>
       <a href="${feedbackLink}">${feedbackLink}</a></p>
    <p style="font-size:12px; color:#888;">
       If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  return { subject, body };
}

function renderMissingTarNudge(uploadLink, reportLink) {
  const subject = `CSSE 230: ${shortName} Exam Review Reminder (${nearestAssessment}, ${assessmentDate})`;
  const body = wrap(`
    <p>A reminder that your exam review guide for <strong>${fullName}</strong> is still available
       ahead of ${nearestAssessment} (${assessmentDate}).</p>
    ${reportLink ? `<p><strong>View the exam review guide (PDF):</strong><br>
       <a href="${reportLink}">${reportLink}</a></p>` : ''}
    <p>If you have located your run.tar file, you can upload it to get personalized feedback
       focused on your specific weak areas:<br>
       <a href="${uploadLink}">${uploadLink}</a></p>
    <p style="font-size:12px; color:#888;">
       If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  return { subject, body };
}

// ── Find candidates ───────────────────────────────────────────────────────────

// Students with a sent feedback_ready or regeneration_ready email — no page_view, no prior nudge.
const feedbackCandidates = db.prepare(`
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

// Students with only a sent missing_tar email — no page_view, no prior nudge.
const missingTarCandidates = db.prepare(`
  SELECT eq.token, eq.recipient, t.student_id
  FROM email_queue eq
  JOIN tokens t ON t.token = eq.token
  WHERE eq.assignment = ?
    AND eq.email_type = 'missing_tar'
    AND eq.status = 'sent'
    AND NOT EXISTS (
      SELECT 1 FROM email_queue other
      WHERE other.token = eq.token
        AND other.assignment = eq.assignment
        AND other.email_type IN ('feedback_ready', 'regeneration_ready')
    )
    AND NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.token = eq.token AND e.event_type = 'page_view'
    )
    AND NOT EXISTS (
      SELECT 1 FROM email_queue n
      WHERE n.token = eq.token AND n.assignment = eq.assignment AND n.email_type = 'nudge'
    )
`).all(assignment);

if (!feedbackCandidates.length && !missingTarCandidates.length) {
  console.log('No eligible students for nudge (all have viewed feedback or already nudged).');
  process.exit(0);
}

console.log(`Found ${feedbackCandidates.length} feedback + ${missingTarCandidates.length} missing_tar candidate(s) — queueing nudges.\n`);

let queued = 0;

for (const { token, recipient, student_id } of feedbackCandidates) {
  const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
  let patternCount = 0;
  if (fs.existsSync(frontendJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
      patternCount = data.feedback?.length || 0;
    } catch { /* leave 0 */ }
  }

  const feedbackLink = `${BASE_URL}/feedback?token=${token}`;
  const reportLink   = `${BASE_URL}/report?token=${token}`;
  const { subject, body } = renderNudge(patternCount, reportLink, feedbackLink);

  db.prepare(
    'INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)'
  ).run(token, recipient, subject, body, 'nudge', assignment);

  console.log(`  [nudge:feedback]    ${student_id} → ${recipient} (${patternCount} patterns)`);
  queued++;
}

for (const { token, recipient, student_id } of missingTarCandidates) {
  const uploadLink = `${BASE_URL}/feedback?token=${token}`;
  const reportPath = path.join(DATA_DIR, assignment, 'output', student_id, 'report.pdf');
  const reportLink = fs.existsSync(reportPath) ? `${BASE_URL}/report?token=${token}` : null;
  const { subject, body } = renderMissingTarNudge(uploadLink, reportLink);

  db.prepare(
    'INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)'
  ).run(token, recipient, subject, body, 'nudge', assignment);

  console.log(`  [nudge:missing_tar] ${student_id} → ${recipient}${reportLink ? ' (+ review guide)' : ''}`);
  queued++;
}

console.log(`\nDone. ${queued} nudge email(s) queued.`);
