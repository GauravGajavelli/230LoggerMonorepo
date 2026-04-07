// dotenv MUST be first — sets process.env before any lib module reads it
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { execFile } from 'child_process';
import jwt from 'jsonwebtoken';
import db from './lib/db.js';
import { verifyToken } from './lib/tokens.js';
import { logEvents } from './lib/events.js';
import { generateReportForToken } from './lib/report.js';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT       = path.resolve(__dirname, '..');
const ASSIGNMENTS_DIR = path.join(REPO_ROOT, 'Pipeline', 'assignments');

const PORT        = parseInt(process.env.PORT)          || 3000;
const DATA_DIR    = path.resolve(process.env.DATA_DIR   || path.join(__dirname, 'data'));
const BASE_URL    = (process.env.BASE_URL               || `http://localhost:${PORT}`).replace(/\/$/, '');
const RELAY_SECRET = process.env.RELAY_SECRET;
const DIST_DIR    = path.resolve(process.env.DIST_DIR   || path.join(__dirname, 'dist'));
const PIPELINE_JAR = path.resolve(process.env.PIPELINE_JAR || path.join(__dirname, '..', 'Pipeline', 'target', 'csse230-feedback.jar'));
const LLM_CACHE_DIR = path.resolve(process.env.LLM_CACHE_DIR || path.join(__dirname, '..', 'Pipeline', 'cache', 'llm'));
const DEMO_TOKEN  = process.env.DEMO_TOKEN || null;
const EMAIL_DEV_REDIRECT  = process.env.EMAIL_DEV_REDIRECT || null;
const HOLD_EMAILS = process.env.HOLD_EMAILS === 'true';
const DEMO_JSON   = path.join(__dirname, 'public', 'data', 'frontend.json');
// RoseFire — ROSEFIRE_SECRET is the secretOrPrivateKey you provided when registering your app.
// ROSEFIRE_REGISTRY_TOKEN is the UUID returned by registration (safe to embed in client HTML).
const ROSEFIRE_SECRET           = process.env.ROSEFIRE_SECRET;
const ROSEFIRE_REGISTRY_TOKEN   = process.env.ROSEFIRE_REGISTRY_TOKEN || '';

const app = express();
app.set('trust proxy', 1); // nginx sits in front; use X-Forwarded-For for req.ip
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────

const lookupRateMap = new Map(); // ip → [timestamps]
function isLookupAllowed(ip) {
  const now = Date.now();
  const prev = (lookupRateMap.get(ip) || []).filter(t => now - t < 60_000);
  prev.push(now);
  lookupRateMap.set(ip, prev);
  return prev.length <= 5;
}

// DB-backed: max 3 upload-sourced pipeline runs per token (survives server restarts)
function isUploadAllowed(token) {
  const row = db.prepare(
    "SELECT COUNT(*) as n FROM pipeline_runs WHERE student_id=(SELECT student_id FROM tokens WHERE token=?) AND assignment=(SELECT assignment FROM tokens WHERE token=?) AND source='upload'"
  ).get(token, token);
  return (row?.n ?? 0) < 3;
}

// ─── Relay auth ───────────────────────────────────────────────────────────────

