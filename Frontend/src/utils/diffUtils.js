import { diffLines } from 'diff';

/**
 * Compute line-by-line diff between two code strings
 * @param {string} oldCode - Previous version
 * @param {string} newCode - Current version
 * @returns {Array} Array of diff objects with type and content
 */
export function computeLineDiff(oldCode, newCode) {
  if (!oldCode) {
    // First submission - all lines are "added"
    return newCode.split('\n').map((line, index) => ({
      type: 'added',
      content: line,
      lineNumber: index + 1,
      oldLineNumber: null,
      newLineNumber: index + 1
    }));
  }

  const changes = diffLines(oldCode, newCode);
  const result = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    // Remove last empty element if the string ends with newline
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    for (const line of lines) {
      if (change.added) {
        result.push({
          type: 'added',
          content: line,
          oldLineNumber: null,
          newLineNumber: newLineNum++
        });
      } else if (change.removed) {
        result.push({
          type: 'removed',
          content: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: null
        });
      } else {
        result.push({
          type: 'unchanged',
          content: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++
        });
      }
    }
  }

  return result;
}

/**
 * Get statistics about the diff
 */
export function getDiffStats(diffResult) {
  const added = diffResult.filter(d => d.type === 'added').length;
  const removed = diffResult.filter(d => d.type === 'removed').length;
  const unchanged = diffResult.filter(d => d.type === 'unchanged').length;

  return { added, removed, unchanged, total: added + removed + unchanged };
}

/**
 * Create a unified diff view (both sides aligned)
 */
export function createUnifiedDiff(oldCode, newCode) {
  const diff = computeLineDiff(oldCode, newCode);
  
  // Group consecutive changes
  const hunks = [];
  let currentHunk = [];
  let lastType = null;
  
  for (const line of diff) {
    if (line.type !== lastType && currentHunk.length > 0) {
      hunks.push([...currentHunk]);
      currentHunk = [];
    }
    currentHunk.push(line);
    lastType = line.type;
  }
  
  if (currentHunk.length > 0) {
    hunks.push(currentHunk);
  }
  
  return hunks;
}

/**
 * Create split view data (left = old, right = new)
 */
export function createSplitDiff(oldCode, newCode) {
  if (!oldCode) {
    const newLines = newCode.split('\n');
    return {
      left: newLines.map(() => ({ content: '', type: 'empty', lineNumber: null })),
      right: newLines.map((content, i) => ({ content, type: 'added', lineNumber: i + 1 }))
    };
  }

  const diff = computeLineDiff(oldCode, newCode);
  const left = [];
  const right = [];
  
  let leftLine = 1;
  let rightLine = 1;
  
  // Process diff and align lines
  let i = 0;
  while (i < diff.length) {
    const item = diff[i];
    
    if (item.type === 'unchanged') {
      left.push({ content: item.content, type: 'unchanged', lineNumber: leftLine++ });
      right.push({ content: item.content, type: 'unchanged', lineNumber: rightLine++ });
      i++;
    } else if (item.type === 'removed') {
      // Collect consecutive removed lines
      const removedLines = [];
      while (i < diff.length && diff[i].type === 'removed') {
        removedLines.push(diff[i]);
        i++;
      }
      
      // Collect consecutive added lines
      const addedLines = [];
      while (i < diff.length && diff[i].type === 'added') {
        addedLines.push(diff[i]);
        i++;
      }
      
      // Pair them up
      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < maxLen; j++) {
        if (j < removedLines.length) {
          left.push({ content: removedLines[j].content, type: 'removed', lineNumber: leftLine++ });
        } else {
          left.push({ content: '', type: 'empty', lineNumber: null });
        }
        
        if (j < addedLines.length) {
          right.push({ content: addedLines[j].content, type: 'added', lineNumber: rightLine++ });
        } else {
          right.push({ content: '', type: 'empty', lineNumber: null });
        }
      }
    } else if (item.type === 'added') {
      left.push({ content: '', type: 'empty', lineNumber: null });
      right.push({ content: item.content, type: 'added', lineNumber: rightLine++ });
      i++;
    }
  }
  
  return { left, right };
}
