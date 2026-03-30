import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config(); // load .env so env vars are available in the plugin below
const DEMO_TOKEN             = process.env.DEMO_TOKEN || 'demo';
const ROSEFIRE_SECRET        = process.env.ROSEFIRE_SECRET;
const ROSEFIRE_REGISTRY_TOKEN = process.env.ROSEFIRE_REGISTRY_TOKEN || '';
const DEV_BYPASS_AUTH        = process.env.DEV_BYPASS_AUTH === 'true';
const DATA_DIR               = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

// Lazy-load the SQLite DB so it only opens once the dev server actually handles a request
let _db = null;
async function getDb() {
  if (!_db) _db = (await import('./lib/db.js')).default;
  return _db;
}

// Read the full body of an incoming Node.js request
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function jsonReply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Dev-only middleware plugin — handles routes that would normally go to Express,
 * so `npm run dev` works standalone without needing `npm start` running.
 *
 * /login                          → landing.html with ROSEFIRE_REGISTRY_TOKEN injected
 * /api/auth/rosefire  (POST)      → verify RoseFire JWT, look up student, return redirect
 * /api/data?token=<DEMO_TOKEN>    → serve public/data/frontend.json directly
 * everything else                 → falls through to Vite / the /api proxy
 */
function devPlugin() {
  return {
    name: 'dev-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');

        // /login → inject registry token into landing page
        if (url.pathname === '/login') {
          const html = fs.readFileSync(path.join(__dirname, 'public', 'landing.html'), 'utf8')
            .replace('__ROSEFIRE_REGISTRY_TOKEN__', ROSEFIRE_REGISTRY_TOKEN);
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
          return;
        }

        // POST /api/auth/rosefire → verify JWT, look up student
        if (url.pathname === '/api/auth/rosefire' && req.method === 'POST') {
          const { token: rfToken } = await readBody(req);
          if (!rfToken) { jsonReply(res, 400, { error: 'RoseFire token required.' }); return; }
          if (!ROSEFIRE_SECRET) { jsonReply(res, 503, { error: 'RoseFire not configured on this server.' }); return; }

          let decoded;
          try {
            decoded = jwt.verify(rfToken, ROSEFIRE_SECRET, { algorithms: ['HS256'] });
          } catch (err) {
            const msg = err.name === 'TokenExpiredError'
              ? 'Login session expired. Please try again.'
              : 'Invalid login token.';
            jsonReply(res, 401, { error: msg });
            return;
          }

          const email = decoded?.d?.email || decoded?.claims?.email;
          if (!email) { jsonReply(res, 400, { error: 'Could not read email from login token.' }); return; }

          const db = await getDb();
          const record = db.prepare(
            'SELECT token FROM tokens WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1'
          ).get(email.toLowerCase());

          if (!record) {
            // Dev fallback: no token seeded for this email yet — show "no data" screen
            jsonReply(res, 200, { redirectUrl: '/feedback?token=__no_data__' });
            return;
          }

          // Return a relative URL so it stays on the Vite dev server's port
          jsonReply(res, 200, { redirectUrl: `/feedback?token=${record.token}` });
          return;
        }

        // GET /api/data?token=__no_data__ → "no feedback yet" sentinel (dev RoseFire fallback)
        if (url.pathname === '/api/data' && url.searchParams.get('token') === '__no_data__') {
          jsonReply(res, 200, {
            error: 'no_data',
            message: 'No feedback has been generated for your account yet. Check back after the assignment deadline.',
          });
          return;
        }

        // GET /api/data?token=<DEMO_TOKEN> → serve demo JSON without Express
        if (url.pathname === '/api/data' && url.searchParams.get('token') === DEMO_TOKEN) {
          const demoPath = path.join(__dirname, 'public', 'data', 'frontend.json');
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(demoPath).pipe(res);
          return;
        }

        // POST /api/events → silently accept in dev (no Express needed)
        if (url.pathname === '/api/events' && req.method === 'POST') {
          jsonReply(res, 200, { ok: true });
          return;
        }

        // POST /api/upload → not supported without Express (pipeline requires Java)
        if (url.pathname === '/api/upload' && req.method === 'POST') {
          jsonReply(res, 503, { error: 'Upload is not available in dev mode. Run npm start to use Express.' });
          return;
        }

        // GET /__dev__ → roster page listing all students + their token links (dev only)
        if (url.pathname === '/__dev__') {
          const db = await getDb();
          const rows = db.prepare('SELECT student_id, email, assignment, token FROM tokens ORDER BY assignment, student_id').all();
          const byAssignment = {};
          for (const r of rows) {
            (byAssignment[r.assignment] ||= []).push(r);
          }
          const sections = Object.entries(byAssignment).map(([asgn, students]) => `
            <h2 style="margin:32px 0 12px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">${asgn}</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#f1f5f9;text-align:left">
                <th style="padding:8px 12px;border:1px solid #e2e8f0">Student ID</th>
                <th style="padding:8px 12px;border:1px solid #e2e8f0">Email</th>
                <th style="padding:8px 12px;border:1px solid #e2e8f0">Token</th>
              </tr></thead>
              <tbody>${students.map(s => `
                <tr>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace">${s.student_id}</td>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0">${s.email}</td>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0">
                    <a href="/feedback?token=${s.token}" style="color:#800000;font-family:monospace">${s.token}</a>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>`).join('');
          const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>Dev Roster</title>
            <style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#1e293b}
            h1{font-size:20px;font-weight:700;margin:0 0 4px}
            .subtitle{font-size:13px;color:#94a3b8;margin:0 0 24px}</style>
            </head><body>
            <h1>Dev Roster</h1>
            <p class="subtitle">Click a token to view that student's feedback. Only visible in dev mode.</p>
            ${rows.length === 0
              ? '<p style="color:#94a3b8">No tokens in DB yet. Run scripts/generate-tokens.js first.</p>'
              : sections}
            </body></html>`;
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
          return;
        }

        // GET /api/data?token=X with DEV_BYPASS_AUTH=true → serve file directly from disk
        // Lets you browse any student URL in dev without Express running.
        if (DEV_BYPASS_AUTH && url.pathname === '/api/data') {
          const token = url.searchParams.get('token');
          if (token) {
            const db = await getDb();
            const record = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token);
            if (!record) { jsonReply(res, 404, { error: 'invalid token' }); return; }
            const jsonPath = path.join(DATA_DIR, record.assignment, 'output', record.student_id, 'frontend.json');
            if (fs.existsSync(jsonPath)) {
              res.setHeader('Content-Type', 'application/json');
              fs.createReadStream(jsonPath).pipe(res);
            } else {
              jsonReply(res, 200, {
                error: 'no_data',
                message: "No frontend.json found for this student yet. Run process-batch.js first.",
              });
            }
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devPlugin()],
  server: {
    port: 5173,
    open: '/demo',
    // Proxy remaining /api calls to Express (only needed for live tokens, not demo/rosefire)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
