import { parseCitations } from '../utils/citationParser';

/**
 * Renders feedback text with inline clickable run-citation buttons.
 * @param {{ text: string, onCiteClick: (runNumber: number) => void }} props
 */
export function CitationText({ text, onCiteClick }) {
  const parts = parseCitations(text);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }
        return (
          <button
            key={i}
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
        );
      })}
    </span>
  );
}
