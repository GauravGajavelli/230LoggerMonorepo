#!/usr/bin/env node
/**
 * validate-assignment-config.js <assignment-slug>
 *
 * Pre-flight validation for all three assignment config files.
 * Run before process-batch.js or queue-emails.js for a new assignment.
 *
 * Exit codes:
 *   0 — all checks passed (warnings are non-fatal)
 *   1 — one or more ERROR-level checks failed
 *
 * Usage (run from Frontend/):
 *   node scripts/validate-assignment-config.js wuas
 *   node scripts/validate-assignment-config.js bst
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ASSIGNMENTS_DIR = path.join(REPO_ROOT, 'Pipeline', 'assignments');

const assignment = process.argv[2];
if (!assignment) {
  console.error('Usage: node scripts/validate-assignment-config.js <assignment-slug>');
  process.exit(1);
}

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const GREEN  = s => `\x1b[32m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const RED    = s => `\x1b[31m${s}\x1b[0m`;
const BOLD   = s => `\x1b[1m${s}\x1b[0m`;

let errors = 0;
let warnings = 0;

function pass(msg)  { console.log(`  ${GREEN('✓')} ${msg}`); }
function warn(msg)  { console.log(`  ${YELLOW('⚠')} ${msg}`); warnings++; }
function error(msg) { console.log(`  ${RED('✗')} ${msg}`); errors++; }

// ── Load files ────────────────────────────────────────────────────────────────
const assessmentCfgPath  = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
const testCategoriesPath = path.join(ASSIGNMENTS_DIR, `${assignment}_test_categories.json`);
const drillQuestionsPath = path.join(ASSIGNMENTS_DIR, `${assignment}_drill_questions.json`);

console.log(BOLD(`\nValidating config for: ${assignment}\n`));

// ── Check 1: File existence ───────────────────────────────────────────────────
console.log(BOLD('File existence'));

let assessmentConfig = null;
if (!fs.existsSync(assessmentCfgPath)) {
  error(`Missing: Pipeline/assignments/${assignment}_assessment_config.json`);
} else {
  try {
    assessmentConfig = JSON.parse(fs.readFileSync(assessmentCfgPath, 'utf8'));
    pass(`${assignment}_assessment_config.json`);
  } catch (e) {
    error(`Invalid JSON in ${assignment}_assessment_config.json: ${e.message}`);
  }
}

let testCategories = null;
if (!fs.existsSync(testCategoriesPath)) {
  error(`Missing: Pipeline/assignments/${assignment}_test_categories.json`);
} else {
  try {
    testCategories = JSON.parse(fs.readFileSync(testCategoriesPath, 'utf8'));
    pass(`${assignment}_test_categories.json`);
  } catch (e) {
    error(`Invalid JSON in ${assignment}_test_categories.json: ${e.message}`);
  }
}

let drillQuestions = null;
if (!fs.existsSync(drillQuestionsPath)) {
  warn(`Missing: Pipeline/assignments/${assignment}_drill_questions.json (reports work without drills, but no practice drills will appear)`);
} else {
  try {
    drillQuestions = JSON.parse(fs.readFileSync(drillQuestionsPath, 'utf8'));
    pass(`${assignment}_drill_questions.json`);
  } catch (e) {
    error(`Invalid JSON in ${assignment}_drill_questions.json: ${e.message}`);
  }
}

// ── Check 2: Assessment config structure ─────────────────────────────────────
if (assessmentConfig) {
  console.log(BOLD('\nAssessment config'));

  const assessments = assessmentConfig.assessments;
  if (!Array.isArray(assessments) || assessments.length === 0) {
    error('assessments[] array is missing or empty');
  } else {
    pass(`${assessments.length} assessment(s) found`);
    const now = new Date();
    for (const a of assessments) {
      const prefix = `[${a.id ?? '?'}]`;
      if (!a.name)  error(`${prefix} missing 'name'`);
      if (!a.date)  error(`${prefix} missing 'date'`);
      if (!a.type)  error(`${prefix} missing 'type' (exam/homework/assignment)`);
      if (!a.concept_weights || typeof a.concept_weights !== 'object') {
        error(`${prefix} missing or invalid 'concept_weights'`);
      } else {
        const weightSum = Object.values(a.concept_weights).reduce((s, w) => s + w, 0);
        if (weightSum <= 0) warn(`${prefix} all concept_weights are zero — no drills will appear for this assessment`);
      }
      if (a.date) {
        const daysLeft = Math.ceil((new Date(a.date + 'T12:00:00Z') - now) / 86400000);
        if (daysLeft < -7) warn(`${prefix} date ${a.date} is more than 7 days in the past`);
      }
    }
  }
}

// ── Check 3: Drill questions structure ───────────────────────────────────────
if (drillQuestions) {
  console.log(BOLD('\nDrill questions'));

  if (!Array.isArray(drillQuestions) || drillQuestions.length === 0) {
    error('drill_questions must be a non-empty array');
  } else {
    pass(`${drillQuestions.length} drill(s) found`);
    for (const d of drillQuestions) {
      const prefix = `[${d.id ?? '?'}]`;
      if (!d.id)                        error(`${prefix} missing 'id'`);
      if (!Array.isArray(d.categories) || d.categories.length === 0)
                                        error(`${prefix} missing or empty 'categories[]'`);
      if (!d.testCode)                  error(`${prefix} missing 'testCode'`);
      if (!Array.isArray(d.hints) || d.hints.length === 0)
                                        error(`${prefix} missing or empty 'hints[]'`);
    }
  }
}

// ── Check 4: Cross-file coverage ─────────────────────────────────────────────
if (assessmentConfig && drillQuestions) {
  console.log(BOLD('\nDrill coverage'));

  // Build category → drill count map
  const drillCatCounts = {};
  for (const d of drillQuestions) {
    for (const cat of (d.categories || [])) {
      drillCatCounts[cat] = (drillCatCounts[cat] || 0) + 1;
    }
  }

  // Check each concept_weight category has at least one drill
  const allCats = new Set();
  for (const a of (assessmentConfig.assessments || [])) {
    for (const [cat, w] of Object.entries(a.concept_weights || {})) {
      if (w > 0) allCats.add(cat);
    }
  }
  let uncoveredAny = false;
  for (const cat of allCats) {
    if (!drillCatCounts[cat]) {
      warn(`Category '${cat}' appears in concept_weights but has no matching drill`);
      uncoveredAny = true;
    }
  }
  if (!uncoveredAny) pass('All concept_weight categories have at least one drill');
}

if (testCategories && drillQuestions) {
  // Check drill categories exist in test_categories
  const knownCats = new Set(Object.keys(testCategories.categories || {}));
  for (const d of drillQuestions) {
    for (const cat of (d.categories || [])) {
      if (!knownCats.has(cat)) {
        warn(`Drill '${d.id}' category '${cat}' not found in test_categories.json`);
      }
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (errors === 0 && warnings === 0) {
  console.log(GREEN(BOLD('All checks passed.')));
} else if (errors === 0) {
  console.log(YELLOW(BOLD(`Passed with ${warnings} warning(s). Review before sending.`)));
} else {
  console.log(RED(BOLD(`${errors} error(s), ${warnings} warning(s). Fix errors before proceeding.`)));
}
console.log('');

process.exit(errors > 0 ? 1 : 0);
