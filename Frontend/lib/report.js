/**
 * report.js
 *
 * Derives the report data model from frontend.json + assessment-config.json,
 * then generates a PDF via Puppeteer.
 *
 * Primary export:
 *   generateReport(studentId, assignment, dataDir, baseUrl)
 *     → writes report.pdf to data/{assignment}/output/{studentId}/report.pdf
 *     → returns the path, or null if no frontend.json exists
 *
 * Data derivation logic:
 *   1. Load frontend.json → feedback[].categories per pattern
 *   2. Load assessment-config.json → concept_weights per assessment
 *   3. For each feedback item, resolve categories via test_categories.json,
 *      find all assessments whose concept_weights include any of those categories
 *   4. Post-dedup: keep only the highest-weight drill per primary concept area
 *      so displayed percentages are mutually exclusive
 *   5. overlap_pct per assessment = sum of surviving drills' match weights (capped at 100)
 *   6. Sort assessments by composite relevance score, then date, then type
 *   7. Split into exam_assessments and hw_assessments for the two-zone report layout
 */

import fs from 'fs';
import path from 'path';
import { renderReportHtml, renderDrillSheetPageHtml } from './reportTemplate.js';

const TYPE_PRIORITY = { exam: 3, assignment: 2, homework: 1 };

const CATEGORY_LABELS = {
  anagram:          'Anagram Detection',
  priorityQueue:    'Priority Queue',
  binarySearch:     'Binary Search',
  euclid:           "Euclid's Algorithm",
  ngramCounting:    'N-gram Counting',
  comparable:       'Comparable / Sorting',
  sortedLinkedList: 'Sorted Linked List',
  treeSet:          'TreeSet / BST',
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Assessments further out than this get no drill assignments (still appear in the table strip).
const DRILL_HORIZON_DAYS = 21;

function urgencyFactor(days) {
  if (days <= 3)  return 1.0;
  if (days <= 7)  return 0.8;
  if (days <= 14) return 0.6;
  if (days <= 30) return 0.4;
  return 0.2;
}

// Approximate time (minutes) per drill based on drillPoints.
// drillPoints is ~25% of pointsAvailable; 1pt ≈ 5 min.
function estimateTime(drill) {
  if (drill?.timeEstimate) {
    const m = String(drill.timeEstimate).match(/(\d+)/);
    if (m) return parseInt(m[1]);
  }
  return drill?.drillPoints ? drill.drillPoints * 5 : 5;
}

// Extract a human-readable pattern name from a feedback item.
function patternName(fb) {
  if (fb.pattern) return fb.pattern;
  const hash = fb.testId?.indexOf('#') ?? -1;
  if (hash >= 0) return fb.testId.substring(hash + 1).replace(/\(.*\)/, '');
  return fb.testId || 'Unknown pattern';
}

// Get test method names associated with a feedback item.
function testNames(fb) {
  const names = [];
  if (fb.testId) {
    const hash = fb.testId.indexOf('#');
    if (hash >= 0) names.push(fb.testId.substring(hash + 1).replace(/\(.*\)$/, '()'));
  }
  for (const id of fb.relatedTestIds || []) {
    const h = id.indexOf('#');
    if (h >= 0) names.push(id.substring(h + 1).replace(/\(.*\)$/, '()'));
  }
  return [...new Set(names)];
}

// Derive a URL anchor for this feedback item's drill section.
function drillAnchor(fb) {
  const hash = fb.testId?.indexOf('#') ?? -1;
  if (hash < 0) return null;
  return 'drill-' + fb.testId.substring(hash + 1).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// Resolve category keys for a feedback item's testId using the test_categories file.
function resolveCategories(testId, testToCategories) {
  if (!testToCategories || !testId) return [];
  if (testToCategories[testId]) return testToCategories[testId];
  const bare = testId.replace(/\(.*\)$/, '()');
  return testToCategories[bare] || [];
}

/**
 * Deduplicates drills within an assessment entry so concept percentages are mutually exclusive.
 * Each drill's "primary concept" = the category with the highest concept_weight for this assessment.
 * Among drills sharing the same primary concept, keep only the one with the highest matchWeight.
 */
function dedupByPrimaryConcept(drills, conceptWeights) {
  const best = new Map(); // primaryCat → drill entry
  for (const d of drills) {
    const cats = d._categories || [];
    if (cats.length === 0) continue;
    const primaryCat = cats.reduce((bestCat, c) =>
      (conceptWeights?.[c] ?? 0) > (conceptWeights?.[bestCat] ?? 0) ? c : bestCat
    , cats[0]);
    const existing = best.get(primaryCat);
    if (!existing || d._matchWeight > existing._matchWeight) {
      best.set(primaryCat, d);
    }
  }
  return [...best.values()];
}

export async function generateReport(studentId, assignment, dataDir, baseUrl) {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const outputDir        = path.join(dataDir, assignment, 'output', studentId);
  const frontendJsonPath = path.join(outputDir, 'frontend.json');
  const assessmentCfgPath = path.join(repoRoot, 'Pipeline', 'assignments', `${assignment}_assessment_config.json`);
  const reportJsonPath   = path.join(outputDir, 'report.json');
  const reportPdfPath    = path.join(outputDir, 'report.pdf');

  const testCategoriesPath = path.join(repoRoot, 'Pipeline', 'assignments', `${assignment}_test_categories.json`);
  let testToCategories = null;
  let categoryDescriptions = {};
  if (fs.existsSync(testCategoriesPath)) {
    try {
      const tc = JSON.parse(fs.readFileSync(testCategoriesPath, 'utf8'));
      testToCategories = tc.testToCategories || null;
      for (const [k, v] of Object.entries(tc.categories || {})) {
        categoryDescriptions[k] = v.description || k;
      }
    } catch { /* degrade gracefully */ }
  }

  if (!fs.existsSync(frontendJsonPath)) return null;

  const frontendData = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
  const feedbackItems = frontendData.feedback || [];
  const _now = new Date();
  const generatedAt = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate()); // local midnight today

  // Load assessment config (optional — report degrades gracefully without it)
  let assessmentConfig = null;
  if (fs.existsSync(assessmentCfgPath)) {
    assessmentConfig = JSON.parse(fs.readFileSync(assessmentCfgPath, 'utf8'));
  }

  const fullName  = assessmentConfig?.full_name  || assignment;
  const shortName = assessmentConfig?.short_name || assignment;
  const reviewVideoUrl = assessmentConfig?.review_video_url || null;

  // Map each feedback item to all relevant assessments
  const assessmentMap = new Map(); // assessmentId → { config, drills[], rawOverlap }

  for (const fb of feedbackItems) {
    const categories = resolveCategories(fb.testId, testToCategories);
    const drill = fb.drills?.[0] || null;
    const time = estimateTime(drill);

    if (assessmentConfig?.assessments) {
      for (const aCfg of assessmentConfig.assessments) {
        // Skip assessments beyond the drill horizon — they appear in the table strip
        // but are too far out to prioritize drills for now.
        const aCfgDaysLeft = Math.ceil(
          (new Date(aCfg.date + 'T00:00:00') - generatedAt) / MS_PER_DAY
        );
        if (aCfgDaysLeft > DRILL_HORIZON_DAYS) continue;

        let matchWeight = 0;
        for (const cat of categories) {
          if (aCfg.concept_weights?.[cat]) {
            matchWeight += aCfg.concept_weights[cat];
          }
        }
        if (matchWeight === 0) continue;

        if (!assessmentMap.has(aCfg.id)) {
          assessmentMap.set(aCfg.id, { config: aCfg, drills: [], rawOverlap: 0 });
        }
        const entry = assessmentMap.get(aCfg.id);

        // courseAppearances for this assessment (match by label prefix)
        const caForAssmt = (fb.courseAppearances || []).filter(ca =>
          ca.label === aCfg.name || ca.label.startsWith(aCfg.name + ' ')
        );

        // Fall back to courseAppearances for source link — but NOT for drill_intro,
        // because the courseAppearance description describes the connection to another
        // pattern (e.g. "shortestWordAlongPath uses the same navigation as contains"),
        // not the drill practice task itself.
        // Also exclude solution files from courseAppearances — they should not be linked
        // as the primary source for a drill (LLM sometimes references solution URLs).
        const nonSolutionCa = caForAssmt.filter(ca => !ca.url?.toLowerCase().includes('solution'));
        const sourceUrl   = drill?.sourceUrl   || nonSolutionCa[0]?.url   || null;
        const sourceLabel = drill?.sourceLabel  || nonSolutionCa[0]?.label || null;
        const drillIntro  = drill?.intro        || null;

        // Store internal tracking fields for dedup; stripped below
        entry.drills.push({
          _categories: categories,
          _matchWeight: matchWeight,
          _extraLinks: caForAssmt
            .filter(ca => ca.url && !ca.url.toLowerCase().includes('solution'))
            .map(ca => ({ url: ca.url, label: ca.label })),
          pattern_name: patternName(fb),
          time_min: time,
          test_names: testNames(fb),
          drill_anchor: drill ? drillAnchor(fb) : null,
          source: drill?.source || null,
          source_url: sourceUrl,
          source_label: sourceLabel,
          drill_intro: drillIntro,
        });
      }
    } else {
      // No assessment config — collect drills under a synthetic "no-assessment" entry
      if (!assessmentMap.has('__none__')) {
        assessmentMap.set('__none__', { config: null, drills: [], rawOverlap: 0 });
      }
      assessmentMap.get('__none__').drills.push({
        pattern_name: patternName(fb),
        weight_pct: 0,
        time_min: time,
        test_names: testNames(fb),
        drill_anchor: drillAnchor(fb),
        source: drill?.source || null,
        source_url: drill?.sourceUrl || null,
        source_label: drill?.sourceLabel || null,
        drill_intro: drill?.intro || null,
      });
    }
  }

  // Add zero-drill rows for assessments not matched by any feedback item
  if (assessmentConfig?.assessments) {
    for (const aCfg of assessmentConfig.assessments) {
      if (!assessmentMap.has(aCfg.id)) {
        assessmentMap.set(aCfg.id, { config: aCfg, drills: [], rawOverlap: 0 });
      }
    }
  }

  // Post-dedup: keep only the highest-weight drill per primary concept area per assessment,
  // then recalculate rawOverlap from surviving drills only.
  for (const [id, entry] of assessmentMap.entries()) {
    if (id === '__none__' || !entry.config?.concept_weights) continue;
    entry.drills = dedupByPrimaryConcept(entry.drills, entry.config.concept_weights);
    // Collect covered categories before stripping internal fields
    const coveredCats = new Set();
    for (const d of entry.drills) {
      for (const cat of (d._categories || [])) coveredCats.add(cat);
    }
    // Uncovered concepts = concept_weights keys with no surviving drill
    entry.uncoveredConcepts = Object.entries(entry.config.concept_weights || {})
      .filter(([cat]) => !coveredCats.has(cat))
      .map(([cat, w]) => ({
        name: cat,
        description: categoryDescriptions[cat] || cat,
        weight_pct: Math.round(w * 100),
      }))
      .sort((a, b) => b.weight_pct - a.weight_pct);
    entry.rawOverlap = entry.drills.reduce((sum, d) => sum + (d._matchWeight || 0), 0);
    // Collect all unique source links across surviving drills + courseAppearances + config resources
    const allLinksMap = new Map(); // url → label
    for (const d of entry.drills) {
      if (d.source_url) allLinksMap.set(d.source_url, d.source_label || d.source || 'source');
      for (const el of (d._extraLinks || [])) allLinksMap.set(el.url, el.label);
    }
    // Always-shown assessment resources (not drill-dependent, e.g. practice exam zips)
    for (const r of (entry.config?.resources || [])) {
      if (r.url) allLinksMap.set(r.url, r.label || 'resource');
    }
    entry.allLinks = [...allLinksMap.entries()].map(([url, label]) => ({ url, label }));
    // Compute weight_pct from matchWeight, then strip internal tracking fields
    for (const d of entry.drills) {
      d.weight_pct = Math.round((d._matchWeight || 0) * 100);
      delete d._categories;
      delete d._matchWeight;
      delete d._extraLinks;
    }
  }

  // Build sorted assessments array
  const sortedAssessments = [...assessmentMap.entries()]
    .filter(([id]) => id !== '__none__')
    .map(([, entry]) => {
      const a = entry.config;
      // Sort drills: time asc (all are already deduplicated by concept)
      const drills = entry.drills
        .sort((x, y) => x.time_min - y.time_min);
      const totalTime = drills.reduce((s, d) => s + d.time_min, 0);
      // overlap_pct: sum of surviving drill weights, capped at 100
      const overlapPct = Math.min(100, Math.round(entry.rawOverlap * 100));
      const daysLeft = Math.ceil(
        (new Date(a.date + 'T00:00:00') - generatedAt) / MS_PER_DAY
      );
      const gradeWeight = a.grade_weight != null
        ? a.grade_weight
        : (a.type === 'exam' ? 0.10 : 0.035);
      const relevanceScore = entry.rawOverlap * gradeWeight * urgencyFactor(daysLeft);
      return {
        id: a.id,
        name: a.name,
        date: a.date,
        date_display: a.date_display,
        type: a.type,
        days_left: daysLeft,
        relevance_score: relevanceScore,
        overlap_pct: overlapPct,
        drill_count: drills.length,
        total_time: totalTime,
        drills,
        uncovered_concepts: entry.uncoveredConcepts || [],
        all_links: entry.allLinks || [],
      };
    })
    .sort((a, b) => {
      if (Math.abs(b.relevance_score - a.relevance_score) > 1e-9)
        return b.relevance_score - a.relevance_score;
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
    });

  // Add also_relevant_to annotation for drills appearing in multiple columns
  const drillInAssessments = new Map();
  for (const a of sortedAssessments) {
    for (const d of a.drills) {
      const list = drillInAssessments.get(d.pattern_name) || [];
      list.push(a.name);
      drillInAssessments.set(d.pattern_name, list);
    }
  }
  for (const a of sortedAssessments) {
    for (const d of a.drills) {
      const others = (drillInAssessments.get(d.pattern_name) || []).filter(n => n !== a.name);
      if (others.length > 0) d.also_relevant_to = others.join(', ');
    }
  }

  // Unique drill count and total time (deduplicated by pattern_name across all assessments)
  const seen = new Set();
  let totalUniqueDrills = 0;
  let totalTime = 0;
  for (const a of sortedAssessments) {
    for (const d of a.drills) {
      if (!seen.has(d.pattern_name)) {
        seen.add(d.pattern_name);
        totalUniqueDrills++;
        totalTime += d.time_min;
      }
    }
  }
  if (assessmentMap.has('__none__')) {
    const noneDrills = assessmentMap.get('__none__').drills;
    totalUniqueDrills = noneDrills.length;
    totalTime = noneDrills.reduce((s, d) => s + d.time_min, 0);
  }

  // Split into exam and hw zones for the two-zone report layout
  const examAssessments = sortedAssessments.filter(a => a.type === 'exam');
  const hwAssessments   = sortedAssessments.filter(a => a.type !== 'exam');

  const reportData = {
    student_id: studentId,
    assignment: { full_name: fullName, short_name: shortName },
    assessments: assessmentMap.has('__none__') ? [] : sortedAssessments,
    exam_assessments: assessmentMap.has('__none__') ? [] : examAssessments,
    hw_assessments:   assessmentMap.has('__none__') ? [] : hwAssessments,
    total_unique_drills: totalUniqueDrills,
    total_time: totalTime,
    generated_at: new Date().toISOString(),
    review_video_url: reviewVideoUrl && reviewVideoUrl.length > 0 ? reviewVideoUrl : null,
  };

  // Write report.json — PDF is always generated via generateReportForToken so the
  // real token URL is embedded (never the __token__ placeholder).
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2));

  return reportJsonPath;
}

