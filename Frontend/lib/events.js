import db from './db.js';

const insertEvent = db.prepare(
  'INSERT INTO events (token, event_type, event_data) VALUES (?, ?, ?)'
);

/** Batch-insert interaction events for a token. */
export function logEvents(token, events) {
  db.transaction((evts) => {
    for (const evt of evts) {
      insertEvent.run(token, evt.type, evt.data != null ? JSON.stringify(evt.data) : null);
    }
  })(events);
}
