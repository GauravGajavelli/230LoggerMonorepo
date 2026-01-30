import { X, Loader2 } from 'lucide-react';
import { StackTraceViewer } from '../FeedbackDrawer/StackTraceViewer';
import { FeedbackContent } from '../FeedbackDrawer/FeedbackContent';
import { OriginSection } from './OriginSection';

/**
 * Inline feedback panel card showing stack trace and AI feedback
 * Replaces the fixed-bottom FeedbackDrawer with an in-flow card component
 *
 * @param {Object} props
 * @param {import('../../types').TestResult | null} props.selectedTest
 * @param {import('../../types').Feedback | null} props.feedback
 * @param {boolean} props.isLoadingFeedback
 * @param {() => void} props.onClose
 * @param {(location: { file: string, line: number }) => void} [props.onJumpToCode]
 * @param {import('../../types').TestHistory | null} [props.testHistory] - Test history for origin info
 * @param {number | null} [props.originRun] - Origin run number
 * @param {number} [props.currentRun] - Current run number
 * @param {() => void} [props.onJumpToOrigin] - Callback to jump to origin
 * @param {(runNumber: number) => void} [props.onClickSparklineRun] - Callback when sparkline cell is clicked
 */
export function FeedbackPanel({
  selectedTest,
  feedback,
  isLoadingFeedback,
  onClose,
  onJumpToCode,
  testHistory,
  originRun,
  currentRun,
  onJumpToOrigin,
  onClickSparklineRun
}) {
  const isPassing = selectedTest?.status === 'pass';

  // Determine if this is a regression (test was passing before)
  const isRegression = testHistory?.failureIntervals?.some(i => i.isRegression) ?? false;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${isPassing ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Test name */}
          <span className="font-mono text-sm text-gray-900">
            {selectedTest?.name || 'No test selected'}
          </span>

          {/* Pattern badge */}
          {feedback?.pattern && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
              {feedback.pattern}
            </span>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-900 transition p-1 rounded hover:bg-gray-100"
          aria-label="Close feedback panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Origin Section - shows failure timeline and jump button */}
      {testHistory && !isPassing && (
        <OriginSection
          testHistory={testHistory}
          originRun={originRun}
          currentRun={currentRun}
          isRegression={isRegression}
          onJumpToOrigin={onJumpToOrigin}
          onClickRun={onClickSparklineRun}
        />
      )}

      {/* Content area */}
      <div className="p-6 max-h-80 overflow-auto">
        {selectedTest ? (
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Stack Trace */}
            <div>
              <StackTraceViewer
                stackTrace={selectedTest.stackTrace || ''}
                errorMessage={selectedTest.errorMessage || ''}
                onLineClick={onJumpToCode ? (file, line) => onJumpToCode({ file, line }) : undefined}
              />
            </div>

            {/* Right: AI Feedback */}
            <div>
              {isLoadingFeedback ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-sm">Analyzing error pattern...</span>
                </div>
              ) : feedback ? (
                <FeedbackContent
                  feedback={feedback}
                  onJumpToCode={onJumpToCode}
                />
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                  {isPassing
                    ? 'This test is passing. Select a failing test to see feedback.'
                    : 'No feedback available for this test.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            Select a test to view details
          </div>
        )}
      </div>
    </div>
  );
}
