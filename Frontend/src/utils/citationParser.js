// Matches: "run 45", "runs 45–55", "runs 47-48"
const RE = /\bruns?\s+(\d+)(?:\s*[–—\-]\s*(\d+))?/gi;

/**
 * Parses citation references from feedback text.
 * @param {string} text
 * @returns {Array<{type:'text'|'cite', content:string, startRun?:number, endRun?:number}>}
 */
export function parseCitations(text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  RE.lastIndex = 0;

  while ((match = RE.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const startRun = parseInt(match[1], 10);
    const endRun = match[2] ? parseInt(match[2], 10) : startRun;
    parts.push({ type: 'cite', content: match[0], startRun, endRun });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
}
