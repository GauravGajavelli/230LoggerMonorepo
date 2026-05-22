#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(__dirname, '../data');
const DEFAULT_DB = path.resolve(__dirname, '../db/feedback.db');
const ASSIGNMENTS = ['bst', 'string_hashset', 'graphsurfing'];
const ASSIGNMENT_LABELS = {
  bst: 'Binary Search Tree',
  string_hashset: 'String Hash Set',
  graphsurfing: 'Graph Surfing',
};

// Only students who opted in to the IRB study
const OPTED_IN = new Set([
  'mirandac', 'kamerhd', 'mccordca', 'weiz3', 'cherukbj', 'clutteda',
  'wangj36', 'adusumn', 'theslikj', 'riedliso', 'weberjm1', 'osujiun',
]);

const RATER_IDS = ['TA-1', 'TA-2', 'TA-3', 'TA-4', 'TA-5'];
const SEED = 42;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'rater-rating-secret-key';

const dbPath = process.argv.find(a => a.startsWith('--db='))?.slice(5) || DEFAULT_DB;

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRaterToken(raterId) {
  return crypto.createHmac('sha256', TOKEN_SECRET)
    .update(`rater:${raterId}`)
    .digest('hex')
    .slice(0, 16);
}

function collectPairs() {
  const pairs = [];
  for (const asgn of ASSIGNMENTS) {
    const outputDir = path.join(DATA_DIR, asgn, 'output');
    if (!fs.existsSync(outputDir)) continue;
    for (const studentId of fs.readdirSync(outputDir)) {
      if (!OPTED_IN.has(studentId)) continue;

      const frontendPath = path.join(outputDir, studentId, 'frontend.json');
      const reportPdfPath = path.join(outputDir, studentId, 'report.pdf');
      const hasFrontend = fs.existsSync(frontendPath);
      const hasPdf = fs.existsSync(reportPdfPath);

      let feedbackCount = 0;
      if (hasFrontend) {
        const frontend = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));
        feedbackCount = (frontend.feedback || []).length;
      }

      // Personalized: has frontend.json with feedback > 0
      // Generic: has report.pdf but no personalized feedback
      if (feedbackCount > 0) {
        pairs.push({
          studentId, assignment: asgn,
          displayName: ASSIGNMENT_LABELS[asgn] || asgn,
          type: 'personalized', feedbackCount,
        });
      } else if (hasPdf) {
        pairs.push({
          studentId, assignment: asgn,
          displayName: ASSIGNMENT_LABELS[asgn] || asgn,
          type: 'generic', feedbackCount: 0,
        });
      }
    }
  }
  return pairs;
}

const pairs = collectPairs();
const personalized = pairs.filter(p => p.type === 'personalized');
const generic = pairs.filter(p => p.type === 'generic');
console.log(`Found ${pairs.length} total pairs (${personalized.length} personalized, ${generic.length} generic)`);

// Shuffle personalized and generic separately, then interleave (personalized first)
const shuffledPersonalized = seededShuffle(personalized, SEED);
const shuffledGeneric = seededShuffle(generic, SEED + 1);
const allShuffled = [...shuffledPersonalized, ...shuffledGeneric];

// Assign pair IDs: P001-P0XX for personalized, G001-G0XX for generic
let pIdx = 0, gIdx = 0;
const pairList = allShuffled.map((p, i) => {
  const prefix = p.type === 'personalized' ? `P${String(++pIdx).padStart(3, '0')}` : `G${String(++gIdx).padStart(3, '0')}`;
  return { ...p, pairId: prefix, sortOrder: i };
});

// Open DB and seed
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Drop and recreate rater tables (keeps ratings for continuity)
db.exec('DROP TABLE IF EXISTS rater_pair_assignments');
db.exec('DROP TABLE IF EXISTS rater_pairs');
db.exec('DROP TABLE IF EXISTS rater_sessions');

db.exec(`
  CREATE TABLE rater_sessions (
    rater_id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE,
    current_pair TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE rater_pairs (
    pair_id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
    assignment TEXT NOT NULL, display_name TEXT NOT NULL,
    pair_type TEXT NOT NULL DEFAULT 'personalized',
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE rater_pair_assignments (
    rater_id TEXT NOT NULL, pair_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL, PRIMARY KEY (rater_id, pair_id)
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pair_id TEXT NOT NULL,
    rater_id TEXT NOT NULL, test_id TEXT NOT NULL DEFAULT '_pair_',
    assignment TEXT NOT NULL,
    correctness INTEGER, actionability INTEGER, specificity INTEGER,
    failure_modes TEXT, notes TEXT,
    updated_at TEXT DEFAULT (datetime('now')), UNIQUE(pair_id, rater_id, test_id)
  );
`);

const insertPair = db.prepare(
  'INSERT INTO rater_pairs (pair_id, student_id, assignment, display_name, pair_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertSession = db.prepare(
  'INSERT INTO rater_sessions (rater_id, token) VALUES (?, ?)'
);
const insertAssignment = db.prepare(
  'INSERT INTO rater_pair_assignments (rater_id, pair_id, sort_order) VALUES (?, ?, ?)'
);

const seedAll = db.transaction(() => {
  for (const p of pairList) {
    insertPair.run(p.pairId, p.studentId, p.assignment, p.displayName, p.type, p.sortOrder);
  }

  for (const raterId of RATER_IDS) {
    const token = generateRaterToken(raterId);
    insertSession.run(raterId, token);

    // All raters get all pairs (36 total is manageable)
    pairList.forEach((p, order) => {
      insertAssignment.run(raterId, p.pairId, order);
    });
  }
});

seedAll();

// Print summary
console.log(`\nSeeded ${pairList.length} pairs into rater_pairs`);
console.log(`  Personalized (P###): ${pIdx}`);
console.log(`  Generic (G###): ${gIdx}`);

console.log(`\nAssignment breakdown:`);
for (const asgn of ASSIGNMENTS) {
  const pCount = pairList.filter(p => p.assignment === asgn && p.type === 'personalized').length;
  const gCount = pairList.filter(p => p.assignment === asgn && p.type === 'generic').length;
  console.log(`  ${ASSIGNMENT_LABELS[asgn]}: ${pCount} personalized + ${gCount} generic = ${pCount + gCount}`);
}

console.log(`\nRater URLs (each rater gets all ${pairList.length} pairs):`);
for (const raterId of RATER_IDS) {
  const token = generateRaterToken(raterId);
  console.log(`  ${raterId}:`);
  console.log(`    Local:  http://localhost:3000/rate?token=${token}`);
  console.log(`    Server: https://feedback.csse.rose-hulman.edu/rate?token=${token}`);
}

console.log(`\nOpted-in students: ${[...OPTED_IN].sort().join(', ')}`);

db.close();
