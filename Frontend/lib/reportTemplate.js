/**
 * reportTemplate.js
 *
 * Produces a self-contained HTML string for the student summary report.
 * Designed to be printed to PDF by Puppeteer — all styles are inline or in a
 * <style> block, no external resources.
 *
 * Two-zone layout:
 *   1. Assessment table strip — all assessments, compact rows
 *   2. Exam zone — full drill cards (numbered, colored, intro text)
 *   3. HW zone — compact one-line rows per homework assessment
 *
 * Input: the reportData object produced by report.js
 */

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dayLabel(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return DAY_NAMES[d.getUTCDay()];
}

// Bar fill: literal percentage (capped at 100)
function barPct(overlapPct) {
  return Math.min(100, overlapPct);
}

// Bar color: higher coverage = more exam content at stake = warmer/more urgent
function barColor(overlapPct) {
  if (overlapPct >= 35) return '#c0392b';
  if (overlapPct >= 20) return '#b7860b';
  return 'var(--bar-fill)';
}

// Time display: weeks when >= 14 days
function timeDisplay(days) {
  if (days <= 13) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function daysUrgencyColor(days) {
  if (days <= 3)  return '#c0392b';
  if (days <= 7)  return '#d35400';
  if (days <= 14) return '#b7860b';
  return 'var(--text-tertiary)';
}

function typeLabel(type) {
  if (type === 'exam')     return 'EXAM';
  if (type === 'homework') return 'HW';
  return 'ASMT';
}

function weightLabel(type) {
  if (type === 'exam')     return 'of exam';
  if (type === 'homework') return 'of HW';
  return 'of assessment';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encodeStudyPath(rawPath) {
  return rawPath.split('/').map(s => encodeURIComponent(s)).join('/');
}

// Compact assessment table strip — all assessments in one table
function renderAssessmentTable(allAssessments) {
  if (!allAssessments || allAssessments.length === 0) return '';
  const rows = allAssessments.map(a => {
    const isExam = a.type === 'exam';
    const accentColor = isExam ? 'var(--accent-exam)' : 'transparent';
    const nameStyle = isExam
      ? 'font-weight:600;color:var(--text-primary)'
      : 'color:var(--text-tertiary)';
    const timeColor = isExam ? daysUrgencyColor(a.days_left) : 'var(--text-tertiary)';
    const hasBar = a.drill_count > 0;
    const fill = hasBar && isExam
      ? `<div class="bar-fill" style="width:${barPct(a.overlap_pct)}%;background:${barColor(a.overlap_pct)}"></div>`
      : '';
    const pctCell = hasBar && isExam ? `~${a.overlap_pct}%` : '';
    const drillCell = a.drill_count > 0
      ? `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`
      : '-';
    const daysCell = a.days_left > 0
      ? `<span style="color:${timeColor}">${timeDisplay(a.days_left)}</span>`
      : '';
    return `
      <tr style="border-left:3px solid ${accentColor}">
        <td class="arow-type" style="${isExam ? '' : 'color:var(--text-tertiary)'}">${typeLabel(a.type)}</td>
        <td class="arow-name" style="${nameStyle}">${escHtml(a.name)}</td>
        <td class="arow-date" style="${isExam ? '' : 'color:var(--text-tertiary)'}">${escHtml(a.date_display)}</td>
        <td class="arow-time">${daysCell}</td>
        <td class="arow-bar"><div class="bar-track">${fill}</div></td>
        <td class="arow-pct" style="${isExam ? '' : 'color:var(--text-tertiary)'}">${pctCell}</td>
        <td class="arow-drills" style="${isExam ? '' : 'color:var(--text-tertiary)'}">${drillCell}</td>
      </tr>`;
  }).join('');
  return `<table class="assessment-table"><tbody>${rows}</tbody></table>`;
}

// Full drill card for exam zone
function renderExamDrillCard(drill, assessment, num, urgencyColor, feedbackUrl) {
  const tests = drill.test_names.slice(0, 3);
  const extraCount = drill.test_names.length - tests.length;
  const testLine = tests.map(t => `<code>${escHtml(t)}</code>`).join(', ')
    + (extraCount > 0 ? ` <span class="muted">+${extraCount}</span>` : '');

  const introText = drill.drill_intro
    ? drill.drill_intro.slice(0, 120) + (drill.drill_intro.length > 120 ? '...' : '')
    : null;

  const metaLine = `~${drill.time_min} min · do before ${escHtml(assessment.name)} · ~${drill.weight_pct}% ${weightLabel(assessment.type)}`;

  let linksHtml = '';
  if (drill.source_url) {
    let smBase = '/study-materials';
    try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
    const href = smBase + '/' + encodeStudyPath(drill.source_url);
    const label = drill.source_label || drill.source || 'source';
    linksHtml += `<a class="drill-link" href="${escHtml(href)}" target="_blank">${escHtml(label)} -&gt;</a>`;
  }
  if (drill.drill_anchor) {
    linksHtml += `<a class="drill-link" href="${escHtml(feedbackUrl)}#${escHtml(drill.drill_anchor)}">Open drill -&gt;</a>`;
  }

  const alsoNote = drill.also_relevant_to
    ? `<div class="drill-also">Also relevant to ${escHtml(drill.also_relevant_to)}</div>`
    : '';

  return `
    <div class="drill-card" style="border-left:3px solid ${urgencyColor}">
      <div class="drill-name">
        <span class="drill-num" style="color:${urgencyColor}">${num}.</span>${escHtml(drill.pattern_name)}
      </div>
      ${introText ? `<div class="drill-intro">${escHtml(introText)}</div>` : ''}
      <div class="drill-tests">${testLine}</div>
      <div class="drill-meta">${metaLine}</div>
      ${alsoNote}
      ${linksHtml ? `<div class="drill-links">${linksHtml}</div>` : ''}
    </div>`;
}

// "Also on this exam" section — concepts not covered by the student's drills
function renderAlsoOnExam(assessment, feedbackUrl) {
  const uncovered = (assessment.uncovered_concepts || []).filter(c => c.weight_pct > 0);
  if (uncovered.length === 0) return '';

  // Find a study material link from any drill in this assessment
  const refDrill = assessment.drills.find(d => d.source_url);
  let linkHtml = '';
  if (refDrill?.source_url) {
    let smBase = '/study-materials';
    try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
    const href = smBase + '/' + encodeStudyPath(refDrill.source_url);
    const label = refDrill.source_label || refDrill.source || 'questions';
    linkHtml = ` - <a class="exam-also-link" href="${escHtml(href)}" target="_blank">${escHtml(label)} -&gt;</a>`;
  }

  const topics = uncovered.map(c => `${escHtml(c.description)} (~${c.weight_pct}%)`).join(', ');
  return `
    <div class="exam-also">
      <span class="exam-also-label">Also on ${escHtml(assessment.name)}:</span> ${topics}${linkHtml}
    </div>`;
}

// Full exam drill column — single focal exam only
function renderExamColumn(a, feedbackUrl) {
  const urgencyColor = barColor(a.overlap_pct);
  const visibleDrills = a.drills.slice(0, 3);
  const hiddenCount = a.drills.length - visibleDrills.length;

  const drillCards = visibleDrills.map((d, i) =>
    renderExamDrillCard(d, a, i + 1, urgencyColor, feedbackUrl)
  ).join('');

  const moreNote = hiddenCount > 0
    ? `<div class="muted" style="font-size:11px;margin-top:4px">and ${hiddenCount} more - see feedback site</div>`
    : '';

  const alsoOnExam = renderAlsoOnExam(a, feedbackUrl);

  return `
    <div class="column">
      <div class="col-header" style="border-left:3px solid var(--accent-exam);padding-left:8px">
        ${escHtml(a.name)} · ${escHtml(dayLabel(a.date))}, ${escHtml(a.date_display)}
      </div>
      <div class="col-rule"></div>
      ${drillCards}${moreNote}${alsoOnExam}
    </div>`;
}

// Compact secondary zone row (non-focal exams + HW)
function renderHwRow(a, feedbackUrl) {
  const typeTag = a.type === 'exam'
    ? `<span style="font-size:9px;letter-spacing:0.05em;color:var(--accent-exam);margin-right:4px">EXAM</span>`
    : '';
  const drillText = `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`;
  const overlapText = a.type === 'exam' && a.overlap_pct > 0 ? ` · ~${a.overlap_pct}% of exam` : '';
  const linkHtml = `<a class="hw-link" href="${escHtml(feedbackUrl)}">see all -&gt;</a>`;
  return `
    <div class="hw-row">
      ${typeTag}<span class="hw-name">${escHtml(a.name)}</span>
      <span class="hw-date">${escHtml(a.date_display)}</span>
      <span class="hw-drills">${drillText}${overlapText}</span>
      ${linkHtml}
    </div>`;
}

export function renderReportHtml(reportData, feedbackUrl) {

  const {
    assignment,
    assessments,
    exam_assessments,
    hw_assessments,
    total_unique_drills,
    total_time,
    generated_at,
    review_video_url,
  } = reportData;

  const generatedDate = generated_at ? generated_at.slice(0, 10) : '';

  // Determine zones. If exam_assessments not present (old report.json), fall back to assessments.
  const examZone = exam_assessments ?? assessments?.filter(a => a.type === 'exam') ?? [];
  const hwZone   = hw_assessments   ?? assessments?.filter(a => a.type !== 'exam') ?? [];

  // Limit to ONE focal exam column — highest relevance exam with drills
  const examZoneWithDrills = examZone.filter(a => a.drill_count > 0);
  const focalExam = examZoneWithDrills[0] ?? null;
  const hwWithDrills = hwZone.filter(a => a.drill_count > 0);

  // If no exam has drills, promote highest-relevance HW to focal position
  let focalAssessment = focalExam;
  let secondaryAssessments; // all non-focal assessments with drills
  if (focalExam) {
    // Secondary = remaining exams + all HW with drills
    secondaryAssessments = [...examZoneWithDrills.slice(1), ...hwWithDrills];
  } else if (hwWithDrills.length > 0) {
    focalAssessment = hwWithDrills[0];
    secondaryAssessments = hwWithDrills.slice(1);
  } else {
    secondaryAssessments = [];
  }

  // All assessments for the table strip (exams first, then HW)
  const allAssessments = [...(exam_assessments ?? []), ...(hw_assessments ?? [])];
  const tableAssessments = allAssessments.length > 0 ? allAssessments : (assessments ?? []);

  // Framing sentence
  const nearestExam = examZone.length > 0 ? examZone[0] : null;
  let framingSentence;
  if (nearestExam && review_video_url) {
    framingSentence = `Based on the <a href="${escHtml(review_video_url)}" style="color:var(--text-secondary);text-decoration:none">${escHtml(nearestExam.name)} review</a> (which covers the expected exam contents, with minor differences possible), these patterns from your submission are your highest-priority practice targets (${timeDisplay(nearestExam.days_left)} until ${escHtml(nearestExam.name)}).`;
  } else if (nearestExam) {
    framingSentence = `These patterns from your submission are your highest-priority practice targets (${timeDisplay(nearestExam.days_left)} until ${escHtml(nearestExam.name)}).`;
  } else {
    framingSentence = `These patterns from your submission are your highest-priority practice targets.`;
  }

  // Assessment table
  const tableHtml = renderAssessmentTable(tableAssessments);

  // Focal exam drill column
  const examColumnHtml = focalAssessment
    ? `<div class="columns">${renderExamColumn(focalAssessment, feedbackUrl)}</div>`
    : '';

  // Secondary zone — all non-focal assessments with drills
  const hwRowsHtml = secondaryAssessments.length > 0
    ? `<div class="hw-zone">
        <div class="hw-zone-label">ALSO PREPARES YOU FOR</div>
        ${secondaryAssessments.map(a => renderHwRow(a, feedbackUrl)).join('')}
      </div>`
    : '';

  // Fallback when no assessments at all
  const noAssessmentHeader = tableAssessments.length === 0
    ? `<p class="fallback-header">${total_unique_drills} debugging pattern${total_unique_drills !== 1 ? 's were' : ' was'} identified in your submission.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(assignment.full_name)} - Debugging Feedback</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --text-primary:    #2c2c2a;
    --text-secondary:  #5f5e5a;
    --text-tertiary:   #888780;
    --border:          #d3d1c7;
    --bg-card:         #fafaf8;
    --accent-exam:     #4a6d8c;
    --bar-fill:        #5576a6;
    --bar-track:       #e8e7e3;
  }

  @page { size: Letter; margin: 0; }
  html {
    height: 10.5in;
    overflow: hidden;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: var(--text-primary);
    background: #fff;
    padding: 14px 22px;
    max-width: 860px;
    margin: 0 auto;
    height: 10.5in;
    overflow: hidden;
  }

  /* Header */
  .sys-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .assignment-name {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  .framing {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 10px;
    line-height: 1.5;
  }
  .header-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 8px; }

  /* Assessment table strip */
  .assessment-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .assessment-table td {
    font-size: 11px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .arow-type   { width: 36px; font-size: 10px; letter-spacing: 0.06em; color: var(--text-tertiary); }
  .arow-name   { width: 130px; }
  .arow-date   { width: 68px; color: var(--text-secondary); }
  .arow-time   { width: 60px; font-size: 10px; }
  .arow-bar    { width: 88px; }
  .arow-pct    { width: 40px; font-size: 10px; font-variant-numeric: tabular-nums; }
  .arow-drills { font-size: 10px; }

  .bar-track { height: 5px; background: var(--bar-track); border-radius: 3px; }
  .bar-fill  { height: 5px; border-radius: 3px; }

  /* Drill columns (exam zone) */
  .columns { display: flex; gap: 0; margin-bottom: 8px; }
  .column  { flex: 1; min-width: 0; }
  .col-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-exam);
    letter-spacing: 0.04em;
    margin-bottom: 5px;
  }
  .col-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 6px; }

  .drill-card {
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-card);
    padding: 7px 9px;
    margin-bottom: 5px;
  }
  .drill-name {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 12px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 3px;
    line-height: 1.3;
  }
  .drill-num { font-variant-numeric: tabular-nums; margin-right: 4px; }
  .drill-intro {
    font-size: 10px;
    color: var(--text-tertiary);
    font-style: italic;
    margin-bottom: 3px;
    line-height: 1.4;
  }
  .drill-tests { font-size: 10px; color: var(--text-secondary); margin-bottom: 3px; }
  .drill-tests code { background: #f0efeb; padding: 1px 3px; border-radius: 2px; font-size: 10px; }
  .drill-meta  { font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; }
  .drill-also  { font-size: 10px; color: var(--text-tertiary); margin-bottom: 3px; }
  .drill-links { display: flex; gap: 10px; align-items: baseline; margin-top: 3px; flex-wrap: wrap; }
  .drill-link  { font-size: 10px; color: var(--text-secondary); text-decoration: none; }

  /* "Also on this exam" section */
  .exam-also {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-top: 6px;
    border-top: 1px solid var(--border);
    padding-top: 5px;
    line-height: 1.5;
  }
  .exam-also-label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9px;
    color: var(--text-tertiary);
  }
  .exam-also-link { color: var(--text-secondary); text-decoration: none; }

  /* HW zone */
  .hw-zone { margin-bottom: 8px; }
  .hw-zone-label {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .hw-row {
    display: flex;
    gap: 12px;
    align-items: baseline;
    font-size: 10px;
    color: var(--text-tertiary);
    margin-bottom: 3px;
  }
  .hw-name   { font-weight: 600; color: var(--text-secondary); }
  .hw-link   { font-size: 10px; color: var(--text-secondary); text-decoration: none; }

  /* Fallback */
  .fallback-header { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; }

  /* Footer */
  .footer { border-top: 1px solid var(--border); padding-top: 8px; }
  .footer-summary { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
  .footer-link    { display: block; font-size: 11px; color: var(--text-secondary); text-decoration: none; margin-bottom: 4px; }
  .footer-privacy { font-size: 10px; color: var(--text-tertiary); line-height: 1.5; }

  .muted { color: var(--text-tertiary); }

  @media print {
    html, body { overflow: hidden; }
  }
</style>
</head>
<body>

<div class="sys-label">CSSE 230 - Debugging Feedback</div>
<div class="assignment-name">${escHtml(assignment.full_name)}</div>
<div class="framing">${framingSentence}</div>
<hr class="header-rule">

${noAssessmentHeader}
${tableHtml}
${examColumnHtml}
${hwRowsHtml}

<div class="footer">
  <div class="footer-summary">
    <span>${total_unique_drills} drill${total_unique_drills !== 1 ? 's' : ''} · ${total_time} min total</span>
    ${generatedDate ? `<span style="font-size:9px;color:var(--text-tertiary)">Generated ${escHtml(generatedDate)}</span>` : ''}
  </div>
  <a class="footer-link" href="${escHtml(feedbackUrl)}">Open full feedback site</a>
  <div class="footer-privacy">
    Drills are optional and supplement, not replace, your own review.<br>
    Only you can see this feedback. Questions? gajavegs@rose-hulman.edu
  </div>
</div>

</body>
</html>`;
}
