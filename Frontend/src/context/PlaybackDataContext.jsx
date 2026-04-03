import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  convertMockToFrontendOutput,
  getAllRunsFlatFromFrontendOutput,
  getProgressDataPointsFromFrontendOutput
} from '../utils/mockDataAdapter';
import {
  getTestHistoriesFromData,
  getFailureHighlightsFromData
} from '../utils/failureIntervals';
import { formatShortTime } from '../utils/formatUtils';

/**
 * @typedef {Object} PlaybackDataContextValue
 * @property {import('../types').FrontendOutput | null} frontendData - Raw FrontendOutput from pipeline
 * @property {import('../types').Episode[]} episodes - All episodes
 * @property {import('../types').EpisodeTestData[]} episodeTestData - Test data per episode
 * @property {Array} allRuns - Flat list of all runs with global indices
 * @property {import('../types').RunProgressDataPoint[]} progressDataPoints - Progress chart data
 * @property {Map<string, import('../types').TestHistory>} testHistories - Map of test ID to history
 * @property {import('../types').FailureHighlights} failureHighlights - Categorized failure highlights
 * @property {Map<string, import('../types').Feedback>} feedbackMap - Map of test ID to feedback
 * @property {Map<number, import('../types').CodeSnapshot>} codeSnapshotsByRun - Map of run number to code snapshot
 * @property {import('../types').SubmissionContext | null} context - Submission context info
 * @property {boolean} loading - Whether data is loading
 * @property {Error | null} error - Error if data loading failed
 * @property {'mock' | 'api' | 'file'} dataSource - Current data source
 */

const PlaybackDataContext = createContext(/** @type {PlaybackDataContextValue | null} */ (null));

// Sentinel: API returned an error response (no_data / processing / processing_error)
// exposed as apiError = { error, message, allowUpload? } | null

/**
 * Provider component for playback data
 * In development, uses mock data. In production, can fetch from API.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.submissionId] - Optional submission ID for API mode
 * @param {boolean} [props.useMock=true] - Force mock mode even if submissionId provided
 * @param {string} [props.jsonUrl] - Optional URL to load JSON data from (e.g., "/data/frontend.json")
 * @param {string} [props.assessmentConfigUrl] - Optional URL to load assessment-config.json from
 */
