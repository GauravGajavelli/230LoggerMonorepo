// MUST be first import — sets process.env before any module reads it
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'feedback.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token       TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL,
    email       TEXT NOT NULL,
    assignment  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, assignment)
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    event_data  TEXT,
    timestamp   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (token) REFERENCES tokens(token)
  );

  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment  TEXT NOT NULL,
    student_id  TEXT NOT NULL,
    status      TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'batch',
    error_msg   TEXT,
    started_at  TEXT,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS email_queue (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    token         TEXT NOT NULL,
    recipient     TEXT NOT NULL,
    subject       TEXT NOT NULL,
    body          TEXT NOT NULL,
    email_type    TEXT NOT NULL,
    assignment    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    attempts      INTEGER DEFAULT 0,
    last_attempt  TEXT,
    sent_at       TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    error_msg     TEXT,
    FOREIGN KEY (token) REFERENCES tokens(token)
  );

  CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status);

  CREATE TABLE IF NOT EXISTS relay_status (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_heartbeat  TEXT,
    relay_ip        TEXT
  );

  INSERT OR IGNORE INTO relay_status (id) VALUES (1);
`);

// relay_port added after initial schema — ALTER TABLE is idempotent (fails silently if exists)
try { db.exec('ALTER TABLE relay_status ADD COLUMN relay_port INTEGER'); } catch { /* already exists */ }

export default db;
