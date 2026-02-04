import { useState, useMemo, useCallback, useEffect } from 'react';
import { PlaybackHeader } from './PlaybackHeader';
import { TimelineBar } from './TimelineBar';
import { TestList } from './TestList';
import { ProgressChart } from './ProgressChart';
import { FeedbackPanel } from './FeedbackPanel';
import { CodeTimelineViewer } from './CodeTimelineViewer';
import { FailureHighlights } from './FailureHighlights';
import { usePlayback } from '../hooks/usePlayback';
import { useRunSelection } from '../hooks/useRunSelection';
import { usePlaybackData } from '../hooks/usePlaybackData';
import { parseStackTrace } from '../utils/stackTraceParser';

/**
 * Main playback page with unified free-floating card layout
 * All components appear as self-contained rounded cards on a dark background
 *
 * Single source of truth: usePlayback controls the global run index,
 * and we derive episode/run from that index.
 */
export function PlaybackPage() {
  // UI state
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [highlightedOriginRun, setHighlightedOriginRun] = useState(null);
  const [errorHighlight, setErrorHighlight] = useState(null); // { file, line }

  // Get data from the playback data provider
  const {
    episodes,
    allRuns,
    progressDataPoints,
    feedbackMap,
    submissionContext,
    loading,
    error,
    getTestHistory,
    getFeedback,
    getHighlightsByCategory,
    getHighlightCategory,
    findOrigin,
    hasHighlights,
    getClosestCodeSnapshot,
    hasCodeSnapshots
  } = usePlaybackData();

  // Single playback state - operates on runs, not submissions
  const playback = usePlayback(allRuns);

  // Derive current episode and run from global index
  const currentRunData = allRuns[playback.currentIndex] || allRuns[0];
  const currentEpisodeId = currentRunData?.episodeId || '';
  const currentRunNumber = currentRunData?.runNumber || 1;
  const currentEpisodeIndex = currentRunData?.episodeIndex || 0;
  const currentEpisode = episodes[currentEpisodeIndex] || episodes[0];

  // Create a mapped playback object for CodeTimelineViewer
  // Uses real code snapshots from the pipeline data
  const codePlayback = useMemo(() => {
    // Get the current and previous code snapshots based on run number
    const currentSnapshot = getClosestCodeSnapshot(currentRunNumber);
    const previousRunNumber = currentRunNumber > 1 ? currentRunNumber - 1 : null;
    const previousSnapshot = previousRunNumber ? getClosestCodeSnapshot(previousRunNumber) : null;

    // Convert snapshot to submission format expected by CodeTimelineViewer
    const snapshotToSubmission = (snapshot) => {
      if (!snapshot) return null;
      return {
        id: `snapshot-${snapshot.runNumber}`,
        files: snapshot.files.map(f => ({
          name: f.name,
          language: f.language,
          content: f.content
        }))
      };
    };

    const currentSubmission = snapshotToSubmission(currentSnapshot);
    const previousSubmission = snapshotToSubmission(previousSnapshot);

    return {
      ...playback,
      currentIndex: currentRunNumber,
      currentSubmission,
      previousSubmission,
      totalCount: allRuns.length
    };
  }, [playback, currentRunNumber, allRuns.length, getClosestCodeSnapshot]);

  // Get all runs for current episode (for RunSelector)
  const currentEpisodeRuns = useMemo(() => {
    return allRuns.filter(r => r.episodeId === currentEpisodeId);
  }, [allRuns, currentEpisodeId]);

  // Find the array index of the current run within currentEpisodeRuns
  const currentRunArrayIndex = useMemo(() => {
    const index = currentEpisodeRuns.findIndex(r => r.globalIndex === playback.currentIndex);
    return index >= 0 ? index : 0;
  }, [currentEpisodeRuns, playback.currentIndex]);

  // Create a run selection interface that's controlled by playback
  const runSelection = useRunSelection(
    currentEpisodeId,
    currentEpisodeRuns.map(r => r.run),
    currentRunArrayIndex,
    // Callback when user manually selects a run via arrows
    // arrayIndex is the index within currentEpisodeRuns (0, 1, 2, ...)
    (arrayIndex) => {
      const targetRun = currentEpisodeRuns[arrayIndex];
      if (targetRun) {
        playback.jumpTo(targetRun.globalIndex);
      }
    }
  );

  // Get tests directly from the current run
  const currentTests = useMemo(() => {
    return currentRunData?.run?.results || [];
  }, [currentRunData]);

  const testSummary = useMemo(() => {
    return currentRunData?.run?.summary || { passed: 0, failed: 0, total: 0 };
  }, [currentRunData]);

  const selectedTest = useMemo(() => {
    if (!selectedTestId) return null;
    return currentTests.find(t => t.id === selectedTestId) || null;
  }, [selectedTestId, currentTests]);

  // Get feedback for the selected test
  const feedback = useMemo(() => {
    if (!selectedTestId) return null;
    return getFeedback(selectedTestId) || null;
  }, [selectedTestId, getFeedback]);

  // Get test history for the selected test
  const selectedTestHistory = useMemo(() => {
    if (!selectedTestId) return null;
    return getTestHistory(selectedTestId) || null;
  }, [selectedTestId, getTestHistory]);

  // Get origin run for the selected test
  const selectedTestOrigin = useMemo(() => {
    if (!selectedTestId) return null;
    return findOrigin(selectedTestId);
  }, [selectedTestId, findOrigin]);

  // Auto-close feedback panel when selected test passes
  useEffect(() => {
    if (!selectedTest) return;

    // If test is now passing, close the feedback panel
    if (selectedTest.status === 'pass') {
      setShowFeedbackPanel(false);
    }
  }, [selectedTest]);

  // Clear error highlight on any navigation (run or test change)
  useEffect(() => {
    setErrorHighlight(null);
  }, [playback.currentIndex, selectedTestId]);

  // Extract first user-code location from stack trace (excluding test files)
  const getErrorLocation = useCallback((test) => {
    if (!test?.stackTrace) return null;
    // Common user file patterns - include broad patterns to catch most user code
    const frames = parseStackTrace(test.stackTrace, ['BinarySearchTree', 'BST', 'AVL', 'Tree']);
    // Find first user code frame that's NOT a test file
    const userFrame = frames.find(f =>
      f.type === 'userCode' &&
      f.file &&
      f.line &&
      !f.file.toLowerCase().includes('test')
    );
    return userFrame ? { file: userFrame.file, line: userFrame.line } : null;
  }, []);

  // Get highlighted tests by category
  const stillFailingTests = useMemo(() => getHighlightsByCategory('stillFailing'), [getHighlightsByCategory]);
  const regressionTests = useMemo(() => getHighlightsByCategory('regressions'), [getHighlightsByCategory]);
  const costlyDetourTests = useMemo(() => getHighlightsByCategory('costlyDetours'), [getHighlightsByCategory]);

  // Handle episode click - jump to first run of that episode
  const handleEpisodeClick = useCallback((episodeId) => {
    // Find the first run in this episode
    const firstRunInEpisode = allRuns.find(r => r.episodeId === episodeId);
    if (firstRunInEpisode) {
      playback.jumpTo(firstRunInEpisode.globalIndex);
    }
  }, [allRuns, playback]);

  // Test selection
  const handleTestSelect = useCallback((testId) => {
    setSelectedTestId(testId);

    // Find the test
    const test = currentTests.find(t => t.id === testId);

    // Show feedback panel if test is failing
    if (test && (test.status === 'fail' || test.status === 'error')) {
      setShowFeedbackPanel(true);

      // Simulate loading feedback
      if (feedbackMap.has(testId)) {
        setIsLoadingFeedback(true);
        setTimeout(() => setIsLoadingFeedback(false), 800);
      }
    }
  }, [currentTests, feedbackMap]);

  const handleCloseFeedback = useCallback(() => {
    setShowFeedbackPanel(false);
  }, []);

  const handleJumpToCode = useCallback((location) => {
    console.log('Jump to code:', location);
    // Integration point for CodeViewer
  }, []);

  // Jump to a specific run number
  const handleJumpToRunNumber = useCallback((runNumber, testId) => {
    // Find the run with this run number
    const targetRun = allRuns.find(r => r.runNumber === runNumber);
    if (targetRun) {
      playback.jumpTo(targetRun.globalIndex);
      // Optionally keep or set the test selection
      if (testId) {
        setSelectedTestId(testId);
      }
    }
  }, [allRuns, playback]);

  // Get origin run number for a test (for FailureHighlights)
  const getOriginRunNumber = useCallback((testId) => {
    const origin = findOrigin(testId);
    return origin?.runNumber || null;
  }, [findOrigin]);

  // Handle jump to origin from highlights panel
  const handleHighlightJumpToOrigin = useCallback((runNumber, testId) => {
    handleJumpToRunNumber(runNumber, testId);
    // Select the test and show feedback panel
    setSelectedTestId(testId);
    setShowFeedbackPanel(true);
    // Highlight the origin run in the timeline
    setHighlightedOriginRun(runNumber);
  }, [handleJumpToRunNumber]);

  // Handle jump to origin from feedback panel
  const handleFeedbackJumpToOrigin = useCallback(() => {
    if (selectedTestOrigin) {
      handleJumpToRunNumber(selectedTestOrigin.runNumber, selectedTestId);
      // Highlight the origin run in the timeline
      setHighlightedOriginRun(selectedTestOrigin.runNumber);

      // Determine error location for code highlighting
      // Priority: 1) feedback.relatedCodeLocation, 2) stack trace parsing
      let errorLoc = null;
      if (feedback?.relatedCodeLocation) {
        errorLoc = {
          file: feedback.relatedCodeLocation.file,
          line: feedback.relatedCodeLocation.startLine
        };
      } else {
        errorLoc = getErrorLocation(selectedTest);
      }

      if (errorLoc) {
        // Use setTimeout to set after the navigation effect clears it
        // Needs enough delay to run after React's useEffect cleanup
        setTimeout(() => setErrorHighlight(errorLoc), 50);
      }
    }
  }, [selectedTestOrigin, selectedTestId, selectedTest, feedback, handleJumpToRunNumber, getErrorLocation]);

  // Handle clicking a sparkline cell
  const handleSparklineRunClick = useCallback((runNumber) => {
    handleJumpToRunNumber(runNumber, selectedTestId);
  }, [handleJumpToRunNumber, selectedTestId]);

  // Use context for the header
  const context = submissionContext || {
    studentDisplayName: 'Loading...',
    assignmentName: 'Loading...',
    submittedAt: new Date(),
    totalEpisodes: episodes.length
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#800000] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading playback data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && allRuns.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading data</p>
          <p className="text-gray-500 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <PlaybackHeader
          context={context}
          testSummary={testSummary}
          currentEpisode={currentEpisode}
          currentEpisodeIndex={currentEpisodeIndex}
        />
      </div>

      {/* Main card layout */}
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Failure Highlights Panel (if any) */}
        {hasHighlights() && (
          <FailureHighlights
            stillFailing={stillFailingTests}
            regressions={regressionTests}
            costlyDetours={costlyDetourTests}
            selectedTestId={selectedTestId}
            onTestSelect={handleTestSelect}
            onJumpToOrigin={handleHighlightJumpToOrigin}
            getOriginRun={getOriginRunNumber}
          />
        )}

        {/* Top row: Code Viewer + Sidebar */}
        <div className="flex gap-4">
          {/* Code Viewer Card */}
          <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {hasCodeSnapshots() && codePlayback.currentSubmission ? (
              <CodeTimelineViewer
                playback={codePlayback}
                errorHighlight={errorHighlight}
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">No Code Available</p>
                  <p className="text-sm">Episode: {currentEpisode?.label}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar cards */}
          <div className="w-72 space-y-4">
            {/* Test Results Card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <TestList
                tests={currentTests}
                selectedTestId={selectedTestId}
                onTestSelect={handleTestSelect}
                maxHeight="250px"
                runSelection={runSelection}
                getHighlightCategory={getHighlightCategory}
                getOriginRun={getOriginRunNumber}
                onJumpToOrigin={handleHighlightJumpToOrigin}
              />
            </div>

            {/* Progress Chart Card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <ProgressChart
                dataPoints={progressDataPoints}
                globalRunIndex={playback.currentIndex}
                height={120}
                onRunClick={(globalIndex) => playback.jumpTo(globalIndex)}
              />
            </div>
          </div>
        </div>

        {/* Timeline Card - unified controls */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <TimelineBar
            episodes={episodes}
            playback={playback}
            currentEpisodeId={currentEpisodeId}
            onEpisodeClick={handleEpisodeClick}
            allRuns={allRuns}
            highlightedOriginRun={highlightedOriginRun}
          />
        </div>

        {/* Feedback Panel Card (conditional) */}
        {showFeedbackPanel && selectedTest && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <FeedbackPanel
              selectedTest={selectedTest}
              feedback={feedback}
              isLoadingFeedback={isLoadingFeedback}
              onClose={handleCloseFeedback}
              onJumpToCode={handleJumpToCode}
              testHistory={selectedTestHistory}
              originRun={selectedTestOrigin?.runNumber}
              currentRun={currentRunNumber}
              onJumpToOrigin={handleFeedbackJumpToOrigin}
              onClickSparklineRun={handleSparklineRunClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
