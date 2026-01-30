import { useMemo } from 'react';
import { parseStackTrace } from '../../utils/stackTraceParser';

/**
 * Display formatted, scrollable stack trace
 *
 * @param {Object} props
 * @param {string} props.stackTrace - Full stack trace string
 * @param {string} props.errorMessage - Short error message
 * @param {string} [props.highlightedFile] - Highlight frames from this file
 * @param {(file: string, line: number) => void} [props.onLineClick] - Jump to code callback
 */
export function StackTraceViewer({
  stackTrace,
  errorMessage,
  highlightedFile,
  onLineClick
}) {
  const userFiles = highlightedFile ? [highlightedFile] : ['BinarySearchTree', 'BST', 'Test'];

  const frames = useMemo(
    () => parseStackTrace(stackTrace, userFiles),
    [stackTrace, userFiles]
  );

  const handleFrameClick = (frame) => {
    if (frame.clickable && frame.file && frame.line && onLineClick) {
      onLineClick(frame.file, frame.line);
    }
  };

  return (
    <div className="bg-gray-950 rounded-lg p-3 overflow-auto max-h-48">
      <h4 className="text-sm font-medium text-gray-400 mb-2">Stack Trace</h4>

      <div className="font-mono text-xs space-y-0.5">
        {/* Error message at top if not in frames */}
        {errorMessage && !frames.some(f => f.type === 'error') && (
          <div className="text-red-400 font-medium mb-2">
            {errorMessage}
          </div>
        )}

        {/* Stack frames */}
        {frames.map((frame, index) => {
          let className = '';

          switch (frame.type) {
            case 'error':
              className = 'text-red-400 font-medium';
              break;
            case 'causedBy':
              className = 'text-yellow-500 mt-2';
              break;
            case 'userCode':
              className = 'text-gray-200';
              break;
            case 'external':
            default:
              className = 'text-gray-600';
              break;
          }

          if (frame.clickable) {
            return (
              <div
                key={index}
                className={`${className} hover:bg-gray-800 cursor-pointer rounded px-1 -mx-1`}
                onClick={() => handleFrameClick(frame)}
              >
                {frame.text}
              </div>
            );
          }

          return (
            <div key={index} className={className}>
              {frame.text}
            </div>
          );
        })}

        {/* Empty state */}
        {frames.length === 0 && !errorMessage && (
          <div className="text-gray-500">No stack trace available</div>
        )}
      </div>
    </div>
  );
}
