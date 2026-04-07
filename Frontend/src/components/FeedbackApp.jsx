import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';
import { AssignmentList } from './AssignmentList';
import { DetailView } from './DetailView';
import { ReplayModal } from './ReplayModal';
import { eventTracker } from '../utils/eventTracker';

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
 * Shown when the server returns a null-feedback response (no_data / processing / processing_error).
 */
function NullFeedbackScreen({ error: apiError, token }) {
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | success | error
  const [uploadMsg, setUploadMsg] = useState('');

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.tar')) {
      setUploadMsg('Please select a .tar file.');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setUploadMsg('Uploading…');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/upload?token=${token}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setUploadState('success');
        setUploadMsg(data.message || 'Upload complete. Check back in a few minutes.');
      } else {
        setUploadState('error');
        setUploadMsg(data.error || 'Upload failed. Please try again.');
      }
    } catch {
      setUploadState('error');
      setUploadMsg('Network error. Please check your connection and try again.');
    }
  }, [token]);

  const containerStyle = {
    maxWidth: 560, margin: '80px auto', padding: '0 20px',
    fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
  };
  const cardStyle = {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
    padding: '32px 36px', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ margin: '0 0 16px', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
          {apiError.message}
        </p>

        {apiError.allowUpload && token && uploadState !== 'success' && (
          <div style={{ marginTop: 24 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Upload your run.tar file
            </p>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: '#800000', color: '#fff',
              borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: uploadState === 'uploading' ? 0.6 : 1,
              pointerEvents: uploadState === 'uploading' ? 'none' : 'auto',
            }}>
              {uploadState === 'uploading' ? 'Uploading…' : 'Choose run.tar'}
              <input
                type="file"
                accept=".tar"
                style={{ display: 'none' }}
                onChange={handleUpload}
                disabled={uploadState === 'uploading'}
              />
            </label>
            {uploadMsg && (
              <p style={{
                marginTop: 12, fontSize: 13,
                color: uploadState === 'error' ? '#B91C1C' : '#475569',
              }}>
                {uploadMsg}
              </p>
            )}
          </div>
        )}

        {uploadState === 'success' && (
          <p style={{ marginTop: 16, fontSize: 14, color: '#166534', fontWeight: 500 }}>
            {uploadMsg}
          </p>
        )}

        {!apiError.allowUpload && (
          <p style={{ marginTop: 16, fontSize: 13, color: '#64748B' }}>
            Questions? Contact <a href="mailto:gajavegs@rose-hulman.edu" style={{ color: '#800000' }}>gajavegs@rose-hulman.edu</a>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Root app — wireframe header, footer, navigation state.
 */
export function FeedbackApp({ token }) {
  const { loading, error, apiError, allRuns, frontendData } = usePlaybackDataContext();

  // Fire once on mount — used to measure time-on-site and session starts
  useEffect(() => {
    eventTracker.track('page_view', {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the page title in sync with the assignment name once data loads
  useEffect(() => {
    const name = frontendData?.context?.assignmentName;
    if (name) {
      document.title = `${name} · CSSE 230`;
    }
  }, [frontendData]);

  const [view, setView] = useState(token ? 'detail' : 'list');
  const [replayRange, setReplayRange] = useState(null); // { start, end } | null
  const [reviewed, setReviewed] = useState(false);
  const [openedFeedbackIds, setOpenedFeedbackIds] = useState(new Set());
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  // Sync reviewed + openedTestIds from server (persisted across sessions)
  useEffect(() => {
    if (frontendData?.reviewed) setReviewed(true);
    const ids = frontendData?.openedTestIds;
    if (ids?.length) setOpenedFeedbackIds(prev => new Set([...prev, ...ids]));
  }, [frontendData]);

  const handleFeedbackOpened = useCallback((testId) => {
    setOpenedFeedbackIds(prev => new Set([...prev, testId]));
  }, []);

  // Fetch all assignments for this student (identified by the current token)
  useEffect(() => {
    if (!token) { setAssignmentsLoading(false); return; }
    fetch(`/api/my-assignments?token=${token}`)
      .then(r => r.json())
      .then(data => { if (data.assignments) setAssignments(data.assignments); })
      .catch(() => {})
      .finally(() => setAssignmentsLoading(false));
  }, [token]);

  const detailScrollRef = useRef(0);

  const handleReplayRun = (startRun, endRun = startRun) => {
    detailScrollRef.current = window.scrollY;
    setReplayRange({ start: startRun, end: endRun });
  };

  const handleCloseReplay = () => {
    setReplayRange(null);
    requestAnimationFrame(() => window.scrollTo(0, detailScrollRef.current));
  };

  const handleAllFeedbackSeen = useCallback(() => {
    setReviewed(true);
    // Mark the current assignment as reviewed in the local assignments list too
    setAssignments(prev => prev.map(a => a.token === token ? { ...a, status: 'reviewed' } : a));
    eventTracker.track('feedback_reviewed', {});
    eventTracker.flush(); // persist immediately so next visit shows correct state
  }, [token]);

  const handleSelectAssignment = useCallback((selectedToken) => {
    if (!selectedToken || selectedToken === token) {
      setView('detail');
    } else {
      // Different assignment — navigate to its URL (full page load with new token)
      window.location.href = `/feedback?token=${selectedToken}`;
    }
  }, [token]);

  /* ── Derive main content ── */
  let mainContent;
  if (view === 'list') {
    mainContent = assignmentsLoading
      ? <SkeletonAssignmentList />
      : <AssignmentList assignments={assignments} onSelectAssignment={handleSelectAssignment} />;
  } else {
    // Detail view — gated on the current token's data loading
    if (loading) {
      mainContent = <SkeletonAssignmentList />;
    } else if (apiError) {
      mainContent = <NullFeedbackScreen error={apiError} token={token} />;
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
    } else {
      mainContent = (
        <DetailView
          onBack={() => setView('list')}
          onReplayRun={handleReplayRun}
          onAllFeedbackSeen={handleAllFeedbackSeen}
          reviewed={reviewed}
          openedFeedbackIds={openedFeedbackIds}
          onFeedbackOpened={handleFeedbackOpened}
        />
      );
    }
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
