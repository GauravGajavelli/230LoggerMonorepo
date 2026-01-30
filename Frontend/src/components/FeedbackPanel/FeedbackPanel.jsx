import { X, Loader2 } from 'lucide-react';
import { StackTraceViewer } from '../FeedbackDrawer/StackTraceViewer';
import { FeedbackContent } from '../FeedbackDrawer/FeedbackContent';

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
 */
export function FeedbackPanel({
  selectedTest,
  feedback,
  isLoadingFeedback,
  onClose,
  onJumpToCode
}) {
  const isPassing = selectedTest?.status === 'pass';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${isPassing ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Test name */}
          <span className="font-mono text-sm text-slate-200">
            {selectedTest?.name || 'No test selected'}
          </span>

          {/* Pattern badge */}
          {feedback?.pattern && (
            <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 rounded text-xs font-medium">
              {feedback.pattern}
            </span>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-700"
          aria-label="Close feedback panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

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
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-sm">Analyzing error pattern...</span>
                </div>
              ) : feedback ? (
                <FeedbackContent
                  feedback={feedback}
                  onJumpToCode={onJumpToCode}
                />
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  {isPassing
                    ? 'This test is passing. Select a failing test to see feedback.'
                    : 'No feedback available for this test.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            Select a test to view details
          </div>
        )}
      </div>
    </div>
  );
}
