import { useState, useRef } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';
import { AssignmentList } from './AssignmentList';
import { DetailView } from './DetailView';
import { ReplayModal } from './ReplayModal';

/* ── Lock icon ── */
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#E2E8F0" strokeWidth="1.3" fill="none" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#E2E8F0" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const InfoIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6.5" stroke="#94A3B8" strokeWidth="1.2" />
    <path d="M8 7v4M8 5.2v.1" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/**
 * Root app — wireframe header, footer, navigation state.
 */
export function FeedbackApp() {
  const { loading, error, allRuns } = usePlaybackDataContext();

  const [view, setView] = useState('list');
  const [replayRange, setReplayRange] = useState(null); // { start, end } | null
  const [reviewed, setReviewed] = useState(false);

  const detailScrollRef = useRef(0);

  const handleReplayRun = (startRun, endRun = startRun) => {
    detailScrollRef.current = window.scrollY;
    setReplayRange({ start: startRun, end: endRun });
  };

  const handleCloseReplay = () => {
    setReplayRange(null);
    requestAnimationFrame(() => window.scrollTo(0, detailScrollRef.current));
  };

  const handleMarkReviewed = () => {
    setReviewed(true);
    setView('list');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '3px solid #800000',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ color: '#64748B', fontSize: 14 }}>Loading feedback…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && allRuns.length === 0) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', color: '#EF4444' }}>
          <p style={{ fontWeight: 600 }}>Error loading data</p>
          <p style={{ fontSize: 13, color: '#64748B' }}>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Top bar — matches wireframe exactly */}
      <header style={{
        background: '#1E293B', color: '#F8FAFC', padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.02em', cursor: 'pointer' }}
            onClick={() => setView('list')}
          >
            CSSE 230
          </span>
          <span style={{ color: '#64748B' }}>·</span>
          <span style={{ color: '#94A3B8' }}>Debugging Feedback</span>
        </div>
        <span style={{
          color: '#E2E8F0', fontSize: 13, fontWeight: 500,
          fontFamily: "'IBM Plex Mono', monospace",
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <LockIcon />
          Private to you
        </span>
      </header>

      {/* Main content */}
      {view === 'list' && (
        <AssignmentList onSelectAssignment={() => setView('detail')} reviewed={reviewed} />
      )}
      {view === 'detail' && (
        <DetailView
          onBack={() => setView('list')}
          onReplayRun={handleReplayRun}
          onMarkReviewed={handleMarkReviewed}
          reviewed={reviewed}
        />
      )}

      {/* Fixed footer — matches wireframe */}
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#F8FAFC', borderTop: '1px solid #E2E8F0',
        padding: '8px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6,
      }}>
        <InfoIcon />
        <span style={{ fontSize: 12, color: '#64748B' }}>
          Part of an IRB-approved research study.
        </span>
        <span style={{ fontSize: 12, color: '#2563EB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          Learn more
        </span>
      </footer>

      {/* Replay modal */}
      {replayRange !== null && (
        <ReplayModal
          startRun={replayRange.start}
          endRun={replayRange.end}
          onClose={handleCloseReplay}
        />
      )}
    </div>
  );
}
