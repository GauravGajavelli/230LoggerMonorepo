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
const dataLines = lines[0]?.toLowerCase().includes('student_id') ? lines.slice(1) : lines;

const upsert = db.prepare(`
  INSERT INTO tokens (token, student_id, email, assignment)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(student_id, assignment) DO UPDATE SET
    token = excluded.token, email = excluded.email
`);

let inserted = 0, skipped = 0;
db.transaction(() => {
  for (const line of dataLines) {
    const [studentId, email] = line.split(',').map(s => s.trim());
    if (!studentId || !email) { console.warn(`  [skip] Malformed line: ${line}`); skipped++; continue; }
    const token = generateToken(studentId, assignment, SECRET_KEY);
    upsert.run(token, studentId, email, assignment);
    console.log(`  ${studentId} → ${token}  (${email})`);
    inserted++;
  }
})();

console.log(`\nDone. ${inserted} tokens for assignment "${assignment}", ${skipped} skipped.`);
