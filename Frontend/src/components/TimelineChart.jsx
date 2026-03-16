/**
 * SVG polyline chart matching the wireframe: solid green for passing, dashed red for failing.
 * Dynamic Y-axis based on total test count.
 *
 * @param {{ data: Array<{time:string, passing:number, failing:number, event:string|null}> }} props
 */
export function TimelineChart({ data }) {
  if (!data || data.length === 0) return null;

  // viewBox coordinate space — SVG is rendered at width="100%" so it fills the card.
  // Increasing w gives more horizontal resolution when there are many data points.
  const h = 100, w = Math.max(520, data.length * 10), padY = 16, padX = 32;
  const totalTests = Math.max(...data.map(d => (d.passing || 0) + (d.failing || 0)), 1);
  const maxVal = Math.ceil(totalTests / 5) * 5; // round to nearest 5

  // With many data points, step can be 0 if only 1 point; guard
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;
  const y = (v) => padY + ((maxVal - v) / maxVal) * (h - padY * 2);

  const passingPts = data.map((d, i) => `${padX + i * stepX},${y(d.passing || 0)}`).join(' ');
  const failingPts = data.map((d, i) => `${padX + i * stepX},${y(d.failing || 0)}`).join(' ');

  // Grid lines: 0, half, max
  const gridVals = [0, Math.round(maxVal / 2), maxVal];

  // Show X labels every N runs to avoid crowding
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h + 38}`}
        style={{ display: 'block', width: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis title */}
        <text
          x={6} y={padY + (h - padY * 2) / 2}
          textAnchor="middle"
          transform={`rotate(-90, 6, ${padY + (h - padY * 2) / 2})`}
          fill="#94A3B8" fontSize="8"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="0.08em"
        >
          TESTS
        </text>

        {/* Grid lines */}
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padX} x2={w - padX} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth="1" />
            <text
              x={padX - 6} y={y(v) + 4} textAnchor="end"
              fill="#94A3B8" fontSize="10"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Passing line (solid green) */}
        {data.length > 1 && (
          <polyline points={passingPts} fill="none" stroke="#059669" strokeWidth="2" />
        )}

        {/* Failing line (dashed red) */}
        {data.length > 1 && (
          <polyline points={failingPts} fill="none" stroke="#DC2626" strokeWidth="2" strokeDasharray="4 3" />
        )}

        {/* Event dots */}
        {data.map((d, i) =>
          d.event ? (
            <circle
              key={i}
              cx={padX + i * stepX}
              cy={y(d.failing || 0)}
              r="5" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2"
              style={{ cursor: 'pointer' }}
            />
          ) : null
        )}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % labelEvery === 0 && d.time ? (
            <text
              key={i}
              x={padX + i * stepX}
              y={h + 18}
              textAnchor="middle"
              fill="#64748B"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {d.time}
            </text>
          ) : null
        )}

        {/* X-axis title */}
        <text
          x={w / 2} y={h + 36}
          textAnchor="middle"
          fill="#94A3B8" fontSize="8"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="0.06em"
        >
          SESSION TIME
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4, paddingLeft: padX }}>
        <span style={{ fontSize: 11, color: '#059669', fontFamily: "'IBM Plex Mono', monospace" }}>● Passing</span>
        <span style={{ fontSize: 11, color: '#DC2626', fontFamily: "'IBM Plex Mono', monospace" }}>╌ Failing</span>
        <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace" }}>● Status change</span>
      </div>
    </div>
  );
}