// Convenience: generate report with the actual token URL substituted in.
// Automatically routes to the generic class-wide review guide when the student's
// frontend.json has no feedback patterns — avoids producing an empty personalized PDF.
export async function generateReportForToken(studentId, assignment, token, dataDir, baseUrl) {
  const outputDir    = path.join(dataDir, assignment, 'output', studentId);
  const reportPdfPath = path.join(outputDir, 'report.pdf');
  const reportJsonPath = path.join(outputDir, 'report.json');
  const frontendJsonPath = path.join(outputDir, 'frontend.json');

  const feedbackUrl = `${baseUrl}/feedback?token=${token}`;

  // Case-2 routing: if the prepare step produced no patterns (or frontend.json is
  // missing entirely), the personalized report layout would render empty. Use the
  // generic class-wide review guide instead so the on-disk PDF is immediately useful.
  let patternCount = 0;
  if (fs.existsSync(frontendJsonPath)) {
    try {
      patternCount = (JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8')).feedback || []).length;
    } catch { /* leave at 0 */ }
  }
  if (patternCount === 0) {
    return generateGenericReport(studentId, assignment, token, dataDir, baseUrl);
  }

  if (fs.existsSync(reportJsonPath)) {
    const reportData = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
    const html = renderReportHtml(reportData, feedbackUrl);
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',  // required on Linux: /dev/shm often too small for Chromium
        '--disable-gpu',            // safe on headless servers; avoids GPU init failures
      ],
    });
    try {
      const page = await browser.newPage();
      // Set viewport to Letter size at 96dpi so body.clientHeight reflects the
      // CSS page height (11in = 1056px) rather than Puppeteer's default 600px.
      await page.setViewport({ width: 816, height: 1056 });
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      // Body uses min-height:11in (not fixed height) so it grows to fit content.
      // Compare scrollHeight against the Letter page height constant — clientHeight
      // is no longer a reliable sentinel since the body expands with content.
      const pdfScale = await page.evaluate(() => {
        const PAGE_H     = 1056; // 11in at 96 dpi — one Letter page
        const MARGIN     = 40;   // safety buffer — PDF pagination can split before scrollHeight hits PAGE_H
        const hasDrills  = !!document.querySelector('.page-drills');
        const PAGE_LIMIT = (hasDrills ? PAGE_H * 2 : PAGE_H) - MARGIN;
        const contentH   = document.body.scrollHeight;
        return contentH > PAGE_LIMIT ? Math.max(0.80, PAGE_LIMIT / contentH) : 1.0;
      });
      await page.pdf({
        path: reportPdfPath,
        format: 'Letter',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
        preferCSSPageSize: true,
        scale: pdfScale,
      });
    } catch (err) {
      console.error('[report] Puppeteer PDF generation failed:', err.message);
      throw err;
    } finally {
      await browser.close();
    }
    return reportPdfPath;
  }

  await generateReport(studentId, assignment, dataDir, baseUrl);
  return generateReportForToken(studentId, assignment, token, dataDir, baseUrl);
}

