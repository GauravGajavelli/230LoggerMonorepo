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
      ? 'font-weight:600;font-family:\'Source Serif 4\',serif;color:var(--text-primary)'
      : 'color:var(--text-tertiary)';
    const timeColor = isExam ? daysUrgencyColor(a.days_left) : 'var(--text-tertiary)';
    const hasBar = a.drill_count > 0;
    const fill = hasBar && isExam
      ? `<div class="bar-fill" style="width:${barPct(a.overlap_pct)}%;background:${barColor(a.overlap_pct)}"></div>`
      : '';
    const pctCell = hasBar && isExam ? `~${a.overlap_pct}%` : '';
    const drillCell = a.drill_count > 0
      ? `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`
      : '—';
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
    ? drill.drill_intro.slice(0, 120) + (drill.drill_intro.length > 120 ? '…' : '')
    : null;

  const metaLine = `~${drill.time_min} min · do before ${escHtml(assessment.name)} · ~${drill.weight_pct}% ${weightLabel(assessment.type)}`;

  let linksHtml = '';
  if (drill.source_url) {
    let smBase = '/study-materials';
    try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
    const href = smBase + '/' + encodeStudyPath(drill.source_url);
    const label = drill.source_label || drill.source || 'source';
    linksHtml += `<a class="drill-link" href="${escHtml(href)}" target="_blank">${escHtml(label)} →</a>`;
  }
  if (drill.drill_anchor) {
    linksHtml += `<a class="drill-link" href="${escHtml(feedbackUrl)}#${escHtml(drill.drill_anchor)}">Open drill →</a>`;
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

// Full exam drill column
function renderExamColumn(a, feedbackUrl, isPrimary) {
  const urgencyColor = barColor(a.overlap_pct);
  const headerBorder = isPrimary ? `border-left:3px solid var(--accent-exam);padding-left:8px` : '';
  const visibleDrills = a.drills.slice(0, 4);
  const hiddenCount = a.drills.length - visibleDrills.length;

  const drillCards = visibleDrills.map((d, i) =>
    renderExamDrillCard(d, a, i + 1, urgencyColor, feedbackUrl)
  ).join('');

  const moreNote = hiddenCount > 0
    ? `<div class="muted" style="font-size:11px;margin-top:4px">and ${hiddenCount} more — see feedback site</div>`
    : '';

  return `
    <div class="column">
      <div class="col-header" style="${headerBorder}">
        ${escHtml(a.name)} · ${escHtml(dayLabel(a.date))}, ${escHtml(a.date_display)}
      </div>
      <div class="col-rule"></div>
      ${drillCards}${moreNote}
    </div>`;
}

// Compact homework zone row
function renderHwRow(a, feedbackUrl) {
  const drillText = a.drill_count > 0
    ? `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`
    : 'no matched drills';
  const linkHtml = a.drill_count > 0
    ? `<a class="hw-link" href="${escHtml(feedbackUrl)}">see all drills →</a>`
    : '';
  return `
    <div class="hw-row">
      <span class="hw-name">${escHtml(a.name)}</span>
      <span class="hw-date">${escHtml(a.date_display)}</span>
      <span class="hw-drills">${drillText}</span>
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

  // If no exam zone drills, promote highest-relevance HW assessment to exam zone
  const examZoneWithDrills = examZone.filter(a => a.drill_count > 0);
  let primaryExamAssessments = examZoneWithDrills.slice(0, 2);
  let hwZoneToShow = hwZone.filter(a => a.drill_count > 0);

  if (primaryExamAssessments.length === 0 && hwZoneToShow.length > 0) {
    primaryExamAssessments = [hwZoneToShow[0]];
    hwZoneToShow = hwZoneToShow.slice(1);
  }

  // All assessments for the table strip (exams first, then HW)
  const allAssessments = [...(exam_assessments ?? []), ...(hw_assessments ?? [])];
  const tableAssessments = allAssessments.length > 0 ? allAssessments : (assessments ?? []);

  // Framing sentence
  const nearestExam = primaryExamAssessments[0];
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

  // Exam drill columns
  const examColumnsHtml = primaryExamAssessments.length > 0
    ? `<div class="columns">${primaryExamAssessments.map((a, i) => renderExamColumn(a, feedbackUrl, i === 0)).join('')}</div>`
    : '';

  // HW zone
  const hwRowsHtml = hwZoneToShow.length > 0
    ? `<div class="hw-zone">
        <div class="hw-zone-label">ALSO PREPARES YOU FOR UPCOMING HOMEWORK</div>
        ${hwZoneToShow.map(a => renderHwRow(a, feedbackUrl)).join('')}
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
<title>${escHtml(assignment.full_name)} — Debugging Feedback</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --text-primary:    #2c2c2a;
    --text-secondary:  #5f5e5a;
    --text-tertiary:   #888780;
    --border:          #d3d1c7;
    --bg-card:         #fafaf8;
    --accent-exam:     #4a6d8c;
    --accent-hw:       #6b7c6b;
    --bar-fill:        #5576a6;
    --bar-track:       #e8e7e3;
  }

  @page { size: Letter; margin: 0; }
  body {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 14px;
    color: var(--text-primary);
    background: #fff;
    padding: 20px 28px;
    max-width: 860px;
    margin: 0 auto;
    height: 10.5in;
    overflow: hidden;
  }

  /* Header */
  .sys-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 6px;
  }
  .assignment-name {
    font-family: 'Source Serif 4', serif;
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  .framing {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .header-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 14px; }

  /* Assessment table strip */
  .assessment-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    table-layout: fixed;
  }
  .assessment-table td {
    font-size: 12px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .arow-type   { width: 36px; font-size: 10px; letter-spacing: 0.06em; color: var(--text-tertiary); }
  .arow-name   { width: 130px; }
  .arow-date   { width: 72px; color: var(--text-secondary); }
  .arow-time   { width: 64px; font-size: 11px; }
  .arow-bar    { width: 90px; }
  .arow-pct    { width: 42px; font-size: 11px; font-variant-numeric: tabular-nums; }
  .arow-drills { font-size: 11px; }

  .bar-track { height: 5px; background: var(--bar-track); border-radius: 3px; }
  .bar-fill  { height: 5px; border-radius: 3px; }

  /* Drill columns (exam zone) */
  .columns { display: flex; gap: 24px; margin-bottom: 14px; flex-wrap: nowrap; }
  .column  { flex: 1; min-width: 0; }
  .col-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-exam);
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }
  .col-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 10px; }

  .drill-card {
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-card);
    padding: 9px 11px;
    margin-bottom: 7px;
  }
  .drill-name {
    font-family: 'Source Serif 4', serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    line-height: 1.3;
  }
  .drill-num { font-variant-numeric: tabular-nums; margin-right: 4px; }
  .drill-intro {
    font-size: 11px;
    color: var(--text-tertiary);
    font-style: italic;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .drill-tests { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
  .drill-tests code { background: #f0efeb; padding: 1px 3px; border-radius: 2px; font-size: 10px; }
  .drill-meta  { font-size: 11px; color: var(--text-secondary); margin-bottom: 3px; }
  .drill-also  { font-size: 10px; color: var(--text-tertiary); margin-bottom: 4px; }
  .drill-links { display: flex; gap: 10px; align-items: baseline; margin-top: 5px; flex-wrap: wrap; }
  .drill-link  { font-size: 11px; color: var(--text-secondary); text-decoration: none; }

  /* HW zone */
  .hw-zone { margin-bottom: 14px; }
  .hw-zone-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 6px;
  }
  .hw-row {
    display: flex;
    gap: 14px;
    align-items: baseline;
    font-size: 11px;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .hw-name   { font-weight: 600; color: var(--text-secondary); }
  .hw-date   { }
  .hw-drills { }
  .hw-link   { font-size: 11px; color: var(--text-secondary); text-decoration: none; }

  /* Fallback */
  .fallback-header { font-size: 15px; color: var(--text-secondary); margin-bottom: 20px; }

  /* Footer */
  .footer { border-top: 1px solid var(--border); padding-top: 12px; }
  .footer-summary { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }
  .footer-link    { display: block; font-size: 12px; color: var(--text-secondary); text-decoration: none; margin-bottom: 8px; }
  .footer-privacy { font-size: 11px; color: var(--text-tertiary); line-height: 1.5; }

  .muted { color: var(--text-tertiary); }

  @media print {
    body { padding: 20px 28px; }
    .columns { flex-wrap: nowrap; }
  }
</style>
</head>
<body>

<div class="sys-label">CSSE 230 · Debugging Feedback</div>
<div class="assignment-name">${escHtml(assignment.full_name)}</div>
<div class="framing">${framingSentence}</div>
<hr class="header-rule">

${noAssessmentHeader}
${tableHtml}
${examColumnsHtml}
${hwRowsHtml}

<div class="footer">
  <div class="footer-summary">
    <span>${total_unique_drills} drill${total_unique_drills !== 1 ? 's' : ''} · ${total_time} min total</span>
    ${generatedDate ? `<span style="font-size:10px;color:var(--text-tertiary)">Generated ${escHtml(generatedDate)}</span>` : ''}
  </div>
  <a class="footer-link" href="${escHtml(feedbackUrl)}">Open full feedback site</a>
  <div class="footer-privacy">
    Drills are optional and supplement — not replace — your own review.<br>
    Only you can see this feedback. Questions? gajavegs@rose-hulman.edu
  </div>
</div>

</body>
</html>`;
}
