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
import { generateGenericReport } from '../lib/report.js';

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

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSIGNMENTS_DIR = path.join(REPO_ROOT, 'Pipeline', 'assignments');
const cfgPath = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
if (!fs.existsSync(cfgPath)) {
  console.error(`Missing assessment config: ${cfgPath}`);
  console.error(`Create Pipeline/assignments/${assignment}_assessment_config.json before queueing emails.`);
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

// ── Template rendering (HTML) ─────────────────────────────────────────────────

const FONT  = 'font-family: Arial, Helvetica, sans-serif;';
const CRUMB = `2526S CSSE230 &rsaquo; Debugging Feedback &rsaquo; ${fullName}`;
const HR    = '<hr style="border:none;border-top:1px solid #ddd;margin:14px 0;">';
const FOOTER_HTML = `
  ${HR}
  <p style="${FONT} font-size:12px; color:#888; margin:0;">
    This email was sent automatically. Replies are not monitored.<br>
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

function renderFeedbackReady(patternCount, reportLink, feedbackLink) {
  const fullSubject  = `CSSE 230: ${shortName} Feedback Available (${patternCount} patterns, ${nearestAssessment})`;
  const shortSubject = `CSSE 230: ${shortName} Feedback Available (${patternCount} patterns)`;
  const subject = fullSubject.length <= 60 ? fullSubject : shortSubject;
  const body = wrap(`
    <p>Your debugging feedback for <strong>${fullName}</strong> has been processed.
       ${patternCount} pattern${patternCount !== 1 ? 's were' : ' was'} identified,
       relevant to ${nearestAssessment} (${assessmentDate}).</p>
    <p><strong>View your feedback summary (PDF, ~3 min):</strong><br>
       <a href="${reportLink}">${reportLink}</a></p>
    <p><strong>Or open the interactive feedback site (~5&ndash;10 min):</strong><br>
       <a href="${feedbackLink}">${feedbackLink}</a></p>
    <p>This feedback is private to you and is not shared with course staff.</p>
    <p style="font-size:12px; color:#888;">
       If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  return { subject, body };
}

function renderMissingTar(uploadLink, reportLink) {
  const subject = `CSSE 230: ${shortName} Feedback, Action Needed`;
  const reviewSection = reportLink ? `
    <p>While you locate your file, here is an exam review guide
       covering the key topics for ${nearestAssessment}:<br>
       <a href="${reportLink}">${reportLink}</a></p>` : '';
  const body = wrap(`
    <p>Your debugging feedback for <strong>${fullName}</strong> could not be generated
       because no run.tar file was found in your submission.</p>
    <p>If you have your run.tar file, you can upload it to get personalized feedback
       focused on just your highest-priority practice areas:<br>
       <a href="${uploadLink}">${uploadLink}</a></p>
    ${reviewSection}
    <p style="font-size:12px; color:#888;">
       If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  return { subject, body };
}

function renderNoIssues(reportLink, feedbackLink) {
  const fullSubject  = `CSSE 230: ${shortName} Feedback (no issues flagged, ${nearestAssessment})`;
  const shortSubject = `CSSE 230: ${shortName} Feedback (no issues flagged)`;
  const subject = fullSubject.length <= 60 ? fullSubject : shortSubject;
  const reviewSection = reportLink ? `
    <p><strong>View an exam review guide for ${nearestAssessment} (${assessmentDate}):</strong><br>
       <a href="${reportLink}">${reportLink}</a></p>` : '';
  const body = wrap(`
    <p>Your debugging feedback for <strong>${fullName}</strong> has been processed.
       No issues were flagged in the required tests &mdash; your implementation is looking good.</p>
    ${reviewSection}
    <p><strong>You can also open the interactive feedback site:</strong><br>
       <a href="${feedbackLink}">${feedbackLink}</a></p>
    <p>This feedback is private to you and is not shared with course staff.</p>
    <p style="font-size:12px; color:#888;">
       If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  return { subject, body };
}

// ── Queue emails ──────────────────────────────────────────────────────────────

const tokenRows = db.prepare('SELECT token, student_id, email FROM tokens WHERE assignment=?').all(assignment);
if (!tokenRows.length) {
  console.error(`No tokens for "${assignment}". Run generate-tokens.js first.`);
  process.exit(1);
}

let feedbackQueued = 0, noIssuesQueued = 0, missingQueued = 0, skipped = 0;

for (const { token, student_id, email } of tokenRows) {
  const hasTar = fs.existsSync(path.join(DATA_DIR, assignment, 'tars', student_id, 'run.tar'));
  const hasSuccess = db.prepare(
    "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='success' ORDER BY id DESC LIMIT 1"
  ).get(student_id, assignment);

  // Read drill/pattern counts before determining email type
  let patternCount = 0, drillCount = 0;
  if (hasSuccess) {
    const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
    if (fs.existsSync(frontendJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
        patternCount = data.feedback?.length || 0;
        drillCount   = data.practiceDrills?.length || 0;
      } catch { /* leave at 0 */ }
    }
  }

  const emailType = hasSuccess
    ? (drillCount > 0 ? 'feedback_ready' : 'no_issues')
    : (!hasTar ? 'missing_tar' : null);
  if (!emailType) {
    console.log(`  [skip] ${student_id} — tar exists but pipeline not successful yet`);
    skipped++;
    continue;
  }

  const alreadyQueued = db.prepare(
    "SELECT id FROM email_queue WHERE token=? AND email_type=? AND assignment=? AND status != 'cancelled'"
  ).get(token, emailType, assignment);
  if (alreadyQueued) {
    console.log(`  [skip] ${student_id} — already queued`);
    skipped++;
    continue;
  }

  const feedbackLink   = `${BASE_URL}/feedback?token=${token}`;
  const studentReportLink = `${BASE_URL}/report?token=${token}`;
  let subject, body;

  if (emailType === 'feedback_ready') {
    ({ subject, body } = renderFeedbackReady(patternCount, studentReportLink, feedbackLink));
    console.log(`  [feedback_ready] ${student_id} → ${email} (${patternCount} patterns)`);
    feedbackQueued++;
  } else if (emailType === 'no_issues') {
    let genericReportLink = null;
    try {
      const reportPath = await generateGenericReport(student_id, assignment, token, DATA_DIR, BASE_URL);
      if (reportPath) genericReportLink = studentReportLink;
    } catch (err) {
      console.warn(`  [warn] Generic report failed for ${student_id}: ${err.message}`);
    }
    ({ subject, body } = renderNoIssues(genericReportLink, feedbackLink));
    console.log(`  [no_issues]      ${student_id} → ${email}${genericReportLink ? ' (+ review guide)' : ''}`);
    noIssuesQueued++;
  } else {
    let genericReportLink = null;
    try {
      const reportPath = await generateGenericReport(student_id, assignment, token, DATA_DIR, BASE_URL);
      if (reportPath) genericReportLink = studentReportLink;
    } catch (err) {
      console.warn(`  [warn] Generic report failed for ${student_id}: ${err.message}`);
    }
    ({ subject, body } = renderMissingTar(feedbackLink, genericReportLink));
    console.log(`  [missing_tar]    ${student_id} → ${email}${genericReportLink ? ' (+ review guide)' : ''}`);
    missingQueued++;
  }

  db.prepare(
    'INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)'
  ).run(token, email, subject, body, emailType, assignment);
}

console.log(`\nDone. ${feedbackQueued} feedback_ready, ${noIssuesQueued} no_issues, ${missingQueued} missing_tar queued; ${skipped} skipped.`);
