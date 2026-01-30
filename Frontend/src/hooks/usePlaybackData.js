import { useMemo } from 'react';
import { usePlaybackDataContext } from '../context/PlaybackDataContext';

/**
 * Hook to access playback data with convenient helpers
 *
 * @returns {Object} Playback data and helper functions
 */
export function usePlaybackData() {
  const context = usePlaybackDataContext();

  const helpers = useMemo(() => ({
    /**
     * Get test history for a specific test
     * @param {string} testId
     * @returns {import('../types').TestHistory | undefined}
     */
    getTestHistory: (testId) => context.testHistories.get(testId),

    /**
     * Get feedback for a specific test
     * @param {string} testId
     * @returns {import('../types').Feedback | undefined}
     */
    getFeedback: (testId) => context.feedbackMap.get(testId),

    /**
     * Get highlighted tests by category
     * @param {'stillFailing' | 'regressions' | 'costlyDetours'} category
     * @returns {import('../types').TestHistory[]}
     */
    getHighlightsByCategory: (category) => {
      const testIds = context.failureHighlights[category] || [];
      return testIds
        .map(id => context.testHistories.get(id))
        .filter(Boolean);
    },

    /**
     * Check if a test is highlighted
     * @param {string} testId
     * @returns {boolean}
     */
    isTestHighlighted: (testId) => {
      const { stillFailing, regressions, costlyDetours } = context.failureHighlights;
      return stillFailing.includes(testId) ||
             regressions.includes(testId) ||
             costlyDetours.includes(testId);
    },

    /**
     * Get the highlight category for a test
     * @param {string} testId
     * @returns {'stillFailing' | 'regression' | 'costlyDetour' | null}
     */
    getHighlightCategory: (testId) => {
      const { stillFailing, regressions, costlyDetours } = context.failureHighlights;
      if (stillFailing.includes(testId)) return 'stillFailing';
      if (regressions.includes(testId)) return 'regression';
      if (costlyDetours.includes(testId)) return 'costlyDetour';
      return null;
    },

    /**
     * Find the origin run for a test's current/latest failure
     * @param {string} testId
     * @returns {{ runNumber: number, episodeId: string, isRegression: boolean } | null}
     */
    findOrigin: (testId) => {
      const history = context.testHistories.get(testId);
      if (!history || history.failureIntervals.length === 0) return null;

      // For still-failing tests: find the most recent P->F (regression origin)
      // For others: use the latest interval's start
      const intervals = history.failureIntervals;

      if (history.isLingeringFailure) {
        // Find the last interval that was a regression
        const regressionIntervals = intervals.filter(i => i.isRegression);
        if (regressionIntervals.length > 0) {
          const origin = regressionIntervals[regressionIntervals.length - 1];
          // Find which episode contains this run
          const runData = context.allRuns.find(r => r.runNumber === origin.startRun);
          return {
            runNumber: origin.startRun,
            episodeId: runData?.episodeId || context.episodes[0]?.id,
            isRegression: true
          };
        }
      }

      // Default: most recent interval's start
      const latestInterval = intervals[intervals.length - 1];
      const runData = context.allRuns.find(r => r.runNumber === latestInterval.startRun);

      return {
        runNumber: latestInterval.startRun,
        episodeId: runData?.episodeId || context.episodes[0]?.id,
        isRegression: latestInterval.isRegression
      };
    },

    /**
     * Get total number of highlighted tests
     * @returns {number}
     */
    getTotalHighlights: () => {
      const { stillFailing, regressions, costlyDetours } = context.failureHighlights;
      return stillFailing.length + regressions.length + costlyDetours.length;
    },

    /**
     * Check if there are any highlights to show
     * @returns {boolean}
     */
    hasHighlights: () => {
      const { stillFailing, regressions, costlyDetours } = context.failureHighlights;
      return stillFailing.length > 0 || regressions.length > 0 || costlyDetours.length > 0;
    },

    /**
     * Get run data by global index
     * @param {number} globalIndex
     * @returns {Object | undefined}
     */
    getRunByIndex: (globalIndex) => context.allRuns[globalIndex],

    /**
     * Get run data by run number
     * @param {number} runNumber
     * @returns {Object | undefined}
     */
    getRunByNumber: (runNumber) => context.allRuns.find(r => r.runNumber === runNumber),

    /**
     * Get global index for a run number
     * @param {number} runNumber
     * @returns {number}
     */
    getGlobalIndexForRunNumber: (runNumber) => {
      const runData = context.allRuns.find(r => r.runNumber === runNumber);
      return runData?.globalIndex ?? 0;
    },

    /**
     * Get code snapshot for a specific run number
     * @param {number} runNumber
     * @returns {import('../types').CodeSnapshot | undefined}
     */
    getCodeSnapshot: (runNumber) => context.codeSnapshotsByRun.get(runNumber),

    /**
     * Get the closest code snapshot at or before a run number
     * (useful when a run doesn't have its own snapshot)
     * @param {number} runNumber
     * @returns {import('../types').CodeSnapshot | undefined}
     */
    getClosestCodeSnapshot: (runNumber) => {
      // First try exact match
      if (context.codeSnapshotsByRun.has(runNumber)) {
        return context.codeSnapshotsByRun.get(runNumber);
      }
      // Find the highest run number <= runNumber that has a snapshot
      let closest = undefined;
      let closestRun = -1;
      for (const [run, snapshot] of context.codeSnapshotsByRun) {
        if (run <= runNumber && run > closestRun) {
          closestRun = run;
          closest = snapshot;
        }
      }
      return closest;
    },

    /**
     * Check if code snapshots are available
     * @returns {boolean}
     */
    hasCodeSnapshots: () => context.codeSnapshotsByRun.size > 0
  }), [context]);

  return {
    // Raw data
    frontendData: context.frontendData,
    episodes: context.episodes,
    episodeTestData: context.episodeTestData,
    allRuns: context.allRuns,
    progressDataPoints: context.progressDataPoints,
    testHistories: context.testHistories,
    failureHighlights: context.failureHighlights,
    feedbackMap: context.feedbackMap,
    codeSnapshotsByRun: context.codeSnapshotsByRun,
    submissionContext: context.context,

    // State
    loading: context.loading,
    error: context.error,
    dataSource: context.dataSource,

    // Helpers
    ...helpers
  };
}

export default usePlaybackData;
