#!/usr/bin/env node
/**
 * relay-server.js — Outlook email relay for the Asus Zenbook (Windows)
 *
 * Drop-in replacement for relay-server.ps1. Keeps the same /send and /status
 * endpoint contract so the Ubuntu server needs no changes.
 *
 * For each email, spawns a short-lived PowerShell process that sends via
 * Outlook COM. Outlook must be open and signed in before this starts.
 *
 * Environment variables (same as relay-server.ps1):
 *   FEEDBACK_SERVER_URL   Ubuntu server base URL (no trailing slash)
 *   RELAY_SECRET          Shared secret — must match RELAY_SECRET in Ubuntu .env
 *   RELAY_PORT            Port to listen on (default 3001)
 *
 * Usage:
 *   node relay-server.js
 *   pm2 start relay-server.js --name relay
 */

import http from 'http';
import https from 'https';
import { spawn } from 'child_process';

const SERVER_URL   = process.env.FEEDBACK_SERVER_URL;
const RELAY_SECRET = process.env.RELAY_SECRET;
const PORT         = parseInt(process.env.RELAY_PORT || '3001', 10);

if (!SERVER_URL)   { console.error('FEEDBACK_SERVER_URL is not set'); process.exit(1); }
if (!RELAY_SECRET) { console.error('RELAY_SECRET is not set'); process.exit(1); }

// ── Send one email by spawning a PowerShell child process ─────────────────────
// Payload is written to the child's stdin as JSON so no shell-escaping is needed.
function sendViaOutlook({ recipient, subject, body }) {
  return new Promise((resolve, reject) => {
    // Inline PowerShell script — reads JSON from stdin, sends via Outlook COM.
    const ps = [
      '$raw = [Console]::In.ReadToEnd()',
      '$p   = $raw | ConvertFrom-Json',
      '$ol  = New-Object -ComObject Outlook.Application',
      '$m   = $ol.CreateItem(0)',
      '$m.To                = $p.recipient',
      '$m.Subject           = $p.subject',
      '$m.Body              = $p.body',
      '$m.DeleteAfterSubmit = $true',
      '$m.Send()',
    ].join('; ');

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `PowerShell exited ${code}`));
    });

    // Write email payload as JSON to PowerShell stdin
    child.stdin.write(JSON.stringify({ recipient, subject, body }));
    child.stdin.end();
  });
}

// ── Register this relay with the Ubuntu server ────────────────────────────────
async function register() {
  const url = new URL('/api/relay/register', SERVER_URL);
  const body = JSON.stringify({ port: PORT });
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RELAY_SECRET}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Auth check
  if (req.headers['authorization'] !== `Bearer ${RELAY_SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end('{"error":"Unauthorized"}');
  }

  // GET /status
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }

  // POST /send
  if (req.method === 'POST' && req.url === '/send') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(raw); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end('{"error":"Invalid JSON"}');
      }

      const { recipient, subject, body } = payload;
      if (!recipient || !subject || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end('{"error":"recipient, subject, and body are required"}');
      }

      try {
        await sendViaOutlook({ recipient, subject, body });
        console.log(`[relay] Sent to ${recipient}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (err) {
        console.error(`[relay] Outlook error for ${recipient}:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"Not found"}');
});

server.listen(PORT, () => {
  console.log(`[relay] Listening on port ${PORT}`);
  register()
    .then(status => console.log(`[relay] Registered with ${SERVER_URL} (HTTP ${status})`))
    .catch(err  => console.warn(`[relay] Registration failed: ${err.message} (will retry on restart)`));
});

process.on('SIGINT',  () => { console.log('[relay] Stopping.'); server.close(); process.exit(0); });
process.on('SIGTERM', () => { console.log('[relay] Stopping.'); server.close(); process.exit(0); });
