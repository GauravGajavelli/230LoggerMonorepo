/**
 * Parse a Java stack trace into structured frames
 * @param {string} trace - The full stack trace string
 * @param {string[]} [userFiles=[]] - List of user file names to highlight
 * @returns {import('../types').StackFrame[]}
 */
export function parseStackTrace(trace, userFiles = []) {
  if (!trace) return [];

  const lines = trace.split('\n');
  const frames = [];
  let inErrorMessage = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for "Caused by:" lines
    if (trimmed.startsWith('Caused by:')) {
      inErrorMessage = false;
      frames.push({
        text: trimmed,
        type: 'causedBy',
        clickable: false
      });
      continue;
    }

    // Check for stack frame lines (start with "at ")
    if (trimmed.startsWith('at ')) {
      inErrorMessage = false;

      // Parse the frame: "at package.Class.method(File.java:123)"
      const match = trimmed.match(/at\s+(.+)\(([^:]+):(\d+)\)/);

      if (match) {
        const [, method, file, lineNum] = match;
        const isUserCode = userFiles.some(uf => file.includes(uf));

        frames.push({
          text: trimmed,
          type: isUserCode ? 'userCode' : 'external',
          file,
          line: parseInt(lineNum, 10),
          clickable: isUserCode
        });
      } else {
        // Frame without file/line info
        frames.push({
          text: trimmed,
          type: 'external',
          clickable: false
        });
      }
      continue;
    }

    // Check for "... X more" lines
    if (trimmed.match(/^\.\.\.\s+\d+\s+more$/)) {
      frames.push({
        text: trimmed,
        type: 'external',
        clickable: false
      });
      continue;
    }

    // Error message lines (before first "at " or "Caused by:")
    if (inErrorMessage) {
      frames.push({
        text: trimmed,
        type: 'error',
        clickable: false
      });
    }
  }

  return frames;
}