export function PlaybackDataProvider({ children, submissionId, useMock = true, jsonUrl, assessmentConfigUrl }) {
  const [frontendData, setFrontendData] = useState(null);
  const [assessmentConfig, setAssessmentConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [dataSource, setDataSource] = useState('mock');

  // Load data on mount or when submissionId changes
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (jsonUrl) {
          // Load from URL (static JSON file in dev, or /api/data?token=... in prod)
          const response = await fetch(jsonUrl);
          if (!response.ok) {
            throw new Error(`Failed to load data: ${response.statusText}`);
          }
          const data = await response.json();
          // API may return an error object instead of real feedback data
          if (data.error) {
            setApiError(data);
            setFrontendData(null);
            setDataSource('api');
            return;
          }
          setApiError(null);
          setFrontendData(data);
          setDataSource('file');
        } else if (useMock || !submissionId) {
          // Use mock data
          const mockData = convertMockToFrontendOutput();
          setFrontendData(mockData);
          setDataSource('mock');
        } else {
          // Fetch from API (future implementation)
          const response = await fetch(`/api/submissions/${submissionId}/frontend.json`);
          if (!response.ok) {
            throw new Error(`Failed to load data: ${response.statusText}`);
          }
          const data = await response.json();
          setFrontendData(data);
          setDataSource('api');
        }
      } catch (err) {
        console.error('Error loading playback data:', err);
        setError(err);

        // Only fall back to mock data when in dev/mock mode (no jsonUrl)
        if (!jsonUrl) {
          try {
            const mockData = convertMockToFrontendOutput();
            setFrontendData(mockData);
            setDataSource('mock');
          } catch (mockErr) {
            console.error('Error loading mock data:', mockErr);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [submissionId, useMock, jsonUrl]);

  // Fetch assessment config independently — non-blocking, best-effort
  useEffect(() => {
    if (!assessmentConfigUrl) return;
    fetch(assessmentConfigUrl)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.assessments) setAssessmentConfig(data); })
      .catch(() => {});
  }, [assessmentConfigUrl]);

  // Derive data from frontendData
  const derivedData = useMemo(() => {
    if (!frontendData) {
      return {
        episodes: [],
        episodeTestData: [],
        allRuns: [],
        progressDataPoints: [],
        testHistories: new Map(),
        failureHighlights: { stillFailing: [], regressions: [], costlyDetours: [] },
        feedbackMap: new Map(),
        codeSnapshotsByRun: new Map(),
        context: null,
        detailTests: [],
        detailSummary: { failing: 0, improved: 0, passing: 0, total: 0 },
        runToEpisode: {},
      };
    }

    const allRuns = getAllRunsFlatFromFrontendOutput(frontendData);
    const progressDataPoints = getProgressDataPointsFromFrontendOutput(frontendData);
    const testHistories = getTestHistoriesFromData(frontendData);

    // Build failure highlights - use from data if available, otherwise compute
    const failureHighlights = frontendData.failureHighlights ||
      getFailureHighlightsFromData(frontendData);

    // Build feedback map
    const feedbackMap = new Map();
    if (frontendData.feedback) {
      frontendData.feedback.forEach(fb => {
        feedbackMap.set(fb.testId, fb);
      });
    }

    // Build code snapshots map (runNumber -> CodeSnapshot)
    const codeSnapshotsByRun = new Map();
    if (frontendData.codeSnapshots) {
      frontendData.codeSnapshots.forEach(snapshot => {
        codeSnapshotsByRun.set(snapshot.runNumber, snapshot);
      });
    }

    // Build run → timestamp map for changedAt derivation
    const runToTimestamp = new Map();
    (frontendData.episodeTestData || []).forEach(ep =>
      (ep.runs || []).forEach(r => runToTimestamp.set(r.runNumber, r.timestamp))
    );

    // Feedback keyed by testId
    const feedbackByTestId = new Map(
      (frontendData.feedback || []).map(fb => [fb.testId, fb])
    );

    // Derive detail-view test list from testHistories
    const detailTests = (frontendData.testHistories || []).map(h => {
      const status = h.isLingeringFailure ? 'failing'
        : (h.failureIntervals?.length > 0) ? 'improved'
        : 'passing';

      const runs = Object.keys(h.statusByRun || {}).map(Number).sort((a, b) => a - b);
      let lastChangeRun = null;
      for (let i = 1; i < runs.length; i++) {
        if (h.statusByRun[runs[i]] !== h.statusByRun[runs[i - 1]]) lastChangeRun = runs[i];
      }
      const rawTs = lastChangeRun ? runToTimestamp.get(lastChangeRun) : null;
      const changedAt = rawTs ? formatShortTime(rawTs) : null;

      const fb = feedbackByTestId.get(h.testId);

      // Concept scores computed by pipeline (conceptScores field on TestHistory)
      const conceptScores = h.conceptScores || [];

      return {
        id: h.testId,
        name: h.testName,
        status,
        changedAt,
        explanation:       fb?.explanation       || '',
        pattern:           fb?.pattern           || '',
        nextSteps:         fb?.nextSteps         || [],
        suggestion:        fb?.suggestion        || '',
        diffs:             fb?.diffs             || [],
        courseAppearances: fb?.courseAppearances || [],
        drills:            fb?.drills            || null,
        statusByRun:       h.statusByRun         || {},
        testSource:        frontendData.testSources?.[h.testId] || null,
        conceptScores,
      };
    });

    const detailSummary = {
      failing:  detailTests.filter(t => t.status === 'failing').length,
      improved: detailTests.filter(t => t.status === 'improved').length,
      passing:  detailTests.filter(t => t.status === 'passing').length,
      total:    detailTests.length,
    };

    // Build run-number → episode lookup for citation tooltips
    const episodes = frontendData.episodes || [];
    const runToEpisode = {};
    episodes.forEach((ep, idx) => {
      (ep.runNumbers || []).forEach(r => { runToEpisode[r] = { idx: idx + 1, ep }; });
    });

    return {
      episodes,
      episodeTestData: frontendData.episodeTestData || [],
      allRuns,
      progressDataPoints,
      testHistories,
      failureHighlights,
      feedbackMap,
      codeSnapshotsByRun,
      context: frontendData.context || null,
      detailTests,
      detailSummary,
      runToEpisode,
    };
  }, [frontendData]);

  const value = useMemo(() => ({
    frontendData,
    ...derivedData,
    assessmentConfig,
    loading,
    error,
    apiError,
    dataSource
  }), [frontendData, derivedData, assessmentConfig, loading, error, apiError, dataSource]);

  return (
    <PlaybackDataContext.Provider value={value}>
      {children}
    </PlaybackDataContext.Provider>
  );
}

/**
 * Hook to access playback data context
 * @returns {PlaybackDataContextValue}
 * @throws {Error} If used outside PlaybackDataProvider
 */
export function usePlaybackDataContext() {
  const context = useContext(PlaybackDataContext);
  if (!context) {
    throw new Error('usePlaybackDataContext must be used within a PlaybackDataProvider');
  }
  return context;
}

export default PlaybackDataContext;
