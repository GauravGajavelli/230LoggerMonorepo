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
 *   3. For each feedback item, find all assessments whose concept_weights
 *      include any of the item's categories → assign drill to that assessment
 *   4. overlap_pct per assessment = sum of matched concept_weights (capped at 50 for display)
 *   5. Sort assessments by date, then exam > assignment > homework
 *   6. Sort drills within each assessment by weight desc, time asc
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
// Prefer the first sentence of the explanation; fall back to the testId method name.
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
  // relatedTestIds may be present
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

export async function generateReport(studentId, assignment, dataDir, baseUrl) {
  const outputDir        = path.join(dataDir, assignment, 'output', studentId);
  const frontendJsonPath = path.join(outputDir, 'frontend.json');
  const assessmentCfgPath = path.join(dataDir, assignment, 'assessment-config.json');
  const reportJsonPath   = path.join(outputDir, 'report.json');
  const reportPdfPath    = path.join(outputDir, 'report.pdf');

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

  // Map each feedback item to all relevant assessments
  const assessmentMap = new Map(); // assessmentId → { config, drills[], rawOverlap }

  for (const fb of feedbackItems) {
    const categories = fb.categories || [];
    const drill = fb.drills?.[0] || null; // use primary drill for time/points
    const time = estimateTime(drill);

    if (assessmentConfig?.assessments) {
      for (const aCfg of assessmentConfig.assessments) {
        // Find the total concept weight this feedback item contributes to this assessment
        let matchWeight = 0;
        for (const cat of categories) {
          if (aCfg.concept_weights?.[cat]) {
            matchWeight += aCfg.concept_weights[cat];
          }
        }
        if (matchWeight === 0) continue; // this item doesn't map to this assessment

        if (!assessmentMap.has(aCfg.id)) {
          assessmentMap.set(aCfg.id, { config: aCfg, drills: [], rawOverlap: 0 });
        }
        const entry = assessmentMap.get(aCfg.id);
        entry.rawOverlap += matchWeight;
        entry.drills.push({
          pattern_name: patternName(fb),
          weight_pct: Math.round(matchWeight * 100),
          time_min: time,
          test_names: testNames(fb),
          drill_anchor: drillAnchor(fb),
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
      });
    }
  }

  // Build sorted assessments array
  const sortedAssessments = [...assessmentMap.entries()]
    .filter(([id]) => id !== '__none__')
    .map(([, entry]) => {
      const a = entry.config;
      // Sort drills: weight desc, then time asc
      const drills = entry.drills
        .sort((x, y) => y.weight_pct - x.weight_pct || x.time_min - y.time_min);
      const totalTime = drills.reduce((s, d) => s + d.time_min, 0);
      // overlap_pct: cap raw sum at 50 for display
      const overlapPct = Math.min(50, Math.round(entry.rawOverlap * 100));
      // Composite relevance score: concept coverage × grade weight × urgency
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
    // Sort by composite relevance DESC; fall back to date ASC then type on ties
    .sort((a, b) => {
      if (Math.abs(b.relevance_score - a.relevance_score) > 1e-9)
        return b.relevance_score - a.relevance_score;
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
    });

  // Add also_relevant_to annotation for drills appearing in multiple columns
  const drillInAssessments = new Map(); // pattern_name → [assessmentNames]
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

  // Unique drill count and total time (deduplicated by pattern_name)
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
  // If no assessment config, count from the __none__ bucket
  if (assessmentMap.has('__none__')) {
    const noneDrills = assessmentMap.get('__none__').drills;
    totalUniqueDrills = noneDrills.length;
    totalTime = noneDrills.reduce((s, d) => s + d.time_min, 0);
  }

  const reportData = {
    student_id: studentId,
    assignment: { full_name: fullName, short_name: shortName },
    assessments: assessmentMap.has('__none__') ? [] : sortedAssessments,
    total_unique_drills: totalUniqueDrills,
    total_time: totalTime,
    generated_at: new Date().toISOString(),
  };

  // Cache report.json alongside the PDF
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2));

  // Render HTML and generate PDF via Puppeteer
  const feedbackUrl = `${baseUrl}/feedback?token=__token__`; // placeholder; caller replaces
  const html = renderReportHtml(reportData, feedbackUrl);

  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: reportPdfPath,
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
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

  // If report.json already cached, just re-render the PDF with the real token URL
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
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
      });
    } finally {
      await browser.close();
    }
    return reportPdfPath;
  }

  // Otherwise run the full derivation (stores placeholder URL in JSON, then re-renders)
  await generateReport(studentId, assignment, dataDir, baseUrl);
  return generateReportForToken(studentId, assignment, token, dataDir, baseUrl);
}
