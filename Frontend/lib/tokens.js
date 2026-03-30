import { createHmac } from 'crypto';
import db from './db.js';

/**
 * Generate a deterministic HMAC-SHA256 token for a student+assignment pair.
 * Including the assignment makes each link assignment-specific, so students
 * can bookmark individual assignment feedback pages.
 */
export function generateToken(studentId, assignment, secret) {
  return createHmac('sha256', secret)
    .update(`${studentId}:${assignment}`)
    .digest('hex')
    .slice(0, 16);
}

/** DB lookup — returns full token record or null. */
export function verifyToken(token) {
  return db.prepare('SELECT * FROM tokens WHERE token = ?').get(token) || null;
}
