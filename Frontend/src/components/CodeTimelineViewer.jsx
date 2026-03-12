import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Highlight } from 'prism-react-renderer';
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
 */
function getFileContent(submission, fileName) {
  if (!submission) return '';
  if (!submission.files) return submission.code || '';
  const file = fileName
    ? submission.files.find(f => f.name === fileName)
    : submission.files[0];
  return file?.content || '';
}

/**
 * Main component for single-view code timeline playback.
 * Shows code at one point in time with green highlights for added lines.
 *
 * @param {Object} props
 * @param {Object} props.playback - Playback state with currentSubmission and previousSubmission
 * @param {{ file: string, line: number } | null} [props.errorHighlight] - Error line to highlight
 */
export function CodeTimelineViewer({ playback, errorHighlight }) {
  const [highlightKey, setHighlightKey] = useState(0);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const codeContainerRef = useRef(null);

  const { currentIndex, currentSubmission, previousSubmission } = playback;

  const allFiles = currentSubmission?.files || [];

  // Open only files that changed from the previous snapshot; if none changed, open all.
  useEffect(() => {
    if (allFiles.length > 0) {
      const allFileNames = allFiles.map(f => f.name);
      const changedFileNames = allFileNames.filter(name => {
        const curr = getFileContent(currentSubmission, name);
        const prev = getFileContent(previousSubmission, name);
        return curr !== prev;
      });
      const initialOpen = changedFileNames.length > 0 ? changedFileNames : allFileNames;
      setOpenFiles(initialOpen);
      setActiveFile(initialOpen[0]);
    } else if (!currentSubmission?.files && currentSubmission?.code) {
      setOpenFiles([]);
      setActiveFile(null);
    }
  }, [currentSubmission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentCode = getFileContent(currentSubmission, activeFile);
  const previousCode = getFileContent(previousSubmission, activeFile);

  // Compute per-file diff stats for tab glow effects
  const fileDiffStats = useMemo(() => {
    const stats = {};
    openFiles.forEach(fileName => {
      const currCode = getFileContent(currentSubmission, fileName);
      const prevCode = getFileContent(previousSubmission, fileName);
      const currentLines = currCode ? currCode.split('\n') : [];
      const prevLines = prevCode ? prevCode.split('\n') : [];
      const prevSet = new Set(prevLines.map(l => l.trim()));
      const currSet = new Set(currentLines.map(l => l.trim()));
      let addedCount = 0, deletedCount = 0;
      currentLines.forEach(line => { if (!prevSet.has(line.trim()) && line.trim()) addedCount++; });
      prevLines.forEach(line => { if (!currSet.has(line.trim()) && line.trim()) deletedCount++; });
      stats[fileName] = { addedCount, deletedCount };
    });
    return stats;
  }, [openFiles, currentSubmission, previousSubmission]);

  const activeFileData = allFiles.find(f => f.name === activeFile);
  const language = activeFileData?.language || 'java';

  const handleFileSelect = (fileName) => setActiveFile(fileName);

  const handleFileClose = (fileName) => {
    if (openFiles.length <= 1) return;
    const newOpen = openFiles.filter(f => f !== fileName);
    setOpenFiles(newOpen);
    if (activeFile === fileName && newOpen.length > 0) setActiveFile(newOpen[0]);
  };

  const handleFileOpen = useCallback((fileName) => {
    if (!openFiles.includes(fileName)) setOpenFiles(prev => [...prev, fileName]);
    setActiveFile(fileName);
  }, [openFiles]);

  const { mergedLines, addedCount } = useTimelineHighlights(previousCode, currentCode);

  // Re-animate and re-scroll when snapshot or active file changes
  useEffect(() => {
    setHighlightKey(prev => prev + 1);
  }, [currentIndex, activeFile]);

  const mergedLinesRef = useRef(mergedLines);
  mergedLinesRef.current = mergedLines;

  useEffect(() => {
    if (!codeContainerRef.current) return;
    requestAnimationFrame(() => {
      const lines = mergedLinesRef.current;
      if (lines.length === 0) return;
      const firstChangeIndex = lines.findIndex(line => line.isAdded);
      if (firstChangeIndex === -1) return;
      const container = codeContainerRef.current;
      const lineElements = container?.querySelectorAll('.code-timeline-line');
      const targetElement = lineElements?.[firstChangeIndex];
      if (targetElement && container) {
        const containerHeight = container.clientHeight;
        const elementTop = targetElement.offsetTop;
        const elementHeight = targetElement.offsetHeight;
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    });
  }, [highlightKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to error highlight when set
  useEffect(() => {
    if (!errorHighlight || !codeContainerRef.current) return;
    requestAnimationFrame(() => {
      const container = codeContainerRef.current;
      const lineElements = container?.querySelectorAll('.code-timeline-line');
      const targetElement = lineElements?.[errorHighlight.line - 1];
      if (targetElement && container) {
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
    const matchingFile = allFiles.find(f =>
      f.name === errorHighlight.file ||
      f.name.toLowerCase().includes(errorHighlight.file.replace('.java', '').toLowerCase())
    );
    if (matchingFile && matchingFile.name !== activeFile) handleFileOpen(matchingFile.name);
  }, [errorHighlight?.file, allFiles, activeFile, handleFileOpen]);

  const isErrorLine = (lineNumber) => errorHighlight && lineNumber === errorHighlight.line;

  return (
    <div className="h-[500px] w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 bg-gray-100 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-900">Task timeline</h2>
        {addedCount > 0 && (
          <span className="text-xs text-green-600 ml-3">+{addedCount} lines</span>
        )}
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
      <div ref={codeContainerRef} className="flex-1 overflow-y-auto bg-white">
        <Highlight theme={lightTheme} code={currentCode} language={language}>
          {({ className, style, tokens }) => (
            <pre
              className={`${className} p-4 text-sm`}
              style={{ ...style, background: 'transparent', margin: 0 }}
            >
              <code key={highlightKey}>
                {mergedLines.map((line, index) => {
                  const tokenLine = tokens[line.lineNumber - 1];
                  const lineContent = tokenLine
                    ? tokenLine.map((token, i) => (
                        <span key={i} style={token.empty ? {} : { color: token.color }}>
                          {token.content}
                        </span>
                      ))
                    : (line.content || ' ');

                  let lineClass = 'code-timeline-line';
                  if (isErrorLine(line.lineNumber)) lineClass += ' line-error-highlight';
                  else if (line.isAdded) lineClass += ' line-added';

                  return (
                    <div key={index} className={lineClass}>
                      <span className="code-line-number">{line.lineNumber}</span>
                      <span className="code-line-content">{lineContent}</span>
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