function requireRelayAuth(req, res, next) {
  if (!RELAY_SECRET || req.headers.authorization !== `Bearer ${RELAY_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  dest: path.join(__dirname, 'tmp'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Static serving ───────────────────────────────────────────────────────────

// Serve built assets without auto-serving index.html at /
app.use(express.static(DIST_DIR, { index: false }));

// Serve course study materials (exam solutions, homework specs) from Pipeline/testInputs/csse230/
const STUDY_MATERIALS_DIR = path.join(REPO_ROOT, 'Pipeline', 'testInputs', 'csse230');
app.use('/study-materials', express.static(STUDY_MATERIALS_DIR));

// Markdown file viewer — renders .md files as styled HTML instead of raw text.
// Only serves files inside STUDY_MATERIALS_DIR (path traversal protection).
// PDFs and other files are served directly via the /study-materials static route.
app.get('/view', (req, res) => {
  const rawFile = req.query.file;
  if (!rawFile) return res.status(400).send('Missing file parameter.');

  const resolved = path.resolve(STUDY_MATERIALS_DIR, rawFile);
  if (!resolved.startsWith(STUDY_MATERIALS_DIR + path.sep) && resolved !== STUDY_MATERIALS_DIR) {
    return res.status(403).send('Forbidden.');
  }
  if (!resolved.endsWith('.md')) {
    return res.redirect('/study-materials/' + rawFile.split('/').map(encodeURIComponent).join('/'));
  }
  if (!fs.existsSync(resolved)) return res.status(404).send('File not found.');

  const mdContent = fs.readFileSync(resolved, 'utf8');
  const body = marked.parse(mdContent);
  const title = path.basename(rawFile, '.md').replace(/-/g, ' ');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — CSSE 230</title>
<style>
  body { font-family: Georgia, serif; max-width: 780px; margin: 40px auto; padding: 0 24px 60px; color: #111; line-height: 1.65; font-size: 15px; }
  h1 { font-size: 1.6em; border-bottom: 2px solid #800000; padding-bottom: 8px; margin-bottom: 6px; }
  h2 { font-size: 1.25em; margin-top: 2em; }
  h3 { font-size: 1.05em; margin-top: 1.5em; }
  code { font-family: 'Courier New', monospace; font-size: 0.88em; background: #f4f4f2; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f4f4f2; padding: 14px 16px; border-radius: 4px; overflow-x: auto; border-left: 3px solid #800000; }
  pre code { background: none; padding: 0; font-size: 0.85em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 6px 12px; text-align: left; }
  th { background: #f0efeb; font-weight: bold; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 16px; color: #555; }
  a { color: #800000; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
  .back { font-size: 13px; color: #555; margin-bottom: 24px; display: block; font-style: italic; }
</style>
</head>
<body>
<a class="back" href="javascript:history.back()">← Back</a>
${body}
</body>
</html>`);
});

