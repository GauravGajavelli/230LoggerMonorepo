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
import { renderReportHtml } from './reportTemplate.js';

const TYPE_PRIORITY = { exam: 3, assignment: 2, homework: 1 };

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
  if (fs.existsSync(testCategoriesPath)) {
    try {
      const tc = JSON.parse(fs.readFileSync(testCategoriesPath, 'utf8'));
      testToCategories = tc.testToCategories || null;
    } catch { /* degrade gracefully */ }
  }

  if (!fs.existsSync(frontendJsonPath)) return null;

  const frontendData = JSON.parse(fs.readFileSync(frontendJsonPath, 'utf8'));
  const feedbackItems = frontendData.feedback || [];
  const generatedAt = new Date();

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
        // Store internal tracking fields for dedup; stripped below
        entry.drills.push({
          _categories: categories,
          _matchWeight: matchWeight,
          pattern_name: patternName(fb),
          time_min: time,
          test_names: testNames(fb),
          drill_anchor: drillAnchor(fb),
          source: drill?.source || null,
          source_url: drill?.sourceUrl || null,
          source_label: drill?.sourceLabel || null,
          drill_intro: drill?.intro || null,
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
    entry.rawOverlap = entry.drills.reduce((sum, d) => sum + (d._matchWeight || 0), 0);
    // Compute weight_pct from matchWeight, then strip internal tracking fields
    for (const d of entry.drills) {
      d.weight_pct = Math.round((d._matchWeight || 0) * 100);
      delete d._categories;
      delete d._matchWeight;
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
        (new Date(a.date + 'T12:00:00Z') - generatedAt) / MS_PER_DAY
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

  // Cache report.json alongside the PDF
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2));

  // Render HTML and generate PDF via Puppeteer
  const feedbackUrl = `${baseUrl}/feedback?token=__token__`;
  const html = renderReportHtml(reportData, feedbackUrl);

  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: reportPdfPath,
      format: 'Letter',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }

  return reportPdfPath;
}

// Convenience: generate report with the actual token URL substituted in.
export async function generateReportForToken(studentId, assignment, token, dataDir, baseUrl) {
  const outputDir    = path.join(dataDir, assignment, 'output', studentId);
  const reportPdfPath = path.join(outputDir, 'report.pdf');
  const reportJsonPath = path.join(outputDir, 'report.json');

  const feedbackUrl = `${baseUrl}/feedback?token=${token}`;

  if (fs.existsSync(reportJsonPath)) {
    const reportData = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
    const html = renderReportHtml(reportData, feedbackUrl);
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: reportPdfPath,
        format: 'Letter',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await browser.close();
    }
    return reportPdfPath;
  }

  await generateReport(studentId, assignment, dataDir, baseUrl);
  return generateReportForToken(studentId, assignment, token, dataDir, baseUrl);
}
