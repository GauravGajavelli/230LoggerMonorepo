#!/usr/bin/env node
/**
 * generate-tokens.js <assignment-slug>
 *
 * Reads data/roster.csv (student_id,email) and upserts HMAC tokens into the DB.
 *
 * Usage (run from Frontend/):
 *   node scripts/generate-tokens.js bst
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../lib/db.js';
import { generateToken } from '../lib/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assignment = process.argv[2];
const rosterFile = process.argv[3] || 'roster.csv';
if (!assignment) {
  console.error('Usage: node scripts/generate-tokens.js <assignment-slug> [roster-file]');
  console.error('  e.g. node scripts/generate-tokens.js wuas roster.dev.csv');
  process.exit(1);
}

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) { console.error('ERROR: SECRET_KEY not set in .env'); process.exit(1); }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const rosterPath = path.join(DATA_DIR, rosterFile);

if (!fs.existsSync(rosterPath)) {
  console.error(`ERROR: Roster not found at ${rosterPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(rosterPath, 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const dataLines = lines[0]?.toLowerCase().includes('email') ? lines.slice(1) : lines;

const upsert = db.prepare(`
  INSERT INTO tokens (token, student_id, email, assignment)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(student_id, assignment) DO UPDATE SET
    token = excluded.token, email = excluded.email
`);

const rosterIds = new Set();
let inserted = 0, skipped = 0;
db.transaction(() => {
  for (const line of dataLines) {
    const parts = line.split(',').map(s => s.trim());
    const email = parts.find(p => p.includes('@'));
    if (!email) { console.warn(`  [skip] No email found on line: ${line}`); skipped++; continue; }
    const studentId = email.split('@')[0];
    rosterIds.add(studentId);
    const token = generateToken(studentId, assignment, SECRET_KEY);
    upsert.run(token, studentId, email, assignment);
    console.log(`  ${studentId} → ${token}  (${email})`);
    inserted++;
  }
})();

// Remove tokens for students no longer in the roster. Pending emails must be
// cancelled first to satisfy the FK constraint (foreign_keys = ON).
const stale = db.prepare(
  "SELECT token, student_id FROM tokens WHERE assignment = ?"
).all(assignment).filter(r => !rosterIds.has(r.student_id));

if (stale.length > 0) {
  db.transaction(() => {
    for (const { token, student_id } of stale) {
      db.prepare("DELETE FROM email_queue WHERE token = ? AND status = 'pending'").run(token);
      db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
      console.log(`  [removed] ${student_id} no longer in roster — token revoked, pending emails cancelled`);
    }
  })();
}

console.log(`\nDone. ${inserted} upserted, ${skipped} skipped, ${stale.length} removed for assignment "${assignment}".`);
