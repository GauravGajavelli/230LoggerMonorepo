/**
 * reportTemplate.js
 *
 * Produces a self-contained HTML string for the student summary report.
 * Designed to be printed to PDF by Puppeteer — all styles are inline or in a
 * <style> block, no external resources.
 *
 * Input: the reportData object produced by report.js
 */

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dayLabel(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return DAY_NAMES[d.getUTCDay()];
}

function weightLabel(type) {
  if (type === 'exam')     return 'of exam content';
  if (type === 'homework') return 'of HW topics';
  return 'of assessment content';
}

// Bar fill: scale overlap_pct so that 50% maps to 100% visual width
function barPct(overlapPct) {
  return Math.min(100, Math.round((overlapPct / 50) * 100));
}

function daysUrgencyColor(days) {
  if (days <= 3)  return '#c0392b';  // red — this week
  if (days <= 7)  return '#d35400';  // orange — next week
  if (days <= 14) return '#b7860b';  // amber — two weeks out
  return 'var(--text-tertiary)';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCard(a) {
  const fill = barPct(a.overlap_pct);
  const accentColor = a.type === 'exam' ? '#4a6d8c' : '#6b7c6b';
  const isExam = a.type === 'exam';
  const cardBg = isExam ? '#f0f4f8' : 'var(--bg-card)';
  const topRule = isExam ? 'border-top: 3px solid var(--accent-exam);' : '';
  const drillSummary = a.drill_count === 0
    ? '<span class="muted">No drill matches</span>'
    : `${a.drill_count} drill${a.drill_count !== 1 ? 's' : ''} · ${a.total_time} min`;
  return `
    <div class="card" style="background:${cardBg};${topRule}">
      <div class="card-header">
        <span class="card-name" style="color:${accentColor}">${escHtml(a.name.toUpperCase())}</span>
        <span class="card-date">
          ${escHtml(dayLabel(a.date))}, ${escHtml(a.date_display)}
          ${a.days_left > 0 ? `<span class="days-left" style="color:${daysUrgencyColor(a.days_left)}">${a.days_left} days left</span>` : ''}
        </span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${fill}%"></div>
      </div>
      <div class="overlap-label" style="font-feature-settings:'tnum'">~${a.overlap_pct}% ${escHtml(weightLabel(a.type))}<br>overlaps with your practice drills</div>
      <div class="card-summary">${drillSummary}</div>
    </div>`;
}

function encodeStudyPath(rawPath) {
  return rawPath.split('/').map(s => encodeURIComponent(s)).join('/');
}

function renderDrillCard(drill, assessmentType, feedbackUrl) {
  const tests = drill.test_names.slice(0, 4);
  const extraCount = drill.test_names.length - tests.length;
  const testLine = tests.map(t => `<code>${escHtml(t)}</code>`).join(', ')
    + (extraCount > 0 ? ` <span class="muted">and ${extraCount} more</span>` : '');
  const drillUrl = `${feedbackUrl}${drill.drill_anchor ? '#' + drill.drill_anchor : ''}`;
  let sourceHtml = '';
  if (drill.source_url) {
    let smBase = '/study-materials';
    try { smBase = new URL(feedbackUrl).origin + '/study-materials'; } catch {}
    const href = smBase + '/' + encodeStudyPath(drill.source_url);
    sourceHtml = `<a class="drill-source-link" href="${escHtml(href)}" target="_blank">View ${escHtml(drill.source || 'source')} →</a>`;
  }
  return `
    <div class="drill-card">
      <div class="drill-name">${escHtml(drill.pattern_name)}</div>
      <div class="drill-tests">${testLine}</div>
      <div class="drill-meta">~${drill.weight_pct}% ${escHtml(weightLabel(assessmentType))} · ${drill.time_min} min</div>
      ${drill.also_relevant_to ? `<div class="drill-also">Also relevant to ${escHtml(drill.also_relevant_to)}</div>` : ''}
      <div class="drill-links">${sourceHtml}<a class="drill-link" href="${escHtml(drillUrl)}">Open drill →</a></div>
    </div>`;
}

function renderColumn(a, feedbackUrl) {
  const accentColor = a.type === 'exam' ? '#4a6d8c' : '#6b7c6b';
  const visibleDrills = a.drills.slice(0, 4);
  const hiddenCount = a.drills.length - visibleDrills.length;
  const drillCards = visibleDrills.map(d => renderDrillCard(d, a.type, feedbackUrl)).join('');
  const moreNote = hiddenCount > 0
    ? `<div class="muted" style="font-size:11px;margin-top:4px">and ${hiddenCount} more — see feedback site</div>`
    : '';
  return `
    <div class="column">
      <div class="col-header" style="color:${accentColor}">
        ${escHtml(a.name)} · ${escHtml(dayLabel(a.date))}, ${escHtml(a.date_display)}
      </div>
      <div class="col-rule"></div>
      ${drillCards}${moreNote}
    </div>`;
}

export function renderReportHtml(reportData, feedbackUrl) {
  const { assignment, assessments, total_unique_drills, total_time, generated_at } = reportData;
  const generatedDate = generated_at ? generated_at.slice(0, 10) : '';

  const hasAssessments = assessments && assessments.length > 0;

  // Cap at 3 cards; extras go into a footer note
  const visibleAssessments = hasAssessments ? assessments.slice(0, 3) : [];
  const hiddenAssessments  = hasAssessments ? assessments.slice(3) : [];

  const cardsHtml = visibleAssessments.map(renderCard).join('');
  const columnsHtml = visibleAssessments.map(a => renderColumn(a, feedbackUrl)).join('');

  const hiddenNote = hiddenAssessments.length > 0
    ? `<p class="also-relevant">Also relevant to: ${hiddenAssessments.map(a => `${escHtml(a.name)} (${escHtml(a.date_display)})`).join(', ')}</p>`
    : '';

  const noAssessmentHeader = !hasAssessments
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
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 20px;
  }
  .header-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 24px; }

  /* Assessment cards */
  .cards { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .card {
    flex: 1; min-width: 200px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-card);
    padding: 14px 16px;
  }
  .card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .card-name { font-size: 12px; font-weight: 600; letter-spacing: 0.05em; }
  .card-date { font-size: 12px; color: var(--text-secondary); }
  .days-left { display: block; font-size: 11px; font-weight: 600; margin-top: 2px; }
  .bar-track { height: 6px; background: var(--bar-track); border-radius: 3px; margin-bottom: 6px; }
  .bar-fill  { height: 6px; background: var(--bar-fill); border-radius: 3px; }
  .overlap-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4; }
  .card-summary  { font-size: 12px; color: var(--text-tertiary); }

  /* Drill columns */
  .columns { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
  .column { flex: 1; min-width: 220px; }
  .col-header { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 6px; }
  .col-rule { border: none; border-top: 1px solid var(--border); margin-bottom: 14px; }

  .drill-card {
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-card);
    padding: 10px 12px;
    margin-bottom: 8px;
  }
  .drill-name {
    font-family: 'Source Serif 4', serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 5px;
    line-height: 1.35;
  }
  .drill-tests { font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; }
  .drill-tests code { background: #f0efeb; padding: 1px 4px; border-radius: 3px; font-size: 10px; }
  .drill-meta  { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
  .drill-also  { font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px; }
  .drill-links { display: flex; gap: 12px; align-items: baseline; margin-top: 6px; flex-wrap: wrap; }
  .drill-link, .drill-source-link {
    display: inline-block;
    font-size: 12px;
    color: var(--accent-exam);
    text-decoration: none;
  }
  .drill-source-link { color: var(--text-tertiary); }
  .muted { color: var(--text-tertiary); }

  /* Fallback */
  .fallback-header { font-size: 15px; color: var(--text-secondary); margin-bottom: 24px; }

  /* Also relevant */
  .also-relevant { font-size: 12px; color: var(--text-tertiary); margin-bottom: 24px; }

  /* Footer */
  .footer { border-top: 1px solid var(--border); padding-top: 16px; }
  .footer-summary { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
  .footer-link    { display: block; font-size: 13px; color: var(--accent-exam); text-decoration: none; margin-bottom: 12px; }
  .footer-privacy { font-size: 11px; color: var(--text-tertiary); line-height: 1.5; }

  @media print {
    body { padding: 20px 28px; }
    .cards, .columns { flex-wrap: nowrap; }
  }
</style>
</head>
<body>

<div class="sys-label">CSSE 230 · Debugging Feedback</div>
<div class="assignment-name">${escHtml(assignment.full_name)}</div>
<div class="framing">Your submission was analyzed.<br>Here's what to focus on.</div>
<hr class="header-rule">

${noAssessmentHeader}

${hasAssessments ? `<div class="cards">${cardsHtml}</div>` : ''}
${hiddenNote}

${hasAssessments ? `<div class="columns">${columnsHtml}</div>` : ''}

<div class="footer">
  <div class="footer-summary" style="display:flex;justify-content:space-between;align-items:baseline">
    <span>${total_unique_drills} drill${total_unique_drills !== 1 ? 's' : ''} · ${total_time} min total · All drills are optional</span>
    ${generatedDate ? `<span style="font-size:10px;color:var(--text-tertiary)">Generated ${escHtml(generatedDate)}</span>` : ''}
  </div>
  <a class="footer-link" href="${escHtml(feedbackUrl)}">Open full feedback site →</a>
  <div class="footer-privacy">
    This report was generated from your test run data.<br>
    Only you can see this feedback.<br>
    Questions? gajavegs@rose-hulman.edu
  </div>
</div>

</body>
</html>`;
}
