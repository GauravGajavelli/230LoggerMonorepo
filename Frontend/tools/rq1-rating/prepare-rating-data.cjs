#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const ASSIGNMENTS = ['bst', 'string_hashset'];
const ASSIGNMENT_LABELS = {
  bst: 'Binary Search Tree',
  string_hashset: 'String Hash Set',
};
const DEMO_STUDENT = 'gajavegs';
const DEMO_ASSIGNMENT = 'bst';
const SEED = 42;

const isDemo = process.argv.includes('--demo');

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

function extractFailedTests(frontend) {
  const highlights = frontend.failureHighlights || {};
  const highlightMap = {};
  for (const [cat, ids] of Object.entries(highlights)) {
    for (const id of ids || []) {
      highlightMap[id] = cat;
    }
  }

  const histories = frontend.testHistories || [];
  return histories
    .filter(h => (h.totalFailedRuns || 0) > 0)
    .map(h => ({
      name: h.testName || h.testId,
      highlightCategory: highlightMap[h.testId] || null,
      totalFailedRuns: h.totalFailedRuns || 0,
      wasFixed: h.struggleProfile?.wasFixed ?? null,
      progressionSummary: h.errorEvolution?.progressionSummary || null,
    }))
    .sort((a, b) => b.totalFailedRuns - a.totalFailedRuns);
}

function extractFeedbackItems(frontend) {
  return (frontend.feedback || []).map(fb => ({
    testId: fb.testId,
    pattern: fb.pattern,
    confidence: fb.confidence,
    explanation: fb.explanation,
    nextSteps: fb.nextSteps || [],
    diffs: (fb.diffs || []).map(d => ({
      label: d.label,
      before: d.before || [],
      after: d.after || [],
      note: d.note,
    })),
    courseAppearances: (fb.courseAppearances || []).map(ca => ({
      label: ca.label,
      description: ca.description,
    })),
    drills: (fb.drills || []).map(dr => ({
      mode: dr.mode,
      timeEstimate: dr.timeEstimate,
      intro: dr.intro,
      testCode: dr.testCode,
      hints: dr.hints || [],
      source: dr.source,
      sourceLabel: dr.sourceLabel,
    })),
    relatedTestIds: fb.relatedTestIds || [],
  }));
}

function extractEpisodeSummaries(frontend) {
  return (frontend.episodes || []).map(ep => ({
    label: ep.label,
    summary: ep.semantics?.summary || null,
    dominantIntent: ep.semantics?.dominantIntent || null,
    progressAssessment: ep.semantics?.progressAssessment || null,
  }));
}

function extractReportDrills(report) {
  return (report.assessments || [])
    .filter(a => a.drills && a.drills.length > 0)
    .map(a => ({
      assessmentName: a.name,
      overlap_pct: a.overlap_pct || 0,
      drills: a.drills.map(d => ({
        pattern_name: d.pattern_name,
        drill_intro: d.drill_intro,
        source: d.source,
      })),
    }));
}

function collectPairs() {
  const pairs = [];
  for (const asgn of ASSIGNMENTS) {
    const outputDir = path.join(DATA_DIR, asgn, 'output');
    if (!fs.existsSync(outputDir)) continue;
    for (const studentId of fs.readdirSync(outputDir)) {
      const frontendPath = path.join(outputDir, studentId, 'frontend.json');
      const reportPath = path.join(outputDir, studentId, 'report.json');
      if (!fs.existsSync(frontendPath) || !fs.existsSync(reportPath)) continue;

      const frontend = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));
      if (!frontend.feedback || frontend.feedback.length === 0) continue;

      if (isDemo && !(asgn === DEMO_ASSIGNMENT && studentId === DEMO_STUDENT)) continue;

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      pairs.push({
        _studentId: studentId,
        _assignment: asgn,
        assignment: ASSIGNMENT_LABELS[asgn] || asgn,
        failedTests: extractFailedTests(frontend),
        feedbackItems: extractFeedbackItems(frontend),
        episodeSummaries: extractEpisodeSummaries(frontend),
        reportDrills: extractReportDrills(report),
      });
    }
  }
  return pairs;
}

const pairs = collectPairs();

if (isDemo) {
  const items = pairs.map((p, i) => {
    const { _studentId, _assignment, ...rest } = p;
    return { pairId: `DEMO-${String(i + 1).padStart(3, '0')}`, ...rest };
  });
  const outPath = path.join(__dirname, 'rating-data-demo.json');
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
  console.log(`Demo: wrote ${items.length} pair(s) to ${outPath}`);
  console.log(`  Feedback items: ${items.reduce((s, p) => s + p.feedbackItems.length, 0)}`);
} else {
  const shuffled = seededShuffle(pairs, SEED);
  const items = shuffled.map((p, i) => {
    const { _studentId, _assignment, ...rest } = p;
    return { pairId: `A${String(i + 1).padStart(3, '0')}`, ...rest };
  });
  const outPath = path.join(__dirname, 'rating-data.json');
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
  console.log(`Full: wrote ${items.length} pairs to ${outPath}`);
  console.log(`  Feedback items: ${items.reduce((s, p) => s + p.feedbackItems.length, 0)}`);
}
