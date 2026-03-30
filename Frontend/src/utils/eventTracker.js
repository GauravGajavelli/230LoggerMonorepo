/**
 * eventTracker — lightweight client-side event buffer.
 *
 * Collects events in memory, flushes to POST /api/events every 30 s
 * and immediately on page unload (via navigator.sendBeacon).
 *
 * Usage:
 *   eventTracker.init('abc123token');
 *   eventTracker.track('page_view');
 *   eventTracker.track('expand_episode', { episode_id: 3 });
 */

let _token = null;
let _buffer = [];
let _timer = null;

const FLUSH_INTERVAL_MS = 30_000;
const ENDPOINT = '/api/events';

function init(token) {
  if (!token) return;
  _token = token;

  if (_timer) clearInterval(_timer);
  _timer = setInterval(flush, FLUSH_INTERVAL_MS);

  window.addEventListener('pagehide', flushBeacon);
}

function track(type, data = {}) {
  if (!_token) return;
  _buffer.push({ type, data });
}

async function flush() {
  if (!_token || _buffer.length === 0) return;
  const events = _buffer.splice(0, _buffer.length);
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: _token, events }),
      keepalive: true,
    });
  } catch {
    // Non-critical — push events back if fetch failed
    _buffer.unshift(...events);
  }
}

function flushBeacon() {
  if (!_token || _buffer.length === 0) return;
  const events = _buffer.splice(0, _buffer.length);
  const payload = JSON.stringify({ token: _token, events });
  navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
}

export const eventTracker = { init, track, flush };