const CHECK_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CSSE 230 Debugging Feedback</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #f1f5f9;
           color: #1e293b; min-height: 100vh; display: flex; flex-direction: column; }
    header { background: #800000; color: #fff; padding: 14px 28px;
             box-shadow: 0 2px 8px rgba(0,0,0,.22); }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; }
    main { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 64px 20px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
            padding: 36px 40px; max-width: 420px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,.06); text-align: center; }
    h2 { margin: 0 0 12px; font-size: 20px; font-weight: 700; }
    p  { margin: 0; font-size: 14px; color: #64748b; line-height: 1.6; }
    .error { margin-top: 14px; padding: 10px 14px; background: #fef2f2; color: #b91c1c;
             border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; display: none; }
    footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <header><h1>CSSE 230 · Debugging Feedback</h1></header>
  <main>
    <div class="card">
      <h2>Check your email</h2>
      <p>Access your personalized feedback using the link sent to your Rose-Hulman email address after the assignment deadline.</p>
      <div class="error" id="err"></div>
    </div>
  </main>
  <footer>CSSE 230 Data Structures &nbsp;·&nbsp; Rose-Hulman Institute of Technology</footer>
  <script>
    const e = new URLSearchParams(location.search).get('error');
    if (e === 'invalid') {
      const el = document.getElementById('err');
      el.textContent = 'That link has expired or is invalid. Use the link from your feedback email.';
      el.style.display = 'block';
    }
  </script>
</body>
</html>`;

// Root and login → simple "check your email" page (login via RoseFire disabled for now)
app.get('/', (_req, res) => res.type('html').send(CHECK_EMAIL_HTML));
app.get('/login', (_req, res) => res.type('html').send(CHECK_EMAIL_HTML));

// Demo — no auth, serves the React app which loads /data/frontend.json
app.get('/demo', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

// Token-based assignment feedback
app.get('/feedback', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/login');
  // Demo token → canonical demo route
  if (DEMO_TOKEN && token === DEMO_TOKEN) return res.redirect('/demo');
  if (!verifyToken(token)) return res.redirect('/login?error=invalid');
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// ─── API: RoseFire authentication ────────────────────────────────────────────

app.post('/api/auth/rosefire', (req, res) => {
  if (!isLookupAllowed(req.ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  }

  const { token: rfToken } = req.body || {};
  if (!rfToken) return res.status(400).json({ error: 'RoseFire token required.' });
  if (!ROSEFIRE_SECRET) return res.status(503).json({ error: 'RoseFire not configured on this server.' });

  let decoded;
  try {
    decoded = jwt.verify(rfToken, ROSEFIRE_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Login session expired. Please try again.' });
    }
    return res.status(401).json({ error: 'Invalid login token.' });
  }

  // RoseFire v3 non-Firebase JWT: claims are under decoded.d
  const email = decoded?.d?.email || decoded?.claims?.email;
  if (!email) return res.status(400).json({ error: 'Could not read email from login token.' });

  // Return most recently created token (latest assignment) for this student
  const record = db.prepare(
    'SELECT token FROM tokens WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1'
  ).get(email.toLowerCase());

  if (!record) {
    return res.status(404).json({
      error: "We don't have feedback for your account yet. Check back after the assignment deadline.",
    });
  }

  res.json({ redirectUrl: `${BASE_URL}/feedback?token=${record.token}` });
});

// ─── API: fetch feedback data ─────────────────────────────────────────────────

app.get('/api/data', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });

  // Demo token — serve the static demo JSON directly
  if (DEMO_TOKEN && token === DEMO_TOKEN) {
    if (fs.existsSync(DEMO_JSON)) return res.sendFile(DEMO_JSON);
    return res.status(404).json({ error: 'no_data', message: 'Demo JSON not found at public/data/frontend.json' });
  }

  const record = verifyToken(token);
  if (!record) return res.status(404).json({ error: 'invalid token' });

  const { student_id, assignment } = record;

  const running = db.prepare(
    "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='processing' ORDER BY id DESC LIMIT 1"
  ).get(student_id, assignment);
  if (running) {
    logNullFeedback(token, 'null_feedback_processing');
    return res.json({ error: 'processing', message: 'Your feedback is being generated. Check back in a few minutes.' });
  }

  const jsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
  if (!fs.existsSync(jsonPath)) {
    logNullFeedback(token, 'null_feedback_no_data');
    const errored = db.prepare(
      "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='error' ORDER BY id DESC LIMIT 1"
    ).get(student_id, assignment);
    if (errored) {
      return res.json({
        error: 'processing_error',
        message: 'Something went wrong generating your feedback. You can try uploading your run.tar again, or contact the research team.',
        allowUpload: true,
      });
    }
    return res.json({
      error: 'no_data',
      message: "We didn't find test run data in your submission. You can upload your run.tar file below to generate feedback.",
      allowUpload: true,
    });
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const isReviewed = !!db.prepare(
      "SELECT id FROM events WHERE token=? AND event_type='feedback_reviewed' LIMIT 1"
    ).get(token);
    data.reviewed = isReviewed;
    const openedRows = db.prepare(
      "SELECT event_data FROM events WHERE token=? AND event_type='feedback_opened'"
    ).all(token);
    data.openedTestIds = [...new Set(
      openedRows
        .map(r => { try { return JSON.parse(r.event_data)?.test_id; } catch { return null; } })
        .filter(Boolean)
    )];
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to read feedback data.' });
  }
});

// ─── API: assessment config (for urgency display in feedback app) ─────────────

app.get('/api/assessment-config', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  const record = verifyToken(token);
  if (!record) return res.status(403).json({ error: 'invalid token' });
  const cfgPath = path.join(ASSIGNMENTS_DIR, `${record.assignment}_assessment_config.json`);
  if (!fs.existsSync(cfgPath)) return res.json({});
  try {
    res.json(JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
  } catch {
    res.json({});
  }
});

// ─── API: all assignments for a student (identified by any of their tokens) ──

app.get('/api/my-assignments', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  if (DEMO_TOKEN && token === DEMO_TOKEN) return res.json({ assignments: [] });

  const record = verifyToken(token);
  if (!record) return res.status(401).json({ error: 'invalid token' });

  const tokenRows = db.prepare(
    'SELECT token, student_id, assignment FROM tokens WHERE student_id = ? ORDER BY created_at DESC'
  ).all(record.student_id);

  const assignments = tokenRows.map(row => {
    const jsonPath = path.join(DATA_DIR, row.assignment, 'output', row.student_id, 'frontend.json');
    let summary = { passing: 0, failing: 0, improved: 0, total: 0 };
    let title = row.assignment;
    let submittedAt = null;
    let dataReady = false;

    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const histories = data.testHistories || [];
        summary.total    = histories.length;
        summary.failing  = histories.filter(h => h.isLingeringFailure).length;
        summary.improved = histories.filter(h => !h.isLingeringFailure && h.failureIntervals?.length > 0).length;
        summary.passing  = histories.filter(h => !h.isLingeringFailure && (!h.failureIntervals || h.failureIntervals.length === 0)).length;
        title      = data.context?.assignmentName || row.assignment;
        submittedAt = data.context?.submittedAt   || null;
        dataReady  = true;
      } catch { /* use defaults */ }
    }

    const isReviewed = dataReady && !!db.prepare(
      "SELECT id FROM events WHERE token=? AND event_type='feedback_reviewed' LIMIT 1"
    ).get(row.token);

    return {
      token:      row.token,
      assignment: row.assignment,
      title,
      submittedAt,
      status:  !dataReady ? 'pending' : isReviewed ? 'reviewed' : 'new',
      ...summary,
    };
  });

  res.json({ assignments: assignments.filter(a => a.status !== 'pending') });
});

function logNullFeedback(token, eventType) {
  try { db.prepare('INSERT INTO events (token, event_type) VALUES (?, ?)').run(token, eventType); } catch { /* non-critical */ }
}

// ─── API: interaction events ──────────────────────────────────────────────────

app.post('/api/events', (req, res) => {
  const { token, events } = req.body || {};
  if (!token || !Array.isArray(events)) {
    return res.status(400).json({ error: 'token and events array required' });
  }
  // Silently accept demo token events (don't try to insert into DB)
  if (DEMO_TOKEN && token === DEMO_TOKEN) return res.json({ ok: true });
  if (!verifyToken(token)) return res.status(401).json({ error: 'invalid token' });
  try {
    logEvents(token, events);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to log events' });
  }
});

// ─── API: tar upload + regeneration ──────────────────────────────────────────

app.post('/api/upload', upload.single('file'), (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  if (DEMO_TOKEN && token === DEMO_TOKEN) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Upload not available in demo mode.' });
  }
  const record = verifyToken(token);
  if (!record) return res.status(401).json({ error: 'invalid token' });
  if (!isUploadAllowed(token)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(429).json({ error: 'Upload limit reached (max 3 resubmissions per assignment).' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!req.file.originalname.endsWith('.tar')) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'File must be a .tar file.' });
  }

  const { student_id, assignment } = record;
  const tarDir   = path.join(DATA_DIR, assignment, 'tars', student_id);
  const tarPath  = path.join(tarDir, 'run.tar');
  const outputDir = path.join(DATA_DIR, assignment, 'output', student_id);
  fs.mkdirSync(tarDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.renameSync(req.file.path, tarPath);

  const runId = db.prepare(
    "INSERT INTO pipeline_runs (assignment, student_id, status, source, started_at) VALUES (?,?,'processing','upload',datetime('now'))"
  ).run(assignment, student_id).lastInsertRowid;

  res.json({
    status: 'processing',
    message: "Your feedback is being generated. You'll receive an email when it's ready, or check back in a few minutes.",
  });

  runPipeline(tarDir, outputDir, assignment, student_id, runId)
    .then(async () => {
      // Regenerate PDF report with the real token URL so the link in the PDF is correct
      try {
        await generateReportForToken(student_id, assignment, token, DATA_DIR, BASE_URL);
      } catch (err) {
        console.error(`[report] PDF generation failed for ${student_id}: ${err.message}`);
      }
      queueEmail(token, record.email, assignment,
        process.env.ASSIGNMENT_DISPLAY_NAME || assignment, 'regeneration_ready');
    })
    .catch(() => {
      queueEmail(token, record.email, assignment,
        process.env.ASSIGNMENT_DISPLAY_NAME || assignment, 'generation_failed');
    });
});

// ─── API: health ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const students = db.prepare('SELECT COUNT(*) as n FROM tokens').get().n;
  const relay = db.prepare('SELECT last_heartbeat FROM relay_status WHERE id=1').get();
  res.json({ status: 'ok', students, relayLastHeartbeat: relay?.last_heartbeat || null,
    demo: DEMO_TOKEN ? true : false });
});

// ─── Report PDF endpoint ──────────────────────────────────────────────────────

app.get('/report', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/login');
  if (DEMO_TOKEN && token === DEMO_TOKEN) return res.status(404).send('No report for demo.');

  const record = verifyToken(token);
  if (!record) return res.redirect('/login?error=invalid');

  const { student_id, assignment } = record;
  const frontendJsonExists = fs.existsSync(path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json'));
  logEvents(token, [{ type: 'report_viewed', data: { student_id, assignment, generic: !frontendJsonExists } }]);
  const reportPdfPath = path.join(DATA_DIR, assignment, 'output', student_id, 'report.pdf');

  // Generate/regenerate if missing (e.g. first visit after pipeline ran)
  if (!fs.existsSync(reportPdfPath)) {
    const frontendJsonPath = path.join(DATA_DIR, assignment, 'output', student_id, 'frontend.json');
    if (!fs.existsSync(frontendJsonPath)) {
      const isProcessing = !!db.prepare(
        "SELECT id FROM pipeline_runs WHERE student_id=? AND assignment=? AND status='processing' ORDER BY id DESC LIMIT 1"
      ).get(student_id, assignment);
      const message = isProcessing
        ? 'Your feedback report is being generated. This usually takes 5–10 minutes.'
        : 'Your feedback report has not been generated yet. Upload your run.tar on the feedback site to get started.';
      return res.status(202).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Report Not Ready</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Palatino Linotype', Palatino, serif; background: #fafafa;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 3px;
            padding: 40px 52px; max-width: 460px; width: 100%; }
    h1 { font-size: 17px; color: #222; margin-bottom: 14px; }
    p  { font-size: 13px; line-height: 1.65; color: #555; margin-bottom: 10px; }
    a  { color: #800000; font-size: 13px; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Report Not Ready Yet</h1>
    <p>${message}</p>
    ${isProcessing ? '<p>You\'ll receive an email with a direct link once it\'s ready.</p>' : ''}
    <a href="/feedback?token=${encodeURIComponent(token)}">Return to feedback site</a>
  </div>
</body>
</html>`);
    }
    try {
      await generateReportForToken(student_id, assignment, token, DATA_DIR, BASE_URL);
    } catch (err) {
      console.error(`[report] PDF generation failed for ${student_id}: ${err.message}`);
      return res.status(500).send('Report generation failed. Try again in a moment.');
    }
  }

  res.setHeader('Content-Disposition', `inline; filename="${assignment}-feedback-report.pdf"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(reportPdfPath).pipe(res);
});

// ─── Email relay endpoints ────────────────────────────────────────────────────

// Register: Zenbook calls this on startup so the server knows where to push.
// Immediately attempts to drain any pending emails.
app.post('/api/relay/register', requireRelayAuth, async (req, res) => {
  const { port } = req.body || {};
  if (!port) return res.status(400).json({ error: 'port required' });
  const ip = req.ip.replace(/^::ffff:/, ''); // normalise IPv6-mapped IPv4
  db.prepare("UPDATE relay_status SET relay_ip=?,relay_port=?,last_heartbeat=datetime('now') WHERE id=1")
    .run(ip, port);
  console.log(`[relay] registered at ${ip}:${port}`);
  res.json({ ok: true });
  // Drain any emails that queued while relay was offline — fire and forget
  if (!HOLD_EMAILS) setImmediate(pushAllPending);
});

app.get('/api/emails/stats', requireRelayAuth, (_req, res) => {
  const stats = { pending: 0, sending: 0, sent: 0, failed: 0, dead: 0 };
  for (const row of db.prepare("SELECT status, COUNT(*) as count FROM email_queue GROUP BY status").all()) {
    if (row.status in stats) stats[row.status] = row.count;
  }
  res.json(stats);
});

// Manual-fallback endpoints — used by manual-send.ps1 when the Zenbook is unavailable.
// Normal delivery path goes through pushEmail(); these are not called by the relay server.
app.get('/api/emails/pending', requireRelayAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 50);
  res.json(db.prepare("SELECT * FROM email_queue WHERE status='pending' ORDER BY created_at LIMIT ?").all(limit));
});

app.post('/api/emails/:id/sending', requireRelayAuth, (req, res) => {
  const r = db.prepare("UPDATE email_queue SET status='sending',last_attempt=datetime('now') WHERE id=? AND status='pending'").run(req.params.id);
  if (r.changes === 0) return res.status(409).json({ error: 'Not found or not pending' });
  res.json({ ok: true });
});

app.post('/api/emails/:id/sent', requireRelayAuth, (req, res) => {
  const r = db.prepare("UPDATE email_queue SET status='sent',sent_at=datetime('now') WHERE id=? AND status='sending'").run(req.params.id);
  if (r.changes === 0) return res.status(409).json({ error: 'Not found or not sending' });
  res.json({ ok: true });
});

app.post('/api/emails/:id/failed', requireRelayAuth, (req, res) => {
  const { error_msg } = req.body || {};
  const email = db.prepare('SELECT * FROM email_queue WHERE id=?').get(req.params.id);
  if (!email) return res.status(404).json({ error: 'Email not found' });
  const attempts = email.attempts + 1;
  const status = attempts >= 3 ? 'dead' : 'failed';
  db.prepare('UPDATE email_queue SET status=?,attempts=?,error_msg=? WHERE id=?').run(status, attempts, error_msg || null, req.params.id);
  res.json({ ok: true, status, attempts });
});

// ─── Email push logic ─────────────────────────────────────────────────────────

async function pushEmail(email) {
  // Atomically claim the email — prevents double-send if pushAllPending is called concurrently
  const claimed = db.prepare(
    "UPDATE email_queue SET status='sending',last_attempt=datetime('now') WHERE id=? AND status='pending'"
  ).run(email.id);
  if (claimed.changes === 0) return; // already claimed by another call

  const relay = db.prepare('SELECT relay_ip, relay_port FROM relay_status WHERE id=1').get();
  if (!relay?.relay_ip || !relay?.relay_port) {
    db.prepare("UPDATE email_queue SET status='pending' WHERE id=?").run(email.id);
    return; // relay not registered yet — leave pending for next retry cycle
  }

  const actualRecipient = EMAIL_DEV_REDIRECT ?? email.recipient;
  const actualSubject   = EMAIL_DEV_REDIRECT
    ? `[DEV to ${email.recipient}] ${email.subject}`
    : email.subject;

  try {
    const res = await fetch(`http://${relay.relay_ip}:${relay.relay_port}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RELAY_SECRET}` },
      body: JSON.stringify({ recipient: actualRecipient, subject: actualSubject, body: email.body }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      db.prepare("UPDATE email_queue SET status='sent',sent_at=datetime('now') WHERE id=?").run(email.id);
      if (EMAIL_DEV_REDIRECT) {
        console.log(`[email] DEV redirect → ${actualRecipient} (real: ${email.recipient}, ${email.email_type})`);
      } else {
        console.log(`[email] sent → ${email.recipient} (${email.email_type})`);
      }
    } else {
      recordEmailFailure(email.id, `Relay returned HTTP ${res.status}`);
    }
  } catch (err) {
    recordEmailFailure(email.id, err.message);
  }
}

