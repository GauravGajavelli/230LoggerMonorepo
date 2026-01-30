import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { useTimelineHighlights } from '../hooks/useTimelineHighlights';
import { FileTabs } from './FileTabs';

// Light theme for code highlighting
const lightTheme = {
  plain: {
    color: "#1a1a1a",
    backgroundColor: "#ffffff"
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#6a737d" } },
    { types: ["punctuation"], style: { color: "#24292e" } },
    { types: ["property", "tag", "boolean", "number", "constant", "symbol", "deleted"], style: { color: "#005cc5" } },
    { types: ["selector", "attr-name", "string", "char", "builtin", "inserted"], style: { color: "#22863a" } },
    { types: ["operator", "entity", "url"], style: { color: "#d73a49" } },
    { types: ["atrule", "attr-value", "keyword"], style: { color: "#d73a49" } },
    { types: ["function", "class-name"], style: { color: "#6f42c1" } },
    { types: ["regex", "important", "variable"], style: { color: "#e36209" } }
  ]
};

/**
 * Helper to get code for a file (or first file as default)
 * @param {Object} submission - Submission object with files array
 * @param {string} [fileName] - File name to get content for
 * @returns {string} File content or empty string
 */
function getFileContent(submission, fileName) {
  if (!submission) return '';

  // Support old format with single code string
  if (!submission.files) {
    return submission.code || '';
  }

  // New format with files array
  const file = fileName
    ? submission.files.find(f => f.name === fileName)
    : submission.files[0];
  return file?.content || '';
}

/**
 * Main component for single-view code timeline playback
 * Shows code at one point in time with green highlights for added lines
 * and optional deleted lines with red strikethrough
 *
 * @param {Object} props
 * @param {Object} props.playback - Playback state with currentSubmission and previousSubmission
 * @param {{ file: string, line: number } | null} [props.errorHighlight] - Error line to highlight
 */
