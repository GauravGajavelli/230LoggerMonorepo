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
function DiffBlock({ diff }) {
  const lines = [...(diff.before || []), '───', ...(diff.after || [])];
  return (
    <pre style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: '1.7',
      background: '#0F172A', color: '#CBD5E1', borderRadius: 8,
      padding: '12px 16px', margin: '8px 0 0', overflowX: 'auto',
      border: '1px solid #1E293B',
    }}>
      {diff.label && (
        <div style={{ color: '#64748B', marginBottom: 6, fontSize: 11 }}>{diff.label}</div>
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
  const cardRef = useRef(null);

  const hasFeedback = !!(test.explanation || test.suggestion || test.diffs?.length);
  const canExpand = hasFeedback;
  const open = canExpand && (manualOpen || forceOpen);
  const highlighted = !!forceOpen;

  useEffect(() => {
    if (forceOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setManualOpen(true);
    }
  }, [forceOpen]);

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
          {/* What happened */}
          {test.explanation && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#94A3B8', marginBottom: 6 }}>
                What happened
              </div>
              <p style={{ fontSize: 13, lineHeight: '1.6', color: '#334155', margin: 0 }}>
                <CitationText text={test.explanation} onCiteClick={onCiteClick} />
              </p>
            </div>
          )}

          {/* Code diffs */}
          {test.diffs && test.diffs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#94A3B8', marginBottom: 4 }}>
                Code change
              </div>
              {test.diffs.map((diff, i) => (
                <DiffBlock key={i} diff={diff} />
              ))}
            </div>
          )}

          {/* Suggestion — amber box */}
          {test.suggestion && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.08em', color: '#B45309', marginBottom: 4 }}>
                Suggested next step
              </div>
              <p style={{ fontSize: 13, lineHeight: '1.55', color: '#78350F', margin: 0 }}>
                <CitationText text={test.suggestion} onCiteClick={onCiteClick} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