function recordEmailFailure(id, errorMsg) {
  const row = db.prepare('SELECT attempts FROM email_queue WHERE id=?').get(id);
  const attempts = (row?.attempts || 0) + 1;
  const status = attempts >= 3 ? 'dead' : 'failed';
  db.prepare('UPDATE email_queue SET status=?,attempts=?,error_msg=? WHERE id=?')
    .run(status, attempts, errorMsg?.slice(0, 500) || null, id);
  console.warn(`[email] ${status} (attempt ${attempts}): ${errorMsg}`);
}

// After a successful send, restart the process after 60s of email inactivity.
// pm2 auto-restarts on exit(0), keeping the server fresh without manual intervention.
let restartTimer = null;
function scheduleRestartAfterSend() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    const stillPending = db.prepare("SELECT COUNT(*) as n FROM email_queue WHERE status='pending'").get().n;
    if (stillPending === 0) {
      console.log('[email] Quiet after send — restarting to keep fresh');
      process.exit(0);
    }
  }, 60_000);
}

async function pushAllPending() {
  const pending = db.prepare(
    "SELECT * FROM email_queue WHERE status='pending' ORDER BY created_at LIMIT 20"
  ).all();
  let sent = 0;
  for (const email of pending) {
    await pushEmail(email);
    const row = db.prepare('SELECT status FROM email_queue WHERE id=?').get(email.id);
    if (row?.status === 'sent') sent++;
  }
  if (sent > 0) scheduleRestartAfterSend();
}

