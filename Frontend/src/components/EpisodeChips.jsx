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
export function EpisodeChips({ episodes, onJump, testNameById = {} }) {
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
        const linkedTestName = ep.linkedTestId ? testNameById[ep.linkedTestId] : null;

        // For feedback chips, label is the test name (what the chip navigates to).
        // For non-feedback chips, label is the episode concept (what was being worked on).
        const areaLabel = (ep.hasFeedback && linkedTestName)
          ? linkedTestName.replace(/\(\)$/, '').replace(/^test/, '')
          : (ep.semantics?.conceptsAddressed?.[0] || ep.area || ep.label || ep.id);
        const dotColor = epColor(index);

        return (
          <button
            key={ep.id}
            onClick={() => onJump(ep)}
            style={{
              all: 'unset', display: 'inline-flex', flexDirection: 'column',
              padding: '4px 10px 4px 7px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              background: bg, border: `1px solid ${border}`, color,
              transition: 'box-shadow .12s, border-color .12s', lineHeight: 1.3,
              maxWidth: 260,
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
            {/* Line 1: number · area label  [feedback dot] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: dotColor, flexShrink: 0, display: 'inline-block',
              }} />
              <span style={{ color: dotColor, fontWeight: 600, flexShrink: 0 }}>{index + 1}</span>
              <span style={{ color: isRegression ? '#DC2626' : isFix ? '#2563EB' : '#94A3B8', fontWeight: 500, flexShrink: 0 }}>·</span>
              <span style={{
                fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
              }}>{areaLabel}</span>
              {ep.hasFeedback && !ep.feedbackOpened && <span className="feedback-unseen-chip" style={{ marginLeft: 2, flexShrink: 0 }} title="Unread feedback" />}
            </div>
            {/* Line 2: → linked test name (only for non-feedback chips; feedback chips use it as the primary label) */}
            {linkedTestName && !ep.hasFeedback && (
              <div style={{ paddingLeft: 13, marginTop: 2, overflow: 'hidden' }}>
                <span style={{
                  color: '#94A3B8', fontSize: 10,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>
                  → {linkedTestName}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
