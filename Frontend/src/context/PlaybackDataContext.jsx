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

/**
 * Provider component for playback data
 * In development, uses mock data. In production, can fetch from API.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.submissionId] - Optional submission ID for API mode
 * @param {boolean} [props.useMock=true] - Force mock mode even if submissionId provided
 * @param {string} [props.jsonUrl] - Optional URL to load JSON data from (e.g., "/data/frontend.json")
 */
export function PlaybackDataProvider({ children, submissionId, useMock = true, jsonUrl }) {
  const [frontendData, setFrontendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('mock');

  // Load data on mount or when submissionId changes
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (jsonUrl) {
          // Load from local JSON file
          const response = await fetch(jsonUrl);
          if (!response.ok) {
            throw new Error(`Failed to load data: ${response.statusText}`);
          }
          const data = await response.json();
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

        // Fall back to mock data on error
        try {
          const mockData = convertMockToFrontendOutput();
          setFrontendData(mockData);
          setDataSource('mock');
        } catch (mockErr) {
          console.error('Error loading mock data:', mockErr);
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [submissionId, useMock, jsonUrl]);

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
        context: null
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

    return {
      episodes: frontendData.episodes || [],
      episodeTestData: frontendData.episodeTestData || [],
      allRuns,
      progressDataPoints,
      testHistories,
      failureHighlights,
      feedbackMap,
      codeSnapshotsByRun,
      context: frontendData.context || null
    };
  }, [frontendData]);

  const value = useMemo(() => ({
    frontendData,
    ...derivedData,
    loading,
    error,
    dataSource
  }), [frontendData, derivedData, loading, error, dataSource]);

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
