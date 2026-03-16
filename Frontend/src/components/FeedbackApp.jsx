import { useState, useRef, useEffect } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';
import { AssignmentList } from './AssignmentList';
import { DetailView } from './DetailView';
import { ReplayModal } from './ReplayModal';

/* ── Lock icon ── */
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const InfoIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6.5" stroke="#94A3B8" strokeWidth="1.2" />
    <path d="M8 7v4M8 5.2v.1" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/* ── Skeleton assignment list — shown while frontend.json loads ── */
function SkeletonAssignmentList() {
  return (
    <div style={{
      maxWidth: 680, margin: '0 auto', padding: '32px 16px 100px',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Title block */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton-shimmer" style={{ height: 28, width: '52%', marginBottom: 10 }} />
        <div className="skeleton-shimmer" style={{ height: 14, width: '78%', marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ height: 12, width: '48%' }} />
      </div>
      {/* Section label */}
      <div className="skeleton-shimmer" style={{ height: 11, width: 92, marginBottom: 14 }} />
      {/* Two skeleton assignment cards */}
      {[1, 2].map((i) => (
        <div key={i} style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: 12, padding: '18px 20px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div className="skeleton-shimmer" style={{ height: 16, width: 150 }} />
                <div className="skeleton-shimmer" style={{ height: 20, width: 82, borderRadius: 10 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 12, width: 200 }} />
            </div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'center', paddingLeft: 16 }}>
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="skeleton-shimmer" style={{ width: 6, height: 18, borderRadius: 2 }} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Root app — wireframe header, footer, navigation state.
 */
export function FeedbackApp() {
  const { loading, error, allRuns, frontendData } = usePlaybackDataContext();

  // Keep the page title in sync with the assignment name once data loads
  useEffect(() => {
    const name = frontendData?.context?.assignmentName;
    if (name) {
      document.title = `${name} · CSSE 230`;
    }
  }, [frontendData]);

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

  /* ── Derive main content ── */
  let mainContent;
  if (loading) {
    mainContent = <SkeletonAssignmentList />;
  } else if (error && allRuns.length === 0) {
    mainContent = (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0',
      }}>
        <div style={{ textAlign: 'center', color: '#EF4444' }}>
          <p style={{ fontWeight: 600 }}>Error loading data</p>
          <p style={{ fontSize: 13, color: '#64748B' }}>{error.message}</p>
        </div>
      </div>
    );
  } else if (view === 'list') {
    mainContent = <AssignmentList onSelectAssignment={() => setView('detail')} reviewed={reviewed} />;
  } else {
    mainContent = (
      <DetailView
        onBack={() => setView('list')}
        onReplayRun={handleReplayRun}
        onMarkReviewed={handleMarkReviewed}
        reviewed={reviewed}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Top bar — Rose-Hulman branded header */}
      <header style={{
        background: '#800000', color: '#FFFFFF',
        padding: '12px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        borderBottom: '1px solid rgba(0,0,0,0.12)',
      }}>
        <div
          style={{ cursor: 'pointer', lineHeight: 1.2 }}
          onClick={() => setView('list')}
        >
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.58)',
            marginBottom: 5, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
          }}>
            Rose-Hulman Institute of Technology
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{
              fontSize: 19, fontWeight: 700, letterSpacing: '-.02em',
              fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
            }}>
              CSSE 230
            </span>
            <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 15, fontWeight: 300 }}>·</span>
            <span style={{
              fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.82)',
              fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
              letterSpacing: '.01em',
            }}>
              Debugging Feedback
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)',
          fontFamily: "'IBM Plex Mono', monospace",
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <LockIcon />
          Private to you
        </span>
      </header>

      {/* Main content */}
      {mainContent}

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
        <span style={{ fontSize: 12, color: '#800000', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
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
