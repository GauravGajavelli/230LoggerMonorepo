/**
 * Adapter to convert mock data format to FrontendOutput shape.
 * This allows the app to work with mock data during development
 * while using the same data interface as real pipeline output.
 */

import {
  mockContext,
  mockEpisodes,
  mockTestResults,
  mockFeedback,
  getAllRunsFlat
} from '../data/playbackMockData';

/**
 * Convert mock episodes to FrontendOutput episode format
 * @returns {import('../types').Episode[]}
 */
function convertEpisodes() {
  return mockEpisodes.map(ep => ({
    id: ep.id,
    startTime: new Date(ep.startTime * 1000).toISOString(),
    endTime: new Date(ep.endTime * 1000).toISOString(),
    label: ep.label,
    dominantCategory: 'MockCategory'
  }));
}

/**
 * Convert mock test results to episodeTestData format
 * @returns {import('../types').EpisodeTestData[]}
 */
function convertEpisodeTestData() {
  const episodeTestData = [];
  let globalRunNumber = 1;  // Track global run number across episodes

  mockTestResults.forEach((data, episodeId) => {
    const runs = data.runs.map((run) => {
      const runData = {
        runNumber: globalRunNumber,  // Use global numbering
        timestamp: run.timestamp.toISOString(),
        summary: {
          total: run.summary.total,
          passed: run.summary.passed,
          failed: run.summary.failed,
          errored: 0,
          skipped: 0
        },
        results: run.results.map(r => ({
          id: r.id,
          name: r.name,
          status: r.status,
          changedThisRun: r.changedThisRun,
          previousStatus: r.previousStatus,
          errorMessage: r.errorMessage,
          stackTrace: r.stackTrace,
          durationMs: 0
        }))
      };
      globalRunNumber++;  // Increment for next run
      return runData;
    });

    episodeTestData.push({
      episodeId,
      runs
    });
  });

  return episodeTestData;
}

/**
 * Build test histories from mock data
 * @returns {import('../types').TestHistory[]}
 */
function buildTestHistories() {
  const flatRuns = getAllRunsFlat();
  const totalRuns = flatRuns.length;
  const historiesMap = new Map();

  // Build status by run for each test
  flatRuns.forEach((runData, globalIndex) => {
    const runNumber = globalIndex + 1; // 1-indexed run numbers

    runData.run.results.forEach(result => {
      if (!historiesMap.has(result.id)) {
        historiesMap.set(result.id, {
          testId: result.id,
          testName: result.name,
          statusByRun: {},
          failureIntervals: [],
          isLingeringFailure: false,
          isRegression: false,
          recursCount: 0,
          flipsWithin: 0,
          totalFailedRuns: 0,
          meaningfulnessScore: 0,
          highlightCategory: null
        });
      }
      historiesMap.get(result.id).statusByRun[runNumber] = result.status;
    });
  });

  // Compute failure intervals and other metrics for each test
  historiesMap.forEach(history => {
    const runNumbers = Object.keys(history.statusByRun)
      .map(Number)
      .sort((a, b) => a - b);

    let currentInterval = null;
    let prevStatus = null;

    runNumbers.forEach(runNumber => {
      const status = history.statusByRun[runNumber];
      const isFailing = status === 'fail' || status === 'error';

      if (isFailing && !currentInterval) {
        currentInterval = {
          startRun: runNumber,
          endRun: null,
          duration: 1,
          isLingering: false,
          isRegression: prevStatus === 'pass'
        };
        if (currentInterval.isRegression) {
          history.isRegression = true;
        }
      } else if (isFailing && currentInterval) {
        currentInterval.duration++;
      } else if (!isFailing && currentInterval) {
        currentInterval.endRun = runNumber - 1;
        history.failureIntervals.push(currentInterval);
        currentInterval = null;
      }

      // Track status flips
      if (prevStatus !== null && prevStatus !== status) {
        const wasFailingBefore = prevStatus === 'fail' || prevStatus === 'error';
        const isFailingNow = isFailing;
        if (wasFailingBefore !== isFailingNow) {
          history.flipsWithin++;
        }
      }

      if (isFailing) {
        history.totalFailedRuns++;
      }

      prevStatus = status;
    });

    // Handle lingering failure (still failing at end)
    if (currentInterval) {
      currentInterval.isLingering = true;
      history.failureIntervals.push(currentInterval);
      history.isLingeringFailure = true;
    }

    // Compute derived metrics
    history.recursCount = history.failureIntervals.length;

    // Compute meaningfulness score (simplified version)
    // Higher score = more meaningful to highlight
    let score = 0;

    if (history.isLingeringFailure) {
      score += 100; // Lingering failures are critical
    }

    if (history.recursCount > 1) {
      score += 50 * (history.recursCount - 1); // Recurring issues
    }

    // Longest failure duration
    const maxDuration = Math.max(...history.failureIntervals.map(i => i.duration), 0);
    score += maxDuration * 10;

    // Penalize quick detours (fixed in 1-2 runs)
    if (!history.isLingeringFailure && maxDuration <= 2 && history.recursCount === 1) {
      score -= 50;
    }

    history.meaningfulnessScore = score;

    // Assign highlight category
    if (history.isLingeringFailure) {
      history.highlightCategory = 'stillFailing';
    } else if (history.recursCount > 1) {
      history.highlightCategory = 'regression';
    } else if (history.failureIntervals.length > 0) {
      // Only flag as costlyDetour if it was a REGRESSION that took long to fix
      const interval = history.failureIntervals[0];
      if (interval.isRegression && interval.duration > 3) {
        history.highlightCategory = 'costlyDetour';
      }
    }
  });

  return Array.from(historiesMap.values());
}