// ─── Background: retry loop ───────────────────────────────────────────────────

setInterval(async () => {
  // Safety valve: unstick emails left in 'sending' for >5 min (e.g. server crash mid-push)
  db.prepare("UPDATE email_queue SET status='pending' WHERE status='sending' AND last_attempt < datetime('now','-5 minutes')").run();
  // Reset failed emails for retry after 5-min backoff
  db.prepare("UPDATE email_queue SET status='pending' WHERE status='failed' AND attempts < 3 AND last_attempt < datetime('now','-5 minutes')").run();
  // Push any pending (newly queued or retried) — skip if HOLD_EMAILS is set
  if (!HOLD_EMAILS) await pushAllPending();
  // Alert if relay hasn't registered recently
  const relay = db.prepare('SELECT last_heartbeat FROM relay_status WHERE id=1').get();
  if (relay?.last_heartbeat) {
    const staleMs = Date.now() - new Date(relay.last_heartbeat + 'Z').getTime();
    if (staleMs > 5 * 60_000) console.warn(`[ALERT] Relay offline for ${Math.round(staleMs / 60_000)} min`);
  }
}, 60_000);

// ─── Pipeline helper ──────────────────────────────────────────────────────────

function runPipeline(tarDir, outputDir, assignment, studentId, runId) {
  const displayName = process.env.ASSIGNMENT_DISPLAY_NAME || assignment;
  return new Promise((resolve, reject) => {
    execFile('java', ['-jar', PIPELINE_JAR, 'ingest', '-i', tarDir, '-o', outputDir],
      { timeout: 120_000, cwd: REPO_ROOT }, (err, _o, stderr) => {
        if (err) {
          const msg = (stderr || err.message).slice(0, 500);
          db.prepare("UPDATE pipeline_runs SET status='error',error_msg=?,finished_at=datetime('now') WHERE id=?").run(msg, runId);
          console.error(`[pipeline] ingest failed for ${studentId}: ${msg}`);
          return reject(err);
        }
        const assignmentConfigPath = path.join(ASSIGNMENTS_DIR, `${assignment}.json`);
        const prepareArgs = ['-jar', PIPELINE_JAR, 'prepare',
          '-i', outputDir, '-o', path.join(outputDir, 'frontend.json'),
          '--assignment-name', displayName, '--student-id', studentId,
          '--cache-dir', LLM_CACHE_DIR, '--allow-basic-fallback'];
        if (fs.existsSync(assignmentConfigPath)) {
          prepareArgs.push('--assignment-config', assignmentConfigPath);
        }
        execFile('java', prepareArgs,
          { timeout: 300_000, cwd: REPO_ROOT }, (err2, _o2, stderr2) => {
            if (err2) {
              const msg = (stderr2 || err2.message).slice(0, 500);
              db.prepare("UPDATE pipeline_runs SET status='error',error_msg=?,finished_at=datetime('now') WHERE id=?").run(msg, runId);
              console.error(`[pipeline] prepare failed for ${studentId}: ${msg}`);
              return reject(err2);
            }
            db.prepare("UPDATE pipeline_runs SET status='success',finished_at=datetime('now') WHERE id=?").run(runId);
            console.log(`[pipeline] success for ${studentId} (${assignment})`);
            resolve();
          });
      });
  });
}

