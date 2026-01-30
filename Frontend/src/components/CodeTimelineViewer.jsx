import { useState, useEffect, useRef } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { useTimelineHighlights } from '../hooks/useTimelineHighlights';

/**
 * Main component for single-view code timeline playback
 * Shows code at one point in time with green highlights for added lines
 * and optional deleted lines with red strikethrough
 */
export function CodeTimelineViewer({ submissions, playback }) {
  const [showDeletedLines, setShowDeletedLines] = useState(false);
  const [highlightKey, setHighlightKey] = useState(0);
  const codeContainerRef = useRef(null);

  const {
    currentIndex,
    currentSubmission,
    previousSubmission
  } = playback;

  const currentCode = currentSubmission?.code || '';
  const previousCode = previousSubmission?.code || '';

  // Compute highlights
  const { mergedLines, addedCount, deletedCount } = useTimelineHighlights(
    previousCode,
    currentCode,
    showDeletedLines
  );

  // Trigger re-animation when snapshot changes
  useEffect(() => {
    setHighlightKey(prev => prev + 1);
  }, [currentIndex]);

  return (
    <div className="h-[500px] w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-750 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-slate-200">Task timeline</h2>
          {addedCount > 0 && (
            <span className="text-xs text-green-400">+{addedCount} lines</span>
          )}
          {showDeletedLines && deletedCount > 0 && (
            <span className="text-xs text-red-400">-{deletedCount} lines</span>
          )}
        </div>

        {/* Show Deleted Lines toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-400">Show deleted lines</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showDeletedLines}
              onChange={(e) => setShowDeletedLines(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-red-600 transition-colors"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
          </div>
        </label>
      </div>

      {/* Code Viewer */}
      <div
        ref={codeContainerRef}
        className="h-[350px] overflow-y-auto"
      >
        <Highlight
          theme={themes.nightOwl}
          code={currentCode}
          language="java"
        >
          {({ className, style, tokens }) => (
            <pre
              className={`${className} p-4 text-sm`}
              style={{ ...style, background: 'transparent', margin: 0 }}
            >
              <code key={highlightKey}>
                {mergedLines.map((line, index) => {
                  // Get syntax-highlighted tokens for this line if it's not deleted
                  let lineContent;

                  if (line.isDeleted) {
                    // Deleted line - show with strikethrough, no syntax highlighting
                    lineContent = (
                      <span className="line-deleted-text">{line.content || ' '}</span>
                    );
                  } else {
                    // Find the corresponding token line
                    const tokenLineIndex = line.lineNumber - 1;
                    const tokenLine = tokens[tokenLineIndex];

                    if (tokenLine) {
                      lineContent = tokenLine.map((token, tokenIndex) => (
                        <span key={tokenIndex} style={token.empty ? {} : { color: token.color }}>
                          {token.content}
                        </span>
                      ));
                    } else {
                      lineContent = line.content || ' ';
                    }
                  }

                  // Determine line class
                  let lineClass = 'code-timeline-line';
                  if (line.isDeleted) {
                    lineClass += ' line-deleted';
                  } else if (line.isAdded) {
                    lineClass += ' line-added';
                  }

                  return (
                    <div key={index} className={lineClass}>
                      <span className="code-line-number">
                        {line.lineNumber || ''}
                      </span>
                      <span className="code-line-content">
                        {lineContent}
                      </span>
                    </div>
                  );
                })}
              </code>
            </pre>
          )}
        </Highlight>
      </div>

    </div>
  );
}
