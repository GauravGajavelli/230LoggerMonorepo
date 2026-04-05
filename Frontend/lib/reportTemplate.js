/**
 * reportTemplate.js
 *
 * Produces a self-contained HTML string for the student summary report.
 * Designed to be printed to PDF by Puppeteer — all styles are inline or in a
 * <style> block, no external resources.
 *
 * Visual philosophy: reads like a printed course handout, not a web app.
 *   - Georgia serif throughout (consistent with typewritten/word-processed documents)
 *   - Grayscale palette; one structural accent (maroon left border on title only)
 *   - No progress bars, no card boxes, no colored badges
 *   - Tables and numbered sections, same as exam/HW documents
 *
 * Input: the reportData object produced by report.js
 */

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dayLabel(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return DAY_NAMES[d.getUTCDay()];
}

// Bar fill color for exam rows — urgency scale based on how much exam content is targeted
function barColor(overlapPct) {
  if (overlapPct >= 35) return '#BF1722';  // vivid red — significant coverage
  if (overlapPct >= 20) return '#E87722';  // RH Orange — moderate
  return '#4F758B';                        // RH Dark Blue — low
}

// Time display: weeks when >= 14 days
function timeDisplay(days) {
  if (days <= 13) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function typeLabel(type) {
  if (type === 'exam')     return 'Exam';
  if (type === 'homework') return 'HW';
  return 'Asmt';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sanitize user-content strings: replace typographic dashes with plain alternatives.
function sanitize(str) {
  if (!str) return str;
  return String(str)
    .replace(/\u2014/g, ', ')   // em dash → comma-space
    .replace(/\u2013/g, '-');   // en dash → hyphen
}

function encodeStudyPath(rawPath) {
  return rawPath.split('/').map(s => encodeURIComponent(s)).join('/');
}

// Compact assessment table strip — all assessments in one table
function renderAssessmentTable(allAssessments) {
  if (!allAssessments || allAssessments.length === 0) return '';
  const rows = allAssessments.map(a => {
    const isExam = a.type === 'exam';
    const nameStyle = isExam
      ? 'font-weight:600;color:var(--text-primary)'
      : 'color:var(--text-secondary)';
    const rowStyle = isExam ? '' : 'color:var(--text-tertiary)';

    const hasBar = a.drill_count > 0 && a.overlap_pct > 0;
    const fillColor = isExam ? barColor(a.overlap_pct) : '#A7BCD6';
    const barCell = hasBar
      ? `<div class="bar-row">` +
          `<div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, a.overlap_pct)}%;background:${fillColor}"></div></div>` +
          `<span class="bar-label" style="color:${fillColor}">~${a.overlap_pct}% of ${isExam ? 'exam' : 'HW'}</span>` +
        `</div>`
      : '';

    const drillText = a.drill_count > 0
      ? `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`
      : '—';

    const daysText = a.days_left > 0 ? timeDisplay(a.days_left) : '';

    return `
      <tr style="${rowStyle}">
        <td class="arow-type">${typeLabel(a.type)}</td>
        <td class="arow-name" style="${nameStyle}">${escHtml(a.name)}</td>
        <td class="arow-date">${escHtml(a.date_display)}</td>
        <td class="arow-time">${daysText}</td>
        <td class="arow-bar">${barCell}</td>
        <td class="arow-drills">${drillText}</td>
      </tr>`;
  }).join('');
  return `<table class="assessment-table"><tbody>${rows}</tbody></table>`;
}

// Full drill section for exam zone — no card box, numbered list style
function renderExamDrillSection(drill, assessment, num, feedbackUrl) {
  const tests = drill.test_names.slice(0, 3);
  const extraCount = drill.test_names.length - tests.length;
  const testLine = tests.map(t => `<code>${escHtml(t)}</code>`).join(', ')
    + (extraCount > 0 ? ` <span class="muted">+${extraCount}</span>` : '');

  const introText = drill.drill_intro ? sanitize(drill.drill_intro) : null;

  const metaLine = `~${drill.time_min} min · ~${drill.weight_pct}% of ${assessment.type === 'exam' ? 'exam' : 'HW'}`;

  let linksHtml = '';
  if (drill.source_url) {
    let smBase = '/study-materials';
    try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
    const href = smBase + '/' + encodeStudyPath(drill.source_url);
    const label = drill.source_label || drill.source || 'source';
    linksHtml += `<a class="drill-link" href="${escHtml(href)}" target="_blank">${escHtml(label)} &rsaquo;</a>`;
  }
  if (drill.drill_anchor) {
    linksHtml += `<a class="drill-link" href="${escHtml(feedbackUrl)}#${escHtml(drill.drill_anchor)}">Open drill &rsaquo;</a>`;
  }

  const alsoNote = drill.also_relevant_to
    ? `<div class="drill-also">Also relevant to ${escHtml(drill.also_relevant_to)}</div>`
    : '';

  return `
    <div class="drill-section">
      <div class="drill-header">
        <span class="drill-num">${num}.</span>${escHtml(drill.pattern_name)}
      </div>
      ${introText ? `<div class="drill-intro">${escHtml(introText)}</div>` : ''}
      <div class="drill-tests">${testLine}</div>
      <div class="drill-meta">${metaLine}</div>
      ${alsoNote}
      ${linksHtml ? `<div class="drill-links">${linksHtml}</div>` : ''}
    </div>`;
}

// "Also on this exam" section — coverage summary + uncovered concepts + study guide links
function renderAlsoOnExam(assessment, feedbackUrl) {
  const uncovered = (assessment.uncovered_concepts || []).filter(c => c.weight_pct > 0);
  const overlapPct = assessment.overlap_pct || 0;
  if (overlapPct === 0 && uncovered.length === 0) return '';

  let smBase = '/study-materials';
  try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
  const allLinks = assessment.all_links || [];
  const linksHtml = allLinks.length > 0
    ? ' ' + allLinks.map(lk => {
        const href = smBase + '/' + encodeStudyPath(lk.url);
        return `<a class="exam-also-link" href="${escHtml(href)}" target="_blank">${escHtml(lk.label)} &rsaquo;</a>`;
      }).join(' ')
    : '';

  let body;
  if (uncovered.length === 0) {
    body = `Your drills address the full exam content (~${overlapPct}%).`;
  } else {
    const uncoveredTopics = uncovered.map(c => `${escHtml(c.description)} (~${c.weight_pct}%)`).join(', ');
    body = `Your drills cover ~${overlapPct}% of this exam. Not yet targeted: ${uncoveredTopics}.`;
  }

  return `
    <div class="exam-also">
      <span class="exam-also-label">Also on ${escHtml(assessment.name)}:</span> ${body}${linksHtml}
    </div>`;
}

// Full exam drill column — single focal exam only
function renderExamColumn(a, feedbackUrl) {
  const visibleDrills = a.drills.slice(0, 3);
  const hiddenCount = a.drills.length - visibleDrills.length;

  const drillSections = visibleDrills.map((d, i) =>
    renderExamDrillSection(d, a, i + 1, feedbackUrl)
  ).join('');

  const moreNote = hiddenCount > 0
    ? `<div class="muted" style="font-size:11px;margin-top:4px">and ${hiddenCount} more — see feedback site</div>`
    : '';

  const alsoOnExam = renderAlsoOnExam(a, feedbackUrl);

  return `
    <div class="column">
      <div class="col-header">
        <div class="col-header-name">${escHtml(a.name)} · ${escHtml(dayLabel(a.date))}, ${escHtml(a.date_display)}</div>
        <div class="col-subtitle">${timeDisplay(a.days_left)} away · highest-priority drills</div>
      </div>
      <hr class="col-rule">
      ${drillSections}${moreNote}${alsoOnExam}
    </div>`;
}

// Compact secondary zone row (non-focal exams + HW)
function renderHwRow(a, feedbackUrl) {
  const typeTag = a.type === 'exam'
    ? `<span style="font-size:9px;letter-spacing:0.05em;font-style:normal;color:var(--text-tertiary);margin-right:4px">[Exam]</span>`
    : '';
  const drillText = `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`
    + (a.overlap_pct > 0 ? ` (~${a.overlap_pct}% of ${a.type === 'exam' ? 'exam' : 'HW'})` : '');
  const linkHtml = `<a class="hw-link" href="${escHtml(feedbackUrl)}">see all &rsaquo;</a>`;
  return `
    <div class="hw-row">
      ${typeTag}<span class="hw-name">${escHtml(a.name)}</span>
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

  // Limit to ONE focal exam column — highest relevance exam with drills
  const examZoneWithDrills = examZone.filter(a => a.drill_count > 0);
  const focalExam = examZoneWithDrills[0] ?? null;
  const hwWithDrills = hwZone.filter(a => a.drill_count > 0);

  // If no exam has drills, promote highest-relevance HW to focal position
  let focalAssessment = focalExam;
  let secondaryAssessments;
  if (focalExam) {
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
  const focalIsExam = focalAssessment?.type === 'exam';
  let framingSentence;
  if (focalIsExam && review_video_url) {
    framingSentence = `The <a href="${escHtml(review_video_url)}" style="color:var(--text-secondary)">${escHtml(focalAssessment.name)} review</a> covers the expected exam contents (minor differences possible). These patterns from your submission are your highest-priority practice targets with ${timeDisplay(focalAssessment.days_left)} until ${escHtml(focalAssessment.name)}.`;
  } else if (focalAssessment) {
    framingSentence = `These patterns from your submission are your highest-priority practice targets (${timeDisplay(focalAssessment.days_left)} until ${escHtml(focalAssessment.name)}).`;
  } else {
    framingSentence = `These patterns from your submission are your highest-priority practice targets.`;
  }

  // Assessment table
  const tableHtml = renderAssessmentTable(tableAssessments);

  // Focal exam drill column
  const examColumnHtml = focalAssessment
    ? `<div class="columns">${renderExamColumn(focalAssessment, feedbackUrl)}</div>`
    : '';

  // Secondary zone
  const hwRowsHtml = secondaryAssessments.length > 0
    ? `<div class="hw-zone">
        <div class="hw-zone-label">Also prepares you for</div>
        ${secondaryAssessments.map(a => renderHwRow(a, feedbackUrl)).join('')}
      </div>`
    : '';

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
    --text-primary:   #111;
    --text-secondary: #3a3a3a;
    --text-tertiary:  #777;
    --border:         #c0c0c0;
    --accent:         #800000;
  }

  @page { size: Letter; margin: 0; }
  html { height: 11in; overflow: hidden; }
  body {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-primary);
    background: #fff;
    padding: 40px 52px 34px;
    max-width: 900px;
    margin: 0 auto;
    height: 11in;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .main-content { flex: 1; }

  /* Header */
  .sys-label {
    font-family: Georgia, serif;
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
    margin-bottom: 5px;
  }
  .assignment-name {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 7px;
    border-left: 3px solid var(--accent);
    padding-left: 10px;
  }
  .framing {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 18px;
    line-height: 1.55;
    padding-left: 13px;
    font-style: italic;
  }
  .header-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 16px; }

  /* Assessment table strip */
  .assessment-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    table-layout: fixed;
  }
  .assessment-table td {
    font-size: 11px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
  }
  .arow-type   { width: 7%;  font-size: 10px; letter-spacing: 0.03em; color: var(--text-tertiary); font-style: italic; }
  .arow-name   { width: 18%; }
  .arow-date   { width: 11%; }
  .arow-time   { width: 10%; }
  .arow-bar    { width: 27%; white-space: nowrap; }
  .arow-drills { width: 27%; }

  .bar-row   { display: flex; align-items: center; gap: 7px; }
  .bar-track { flex: 1; height: 4px; background: #e0e0e0; border-radius: 2px; }
  .bar-fill  { height: 4px; border-radius: 2px; }
  .bar-label { font-size: 10px; white-space: nowrap; min-width: 78px; font-variant-numeric: tabular-nums; }

  /* Exam drill column header */
  .col-header { margin-bottom: 5px; }
  .col-header-name {
    font-family: Georgia, 'Palatino Linotype', Palatino, serif;
    font-size: 15px;
    font-weight: bold;
    color: var(--text-primary);
    line-height: 1.3;
    margin-bottom: 2px;
  }
  .col-subtitle {
    font-size: 10px;
    color: var(--text-tertiary);
    font-style: italic;
  }
  .col-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 0; }

  /* Drill sections — numbered list style, no card boxes */
  .drill-section {
    padding: 8px 0 6px;
    border-bottom: 1px solid #e4e4e4;
  }
  .drill-header {
    font-size: 12px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 3px;
    line-height: 1.3;
  }
  .drill-num {
    font-variant-numeric: tabular-nums;
    color: var(--text-tertiary);
    margin-right: 5px;
  }
  .drill-intro {
    font-size: 11px;
    color: var(--text-secondary);
    font-style: italic;
    margin-bottom: 3px;
    line-height: 1.45;
    padding-left: 16px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }
  .drill-tests {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 3px;
    padding-left: 16px;
  }
  .drill-tests code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    background: #f0f0f0;
    padding: 1px 3px;
    border-radius: 2px;
  }
  .drill-meta  { font-size: 10px; color: var(--text-tertiary); margin-bottom: 2px; padding-left: 16px; }
  .drill-also  { font-size: 10px; color: var(--text-tertiary); margin-bottom: 2px; padding-left: 16px; }
  .drill-links { display: flex; gap: 12px; padding-left: 16px; flex-wrap: wrap; }
  .drill-link  { font-size: 11px; color: var(--text-secondary); text-decoration: none; }

  /* "Also on this exam" section */
  .exam-also {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 8px;
    padding-top: 5px;
    line-height: 1.5;
  }
  .exam-also-label {
    font-weight: bold;
    color: var(--text-secondary);
  }
  .exam-also-link { color: var(--text-secondary); text-decoration: none; font-size: 11px; }

  /* Secondary zone */
  .hw-zone { margin-bottom: 14px; }
  .hw-zone-label {
    font-size: 10px;
    letter-spacing: 0.04em;
    font-style: italic;
    color: var(--text-tertiary);
    margin-bottom: 5px;
  }
  .hw-row {
    display: flex;
    gap: 14px;
    align-items: baseline;
    font-size: 11px;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .hw-name   { font-weight: bold; color: var(--text-secondary); min-width: 100px; }
  .hw-date   { min-width: 68px; }
  .hw-drills { flex: 1; }
  .hw-link   { font-size: 11px; color: var(--text-secondary); text-decoration: none; }

  /* Fallback */
  .fallback-header { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; }

  /* Footer */
  .footer { border-top: 1px solid var(--border); padding-top: 14px; }
  .footer-summary { font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; display: flex; justify-content: space-between; align-items: baseline; }
  .footer-link    { display: block; font-size: 11px; color: var(--text-secondary); text-decoration: none; margin-bottom: 5px; }
  .footer-privacy { font-size: 10px; color: var(--text-tertiary); line-height: 1.5; }

  .muted { color: var(--text-tertiary); }
  .columns { margin-bottom: 14px; }
  .column  { min-width: 0; }

  @media print {
    html, body { overflow: hidden; }
  }
</style>
</head>
<body>

<div class="main-content">
<div class="sys-label">CSSE 230 Debugging Feedback</div>
<div class="assignment-name">${escHtml(assignment.full_name)}</div>
<div class="framing">${framingSentence}</div>
<hr class="header-rule">

${noAssessmentHeader}
${tableHtml}
${examColumnHtml}
${hwRowsHtml}
</div>

<div class="footer">
  <div class="footer-summary">
    <span>${total_unique_drills} drill${total_unique_drills !== 1 ? 's' : ''} · ${total_time} min total</span>
    ${generatedDate ? `<span style="font-size:9px;color:var(--text-tertiary)">Generated ${escHtml(generatedDate)}</span>` : ''}
  </div>
  <a class="footer-link" href="${escHtml(feedbackUrl)}">Open full feedback site &rsaquo;</a>
  <div class="footer-privacy">
    Drills are optional and supplement, not replace, your own review.<br>
    Only you can see this feedback. Questions? gajavegs@rose-hulman.edu
  </div>
</div>

</body>
</html>`;
}
