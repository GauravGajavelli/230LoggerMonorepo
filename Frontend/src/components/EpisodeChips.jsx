import { epColor } from '../utils/episodeColors';

/**
 * Horizontal row of episode chips — wireframe style.
 * Regression = red, fix = blue, null = neutral grey.
 *
 * @param {{
 *   episodes: Array<{id:string, timeRange:string, edits:number, area:string,
 *                    outcome:string, outcomeType:string|null, linkedTestId:string|null}>,
 *   onJump: (episode: object) => void
 * }} props
 */
export function EpisodeChips({ episodes, onJump }) {
  if (!episodes || episodes.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {episodes.map((ep, index) => {
        const isRegression = ep.outcomeType === 'regression';
        const isFix = ep.outcomeType === 'fix';
        const bg = isRegression ? '#FEF2F2' : isFix ? '#EFF6FF' : '#F8FAFC';
        const border = isRegression ? '#FECACA' : isFix ? '#BFDBFE' : '#E2E8F0';
        const color = isRegression ? '#991B1B' : isFix ? '#1E40AF' : '#64748B';
        const borderHover = isRegression ? '#FCA5A5' : isFix ? '#93C5FD' : '#CBD5E1';
        const areaLabel =
          ep.semantics?.conceptsAddressed?.[0]
          || ep.area
          || ep.label
          || ep.id;
        const dotColor = epColor(index);

        return (
          <button
            key={ep.id}
            onClick={() => onJump(ep)}
            style={{
              all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px 4px 7px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              background: bg, border: `1px solid ${border}`, color,
              transition: 'box-shadow .12s, border-color .12s', lineHeight: 1.3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.08)';
              e.currentTarget.style.borderColor = borderHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = border;
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dotColor, flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ color: dotColor, fontWeight: 600 }}>{index + 1}</span>
            <span style={{ color: isRegression ? '#DC2626' : isFix ? '#2563EB' : '#94A3B8', fontWeight: 500 }}>·</span>
            <span style={{ fontWeight: 500 }}>{areaLabel}</span>
            {ep.hasFeedback && (ep.feedbackOpened
              ? <span className="feedback-seen" title="Feedback reviewed">✓</span>
              : <span className="feedback-unseen-chip" title="Has feedback" />
            )}
          </button>
        );
      })}
    </div>
  );
}
