import { useMemo, useCallback } from 'react';

/**
 * Hook for managing run selection within an episode
 *
 * When externalRunIndex is provided, this hook operates in "controlled" mode
 * where the parent component controls the selection via onRunChange callback.
 *
 * @param {string} currentEpisodeId - Current episode ID
 * @param {import('../types').TestRun[]} runs - Array of runs for the current episode
 * @param {number} [externalRunIndex] - External run index (for controlled mode)
 * @param {(runIndex: number) => void} [onRunChange] - Callback when run changes (for controlled mode)
 * @returns {Object} Run selection state and controls
 */
export function useRunSelection(currentEpisodeId, runs, externalRunIndex, onRunChange) {
  // Use external index if provided, otherwise default to latest (last) run
  const effectiveIndex = useMemo(() => {
    if (runs.length === 0) return 0;
    if (externalRunIndex !== undefined) {
      return Math.min(externalRunIndex, runs.length - 1);
    }
    return runs.length - 1; // Default to latest
  }, [externalRunIndex, runs.length]);

  const currentRun = runs[effectiveIndex] || null;
  const totalRuns = runs.length;

  const isFirstRun = effectiveIndex === 0;
  const isLatestRun = effectiveIndex === runs.length - 1;

  const stepRunForward = useCallback(() => {
    if (!isLatestRun && onRunChange) {
      onRunChange(effectiveIndex + 1);
    }
  }, [effectiveIndex, isLatestRun, onRunChange]);

  const stepRunBackward = useCallback(() => {
    if (!isFirstRun && onRunChange) {
      onRunChange(effectiveIndex - 1);
    }
  }, [effectiveIndex, isFirstRun, onRunChange]);

  const jumpToRun = useCallback((index) => {
    if (index >= 0 && index < runs.length && onRunChange) {
      onRunChange(index);
    }
  }, [runs.length, onRunChange]);

  const jumpToLatest = useCallback(() => {
    if (onRunChange) {
      onRunChange(runs.length - 1);
    }
  }, [runs.length, onRunChange]);

  return {
    selectedRunIndex: effectiveIndex,
    currentRun,
    totalRuns,
    isFirstRun,
    isLatestRun,
    stepRunForward,
    stepRunBackward,
    jumpToRun,
    jumpToLatest
  };
}