/**
 * Generates a class-wide "exam review guide" PDF for students who have no run.tar.
 * Drills are assigned by concept_weight (highest first) rather than by student feedback.
 * Returns the report PDF path, or null if the assessment config is missing.
 */
export async function generateGenericReport(studentId, assignment, token, dataDir, baseUrl) {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const assessmentCfgPath  = path.join(repoRoot, 'Pipeline', 'assignments', `${assignment}_assessment_config.json`);
  const drillQuestionsPath = path.join(repoRoot, 'Pipeline', 'assignments', `${assignment}_drill_questions.json`);

  if (!fs.existsSync(assessmentCfgPath)) return null;
  const assessmentConfig = JSON.parse(fs.readFileSync(assessmentCfgPath, 'utf8'));

  const drillQuestions = fs.existsSync(drillQuestionsPath)
    ? JSON.parse(fs.readFileSync(drillQuestionsPath, 'utf8'))
    : [];

  // Build category → drills[] map
  const drillsByCategory = new Map();
  for (const drill of drillQuestions) {
    for (const cat of (drill.categories || [])) {
      if (!drillsByCategory.has(cat)) drillsByCategory.set(cat, []);
      drillsByCategory.get(cat).push(drill);
    }
  }

  const _n = new Date();
  const now = new Date(_n.getFullYear(), _n.getMonth(), _n.getDate()); // local midnight today
  const fullName      = assessmentConfig.full_name  || assignment;
  const shortName     = assessmentConfig.short_name || assignment;
  const reviewVideoUrl = assessmentConfig.review_video_url || null;
  const feedbackUrl   = `${baseUrl}/feedback?token=${token}`;

  const assessmentEntries = [];
  for (const aCfg of (assessmentConfig.assessments || [])) {
    const daysLeft = Math.ceil((new Date(aCfg.date + 'T00:00:00') - now) / MS_PER_DAY);
    if (daysLeft > DRILL_HORIZON_DAYS) continue;

    const drillsForAssmt = [];
    const uncoveredConcepts = [];

    // Sort concept_weights descending so highest-weight categories get drills first
    const sortedConcepts = Object.entries(aCfg.concept_weights || {})
      .sort(([, a], [, b]) => b - a);

    for (const [category, weight] of sortedConcepts) {
      if (weight <= 0) continue;
      const candidates = drillsByCategory.get(category) || [];
      if (candidates.length === 0) {
        uncoveredConcepts.push({ name: category, weight_pct: Math.round(weight * 100) });
        continue;
      }
      drillsForAssmt.push({
        pattern_name: CATEGORY_LABELS[category] ?? category,
        time_min:     estimateTime(candidates[0]),
        test_names:   [],
        weight_pct:   Math.round(weight * 100),
        source:       candidates[0].source       || null,
        source_url:   candidates[0].url || candidates[0].sourceUrl || null,
        source_label: candidates[0].sourceLabel || candidates[0].source || null,
        drill_anchor: null,
        also_relevant_to: null,
        drill_intro:  candidates[0].intro      || null,
        test_code:    candidates[0].testCode   || null,
        hints:        candidates[0].hints      || [],
        target_file:  candidates[0].targetFile || null,
      });
    }

    const totalTime  = drillsForAssmt.reduce((s, d) => s + d.time_min, 0);
    const overlapPct = Math.min(100, drillsForAssmt.reduce((s, d) => s + d.weight_pct, 0));
    const gradeWeight   = aCfg.grade_weight ?? (aCfg.type === 'exam' ? 0.10 : 0.035);
    const relevanceScore = (overlapPct / 100) * gradeWeight * urgencyFactor(daysLeft);

    assessmentEntries.push({
      id: aCfg.id, name: aCfg.name, date: aCfg.date,
      date_display: aCfg.date_display, type: aCfg.type,
      days_left: daysLeft, relevance_score: relevanceScore,
      overlap_pct: overlapPct, drill_count: drillsForAssmt.length,
      total_time: totalTime, drills: drillsForAssmt,
      uncovered_concepts: uncoveredConcepts, all_links: aCfg.resources || [],
    });
  }

  assessmentEntries.sort((a, b) => {
    if (Math.abs(b.relevance_score - a.relevance_score) > 1e-9)
      return b.relevance_score - a.relevance_score;
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
  });

  const DRILL_CAP = 3;
  const seen = new Set();
  let totalUniqueDrills = 0, totalTime = 0;
  for (const a of assessmentEntries) {
    for (const d of a.drills.slice(0, DRILL_CAP)) {
      if (!seen.has(d.pattern_name)) {
        seen.add(d.pattern_name);
        totalUniqueDrills++;
        totalTime += d.time_min;
      }
    }
  }

  const reportData = {
    student_id: studentId,
    assignment: { full_name: fullName, short_name: shortName },
    assessments:      assessmentEntries,
    exam_assessments: assessmentEntries.filter(a => a.type === 'exam'),
    hw_assessments:   assessmentEntries.filter(a => a.type !== 'exam'),
    total_unique_drills: totalUniqueDrills,
    total_time: totalTime,
    generated_at: now.toISOString(),
    review_video_url: reviewVideoUrl && reviewVideoUrl.length > 0 ? reviewVideoUrl : null,
    generic:   true,
    drill_cap: DRILL_CAP,
  };

  const outputDir    = path.join(dataDir, assignment, 'output', studentId);
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPdfPath = path.join(outputDir, 'report.pdf');

  const htmlPage1 = renderReportHtml(reportData, feedbackUrl);
  const htmlPage2 = renderDrillSheetPageHtml(reportData, feedbackUrl);

  const { default: puppeteer } = await import('puppeteer');
  const { PDFDocument } = await import('pdf-lib');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    async function renderPage(html) {
      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: 1056 });
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const scale = await page.evaluate(() => {
        const PAGE_H   = 1056;
        const contentH = document.body.scrollHeight;
        return contentH > PAGE_H ? Math.max(0.60, PAGE_H / contentH) : 1.0;
      });
      const pdfBytes = await page.pdf({
        format: 'Letter',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true, preferCSSPageSize: true, scale,
      });
      await page.close();
      return pdfBytes;
    }

    const [bytes1, bytes2] = await Promise.all([
      renderPage(htmlPage1),
      htmlPage2 ? renderPage(htmlPage2) : Promise.resolve(null),
    ]);

    if (bytes2) {
      const merged = await PDFDocument.create();
      for (const bytes of [bytes1, bytes2]) {
        const doc   = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      fs.writeFileSync(reportPdfPath, await merged.save());
    } else {
      fs.writeFileSync(reportPdfPath, bytes1);
    }
  } catch (err) {
    console.error('[report] Generic report PDF generation failed:', err.message);
    throw err;
  } finally {
    await browser.close();
  }
  return reportPdfPath;
}
