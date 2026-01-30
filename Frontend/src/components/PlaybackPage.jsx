import { useState, useMemo, useCallback } from 'react';
import { PlaybackHeader } from './PlaybackHeader';
import { TimelineBar } from './TimelineBar';
import { TestList } from './TestList';
import { ProgressChart } from './ProgressChart';
import { FeedbackPanel } from './FeedbackPanel';
import { CodeTimelineViewer } from './CodeTimelineViewer';
import { usePlayback } from '../hooks/usePlayback';
import { useRunSelection } from '../hooks/useRunSelection';
import {
  mockContext,
  mockEpisodes,
  mockFeedback,
  getProgressDataPointsWithRuns,
  getAllRunsFlat
} from '../data/playbackMockData';
import {
  mockStudents,
  mockAssignments,
  getSubmissions
} from '../data/mockData';

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

  // Code viewer submissions (for CodeTimelineViewer)
  const submissions = useMemo(() => {
    return getSubmissions(mockStudents[0].id, mockAssignments[0].id);
  }, []);

  // Get flat list of all runs (10 total) - this is the primary timeline unit
  const allRuns = useMemo(() => getAllRunsFlat(), []);

  // Single playback state - operates on runs, not submissions
  const playback = usePlayback(allRuns);

  // Derive current episode and run from global index
  const currentRunData = allRuns[playback.currentIndex] || allRuns[0];
  const currentEpisodeId = currentRunData?.episodeId || '';
  const currentRunIndex = currentRunData?.run.runIndex || 0;
  const currentEpisodeIndex = currentRunData?.episodeIndex || 0;
  const currentEpisode = mockEpisodes[currentEpisodeIndex] || mockEpisodes[0];

  // Create a mapped playback object for CodeTimelineViewer
  // Maps from run index to submission index based on episode
  const codePlayback = useMemo(() => {
    // Map episode index to submission index (assuming 1:1 mapping)
    const submissionIndex = Math.min(currentEpisodeIndex, submissions.length - 1);
    const currentSubmission = submissions[submissionIndex] || null;
    const previousSubmission = submissionIndex > 0 ? submissions[submissionIndex - 1] : null;

    return {
      ...playback,
      currentIndex: submissionIndex,
      currentSubmission,
      previousSubmission,
      totalCount: submissions.length
    };
  }, [playback, currentEpisodeIndex, submissions]);

  // Get all runs for current episode (for RunSelector)
  const currentEpisodeRuns = useMemo(() => {
    return allRuns.filter(r => r.episodeId === currentEpisodeId);
  }, [allRuns, currentEpisodeId]);

  // Create a run selection interface that's controlled by playback
  const runSelection = useRunSelection(
    currentEpisodeId,
    currentEpisodeRuns.map(r => r.run),
    currentRunIndex,
    // Callback when user manually selects a run
    (runIndex) => {
      // Find the global index for this episode + run combination
      const targetRun = allRuns.find(
        r => r.episodeId === currentEpisodeId && r.run.runIndex === runIndex
      );
      if (targetRun) {
        playback.jumpTo(targetRun.globalIndex);
      }
    }
  );

  // Get tests directly from the current run
  const currentTests = useMemo(() => {
    return currentRunData?.run.results || [];
  }, [currentRunData]);

  const testSummary = useMemo(() => {
    return currentRunData?.run.summary || { passed: 0, failed: 0, total: 0 };
  }, [currentRunData]);

  const progressDataPoints = useMemo(() => getProgressDataPointsWithRuns(), []);

  const selectedTest = useMemo(() => {
    if (!selectedTestId) return null;
    return currentTests.find(t => t.id === selectedTestId) || null;
  }, [selectedTestId, currentTests]);

  const feedback = useMemo(() => {
    if (!selectedTestId) return null;
    return mockFeedback.get(selectedTestId) || null;
  }, [selectedTestId]);

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
      if (mockFeedback.has(testId)) {
        setIsLoadingFeedback(true);
        setTimeout(() => setIsLoadingFeedback(false), 800);
      }
    }
  }, [currentTests]);

  const handleCloseFeedback = useCallback(() => {
    setShowFeedbackPanel(false);
  }, []);

  const handleJumpToCode = useCallback((location) => {
    console.log('Jump to code:', location);
    // Integration point for CodeViewer
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <PlaybackHeader
          context={mockContext}
          testSummary={testSummary}
          currentEpisode={currentEpisode}
          currentEpisodeIndex={currentEpisodeIndex}
        />
      </div>

      {/* Main card layout */}
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Top row: Code Viewer + Sidebar */}
        <div className="flex gap-4">
          {/* Code Viewer Card */}
          <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden">
            {submissions.length > 0 ? (
              <CodeTimelineViewer
                submissions={submissions}
                playback={codePlayback}
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
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <TestList
                tests={currentTests}
                selectedTestId={selectedTestId}
                onTestSelect={handleTestSelect}
                maxHeight="250px"
                runSelection={runSelection}
              />
            </div>

            {/* Progress Chart Card */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
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
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <TimelineBar
            episodes={mockEpisodes}
            playback={playback}
            currentEpisodeId={currentEpisodeId}
            onEpisodeClick={handleEpisodeClick}
            allRuns={allRuns}
          />
        </div>

        {/* Feedback Panel Card (conditional) */}
        {showFeedbackPanel && selectedTest && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <FeedbackPanel
              selectedTest={selectedTest}
              feedback={feedback}
              isLoadingFeedback={isLoadingFeedback}
              onClose={handleCloseFeedback}
              onJumpToCode={handleJumpToCode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