export function CodeTimelineViewer({ playback, errorHighlight }) {
  const [showDeletedLines, setShowDeletedLines] = useState(false);
  const [highlightKey, setHighlightKey] = useState(0);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const codeContainerRef = useRef(null);

  const {
    currentIndex,
    currentSubmission,
    previousSubmission
  } = playback;

  // Get all files from current submission
  const allFiles = currentSubmission?.files || [];

  // Initialize open files when submission changes
  useEffect(() => {
    if (allFiles.length > 0) {
      // If we have files open, try to keep them if they still exist
      const existingFileNames = allFiles.map(f => f.name);
      const stillValidFiles = openFiles.filter(name => existingFileNames.includes(name));

      if (stillValidFiles.length === 0) {
        // No valid files open, open the first one
        setOpenFiles([allFiles[0].name]);
        setActiveFile(allFiles[0].name);
      } else {
        // Keep valid files, ensure active file is still valid
        setOpenFiles(stillValidFiles);
        if (!stillValidFiles.includes(activeFile)) {
          setActiveFile(stillValidFiles[0]);
        }
      }
    } else if (!currentSubmission?.files && currentSubmission?.code) {
      // Legacy single-file submission
      setOpenFiles([]);
      setActiveFile(null);
    }
  }, [currentSubmission?.id]);

  // Get code for active file (or legacy single code)
  const currentCode = getFileContent(currentSubmission, activeFile);
  const previousCode = getFileContent(previousSubmission, activeFile);

  // Compute per-file diff stats for tab glow effects
  const fileDiffStats = useMemo(() => {
    const stats = {};
    openFiles.forEach(fileName => {
      const currCode = getFileContent(currentSubmission, fileName);
      const prevCode = getFileContent(previousSubmission, fileName);

      // Simple line-based diff count
      const currentLines = currCode ? currCode.split('\n') : [];
      const prevLines = prevCode ? prevCode.split('\n') : [];
      const prevSet = new Set(prevLines.map(l => l.trim()));
      const currSet = new Set(currentLines.map(l => l.trim()));

      let addedCount = 0, deletedCount = 0;
      currentLines.forEach(line => {
        if (!prevSet.has(line.trim()) && line.trim()) addedCount++;
      });
      prevLines.forEach(line => {
        if (!currSet.has(line.trim()) && line.trim()) deletedCount++;
      });

      stats[fileName] = { addedCount, deletedCount };
    });
    return stats;
  }, [openFiles, currentSubmission, previousSubmission]);

  // Get language for syntax highlighting
  const activeFileData = allFiles.find(f => f.name === activeFile);
  const language = activeFileData?.language || 'java';

  // Tab handlers
  const handleFileSelect = (fileName) => setActiveFile(fileName);

  const handleFileClose = (fileName) => {
    if (openFiles.length <= 1) return; // Keep at least one tab open
    const newOpen = openFiles.filter(f => f !== fileName);
    setOpenFiles(newOpen);
    if (activeFile === fileName && newOpen.length > 0) {
      setActiveFile(newOpen[0]);
    }
  };

  const handleFileOpen = useCallback((fileName) => {
    if (!openFiles.includes(fileName)) {
      setOpenFiles(prev => [...prev, fileName]);
    }
    setActiveFile(fileName);
  }, [openFiles]);

  // Compute highlights
  const { mergedLines, addedCount, deletedCount } = useTimelineHighlights(
    previousCode,
    currentCode,
    showDeletedLines
  );

  // Trigger re-animation when snapshot or active file changes
  useEffect(() => {
    setHighlightKey(prev => prev + 1);
  }, [currentIndex, activeFile]);

  // Scroll to first change when snapshot changes (only within the code container)
  useEffect(() => {
    if (!codeContainerRef.current || mergedLines.length === 0) return;

    // Find first changed line index
    const firstChangeIndex = mergedLines.findIndex(line => line.isAdded || line.isDeleted);
    if (firstChangeIndex === -1) return;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const container = codeContainerRef.current;
      const lineElements = container?.querySelectorAll('.code-timeline-line');
      const targetElement = lineElements?.[firstChangeIndex];

      if (targetElement && container) {
        // Calculate scroll position to center the element within the container only
        const containerHeight = container.clientHeight;
        const elementTop = targetElement.offsetTop;
        const elementHeight = targetElement.offsetHeight;
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    });
  }, [mergedLines, highlightKey]);

  // Scroll to error highlight when set (takes priority over change scroll)
  useEffect(() => {
    if (!errorHighlight || !codeContainerRef.current) return;

    requestAnimationFrame(() => {
      const container = codeContainerRef.current;
      const lineElements = container?.querySelectorAll('.code-timeline-line');
      const targetElement = lineElements?.[errorHighlight.line - 1];

      if (targetElement && container) {
        // Scroll to line, centering it in the container
        const containerHeight = container.clientHeight;
        const elementTop = targetElement.offsetTop;
        const targetScrollTop = elementTop - (containerHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    });
  }, [errorHighlight]);

  // Auto-switch to error file when errorHighlight is set
  useEffect(() => {
    if (!errorHighlight?.file || !allFiles.length) return;

    // Find matching file in current submission
    const matchingFile = allFiles.find(f =>
      f.name === errorHighlight.file ||
      f.name.toLowerCase().includes(errorHighlight.file.replace('.java', '').toLowerCase())
    );

    if (matchingFile && matchingFile.name !== activeFile) {
      handleFileOpen(matchingFile.name);
    }
  }, [errorHighlight?.file, allFiles, activeFile, handleFileOpen]);

  // Check if a line should have error highlighting
  const isErrorLine = (lineNumber) => {
    if (!errorHighlight) return false;
    // For now, just check line number match - file matching can be added when
    // the data model consistently uses matching file names
    // In production, you'd also verify: activeFile?.includes(errorHighlight.file?.replace('.java', ''))
    return lineNumber === errorHighlight.line;
  };

  return (
    <div className="h-[500px] w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-900">Task timeline</h2>
          {addedCount > 0 && (
            <span className="text-xs text-green-600">+{addedCount} lines</span>
          )}
          {showDeletedLines && deletedCount > 0 && (
            <span className="text-xs text-red-600">-{deletedCount} lines</span>
          )}
        </div>

        {/* Show Deleted Lines toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-600">Show deleted lines</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showDeletedLines}
              onChange={(e) => setShowDeletedLines(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-red-500 transition-colors"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow"></div>
          </div>
        </label>
      </div>

      {/* File tabs - only show if multiple files */}
      {allFiles.length > 1 && (
        <FileTabs
          files={allFiles}
          openFiles={openFiles}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onFileClose={handleFileClose}
          onFileOpen={handleFileOpen}
          fileDiffStats={fileDiffStats}
        />
      )}

      {/* Code Viewer */}
      <div
        ref={codeContainerRef}
        className="flex-1 overflow-y-auto bg-white"
      >
        <Highlight
          theme={lightTheme}
          code={currentCode}
          language={language}
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
                  if (isErrorLine(line.lineNumber)) {
                    lineClass += ' line-error-highlight'; // yellow highlight for error line
                  } else if (line.isDeleted) {
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