/**
 * Build failure highlights from test histories
 * @param {import('../types').TestHistory[]} testHistories
 * @returns {import('../types').FailureHighlights}
 */
function buildFailureHighlights(testHistories) {
  const stillFailing = testHistories
    .filter(h => h.highlightCategory === 'stillFailing')
    .map(h => h.testId);

  const regressions = testHistories
    .filter(h => h.highlightCategory === 'regression')
    .sort((a, b) => b.meaningfulnessScore - a.meaningfulnessScore)
    .slice(0, 3)
    .map(h => h.testId);

  const costlyDetours = testHistories
    .filter(h => h.highlightCategory === 'costlyDetour')
    .sort((a, b) => b.meaningfulnessScore - a.meaningfulnessScore)
    .slice(0, 2)
    .map(h => h.testId);

  return {
    stillFailing,
    regressions,
    costlyDetours
  };
}

/**
 * Convert mock feedback to array format
 * @returns {import('../types').Feedback[]}
 */
function convertFeedback() {
  const feedbackArray = [];
  mockFeedback.forEach((feedback, testId) => {
    feedbackArray.push(feedback);
  });
  return feedbackArray;
}

/**
 * Convert all mock data to FrontendOutput format
 * @returns {import('../types').FrontendOutput}
 */
export function convertMockToFrontendOutput() {
  const testHistories = buildTestHistories();
  const failureHighlights = buildFailureHighlights(testHistories);

  return {
    context: {
      ...mockContext,
      submittedAt: mockContext.submittedAt,  // Keep as Date object
      repoRoot: '/mock/repo'
    },
    episodes: convertEpisodes(),
    episodeTestData: convertEpisodeTestData(),
    feedback: convertFeedback(),
    testHistories,
    failureHighlights
  };
}

/**
 * Get a flat list of all runs with global indices from FrontendOutput
 * @param {import('../types').FrontendOutput} frontendData
 * @returns {Array<{episodeId: string, episodeIndex: number, run: Object, globalIndex: number, runNumber: number}>}
 */
export function getAllRunsFlatFromFrontendOutput(frontendData) {
  const flatRuns = [];

  frontendData.episodes.forEach((episode, episodeIndex) => {
    const episodeData = frontendData.episodeTestData.find(d => d.episodeId === episode.id);
    if (!episodeData) return;

    episodeData.runs.forEach((run) => {
      flatRuns.push({
        episodeId: episode.id,
        episodeIndex,
        run: {
          ...run,
          runId: `${episode.id}-run-${run.runNumber}`,
          runIndex: run.runNumber - 1, // Convert to 0-indexed for compatibility
          timestamp: new Date(run.timestamp),
          results: run.results,
          summary: {
            passed: run.summary.passed,
            failed: run.summary.failed + run.summary.errored,
            total: run.summary.total
          }
        },
        globalIndex: flatRuns.length,
        runNumber: run.runNumber
      });
    });
  });

  return flatRuns;
}

/**
 * Get progress data points from FrontendOutput
 * @param {import('../types').FrontendOutput} frontendData
 * @returns {import('../types').RunProgressDataPoint[]}
 */
export function getProgressDataPointsFromFrontendOutput(frontendData) {
  const flatRuns = getAllRunsFlatFromFrontendOutput(frontendData);

  return flatRuns.map(runData => {
    const episode = frontendData.episodes.find(ep => ep.id === runData.episodeId);
    return {
      episodeId: runData.episodeId,
      runId: runData.run.runId,
      runIndex: runData.run.runIndex,
      label: episode?.label || runData.episodeId,
      passCount: runData.run.summary.passed,
      totalTests: runData.run.summary.total
    };
  });
}