// ─── Email queue helper ───────────────────────────────────────────────────────

const EMAIL_FONT   = 'font-family: Arial, Helvetica, sans-serif;';
const EMAIL_HR     = '<hr style="border:none;border-top:1px solid #ddd;margin:14px 0;">';
const EMAIL_FOOTER = `${EMAIL_HR}<p style="${EMAIL_FONT} font-size:12px; color:#888; margin:0;">This email was sent automatically — replies are not monitored.<br>For questions, contact gajavegs@rose-hulman.edu.</p>`;
function wrapEmail(crumb, inner) {
  return `<div style="${EMAIL_FONT} font-size:14px; color:#333; max-width:600px; line-height:1.5;"><p style="font-size:12px; color:#999; margin:0 0 4px;">${crumb}</p>${EMAIL_HR}${inner}${EMAIL_FOOTER}</div>`;
}

// Reads Pipeline/assignments/{assignment}_assessment_config.json if present, returns parsed JSON or null.
function loadAssessmentConfig(assignment) {
  const cfgPath = path.join(ASSIGNMENTS_DIR, `${assignment}_assessment_config.json`);
  if (!fs.existsSync(cfgPath)) return null;
  try { return JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { return null; }
}

// Called only from the upload regeneration flow — regeneration_ready template.
// feedback_ready, missing_tar, and nudge are queued by the batch scripts.
export function queueEmail(token, recipient, assignment, displayName, emailType) {
  const feedbackLink = `${BASE_URL}/feedback?token=${token}`;
  const reportLink   = `${BASE_URL}/report?token=${token}`;
  const cfg = loadAssessmentConfig(assignment);
  const fullName = cfg?.full_name || displayName;
  const shortName = cfg?.short_name || displayName;

  let subject, body;
  const crumb = `2526S CSSE230 &rsaquo; Debugging Feedback &rsaquo; ${fullName}`;
  if (emailType === 'regeneration_ready') {
    subject = `CSSE 230: Updated ${shortName} Feedback Available`;
    body = wrapEmail(crumb, `
      <p>Your debugging feedback for <strong>${fullName}</strong> has been regenerated with your latest data.</p>
      <p><strong>View your updated feedback summary (PDF):</strong><br><a href="${reportLink}">${reportLink}</a></p>
      <p><strong>Or open the interactive feedback site:</strong><br><a href="${feedbackLink}">${feedbackLink}</a></p>
      <p style="font-size:12px; color:#888;">If links appear blank, connect to eduroam or the Rose-Hulman VPN.</p>`);
  } else if (emailType === 'generation_failed') {
    subject = `CSSE 230: ${shortName} Feedback Generation Failed`;
    body = wrapEmail(crumb, `
      <p>We were unable to generate your debugging feedback for <strong>${fullName}</strong>.</p>
      <p>You can try uploading your run.tar file again at the feedback site:<br><a href="${feedbackLink}">${feedbackLink}</a></p>
      <p>If the problem persists, contact gajavegs@rose-hulman.edu.</p>`);
  } else {
    console.error(`[email] queueEmail called for unexpected type: ${emailType} — use batch scripts for ${emailType}`);
    return;
  }

  db.prepare('INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)')
    .run(token, recipient, subject, body, emailType, assignment);
  // Attempt immediate push; background job retries on failure
  setImmediate(pushAllPending);
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[feedback-service] http://localhost:${PORT}`);
  if (DEMO_TOKEN) console.log(`  Demo URL : http://localhost:${PORT}/feedback?token=${DEMO_TOKEN}`);
  console.log(`  Health   : http://localhost:${PORT}/api/health`);
  console.log(`  Dist dir : ${DIST_DIR}`);
});
