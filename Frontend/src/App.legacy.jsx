import { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { CodeDiffViewer } from './components/CodeDiffViewer';
import { PlaybackTimeline } from './components/PlaybackTimeline';
import { TestResultsPanel } from './components/TestResultsPanel';
import { AIFeedbackPanel } from './components/AIFeedbackPanel';
import { usePlayback } from './hooks/usePlayback';
import { 
  mockStudents, 
  mockAssignments, 
  getSubmissions, 
  getAIFeedback 
} from './data/mockData';
import { formatTimestamp } from './utils/formatUtils';

function App() {
  // Selection state
  const [selectedStudent, setSelectedStudent] = useState(mockStudents[0].id);
  const [selectedAssignment, setSelectedAssignment] = useState(mockAssignments[0].id);

  // Get submissions for current selection
  const submissions = useMemo(() => {
    return getSubmissions(selectedStudent, selectedAssignment);
  }, [selectedStudent, selectedAssignment]);

  // Playback controls
  const playback = usePlayback(submissions);

  // Get AI feedback for current submission
  const currentFeedback = useMemo(() => {
    if (!playback.currentSubmission) return null;
    return getAIFeedback(playback.currentSubmission.id);
  }, [playback.currentSubmission]);

  // Labels for diff viewer
  const diffLabels = useMemo(() => {
    if (!playback.currentSubmission) return { old: 'Previous', new: 'Current' };
    
    const currentTime = formatTimestamp(playback.currentSubmission.timestamp);
    const prevTime = playback.previousSubmission 
      ? formatTimestamp(playback.previousSubmission.timestamp)
      : 'N/A';

    return {
      old: playback.previousSubmission 
        ? `Previous (${prevTime})`
        : 'No previous version',
      new: `Current (${currentTime})`
    };
  }, [playback.currentSubmission, playback.previousSubmission]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <Header
        students={mockStudents}
        assignments={mockAssignments}
        selectedStudent={selectedStudent}
        selectedAssignment={selectedAssignment}
        onStudentChange={setSelectedStudent}
        onAssignmentChange={setSelectedAssignment}
      />

      {/* Main content */}
      <main className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        {submissions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl text-slate-400 mb-2">No submissions found</p>
              <p className="text-sm text-slate-500">
                Select a different student or assignment to view their debugging journey.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Top section: Code + Test Results */}
            <div className="flex-1 grid grid-cols-[1fr,320px] gap-4 min-h-0">
              {/* Code Diff Viewer */}
              <CodeDiffViewer
                oldCode={playback.previousSubmission?.code || ''}
                newCode={playback.currentSubmission?.code || ''}
                oldLabel={diffLabels.old}
                newLabel={diffLabels.new}
                language="java"
              />

              {/* Right sidebar: Test Results + AI Feedback */}
              <div className="flex flex-col gap-4 min-h-0">
                {/* Test Results */}
                <div className="flex-1 min-h-0">
                  <TestResultsPanel
                    testResults={playback.currentSubmission?.testResults}
                    status={playback.currentSubmission?.status}
                  />
                </div>

                {/* AI Feedback */}
                <div className="flex-1 min-h-0">
                  <AIFeedbackPanel feedback={currentFeedback} />
                </div>
              </div>
            </div>

            {/* Bottom section: Playback Timeline */}
            <PlaybackTimeline
              submissions={submissions}
              currentIndex={playback.currentIndex}
              isPlaying={playback.isPlaying}
              speed={playback.speed}
              onPlay={playback.play}
              onPause={playback.pause}
              onStepForward={playback.stepForward}
              onStepBackward={playback.stepBackward}
              onJumpTo={playback.jumpTo}
              onCycleSpeed={playback.cycleSpeed}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 bg-slate-800 border-t border-slate-700 text-center">
        <p className="text-xs text-slate-500">
          DSA Debugging Coach • CSSE 230 Research Project • Rose-Hulman Institute of Technology
        </p>
      </footer>
    </div>
  );
}

export default App;
