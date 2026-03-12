import { useEffect, useMemo } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';
import { CodeTimelineViewer } from './CodeTimelineViewer';
import { epColor } from '../utils/episodeColors';

/* ── Icons ── */
const FailIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" fill="#FECACA" stroke="#DC2626" strokeWidth="1.2" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const PassIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" fill="#D1FAE5" stroke="#059669" strokeWidth="1.2" />
    <path d="M5 8.2l2 2 4-4.4" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Small centered modal showing code snapshot + test results.
 * - Single run (startRun === endRun): diff vs the run immediately before startRun.
 * - Range (startRun < endRun): diff from snapshot at/before startRun to snapshot
 *   at/before endRun — i.e. what changed across that whole span.
 *
 * @param {{ startRun: number, endRun: number, onClose: () => void }} props
 */
export function ReplayModal({ startRun, endRun, onClose }) {
  const { allRuns, codeSnapshotsByRun, episodes, frontendData } = usePlaybackDataContext();

  const isRange = startRun !== endRun;

  /* ── Lock body scroll ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ── Escape to close ── */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /* ── Test results come from the end run ── */
  const runData = useMemo(
    () => allRuns.find(r => r.runNumber === endRun) || null,
    [allRuns, endRun]
  );

  const testResults = runData?.run?.results || [];

  /* ── Episode from end run ── */
  const ep = useMemo(
    () => episodes.find(e => e.id === runData?.episodeId) || null,
    [episodes, runData]
  );
  const epIndex = ep ? episodes.indexOf(ep) : -1;

  /* ── Semantic log entries for this modal's run range ── */
  const semanticEntries = useMemo(() => {
    if (!frontendData?.semanticLog?.entries) return [];
    return frontendData.semanticLog.entries.filter(
      e => e.run >= startRun && e.run <= endRun
    );
  }, [frontendData, startRun, endRun]);

  /* ── Nearest snapshot at or before run n ── */
  const snapshotAtOrBefore = (n) => {
    for (let i = n; i >= 1; i--) {
      if (codeSnapshotsByRun.has(i)) return codeSnapshotsByRun.get(i);
    }
    return null;
  };

  /* ── "Current" = state at end of range (right side of diff) ── */
  const currentSnapshot = useMemo(
    () => snapshotAtOrBefore(endRun),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeSnapshotsByRun, endRun]
  );

  /* ── "Previous" = state at start of range (left side of diff)
       Range  → snapshot at/before startRun
       Single → snapshot before startRun (immediate predecessor)        ── */
  const prevSnapshot = useMemo(() => {
    const lookFrom = startRun - 1;
    if (lookFrom < 0) return null;
    return snapshotAtOrBefore(lookFrom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeSnapshotsByRun, startRun]);

  /* ── Static playback object for CodeTimelineViewer ── */
  const staticPlayback = useMemo(() => {
    const toSub = (snap) => snap
      ? { id: `snap-${snap.runNumber}`, files: snap.files }
      : null;
    return {
      currentIndex: 0, totalCount: 1,
      isPlaying: false, isAtStart: true, isAtEnd: true,
      speed: 1, speedOptions: [1], progress: 0,
      currentSubmission:  toSub(currentSnapshot),
      previousSubmission: toSub(prevSnapshot),
      play: () => {}, pause: () => {}, toggle: () => {},
      stepForward: () => {}, stepBackward: () => {},
      jumpTo: () => {}, jumpToRunNumber: () => {},
      setSpeed: () => {}, cycleSpeed: () => {},
    };
  }, [currentSnapshot, prevSnapshot]);

  const hasCode = !!staticPlayback.currentSubmission;

  /* ── Sorted test results: changed first, then fail, then pass ── */
  const sortedResults = useMemo(() => {
    return [...testResults].sort((a, b) => {
      if (a.changedThisRun !== b.changedThisRun) return a.changedThisRun ? -1 : 1;
      const aFail = a.status !== 'pass' ? 0 : 1;
      const bFail = b.status !== 'pass' ? 0 : 1;
      return aFail - bFail;
    });
  }, [testResults]);

  const runLabel = isRange ? `Runs ${startRun} – ${endRun}` : `Run ${startRun}`;

  return (
    /* Backdrop — fades in */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15,23,42,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'modal-backdrop-in .15s ease-out',
      }}
    >
      {/* Panel — scales in */}
      <div style={{
        width: '100%', maxWidth: 1000,
        height: '85vh', maxHeight: 760,
        background: '#fff', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        overflow: 'hidden',
        animation: 'modal-scale-in .2s ease-out',
      }}>

        {/* Modal header */}
        <div style={{
          background: '#800000', color: '#fff',
          padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace" }}>
            {runLabel}
            {ep && epIndex >= 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontWeight: 400, color: 'rgba(255,255,255,.75)', marginLeft: 10,
              }}>
                ·
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: epColor(epIndex), display: 'inline-block', flexShrink: 0,
                }} />
                Ep. {epIndex + 1}
              </span>
            )}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,.4)',
              color: '#fff', padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body: code (left) + test results (right) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Code viewer + episode summary */}
          <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {hasCode ? (
                <CodeTimelineViewer playback={staticPlayback} errorHighlight={null} />
              ) : (
                <div style={{
                  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 8, color: '#94A3B8',
                }}>
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#CBD5E1" strokeWidth="1.5" />
                    <path d="M8 9l3 3-3 3M13 15h3" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 13 }}>No code snapshot available</span>
                  <span style={{ fontSize: 11 }}>Pipeline was run with --no-code</span>
                </div>
              )}
            </div>
            {ep && (ep.outcome || semanticEntries.length > 0) && (
              <div style={{
                borderTop: '1px solid #E2E8F0', padding: '16px 20px',
                flexShrink: 0, color: '#334155', background: '#FAFBFC',
                overflowY: 'auto', maxHeight: '40%',
              }}>
                {ep.outcome && (
                  <div style={{ fontWeight: 700, marginBottom: 10, color: '#0F172A', fontSize: 15, lineHeight: 1.4 }}>
                    {ep.outcome}
                  </div>
                )}
                {semanticEntries.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 13 }}>
                    {semanticEntries.map((entry) => (
                      <li key={entry.run} style={{ color: '#1E293B', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>Run {entry.run}:</span>{' '}
                        {entry.semanticDescription}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Test results */}
          <div style={{
            width: 260, flexShrink: 0, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 14px 8px', borderBottom: '1px solid #E2E8F0',
              fontWeight: 600, fontSize: 13, color: '#1E293B', flexShrink: 0,
            }}>
              Test Results
              {testResults.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: 11, color: '#64748B', marginLeft: 8 }}>
                  {testResults.filter(t => t.status === 'pass').length}/{testResults.length} passing
                </span>
              )}
              {isRange && (
                <div style={{ fontWeight: 400, fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                  at run {endRun}
                </div>
              )}
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {sortedResults.map((t) => {
                const isFail = t.status !== 'pass';
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 14px',
                      borderLeft: t.changedThisRun ? '3px solid #F59E0B' : '3px solid transparent',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    {isFail ? <FailIcon /> : <PassIcon />}
                    <span style={{
                      fontSize: 12, color: isFail ? '#991B1B' : '#064E3B',
                      fontFamily: "'IBM Plex Mono', monospace",
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.name}
                    </span>
                  </div>
                );
              })}
              {testResults.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                  No test data for this run
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
