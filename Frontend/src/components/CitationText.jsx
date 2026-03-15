import { useState } from 'react';
import { parseCitations } from '../utils/citationParser';

/**
 * Renders feedback text with inline clickable run-citation buttons.
 * When runToEpisode is provided, hovering a citation shows a tooltip with the
 * episode number and outcome (e.g. "Episode 3 · testRemove went from failing to passing").
 *
 * @param {{
 *   text: string,
 *   onCiteClick: (startRun: number, endRun: number) => void,
 *   runToEpisode?: Record<number, { idx: number, ep: object }>,
 * }} props
 */
export function CitationText({ text, onCiteClick, runToEpisode = {} }) {
  const parts = parseCitations(text);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }

        // Look up episode for the startRun of this citation
        const epInfo = runToEpisode[part.startRun];
        const tooltip = epInfo
          ? `Episode ${epInfo.idx}${epInfo.ep.outcome ? ' · ' + epInfo.ep.outcome : ''}`
          : null;

        return (
          <span
            key={i}
            style={{ position: 'relative', display: 'inline' }}
            onMouseEnter={() => tooltip && setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <button
              onClick={() => onCiteClick(part.startRun, part.endRun)}
              style={{
                fontFamily: 'monospace',
                color: '#800000',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                fontSize: 'inherit',
                lineHeight: 'inherit',
              }}
            >
              {part.content}
            </button>
            {tooltip && hoveredIdx === i && (
              <span style={{
                position: 'absolute',
                bottom: 'calc(100% + 4px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1E293B',
                color: '#F8FAFC',
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                {tooltip}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
