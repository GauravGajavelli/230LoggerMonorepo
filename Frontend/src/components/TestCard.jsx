import { useState, useEffect, useRef } from 'react';
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
            color: '#64748B', marginBottom: 6, fontSize: 11,
            cursor: onLabelClick ? 'pointer' : 'default',
            textDecoration: onLabelClick ? 'underline' : 'none',
            textDecorationColor: '#475569',
          }}
        >
          {diff.label}{onLabelClick ? ' ↗' : ''}
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
export function TestCard({ test, forceOpen, onCiteClick }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [diffIndex, setDiffIndex] = useState(0);
  const cardRef = useRef(null);

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
        {canExpand && <ChevronIcon open={open} />}
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: `1px solid ${isFailing ? '#FEE2E2' : isImproved ? '#DBEAFE' : '#D1FAE5'}`,
        }}>
          {/* Diagnostic label */}
          {test.pattern && (
            <div style={{
              display: 'inline-block', marginTop: 10, padding: '2px 8px',
              background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4,
              fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: '.04em',
              textTransform: 'uppercase',
            }}>
              {test.pattern}
            </div>
          )}

          {/* What happened */}
          {test.explanation && (
            <div style={{ marginTop: test.pattern ? 8 : 12 }}>
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
                      <CitationText text={sentence} onCiteClick={onCiteClick} />
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
                      <CitationText text={step} onCiteClick={onCiteClick} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, lineHeight: '1.55', color: '#78350F', margin: 0 }}>
                  <CitationText text={test.suggestion} onCiteClick={onCiteClick} />
                </p>
              )}
            </div>
          )}

          {/* Run history */}
          {test.statusByRun && Object.keys(test.statusByRun).length > 0 && (
            <div style={{ marginTop: 14 }}>
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
                      <span key={run} title={`Run ${run}: ${status}`} style={{
                        width: 6, height: isPassing ? 14 : 20, borderRadius: 2,
                        background: isPassing ? '#6EE7B7' : '#FCA5A5',
                        flexShrink: 0,
                      }} />
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
