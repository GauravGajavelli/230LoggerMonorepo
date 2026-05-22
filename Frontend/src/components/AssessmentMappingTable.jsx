import { useState, useEffect } from 'react';

export function AssessmentMappingTable({ reportUrl }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!reportUrl) return;
    fetch(reportUrl)
      .then(r => r.json())
      .then(setReport)
      .catch(() => {});
  }, [reportUrl]);

  const assessments = (report?.assessments || []).filter(a => a.overlap_pct > 0 || a.drill_count > 0);
  if (!assessments.length) return null;

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '10px 16px', marginTop: 12, marginBottom: 4,
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: '#94A3B8', marginBottom: 8,
      }}>
        Assessment Mapping
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {assessments.map(a => (
          <AssessmentChip key={a.id} assessment={a} />
        ))}
      </div>
    </div>
  );
}

function AssessmentChip({ assessment: a }) {
  const [hover, setHover] = useState(false);
  const drills = a.drills || [];
  const uncovered = a.uncovered_concepts || [];
  const color = a.overlap_pct >= 60 ? '#800000' : a.overlap_pct >= 30 ? '#B45309' : '#94A3B8';

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6,
        padding: '4px 10px', cursor: drills.length > 0 ? 'default' : undefined,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
          {a.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {a.overlap_pct}%
        </span>
        <span style={{
          fontSize: 10, color: '#64748B',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {a.drill_count} drill{a.drill_count !== 1 ? 's' : ''}
        </span>
      </div>

      {hover && drills.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '10px 12px', minWidth: 260, maxWidth: 380,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 6,
          }}>
            {a.name}
            {a.date_display && (
              <span style={{
                fontWeight: 400, color: '#94A3B8', marginLeft: 6,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              }}>
                {a.date_display}
              </span>
            )}
          </div>
          {drills.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              marginBottom: 4, paddingLeft: 2,
            }}>
              <span style={{ fontSize: 11, color: '#334155', flex: 1 }}>{d.pattern_name}</span>
              {d.weight_pct > 0 && (
                <span style={{
                  fontSize: 10, color: '#64748B', flexShrink: 0,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>
                  {d.weight_pct}%
                </span>
              )}
            </div>
          ))}
          {uncovered.length > 0 && (
            <div style={{
              fontSize: 10, color: '#94A3B8', marginTop: 4,
              borderTop: '1px solid #F1F5F9', paddingTop: 4,
            }}>
              Not covered: {uncovered.map(c => `${c.name} (${c.weight_pct}%)`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
