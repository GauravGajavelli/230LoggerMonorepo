import { useState, useEffect, useRef, useCallback } from 'react';
import { CitationText } from './CitationText';

/* ── Icons ── */
const FailIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" fill="#FECACA" stroke="#DC2626" strokeWidth="1.2" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const PassIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" fill="#D1FAE5" stroke="#059669" strokeWidth="1.2" />
    <path d="M5 8.2l2 2 4-4.4" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ImprovedIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.2" />
    <path d="M8 11V5.5M5.5 7.5L8 5l2.5 2.5" stroke="#2563EB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ClockIcon = () => (
  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6.5" stroke="#94A3B8" strokeWidth="1.2" />
    <path d="M8 4.5V8l2.5 1.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg
    width={16} height={16} viewBox="0 0 16 16" fill="none"
    style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
  >
    <path d="M6 4l4 4-4 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Test source modal — same entrance animation as ReplayModal ── */
function TestSourceModal({ testSource, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
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
      <div style={{
        width: '100%', maxWidth: 680,
        maxHeight: '80vh',
        background: '#fff', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        overflow: 'hidden',
        animation: 'modal-scale-in .2s ease-out',
      }}>
        {/* Header — matches ReplayModal */}
        <div style={{
          background: '#800000', color: '#fff',
          padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace" }}>
            {testSource.fileName}
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

        {/* Code body — line-numbered */}
        <div style={{ flex: 1, overflow: 'auto', background: '#0F172A' }}>
          <pre style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: '1.7',
            color: '#CBD5E1', margin: 0, padding: '16px 0',
          }}>
            {testSource.content.split('\n').map((line, i) => (
              <div key={i} style={{ display: 'flex', minHeight: '1.7em' }}>
                <span style={{
                  display: 'inline-block', minWidth: 48, textAlign: 'right',
                  paddingRight: 16, color: '#4B5563',
                  userSelect: 'none', flexShrink: 0,
                }}>
                  {testSource.startLine + i}
                </span>
                <span style={{ flex: 1, paddingRight: 24, whiteSpace: 'pre' }}>{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ── Diff block (dark code style) ── */
function DiffBlock({ diff, onLabelClick }) {
  const lines = [...(diff.before || []), '───', ...(diff.after || [])];
  return (
    <pre style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: '1.7',
      background: '#0F172A', color: '#CBD5E1', borderRadius: 8,
      padding: '12px 16px', margin: '8px 0 0', overflowX: 'auto',
      border: '1px solid #1E293B',
    }}>
      {diff.label && (
        <div
          onClick={onLabelClick || undefined}
          style={{
            color: '#64748B', marginBottom: diff.note ? 4 : 6, fontSize: 11,
            cursor: onLabelClick ? 'pointer' : 'default',
            textDecoration: onLabelClick ? 'underline' : 'none',
            textDecorationColor: '#475569',
          }}
        >
          {diff.label}{onLabelClick ? ' ↗' : ''}
        </div>
      )}
      {diff.note && (
        <div style={{
          color: '#94A3B8', fontSize: 11, marginBottom: 8,
          fontStyle: 'italic', whiteSpace: 'pre-wrap',
        }}>
          {diff.note}
        </div>
      )}
      {lines.map((l, i) => {
        if (l === '───') return <div key={i} style={{ borderTop: '1px dashed #334155', margin: '6px 0' }} />;
        let color = '#CBD5E1', bg = 'transparent';
        if (l.trimStart().startsWith('-') || l.trimStart().startsWith('−')) {
          color = '#FCA5A5'; bg = 'rgba(220,38,38,.12)';
        }
        if (l.trimStart().startsWith('+')) {
          color = '#86EFAC'; bg = 'rgba(5,150,105,.12)';
        }
        return (
          <div key={i} style={{ color, background: bg, padding: '0 4px', borderRadius: 3 }}>{l}</div>
        );
      })}
    </pre>
  );
}

/**
 * TestCard matching the wireframe style.
 * Failing AND improved tests with feedback can expand.
 * forceOpen + scrollIntoView when highlighted by an episode chip click.
 *
 * @param {{
 *   test: { id:string, name:string, status:string, changedAt:string|null,
 *            explanation:string, suggestion:string, diffs:Array },
 *   forceOpen: boolean,
 *   onCiteClick: (runNumber:number) => void,
 * }} props
 */
export function TestCard({ test, forceOpen, onCiteClick, runToEpisode = {}, onFeedbackOpened }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [diffIndex, setDiffIndex] = useState(0);
  const [hoveredRun, setHoveredRun] = useState(null);
  const [hoveredPill, setHoveredPill] = useState(null);
  const [hasOpenedFeedback, setHasOpenedFeedback] = useState(false);
  const [showTestSource, setShowTestSource] = useState(false);
  const closeTestSource = useCallback(() => setShowTestSource(false), []);
  const cardRef = useRef(null);
  const hasRevealedRef = useRef(false);

  const hasFeedback = !!(test.explanation || test.suggestion || test.nextSteps?.length || test.diffs?.length);
  const canExpand = hasFeedback;
  const open = canExpand && (manualOpen || forceOpen);
  const highlighted = !!forceOpen;

  useEffect(() => {
    if (forceOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setManualOpen(true);
    }
  }, [forceOpen]);

  useEffect(() => { setDiffIndex(0); }, [test.id]);

  const isFailing = test.status === 'failing';
  const isImproved = test.status === 'improved';

  const borderColor = highlighted
    ? '#F59E0B'
    : isFailing ? '#FECACA'
    : isImproved ? '#BFDBFE'
    : '#D1FAE5';

  const bgColor = isFailing ? '#FFFBFB' : isImproved ? '#F8FAFF' : '#F7FDF9';

  return (
    <div
      ref={cardRef}
      style={{
        border: `1px solid ${borderColor}`, borderRadius: 10, background: bgColor,
        marginBottom: 8, transition: 'box-shadow .15s, border-color .3s',
        boxShadow: highlighted
          ? '0 2px 12px rgba(245,158,11,.12)'
          : open && isFailing ? '0 2px 12px rgba(220,38,38,.08)'
          : 'none',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => canExpand && setManualOpen(!manualOpen)}
        style={{
          all: 'unset', display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '12px 16px',
          cursor: canExpand ? 'pointer' : 'default', boxSizing: 'border-box',
        }}
      >
        {isFailing ? <FailIcon /> : isImproved ? <ImprovedIcon /> : <PassIcon />}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
          fontWeight: 500, color: '#1E293B', flex: 1, textAlign: 'left',
        }}>
          {test.name}
        </span>
        {test.changedAt && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#64748B', fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <ClockIcon />{test.changedAt}
          </span>
        )}
        {hasFeedback && !hasOpenedFeedback && (
          <span className="feedback-unseen-tab" style={{ width: 7, height: 7 }} title="Has unreviewed feedback" />
        )}
        {canExpand && <ChevronIcon open={open} />}
      </button>

      {/* Expanded body */}
      {open && (
        <div
          style={{
            padding: '0 16px 16px',
            borderTop: `1px solid ${isFailing ? '#FEE2E2' : isImproved ? '#DBEAFE' : '#D1FAE5'}`,
            animation: !hasRevealedRef.current ? 'feedbackReveal 0.3s ease-out' : undefined,
          }}
          onAnimationEnd={() => { hasRevealedRef.current = true; setHasOpenedFeedback(true); onFeedbackOpened?.(); }}
        >
          {/* Top row: diagnostic label (left) + view test button (right) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
            {test.pattern ? (
              <div style={{
                display: 'inline-block', padding: '2px 8px',
                background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4,
                fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: '.04em',
                textTransform: 'uppercase',
              }}>
                {test.pattern}
              </div>
            ) : <div />}
            {test.testSource && (
              <button
                onClick={() => setShowTestSource(true)}
                style={{
                  all: 'unset', cursor: 'pointer', flexShrink: 0,
                  fontSize: 10, fontWeight: 500, color: '#64748B',
                  padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #CBD5E1', background: '#F8FAFC',
                  fontFamily: "'IBM Plex Mono', monospace",
                  lineHeight: '1.6',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#1E293B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B'; }}
              >
                {'<'}/{'>'} view test
              </button>
            )}
          </div>

          {/* What happened */}
          {test.explanation && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6 }}>
                What happened
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, listStyleType: 'disc' }}>
                {test.explanation
                  .split(/(?<=\.)\s+/)
                  .filter(Boolean)
                  .map((sentence, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: '1.6', color: '#334155', marginBottom: 4 }}>
                      <CitationText text={sentence} onCiteClick={onCiteClick} runToEpisode={runToEpisode} />
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Code diffs — paginated */}
          {test.diffs && test.diffs.length > 0 && (() => {
            const diff = test.diffs[diffIndex];
            const total = test.diffs.length;
            const runNum = parseInt(diff?.label?.match(/Run (\d+)/)?.[1]);
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '.08em', color: '#94A3B8' }}>
                    Code change
                  </div>
                  {total > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setDiffIndex(i => Math.max(0, i - 1))}
                        disabled={diffIndex === 0}
                        style={{ all: 'unset', cursor: diffIndex === 0 ? 'default' : 'pointer',
                                 color: diffIndex === 0 ? '#CBD5E1' : '#64748B', fontSize: 14, lineHeight: 1 }}>
                        ‹
                      </button>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{diffIndex + 1} / {total}</span>
                      <button onClick={() => setDiffIndex(i => Math.min(total - 1, i + 1))}
                        disabled={diffIndex === total - 1}
                        style={{ all: 'unset', cursor: diffIndex === total - 1 ? 'default' : 'pointer',
                                 color: diffIndex === total - 1 ? '#CBD5E1' : '#64748B', fontSize: 14, lineHeight: 1 }}>
                        ›
                      </button>
                    </div>
                  )}
                </div>
                <DiffBlock diff={diff} onLabelClick={runNum ? () => onCiteClick(runNum) : null} />
              </div>
            );
          })()}

          {/* What to work on — amber box */}
          {(test.nextSteps?.length > 0 || test.suggestion) && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#B45309', marginBottom: 6 }}>
                What to work on
              </div>
              {test.nextSteps?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, listStyleType: 'disc' }}>
                  {test.nextSteps.map((step, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: '1.55', color: '#78350F', marginBottom: 6 }}>
                      <CitationText text={step} onCiteClick={onCiteClick} runToEpisode={runToEpisode} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, lineHeight: '1.55', color: '#78350F', margin: 0 }}>
                  <CitationText text={test.suggestion} onCiteClick={onCiteClick} runToEpisode={runToEpisode} />
                </p>
              )}
            </div>
          )}

          {/* Relevant in — future course appearances */}
          {test.courseAppearances?.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.08em', color: '#94A3B8', flexShrink: 0,
              }}>
                Relevant in
              </span>
              <span style={{ color: '#CBD5E1', fontSize: 11, flexShrink: 0 }}>→</span>
              {test.courseAppearances.map((ap, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}
                     onMouseEnter={() => setHoveredPill(i)}
                     onMouseLeave={() => setHoveredPill(null)}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1',
                    cursor: 'default', display: 'inline-block',
                  }}>
                    {ap.label}
                  </span>
                  {hoveredPill === i && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1E293B', color: '#F8FAFC',
                      fontSize: 11, padding: '4px 10px', borderRadius: 4,
                      whiteSpace: 'normal', maxWidth: 260, textAlign: 'center',
                      zIndex: 20, pointerEvents: 'none',
                    }}>
                      {ap.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Run history */}
          {Object.keys(test.statusByRun || {}).length > 0 && (
            <div style={{ marginTop: 14 }}>
              {Object.keys(test.statusByRun || {}).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6 }}>
                    Run history ({Object.keys(test.statusByRun).length} runs)
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {Object.entries(test.statusByRun)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([run, status]) => {
                        const isPassing = status === 'pass' || status === 'SUCCESSFUL';
                        return (
                          <div key={run} style={{ position: 'relative' }}
                               onMouseEnter={() => setHoveredRun(run)}
                               onMouseLeave={() => setHoveredRun(null)}>
                            <span style={{
                              display: 'block', width: 6, height: isPassing ? 14 : 20, borderRadius: 2,
                              background: isPassing ? '#6EE7B7' : '#FCA5A5',
                              flexShrink: 0, cursor: 'default',
                              outline: hoveredRun === run ? '2px solid #475569' : '2px solid transparent',
                              outlineOffset: 1,
                            }} />
                            {hoveredRun === run && (
                              <div style={{
                                position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#1E293B', color: '#F8FAFC',
                                fontSize: 11, padding: '3px 8px', borderRadius: 4,
                                whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
                              }}>
                                Run {run}: {isPassing ? 'pass' : 'fail'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Test source modal */}
          {showTestSource && test.testSource && (
            <TestSourceModal testSource={test.testSource} onClose={closeTestSource} />
          )}
        </div>
      )}
    </div>
  );
}
