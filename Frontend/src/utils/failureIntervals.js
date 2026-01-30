/**
 * Failure interval utilities for consuming pre-computed data from the pipeline.
 *
 * The pipeline (StatusChangeTracker.java) computes all failure intervals, scores,
 * and classifications. This module provides thin wrappers to access that data.
 */

import { getAllRunsFlat } from '../data/playbackMockData';

/**
 * Get test histories as a Map from frontend data
 * @param {import('../types').FrontendOutput} frontendData - The frontend.json data
 * @returns {Map<string, import('../types').TestHistory>}
 */
export function getTestHistoriesFromData(frontendData) {
  if (!frontendData?.testHistories) {
    return new Map();
  }
  return new Map(
    frontendData.testHistories.map(h => [h.testId, h])
  );
}

/**
 * Get failure highlights from frontend data
 * @param {import('../types').FrontendOutput} frontendData - The frontend.json data
 * @returns {import('../types').FailureHighlights}
 */
export function getFailureHighlightsFromData(frontendData) {
  return frontendData?.failureHighlights || {
    stillFailing: [],
    regressions: [],
    costlyDetours: []
  };
}

/**
 * Get a specific test's history from frontend data
 * @param {import('../types').FrontendOutput} frontendData - The frontend.json data
 * @param {string} testId
 * @returns {import('../types').TestHistory | undefined}
 */
export function getTestHistoryFromData(frontendData, testId) {
  return frontendData?.testHistories?.find(h => h.testId === testId);
}

/**
 * Get test histories by highlight category from frontend data
 * @param {import('../types').FrontendOutput} frontendData - The frontend.json data
 * @param {'stillFailing' | 'regression' | 'costlyDetour'} category
 * @returns {import('../types').TestHistory[]}
 */
export function getTestHistoriesByCategory(frontendData, category) {
  const highlights = getFailureHighlightsFromData(frontendData);
  const testIds = highlights[category === 'regression' ? 'regressions' :
                             category === 'costlyDetour' ? 'costlyDetours' :
                             'stillFailing'] || [];

  return testIds
    .map(id => getTestHistoryFromData(frontendData, id))
    .filter(Boolean);
}

/**
 * Get tests sorted by meaningfulness score
 * @param {import('../types').FrontendOutput} frontendData - The frontend.json data
 * @returns {import('../types').TestHistory[]}
 */
export function getTestHistoriesByScore(frontendData) {
  if (!frontendData?.testHistories) {
    return [];
  }
  return [...frontendData.testHistories]
    .filter(h => h.meaningfulnessScore > 0)
    .sort((a, b) => b.meaningfulnessScore - a.meaningfulnessScore);
}

// =============================================================================
// LEGACY FUNCTIONS - For backwards compatibility with mock data
// These compute from mock data when frontend.json is not available
// =============================================================================

/**
 * Detect failure intervals from a test's status history (legacy)
 * @param {{ statusByRun: string[] }} history
 * @param {number} totalRuns
 * @returns {Array<{ startRunIndex: number, endRunIndex: number, duration: number, isLingering: boolean, isRegression: boolean }>}
 */
function detectFailureIntervals(history, totalRuns) {
  const intervals = [];
  let currentInterval = null;

  for (let i = 0; i < totalRuns; i++) {
    const status = history.statusByRun[i];
    const isFailing = status === 'fail' || status === 'error';

    if (isFailing && !currentInterval) {
      const prevStatus = i > 0 ? history.statusByRun[i - 1] : null;
      currentInterval = {
        startRunIndex: i,
        endRunIndex: -1,
        duration: 1,
        isLingering: false,
        isRegression: prevStatus === 'pass'
      };
    } else if (isFailing && currentInterval) {
      currentInterval.duration++;
    } else if (!isFailing && currentInterval) {
      currentInterval.endRunIndex = i - 1;
      intervals.push(currentInterval);
      currentInterval = null;
    }
  }

  if (currentInterval) {
    currentInterval.endRunIndex = totalRuns - 1;
    currentInterval.isLingering = true;
    intervals.push(currentInterval);
  }

  return intervals;
}

/**
 * Classify test histories into highlight categories (legacy)
 * @param {Map<string, Object>} histories
 * @returns {{ stillFailing: Object[], regressions: Object[], costlyDetours: Object[] }}
 */
function classifyFailures(histories) {
  const stillFailing = [];
  const regressions = [];
  const costlyDetours = [];

  histories.forEach(history => {
    if (history.finalStatus === 'fail' || history.finalStatus === 'error') {
      stillFailing.push(history);
    }

    if (history.failureIntervals.length > 1) {
      regressions.push(history);
    }

    if (history.failureIntervals.length > 0) {
      const firstInterval = history.failureIntervals[0];
      // Only a costly detour if it's a regression that took long to fix
      if (history.finalStatus === 'pass' &&
          firstInterval.isRegression &&
          firstInterval.duration > 3) {
        costlyDetours.push(history);
      }
    }
  });

  return { stillFailing, regressions, costlyDetours };
}

/**
 * Build test histories from mock data (legacy - for when frontend.json is unavailable)
 * @returns {Map<string, Object>}
 */
export function buildTestHistories() {
  const flatRuns = getAllRunsFlat();
  const totalRuns = flatRuns.length;
  const histories = new Map();

  flatRuns.forEach((runData, globalIndex) => {
    runData.run.results.forEach(result => {
      if (!histories.has(result.id)) {
        histories.set(result.id, {
          testId: result.id,
          testName: result.name,
          statusByRun: new Array(totalRuns).fill(null),
          failureIntervals: [],
          finalStatus: 'pass',
          hasRegression: false,
          isFlaky: false,
          totalFailedRuns: 0
        });
      }
      histories.get(result.id).statusByRun[globalIndex] = result.status;
    });
  });

  histories.forEach(history => {
    history.failureIntervals = detectFailureIntervals(history, totalRuns);
    history.finalStatus = history.statusByRun[totalRuns - 1] || 'pass';
    history.hasRegression = history.failureIntervals.some(i => i.isRegression);
    history.isFlaky = history.failureIntervals.length > 1;
    history.totalFailedRuns = history.statusByRun.filter(
      s => s === 'fail' || s === 'error'
    ).length;
  });

  return histories;
}

/**
 * Get classified highlights from mock data (legacy)
 * @returns {{ stillFailing: Object[], regressions: Object[], costlyDetours: Object[] }}
 */
export function getFailureHighlights() {
  const histories = buildTestHistories();
  return classifyFailures(histories);
}

/**
 * Get history for a specific test from mock data (legacy)
 * @param {string} testId
 * @returns {Object | undefined}
 */
export function getTestHistory(testId) {
  const histories = buildTestHistories();
  return histories.get(testId);
}

/**
 * Find the introduction run for a test's current/latest failure (legacy)
 * @param {string} testId
 * @returns {{ runIndex: number, episodeId: string } | null}
 */
export function findFailureIntroduction(testId) {
  const history = getTestHistory(testId);
  if (!history || history.failureIntervals.length === 0) return null;

  const latestInterval = history.failureIntervals[history.failureIntervals.length - 1];
  const flatRuns = getAllRunsFlat();
  const runData = flatRuns[latestInterval.startRunIndex];

  return {
    runIndex: latestInterval.startRunIndex,
    episodeId: runData.episodeId
  };
}
