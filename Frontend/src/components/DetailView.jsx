import { useState, useCallback, useMemo, useEffect } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';
import { TimelineChart } from './TimelineChart';
import { EpisodeChips } from './EpisodeChips';
import { TestCard } from './TestCard';

/* ── Back icon ── */
const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Detail view: wireframe layout with summary banner, line chart, episode chips, and 3-tab test list.
 * On desktop (≥1024px): sidebar (summary + timeline) left, test cards right.
 * On mobile: single column, stacked.
 */
export function DetailView({ onBack, onReplayRun, onMarkReviewed, reviewed }) {
  const { episodes, feedbackMap, allRuns, detailTests, detailSummary, context, runToEpisode } = usePlaybackDataContext();

  const [tab, setTab] = useState('issues');
  const [highlightedTestId, setHighlightedTestId] = useState(null);
  const [openedFeedbackIds, setOpenedFeedbackIds] = useState(new Set());
  const [hoveredBarId, setHoveredBarId] = useState(null);

  /* ── Bucketed test lists ── */
  const failingTests  = useMemo(() => detailTests.filter(t => t.status === 'failing'), [detailTests]);
  const improvedTests = useMemo(() => detailTests.filter(t => t.status === 'improved'), [detailTests]);
  const passingTests  = useMemo(() => detailTests.filter(t => t.status === 'passing'), [detailTests]);

  /* ── Auto-select first non-empty tab on mount ── */
  useEffect(() => {
    if (failingTests.length === 0) {
      setTab(improvedTests.length > 0 ? 'improved' : 'passing');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── All test IDs that have feedback (used for tab dot + "all seen" check) ── */
  // Covers every feedback item regardless of whether an episode chip links to it.
  // Chip-navigation-only feedback (no chip) is still readable inline in the test card.
  const chipLinkedFeedbackIds = useMemo(() => new Set(feedbackMap.keys()), [feedbackMap]);

  /* ── testId → name lookup for chip labels ── */
  const testNameById = useMemo(
    () => Object.fromEntries(detailTests.map(t => [t.id, t.name])),
    [detailTests]
  );

  /* ── Episodes annotated with feedback presence + opened state ── */
  const episodesWithFeedback = useMemo(() =>
    episodes.map(ep => ({
      ...ep,
      hasFeedback:    ep.linkedTestId ? feedbackMap.has(ep.linkedTestId)        : false,
      feedbackOpened: ep.linkedTestId ? openedFeedbackIds.has(ep.linkedTestId)  : false,
    })),
    [episodes, feedbackMap, openedFeedbackIds]
  );

  /* ── Cumulative timeline data: one point per run ── */
  const timelineData = useMemo(() => {
    // Accumulate test status across all runs in chronological order.
    // A test not yet seen is excluded from the count; once it runs for the
    // first time its status is tracked until changed by a later run.
    const currentStatus = new Map(); // testId -> 'pass' | 'fail'

    return allRuns.map(r => {
      // Update status for every test that ran in this run
      (r.run.results || []).forEach(res => {
        currentStatus.set(res.id, res.status === 'pass' ? 'pass' : 'fail');
      });

      let passing = 0, failing = 0;
      for (const s of currentStatus.values()) {
        if (s === 'pass') passing++;
        else failing++;
      }

      const ts = r.run.timestamp;
      const time = ts instanceof Date
        ? ts.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : null;

      // Event = any test changed status this run (regression OR fix)
      const event = r.run.results?.some(res => res.changedThisRun) ? 'change' : null;

      return { time, passing, failing, event };
    });
  }, [allRuns]);

  /* ── Episode chip click: switch tab + highlight test + mark feedback opened ── */
  const handleEpisodeJump = useCallback((episode) => {
    const linkedId = episode.linkedTestId;
    if (!linkedId) return;

    // Determine which tab the linked test lives on
    if (failingTests.some(t => t.id === linkedId))       setTab('issues');
    else if (improvedTests.some(t => t.id === linkedId)) setTab('improved');
    else                                                  setTab('passing');

    if (episode.hasFeedback) {
      setOpenedFeedbackIds(prev => new Set([...prev, linkedId]));
    }

    setHighlightedTestId(linkedId);
    setTimeout(() => setHighlightedTestId(null), 3000);
  }, [failingTests, improvedTests]);

  /* ── Derived header strings ── */
  const assignmentName = context?.assignmentName || 'Assignment';
  const submittedAt = context?.submittedAt
    ? new Date(context.submittedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : null;

  const totalTests = detailSummary.total;
  const needsAttention = detailSummary.failing;

  return (
    <div className="dv-page">

      {/* Back nav */}
      <button
        onClick={onBack}
        style={{
          all: 'unset', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: '#64748B', cursor: 'pointer', marginBottom: 20, padding: '4px 0',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#1E293B')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
      >
        <BackIcon />
        All assignments
      </button>

      {/* Assignment header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: '#0F172A',
          margin: '0 0 4px', letterSpacing: '-.03em',
        }}>
          {assignmentName}
        </h1>
        {submittedAt && (
          <p style={{ fontSize: 12, color: '#64748B', margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
            Submitted {submittedAt}
          </p>
        )}
      </div>

      {/* Full-width chart — desktop only, sits above the two columns */}
      <div className="dv-chart-fullwidth" style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.08em', color: '#94A3B8', marginBottom: 10,
        }}>
          Session timeline
        </div>
        <TimelineChart data={timelineData} />
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '10px 0 0', lineHeight: 1.5 }}>
          Based on test runs recorded during your work session. Yellow dots mark moments when a test's status changed.
        </p>
      </div>

      {/* Two-column on desktop, stacked on mobile */}
      <div className="dv-columns">

        {/* Left sidebar: summary + episodes */}
        <div className="dv-sidebar">

          {/* Summary banner */}
          <div className="dv-summary-banner" style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '18px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>
                {needsAttention > 0
                  ? `${needsAttention} of ${totalTests} tests need attention`
                  : `All ${totalTests} tests passing`}
              </p>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                {detailSummary.improved > 0
                  ? `${detailSummary.improved} test${detailSummary.improved !== 1 ? 's' : ''} improved since your earlier runs — nice progress.`
                  : 'Keep up the great work!'}
              </p>
            </div>
            {/* Mini-bar of all tests */}
            <div className="dv-summary-bars">
              {[...detailTests]
                .sort((a, b) => ({ failing: 0, improved: 1, passing: 2 }[a.status] - { failing: 0, improved: 1, passing: 2 }[b.status]))
                .map((t) => (
                  <div key={t.id} style={{ position: 'relative' }}
                       onMouseEnter={() => setHoveredBarId(t.id)}
                       onMouseLeave={() => setHoveredBarId(null)}>
                    <span style={{
                      display: 'block', width: 10, height: 28, borderRadius: 3,
                      background: t.status === 'failing' ? '#FCA5A5' : t.status === 'improved' ? '#93C5FD' : '#6EE7B7',
                      outline: hoveredBarId === t.id ? '2px solid #475569' : '2px solid transparent',
                      outlineOffset: 1,
                      cursor: 'default',
                    }} />
                    {hoveredBarId === t.id && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1E293B', color: '#F8FAFC',
                        fontSize: 11, padding: '3px 8px', borderRadius: 4,
                        whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
                      }}>
                        {t.name}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 10 }}>
              {detailSummary.failing  > 0 && <span style={{ color: '#DC2626' }}>{detailSummary.failing} failing</span>}
              {detailSummary.improved > 0 && <span style={{ color: '#2563EB' }}>{detailSummary.improved} improved</span>}
              {detailSummary.passing  > 0 && <span style={{ color: '#059669' }}>{detailSummary.passing} passing</span>}
            </div>
          </div>

          {/* Mobile only: chart + chips together in one card */}
          <div className="dv-sidebar-timeline" style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.08em', color: '#94A3B8', marginBottom: 10,
            }}>
              Session timeline
            </div>
            <TimelineChart data={timelineData} />
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '10px 0 0', lineHeight: 1.5 }}>
              Based on test runs recorded during your work session. Yellow dots mark moments when a test's status changed.
            </p>
            <EpisodeChips episodes={episodesWithFeedback} onJump={handleEpisodeJump} testNameById={testNameById} />
          </div>

          {/* Desktop only: episode chips below the full-width chart */}
          <div className="dv-sidebar-chips" style={{
            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6,
            }}>
              Episodes
            </div>
            <EpisodeChips episodes={episodesWithFeedback} onJump={handleEpisodeJump} testNameById={testNameById} />
            {episodesWithFeedback.some(ep => ep.outcomeType) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8,
                fontSize: 10, color: '#94A3B8', alignItems: 'center' }}>
                {[['#FCA5A5','regression'],['#93C5FD','fix'],['#CBD5E1','neutral']].map(([bg, label]) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: bg, display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>{/* /dv-sidebar */}

        {/* Right main: tabs + test cards */}
        <div className="dv-main">

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid #E2E8F0' }}>
            {[
              { key: 'issues',   label: `Needs attention (${failingTests.length})`, tests: failingTests },
              { key: 'improved', label: `Improved (${improvedTests.length})`,       tests: improvedTests },
              { key: 'passing',  label: `Passing (${passingTests.length})`,         tests: passingTests },
            ].map((t) => {
              const fbTests = t.tests.filter(x => chipLinkedFeedbackIds.has(x.id));
              const hasFeedback = fbTests.length > 0;
              const allSeen = hasFeedback && fbTests.every(x => openedFeedbackIds.has(x.id));
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  all: 'unset', padding: '8px 16px', fontSize: 13,
                  fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? '#0F172A' : '#64748B',
                  borderBottom: tab === t.key ? '2px solid #1E293B' : '2px solid transparent',
                  marginBottom: -2, cursor: 'pointer', transition: 'color .15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {t.label}
                  {hasFeedback && (allSeen
                    ? <span className="feedback-seen" title="All feedback reviewed">✓</span>
                    : <span className="feedback-unseen-tab" title="Has unreviewed feedback" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Test cards per tab */}
          {tab === 'issues'   && failingTests.map(t  => (
            <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} onCiteClick={onReplayRun} runToEpisode={runToEpisode} onFeedbackOpened={() => setOpenedFeedbackIds(prev => new Set([...prev, t.id]))} />
          ))}
          {tab === 'improved' && improvedTests.map(t => (
            <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} onCiteClick={onReplayRun} runToEpisode={runToEpisode} onFeedbackOpened={() => setOpenedFeedbackIds(prev => new Set([...prev, t.id]))} />
          ))}
          {tab === 'passing'  && passingTests.map(t  => (
            <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} onCiteClick={onReplayRun} runToEpisode={runToEpisode} onFeedbackOpened={() => setOpenedFeedbackIds(prev => new Set([...prev, t.id]))} />
          ))}

          {/* Closure / mark reviewed */}
          <div style={{
            marginTop: 24, padding: '16px 20px', background: '#FFFFFF',
            border: '1px solid #E2E8F0', borderRadius: 12, textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            {reviewed ? (
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                ✓ You've marked this as reviewed. You can come back anytime.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 10px' }}>
                  Done reviewing? You can come back anytime before the next assignment.
                </p>
                <button
                  onClick={onMarkReviewed}
                  style={{
                    all: 'unset', padding: '8px 20px', fontSize: 13, fontWeight: 600,
                    color: '#FFF', background: '#1E293B', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  Mark as reviewed ✓
                </button>
              </>
            )}
          </div>

        </div>{/* /dv-main */}

      </div>{/* /dv-columns */}

    </div>
  );
}
