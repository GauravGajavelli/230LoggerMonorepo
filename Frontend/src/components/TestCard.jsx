import { useState, useEffect, useRef, useCallback } from 'react';
import { CitationText } from './CitationText';
import { eventTracker } from '../utils/eventTracker';

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

/* ── Practice drill modal ── */
function PracticeDrillModal({ drill, onClose }) {
  const [hintsOpen, setHintsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(drill.testCode || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isRepair = drill.mode === 'repair';

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
        maxHeight: '85vh',
        background: '#fff', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        overflow: 'hidden',
        animation: 'modal-scale-in .2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          background: '#800000', color: '#fff',
          padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{
              fontWeight: 600, fontSize: 14,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              ✦ practice drill
            </span>
            {drill.mode && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                background: isRepair ? '#FEF2F2' : '#EFF6FF',
                color: isRepair ? '#EF4444' : '#3B82F6',
              }}>
                {drill.mode}
              </span>
            )}
            {drill.timeEstimate && (
              <span style={{
                fontSize: 11, fontWeight: 500,
                padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                background: 'rgba(255,255,255,.15)', color: '#fff',
              }}>
                {drill.timeEstimate}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,.4)',
              color: '#fff', padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              flexShrink: 0,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {drill.intro && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: '1.6', color: '#64748B', fontStyle: 'italic' }}>
              {drill.intro}
            </p>
          )}

          {(drill.targetFile || drill.drillPoints) && (
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
              {drill.targetFile && (
                <>Paste into <code style={{ background: '#F3F4F6', padding: '0 3px', borderRadius: 3 }}>{drill.targetFile}</code></>
              )}
              {drill.drillPoints && (
                <> · ~{drill.drillPoints} pt{drill.drillPoints !== 1 ? 's' : ''}{drill.pointsAvailable ? '' : ' (standalone)'}</>
              )}
            </div>
          )}

          {drill.testCode && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 1,
                  background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
                  color: copied ? '#86EFAC' : '#94A3B8',
                  padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  transition: 'color .15s',
                }}
              >
                {copied ? '✓ copied' : 'copy'}
              </button>
              <pre style={{
                background: '#0F172A', borderRadius: 8, margin: 0,
                padding: '14px 16px', paddingRight: 60,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: '1.7',
                color: '#CBD5E1', overflowX: 'auto', whiteSpace: 'pre',
              }}>
                {drill.testCode}
              </pre>
            </div>
          )}

          {drill.hints && drill.hints.length > 0 && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setHintsOpen(h => !h)}
                style={{
                  all: 'unset', display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '8px 14px', cursor: 'pointer',
                  boxSizing: 'border-box', background: '#F8FAFC',
                  borderBottom: hintsOpen ? '1px solid #E2E8F0' : 'none',
                }}
              >
                <span style={{
                  fontSize: 10, color: '#94A3B8',
                  display: 'inline-block',
                  transition: 'transform .15s',
                  transform: hintsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#64748B',
                  letterSpacing: '.04em', textTransform: 'uppercase',
                }}>
                  {hintsOpen ? 'Hide hints' : 'Show hints'} ({drill.hints.length})
                </span>
              </button>
              {hintsOpen && (
                <ol style={{ margin: 0, paddingLeft: 32, paddingRight: 16, paddingTop: 10, paddingBottom: 10, listStyleType: 'decimal' }}>
                  {drill.hints.map((hint, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: '1.6', color: '#334155', marginBottom: 8 }}>
                      {hint}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Diff block — side-by-side before / after ── */
function DiffBlock({ diff, onLabelClick }) {
  const before = diff.before || [];
  const after  = diff.after  || [];
  const hasBefore = before.length > 0;
  const hasAfter  = after.length  > 0;

  const colStyle = (side) => ({
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
    borderRight: side === 'before' && hasAfter ? '1px solid #1E293B' : 'none',
  });
  const headerStyle = (side) => ({
    padding: '3px 12px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0,
    color:      side === 'before' ? '#FCA5A5' : '#86EFAC',
    background: side === 'before' ? 'rgba(220,38,38,.10)' : 'rgba(5,150,105,.10)',
    borderBottom: '1px solid #1E293B',
  });
  const codeStyle = (side) => ({
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: '1.7',
    color:      side === 'before' ? '#FCA5A5' : '#86EFAC',
    background: side === 'before' ? 'rgba(220,38,38,.05)' : 'rgba(5,150,105,.05)',
    margin: 0, padding: '8px 12px', overflowX: 'auto', flex: 1,
    whiteSpace: 'pre', minWidth: 0,
  });

  return (
    <div style={{ margin: '8px 0 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #1E293B' }}>

      {/* Label + note header */}
      {(diff.label || diff.note) && (
        <div style={{ background: '#0F172A', padding: '6px 12px', borderBottom: '1px solid #1E293B' }}>
          {diff.label && (
            <div
              onClick={onLabelClick || undefined}
              style={{
                color: '#64748B', fontSize: 11,
                cursor: onLabelClick ? 'pointer' : 'default',
                textDecoration: onLabelClick ? 'underline' : 'none',
                textDecorationColor: '#475569',
              }}
            >
              {diff.label}{onLabelClick ? ' ↗' : ''}
            </div>
          )}
          {diff.note && (
            <div style={{ color: '#94A3B8', fontSize: 11, marginTop: diff.label ? 3 : 0, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
              {diff.note}
            </div>
          )}
        </div>
      )}

      {/* Side-by-side columns */}
      {(hasBefore || hasAfter) && (
        <div style={{ display: 'flex', background: '#0F172A' }}>
          {hasBefore && (
            <div style={colStyle('before')}>
              <div style={headerStyle('before')}>Before</div>
              <pre style={codeStyle('before')}>
                {before.map((line, i) => <div key={i}>{line || '\u200b'}</div>)}
              </pre>
            </div>
          )}
          {hasAfter && (
            <div style={colStyle('after')}>
              <div style={headerStyle('after')}>After</div>
              <pre style={codeStyle('after')}>
                {after.map((line, i) => <div key={i}>{line || '\u200b'}</div>)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Feedback shimmer skeleton — shows briefly on first expand ── */
function FeedbackShimmer() {
  return (
    <div style={{ padding: '14px 0 6px' }}>
      <div className="skeleton-shimmer" style={{ height: 10, width: 88, marginBottom: 14 }} />
      <div className="skeleton-shimmer" style={{ height: 13, width: '91%', marginBottom: 7 }} />
      <div className="skeleton-shimmer" style={{ height: 13, width: '76%', marginBottom: 7 }} />
      <div className="skeleton-shimmer" style={{ height: 13, width: '58%', marginBottom: 20 }} />
      <div className="skeleton-shimmer" style={{ height: 10, width: 108, marginBottom: 10 }} />
      <div className="skeleton-shimmer" style={{ height: 54, width: '100%', borderRadius: 6, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ height: 10, width: 80, marginBottom: 10 }} />
      <div className="skeleton-shimmer" style={{ height: 40, width: '100%', borderRadius: 6 }} />
    </div>
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
export function TestCard({ test, forceOpen, forceDrill, initiallyOpen, onCiteClick, runToEpisode = {}, onFeedbackOpened, assessmentConfig }) {
  const [manualOpen, setManualOpen] = useState(initiallyOpen ?? false);
  const [diffIndex, setDiffIndex] = useState(0);
  const [hoveredRun, setHoveredRun] = useState(null);
  const [hoveredPill, setHoveredPill] = useState(null);
  const [hoveredConcept, setHoveredConcept] = useState(null);
  const [hasOpenedFeedback, setHasOpenedFeedback] = useState(false);
  const [showTestSource, setShowTestSource] = useState(false);
  const closeTestSource = useCallback(() => setShowTestSource(false), []);
  const [showDrill, setShowDrill] = useState(false);
  const closeDrill = useCallback(() => setShowDrill(false), []);
  const [diffsOpen, setDiffsOpen] = useState(false);
  const [explanationExpanded, setExplanationExpanded] = useState(false);
  const [shimmerDone, setShimmerDone] = useState(true);
  const [drillGlow, setDrillGlow] = useState(false);
  const cardRef = useRef(null);
  const hasRevealedRef = useRef(!!initiallyOpen);
  const hasShimmeredRef = useRef(!!initiallyOpen); // skip shimmer for initially-open cards

  // Fire telemetry + callbacks for initially-open cards (shimmer is skipped for these)
  useEffect(() => {
    if (initiallyOpen) {
      setHasOpenedFeedback(true);
      onFeedbackOpened?.();
      eventTracker.track('feedback_opened', { test_id: test.id });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // forceDrill: scroll to card, open it, then open the drill modal after scroll settles.
  // Also triggers a brief glow on the card so the student sees where they landed.
  useEffect(() => {
    if (!forceDrill || !test.drills?.[0]) return;
    setManualOpen(true);
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setDrillGlow(true);
    const glowTimer  = setTimeout(() => setDrillGlow(false), 2000);
    const drillTimer = setTimeout(() => setShowDrill(true), 600); // after scroll settles
    return () => { clearTimeout(glowTimer); clearTimeout(drillTimer); };
  }, [forceDrill]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDiffIndex(0); }, [test.id]);

  // Shimmer on first expand: show skeleton for 380ms, then reveal real content
  useEffect(() => {
    if (open && !hasShimmeredRef.current) {
      hasShimmeredRef.current = true;
      setShimmerDone(false);
      const t = setTimeout(() => setShimmerDone(true), 380);
      return () => clearTimeout(t);
    }
  }, [open]);

  const isFailing = test.status === 'failing';
  const isImproved = test.status === 'improved';

  const borderColor = highlighted
    ? '#F59E0B'
    : isFailing ? '#FECACA'
    : isImproved ? '#BFDBFE'
    : '#D1FAE5';

  const bgColor = isFailing ? '#FFFBFB' : isImproved ? '#F8FAFF' : '#F7FDF9';

  // Compute drill anchor id — must match drillAnchor() in report.js
  const drillAnchorId = (() => {
    const hash = test.id?.indexOf('#') ?? -1;
    if (hash < 0) return undefined;
    return 'drill-' + test.id.substring(hash + 1).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  })();

  return (
    <div
      id={drillAnchorId}
      ref={cardRef}
      style={{
        border: `1px solid ${borderColor}`, borderRadius: 10, background: bgColor,
        marginBottom: 8, transition: 'box-shadow .15s, border-color .3s',
        boxShadow: drillGlow
          ? '0 0 0 3px rgba(124,45,18,.35), 0 4px 20px rgba(124,45,18,.20)'
          : highlighted
          ? '0 2px 12px rgba(245,158,11,.12)'
          : open && isFailing ? '0 2px 12px rgba(220,38,38,.08)'
          : 'none',
        outline: drillGlow ? '2px solid rgba(124,45,18,.5)' : 'none',
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

      {/* Course relevance tags — preview when collapsed; fades out on open */}
      {test.courseAppearances?.length > 0 && (
        <div style={{
          overflow: 'hidden',
          maxHeight: open ? '0px' : '120px',
          opacity: open ? 0 : 1,
          transition: 'max-height 0.2s ease-out, opacity 0.15s ease-out',
        }}>
          <div style={{ padding: '0 16px 10px' }}>
            <div style={{
              background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 6,
              padding: '5px 8px',
              display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
            }}>
              {test.courseAppearances.map((ap, i) => (
                ap.url ? (
                  <a key={i}
                     href={`/study-materials/${ap.url.split('/').map(encodeURIComponent).join('/')}`}
                     target="_blank" rel="noopener noreferrer"
                     style={{
                       fontFamily: "'IBM Plex Mono', monospace",
                       fontSize: 10, padding: '1px 6px', borderRadius: 4,
                       background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1',
                       textDecoration: 'none',
                     }}>
                    {ap.label} ↗
                  </a>
                ) : (
                  <span key={i} style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1',
                  }}>
                    {ap.label}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expanded body */}
      {open && (
        <div
          style={{
            padding: '0 16px 16px',
            borderTop: `1px solid ${isFailing ? '#FEE2E2' : isImproved ? '#DBEAFE' : '#D1FAE5'}`,
          }}
        >
          {!shimmerDone ? (
            <FeedbackShimmer />
          ) : (
          <div
            style={{ animation: !hasRevealedRef.current ? 'feedbackReveal 0.3s ease-out' : undefined }}
            onAnimationEnd={() => {
              hasRevealedRef.current = true;
              setHasOpenedFeedback(true);
              onFeedbackOpened?.();
              eventTracker.track('feedback_opened', { test_id: test.id });
            }}
          >
          {/* Top row: diagnostic label (left) + view test button (right) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {test.pattern && (
                <div style={{
                  display: 'inline-block', padding: '2px 8px',
                  background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 4,
                  fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: '.04em',
                  textTransform: 'uppercase',
                }}>
                  {test.pattern}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {test.testSource && (
                <button
                  onClick={() => { setShowTestSource(true); eventTracker.track('test_source_opened', { test_id: test.id }); }}
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
          </div>


          {/* What happened */}
          {test.explanation && (() => {
            const sentences = test.explanation.split(/(?<=\.)\s+/).filter(Boolean);
            const extra = sentences.length - 1;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6 }}>
                  What happened
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, listStyleType: 'disc' }}>
                  <li style={{ fontSize: 13, lineHeight: '1.6', color: '#334155', marginBottom: 4 }}>
                    <CitationText text={sentences[0]} onCiteClick={onCiteClick} runToEpisode={runToEpisode} />
                  </li>
                  {explanationExpanded && sentences.slice(1).map((s, i) => (
                    <li key={i + 1} style={{ fontSize: 13, lineHeight: '1.6', color: '#334155', marginBottom: 4 }}>
                      <CitationText text={s} onCiteClick={onCiteClick} runToEpisode={runToEpisode} />
                    </li>
                  ))}
                </ul>
                {extra > 0 && (
                  <button
                    onClick={() => setExplanationExpanded(e => !e)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      fontSize: 11, color: '#64748B',
                      marginTop: 4, marginLeft: 20, display: 'block',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      textDecorationColor: '#CBD5E1',
                    }}
                  >
                    {explanationExpanded ? '↑ hide' : `↓ ${extra} more`}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Why this matters — concept chain → future assignments */}
          {(test.conceptScores?.length > 0 || test.courseAppearances?.length > 0) && (
            <div style={{
              marginTop: 10,
              background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#15803D', marginBottom: 6 }}>
                Why this matters
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Concept badges: current → potential */}
                {test.conceptScores?.map(({ category, score, potential }) => {
                  const currentColor = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
                  const showArrow = potential > score;
                  return (
                    <div key={category} style={{ position: 'relative', display: 'inline-block' }}
                         onMouseEnter={() => setHoveredConcept(category)}
                         onMouseLeave={() => setHoveredConcept(null)}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 10, padding: '2px 8px', borderRadius: 4,
                        background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        cursor: 'help',
                      }}>
                        {category}
                        <span style={{ color: currentColor, fontWeight: 600 }}>{score}%</span>
                        {showArrow && (
                          <>
                            <span style={{ color: '#CBD5E1' }}>→</span>
                            <span style={{ color: '#059669', fontWeight: 600 }}>{potential}%</span>
                          </>
                        )}
                      </span>
                      {hoveredConcept === category && (
                        <div style={{
                          position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#1E293B', color: '#F8FAFC',
                          fontSize: 11, padding: '6px 10px', borderRadius: 4,
                          whiteSpace: 'normal', maxWidth: 220, textAlign: 'center',
                          zIndex: 20, pointerEvents: 'none', lineHeight: 1.5,
                        }}>
                          <strong style={{ color: '#F8FAFC' }}>{category}</strong>
                          {' '}readiness: how smoothly you learned it this session ({score}%).
                          {showArrow && ` Mastering this test could push it to ${potential}%.`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Connecting arrow (only when both sides exist) */}
                {test.conceptScores?.length > 0 && test.courseAppearances?.length > 0 && (
                  <span style={{ color: '#CBD5E1', fontSize: 13, flexShrink: 0 }}>→</span>
                )}

                {/* Future assignment pills */}
                {test.courseAppearances?.map((ap, i) => {
                  const pillStyle = {
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1',
                    display: 'inline-block',
                  };
                  const href = ap.url
                    ? `/study-materials/${ap.url.split('/').map(encodeURIComponent).join('/')}`
                    : null;
                  return (
                    <div key={i} style={{ position: 'relative', display: 'inline-block' }}
                         onMouseEnter={() => setHoveredPill(i)}
                         onMouseLeave={() => setHoveredPill(null)}>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                           style={{ ...pillStyle, cursor: 'pointer', textDecoration: 'none' }}>
                          {ap.label} ↗
                        </a>
                      ) : (
                        <span style={{ ...pillStyle, cursor: 'default' }}>
                          {ap.label}
                        </span>
                      )}
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
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Practice drill CTA — standalone, card-closing CTA */}
          {test.drills?.length > 0 && (() => {
            const drill = test.drills[0];
            return (
              <div style={{ marginTop: 14 }}>
                <button
                  className="practice-drill-btn"
                  onClick={() => { setShowDrill(true); eventTracker.track('drill_opened', { test_id: test.id }); }}
                  style={{ width: '100%' }}
                >
                  ✦ practice drill
                </button>
                {(drill.timeEstimate || drill.drillPoints || drill.source) && (
                  <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                    marginTop: 5,
                  }}>
                    {drill.source && (() => {
                      const entry = assessmentConfig?.assessments?.find(a => a.name === drill.source);
                      const daysLeft = entry ? Math.ceil(
                        (new Date(entry.date + 'T12:00:00Z') - new Date()) / 86400000
                      ) : null;
                      const urgencyColor = daysLeft == null ? '#7C3AED'
                        : daysLeft <= 3  ? '#c0392b'
                        : daysLeft <= 7  ? '#d35400'
                        : daysLeft <= 14 ? '#b7860b'
                        : '#7C3AED';
                      const urgencyBg = daysLeft == null ? '#F5F3FF'
                        : daysLeft <= 3  ? '#FEF2F2'
                        : daysLeft <= 7  ? '#FFF7ED'
                        : daysLeft <= 14 ? '#FFFBEB'
                        : '#F5F3FF';
                      const urgencyBorder = daysLeft == null ? '#DDD6FE'
                        : daysLeft <= 3  ? '#FECACA'
                        : daysLeft <= 7  ? '#FED7AA'
                        : daysLeft <= 14 ? '#FDE68A'
                        : '#DDD6FE';
                      const badgeContent = `${drill.source}${daysLeft != null && daysLeft > 0 ? ` · ${daysLeft}d` : ''}`;
                      const badgeStyle = {
                        fontSize: 10, color: urgencyColor,
                        fontFamily: "'IBM Plex Mono', monospace",
                        background: urgencyBg, border: `1px solid ${urgencyBorder}`,
                        padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                      };
                      const sourceHref = drill.sourceUrl
                        ? `/study-materials/${drill.sourceUrl.split('/').map(encodeURIComponent).join('/')}`
                        : null;
                      return sourceHref ? (
                        <a href={sourceHref} target="_blank" rel="noopener noreferrer"
                           style={{ ...badgeStyle, textDecoration: 'none', cursor: 'pointer' }}>
                          {badgeContent} ↗
                        </a>
                      ) : (
                        <span style={badgeStyle}>{badgeContent}</span>
                      );
                    })()}
                    {drill.source && (drill.timeEstimate || drill.drillPoints) && (
                      <span style={{ color: '#CBD5E1', fontSize: 10 }}>·</span>
                    )}
                    {drill.timeEstimate && (
                      <span style={{ fontSize: 10, color: '#64748B',
                                     fontFamily: "'IBM Plex Mono', monospace" }}>
                        {drill.timeEstimate}
                      </span>
                    )}
                    {drill.timeEstimate && drill.drillPoints && (
                      <span style={{ color: '#CBD5E1', fontSize: 10 }}>·</span>
                    )}
                    {drill.drillPoints && (
                      <span style={{ fontSize: 10, color: '#15803D',
                                     fontFamily: "'IBM Plex Mono', monospace" }}>
                        ~{drill.drillPoints} pt{drill.drillPoints !== 1 ? 's' : ''}
                        {''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Code diffs — paginated, collapsed by default */}
          {test.diffs && test.diffs.length > 0 && (() => {
            const diff = test.diffs[diffIndex];
            const total = test.diffs.length;
            const runNum = parseInt(diff?.label?.match(/Run (\d+)/)?.[1]);
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <button onClick={() => setDiffsOpen(o => !o)} style={{
                    all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: '#94A3B8',
                  }}>
                    <span style={{ fontSize: 11, color: '#CBD5E1' }}>{diffsOpen ? '▾' : '▸'}</span>
                    Code change{total > 1 ? ` (${total})` : ''}
                  </button>
                  {diffsOpen && total > 1 && (
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
                {diffsOpen && (
                  <DiffBlock diff={diff} onLabelClick={runNum ? () => onCiteClick(runNum) : null} />
                )}
              </div>
            );
          })()}

          {/* Run history */}
          {Object.keys(test.statusByRun || {}).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6,
                            display: 'flex', alignItems: 'center', gap: 6 }}>
                Run history ({Object.keys(test.statusByRun).length} runs)
                {hoveredRun && (
                  <span style={{
                    fontWeight: 500, textTransform: 'none', letterSpacing: 0,
                    fontSize: 10, background: '#1E293B', color: '#F8FAFC',
                    padding: '1px 6px', borderRadius: 3,
                  }}>
                    Run {hoveredRun}: {test.statusByRun[hoveredRun] === 'pass' || test.statusByRun[hoveredRun] === 'SUCCESSFUL' ? 'pass' : 'fail'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto',
                            alignItems: 'flex-end', paddingBottom: 2 }}>
                {Object.entries(test.statusByRun)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([run, status]) => {
                    const isPassing = status === 'pass' || status === 'SUCCESSFUL';
                    return (
                      <div key={run}
                           onMouseEnter={() => setHoveredRun(run)}
                           onMouseLeave={() => setHoveredRun(null)}>
                        <span style={{
                          display: 'block', width: 6, height: isPassing ? 14 : 20, borderRadius: 2,
                          background: isPassing ? '#6EE7B7' : '#FCA5A5',
                          flexShrink: 0, cursor: 'default',
                          outline: hoveredRun === run ? '2px solid #475569' : '2px solid transparent',
                          outlineOffset: 1,
                        }} />
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

          {/* Practice drill modal */}
          {showDrill && test.drills?.[0] && (
            <PracticeDrillModal drill={test.drills[0]} onClose={closeDrill} />
          )}
        </div>
      )}
    </div>
  );
}
