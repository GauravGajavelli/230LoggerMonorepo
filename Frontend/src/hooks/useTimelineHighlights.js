import { useMemo } from 'react';

/**
 * Computes diff between two code strings using a simple line-based diff algorithm
 * Returns added lines (in new code) and deleted lines (from old code)
 */
function computeDiff(oldCode, newCode) {
  const oldLines = oldCode ? oldCode.split('\n') : [];
  const newLines = newCode ? newCode.split('\n') : [];

  // Build a set of old lines for quick lookup
  const oldLinesSet = new Set(oldLines.map(line => line.trim()));
  const newLinesSet = new Set(newLines.map(line => line.trim()));

  // Find added lines (in new but not in old)
  const addedLineNumbers = new Set();
  newLines.forEach((line, index) => {
    if (!oldLinesSet.has(line.trim()) && line.trim() !== '') {
      addedLineNumbers.add(index);
    }
  });

  // Find deleted lines with their approximate positions
  // We'll insert them where they would have appeared
  const deletedLines = [];
  let newIndex = 0;

  for (let oldIndex = 0; oldIndex < oldLines.length; oldIndex++) {
    const oldLine = oldLines[oldIndex];

    // Skip to matching line in new code if possible
    while (newIndex < newLines.length &&
           newLines[newIndex].trim() !== oldLine.trim()) {
      newIndex++;
    }

    if (!newLinesSet.has(oldLine.trim()) && oldLine.trim() !== '') {
      // This line was deleted - insert it at current position
      deletedLines.push({
        content: oldLine,
        insertAfterLine: newIndex > 0 ? newIndex - 1 : -1, // -1 means insert at beginning
        originalLineNumber: oldIndex + 1
      });
    } else if (newIndex < newLines.length) {
      newIndex++;
    }
  }

  return { addedLineNumbers, deletedLines };
}

/**
 * Hook to compute highlights for the timeline viewer
 * @param {string} previousCode - Code from previous snapshot
 * @param {string} currentCode - Code from current snapshot
 * @param {boolean} showDeleted - Whether to show deleted lines
 * @returns {Object} Highlight information
 */
export function useTimelineHighlights(previousCode, currentCode, showDeleted) {
  return useMemo(() => {
    const { addedLineNumbers, deletedLines } = computeDiff(previousCode, currentCode);

    // Build the merged lines array when showing deleted lines
    const currentLines = currentCode ? currentCode.split('\n') : [];

    let mergedLines = [];

    if (showDeleted && deletedLines.length > 0) {
      // Group deleted lines by insertion point
      const deletedByPosition = new Map();
      deletedLines.forEach(deleted => {
        const pos = deleted.insertAfterLine;
        if (!deletedByPosition.has(pos)) {
          deletedByPosition.set(pos, []);
        }
        deletedByPosition.get(pos).push(deleted);
      });

      // Insert at beginning if any
      if (deletedByPosition.has(-1)) {
        deletedByPosition.get(-1).forEach(deleted => {
          mergedLines.push({
            content: deleted.content,
            isDeleted: true,
            lineNumber: null
          });
        });
      }

      // Build merged array
      currentLines.forEach((line, index) => {
        mergedLines.push({
          content: line,
          isDeleted: false,
          isAdded: addedLineNumbers.has(index),
          lineNumber: index + 1
        });

        // Insert any deleted lines after this position
        if (deletedByPosition.has(index)) {
          deletedByPosition.get(index).forEach(deleted => {
            mergedLines.push({
              content: deleted.content,
              isDeleted: true,
              lineNumber: null
            });
          });
        }
      });
    } else {
      // No deleted lines shown - just mark added lines
      mergedLines = currentLines.map((line, index) => ({
        content: line,
        isDeleted: false,
        isAdded: addedLineNumbers.has(index),
        lineNumber: index + 1
      }));
    }

    return {
      mergedLines,
      addedCount: addedLineNumbers.size,
      deletedCount: deletedLines.length
    };
  }, [previousCode, currentCode, showDeleted]);
}
