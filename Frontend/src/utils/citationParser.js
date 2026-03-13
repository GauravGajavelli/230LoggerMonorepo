// Matches:
//   "run 45"
//   "runs 45–55" / "runs 47-48"
//   "runs 46, 49, 51, and 52"  (comma-separated list, optional "and" before last item)
const RE = /\bruns?\s+\d+(?:(?:\s*,\s*(?:and\s+)?\d+)+|\s*[–—\-]\s*\d+)?/gi;

/**
 * Parses citation references from feedback text.
 * Handles single runs, ranges, and comma-separated lists.
 * For lists/ranges, startRun = min of all cited runs, endRun = max.
 * @param {string} text
 * @returns {Array<{type:'text'|'cite', content:string, startRun?:number, endRun?:number}>}
 */
export function parseCitations(text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;

  RE.lastIndex = 0;

  let match;
  while ((match = RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Extract every number from the matched text (works for single, range, and list)
    const nums = [...match[0].matchAll(/\d+/g)].map(m => parseInt(m[0], 10));
    const startRun = Math.min(...nums);
    const endRun   = Math.max(...nums);
    parts.push({ type: 'cite', content: match[0], startRun, endRun });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
}
