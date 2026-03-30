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
const DEMO_JSON   = path.join(__dirname, 'public', 'data', 'frontend.json');
// RoseFire — ROSEFIRE_SECRET is the secretOrPrivateKey you provided when registering your app.
// ROSEFIRE_REGISTRY_TOKEN is the UUID returned by registration (safe to embed in client HTML).
const ROSEFIRE_SECRET           = process.env.ROSEFIRE_SECRET;
const ROSEFIRE_REGISTRY_TOKEN   = process.env.ROSEFIRE_REGISTRY_TOKEN || '';

const app = express();
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────

const lookupRateMap = new Map(); // ip → [timestamps]
const uploadRateMap = new Map(); // token → last upload ms

function isLookupAllowed(ip) {
  const now = Date.now();
  const prev = (lookupRateMap.get(ip) || []).filter(t => now - t < 60_000);
  prev.push(now);
  lookupRateMap.set(ip, prev);
  return prev.length <= 5;
}

function isUploadAllowed(token) {
  const now = Date.now();
  const last = uploadRateMap.get(token);
  if (last && now - last < 3_600_000) return false;
  uploadRateMap.set(token, now);
  return true;
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

// Root → login
app.get('/', (_req, res) => res.redirect('/login'));

// Login page — inject the RoseFire registry token so the client can open the popup
app.get('/login', (_req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'landing.html'), 'utf8')
    .replace('__ROSEFIRE_REGISTRY_TOKEN__', ROSEFIRE_REGISTRY_TOKEN);
  res.type('html').send(html);
});

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
    res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  } catch {
    res.status(500).json({ error: 'Failed to read feedback data.' });
  }
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
    return res.status(429).json({ error: 'Upload limit: one upload per hour.' });
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
    .then(() => {
      queueEmail(token, record.email, assignment,
        process.env.ASSIGNMENT_DISPLAY_NAME || assignment, 'regeneration_ready');
    })
    .catch(() => {});
});

// ─── API: health ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const students = db.prepare('SELECT COUNT(*) as n FROM tokens').get().n;
  const relay = db.prepare('SELECT last_heartbeat FROM relay_status WHERE id=1').get();
  res.json({ status: 'ok', students, relayLastHeartbeat: relay?.last_heartbeat || null,
    demo: DEMO_TOKEN ? true : false });
});

// ─── Email relay endpoints ────────────────────────────────────────────────────

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

app.get('/api/emails/stats', requireRelayAuth, (_req, res) => {
  const stats = { pending: 0, sending: 0, sent: 0, failed: 0, dead: 0 };
  for (const row of db.prepare("SELECT status, COUNT(*) as count FROM email_queue GROUP BY status").all()) {
    if (row.status in stats) stats[row.status] = row.count;
  }
  res.json(stats);
});

app.get('/api/relay/heartbeat', requireRelayAuth, (req, res) => {
  db.prepare("UPDATE relay_status SET last_heartbeat=datetime('now'),relay_ip=? WHERE id=1").run(req.ip);
  res.json({ ok: true });
});

// ─── Background: stuck email recovery + heartbeat alert ──────────────────────

setInterval(() => {
  db.prepare("UPDATE email_queue SET status='pending' WHERE status='sending' AND last_attempt < datetime('now','-5 minutes')").run();
  const relay = db.prepare('SELECT last_heartbeat FROM relay_status WHERE id=1').get();
  if (relay?.last_heartbeat) {
    const staleMs = Date.now() - new Date(relay.last_heartbeat + 'Z').getTime();
    if (staleMs > 5 * 60_000) console.warn(`[ALERT] Relay heartbeat missing for ${Math.round(staleMs / 60_000)} min`);
  }
}, 5 * 60_000);

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

const EMAIL_TEMPLATES = {
  feedback_ready: (dn, link) => ({
    subject: `Your ${dn} debugging feedback is ready`,
    body: `Hi,\n\nYour debugging feedback for the ${dn} assignment is ready to view:\n\n${link}\n\nThis link is private to you — please don't share it.\n\nIf you have questions, contact gajavegs@rose-hulman.edu.`,
  }),
  regeneration_ready: (dn, link) => ({
    subject: `Your updated ${dn} feedback is ready`,
    body: `Hi,\n\nYour regenerated debugging feedback for ${dn} is ready:\n\n${link}\n\nSame link as before — just refreshed with your latest data.`,
  }),
  missing_tar: (dn, link) => ({
    subject: `Your ${dn} debugging feedback — action needed`,
    body: `Hi,\n\nWe tried to generate your debugging feedback for ${dn}, but couldn't find a run.tar file in your submission.\n\nIf you have your run.tar file locally, you can upload it directly at:\n\n${link}\n\nIf you're not sure where to find it, it's in your assignment project directory under the testSupport folder.`,
  }),
  nudge: (dn, link) => ({
    subject: `Reminder — your ${dn} debugging feedback is available`,
    body: `Hi,\n\nJust a reminder that your ${dn} debugging feedback is available:\n\n${link}\n\nIt takes about 5 minutes to review and may help with upcoming assignments.`,
  }),
};

export function queueEmail(token, recipient, assignment, displayName, emailType) {
  const link = `${BASE_URL}/feedback?token=${token}`;
  const tmpl = EMAIL_TEMPLATES[emailType];
  if (!tmpl) { console.error(`[email] Unknown type: ${emailType}`); return; }
  const { subject, body } = tmpl(displayName, link);
  db.prepare('INSERT INTO email_queue (token,recipient,subject,body,email_type,assignment) VALUES (?,?,?,?,?,?)')
    .run(token, recipient, subject, body, emailType, assignment);
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[feedback-service] http://localhost:${PORT}`);
  if (DEMO_TOKEN) console.log(`  Demo URL : http://localhost:${PORT}/feedback?token=${DEMO_TOKEN}`);
  console.log(`  Health   : http://localhost:${PORT}/api/health`);
  console.log(`  Dist dir : ${DIST_DIR}`);
});
