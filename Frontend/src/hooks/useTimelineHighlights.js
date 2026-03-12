import { useMemo } from 'react';

/**
 * Computes which lines in newCode are not present in oldCode (trimmed comparison).
 */
function computeAddedLines(oldCode, newCode) {
  const oldLines = oldCode ? oldCode.split('\n') : [];
  const newLines = newCode ? newCode.split('\n') : [];
  const oldSet = new Set(oldLines.map(l => l.trim()));

  const addedLineNumbers = new Set();
  newLines.forEach((line, index) => {
    if (!oldSet.has(line.trim()) && line.trim() !== '') {
      addedLineNumbers.add(index);
    }
  });

  return { addedLineNumbers, newLines };
}

/**
 * Hook to compute highlights for the timeline viewer.
 * Returns added-line information for the current snapshot diff.
 *
 * @param {string} previousCode - Code from previous snapshot
 * @param {string} currentCode - Code from current snapshot
 * @returns {{ mergedLines: Array, addedCount: number }}
 */
export function useTimelineHighlights(previousCode, currentCode) {
  return useMemo(() => {
    const { addedLineNumbers, newLines } = computeAddedLines(previousCode, currentCode);

    const mergedLines = newLines.map((line, index) => ({
      content: line,
      isAdded: addedLineNumbers.has(index),
      lineNumber: index + 1,
    }));

    return { mergedLines, addedCount: addedLineNumbers.size };
  }, [previousCode, currentCode]);
}
