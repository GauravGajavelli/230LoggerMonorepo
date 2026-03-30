#!/usr/bin/env node
/**
 * queue-emails.js <assignment-slug> [display-name]
 *
 * Queues 'feedback_ready' emails for students with a successful pipeline run,
 * and 'missing_tar' emails for students with no run.tar.
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

const TEMPLATES = {
  feedback_ready: (dn, link) => ({
    subject: `Your ${dn} debugging feedback is ready`,
    body: `Hi,\n\nYour debugging feedback for the ${dn} assignment is ready to view:\n\n${link}\n\nThis link is private to you — please don't share it.\n\nIf you have questions, contact gajavegs@rose-hulman.edu.`,
  }),
  missing_tar: (dn, link) => ({
    subject: `Your ${dn} debugging feedback — action needed`,
    body: `Hi,\n\nWe tried to generate your debugging feedback for ${dn}, but couldn't find a run.tar file in your submission.\n\nIf you have your run.tar file locally, upload it at:\n\n${link}\n\nIt's in your project directory under the testSupport folder.`,
  }),
};

const tokenRows = db.prepare('SELECT token, student_id, email FROM tokens WHERE assignment=?').all(assignment);
if (!tokenRows.length) {
  console.error(`No tokens for "${assignment}". Run generate-tokens.js first.`); process.exit(1);
}

let feedbackQueued = 0, missingQueued = 0;

for (const { token, student_id, email } of tokenRows) {
  const hasTar = fs.existsSync(path.join(DATA_DIR, assignment, 'tars', student_id, 'run.tar'));
  const hasSuccess = db.prepare(
    "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='success' ORDER BY id DESC LIMIT 1"
  ).get(student_id, assignment);
  const emailType = hasSuccess ? 'feedback_ready' : (!hasTar ? 'missing_tar' : null);
  if (!emailType) { console.log(`  [skip] ${student_id} — tar exists but pipeline not successful yet`); continue; }

  const alreadyQueued = db.prepare(
    "SELECT id FROM email_queue WHERE token=? AND email_type=? AND assignment=?"
  ).get(token, emailType, assignment);
  if (alreadyQueued) { console.log(`  [skip] ${student_id} — already queued`); continue; }

  const link = `${BASE_URL}/feedback?token=${token}`;
  const { subject, body } = TEMPLATES[emailType](displayName, link);
  db.prepare('INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)')
    .run(token, email, subject, body, emailType, assignment);

  if (emailType === 'feedback_ready') { console.log(`  [feedback_ready] ${student_id} → ${email}`); feedbackQueued++; }
  else { console.log(`  [missing_tar]    ${student_id} → ${email}`); missingQueued++; }
}

console.log(`\nDone. ${feedbackQueued} feedback emails queued, ${missingQueued} missing-tar emails queued.`);
