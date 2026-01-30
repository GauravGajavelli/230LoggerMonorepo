import { useState, useMemo } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { createSplitDiff, getDiffStats } from '../utils/diffUtils';
import { Columns2, FileCode, Plus, Minus } from 'lucide-react';

// Custom theme based on VS Code Dark+
const codeTheme = {
  ...themes.vsDark,
  plain: {
    ...themes.vsDark.plain,
    backgroundColor: 'transparent'
  }
};

function CodeLine({ content, lineNumber, type, language = 'java' }) {
  const bgClass = type === 'added' 
    ? 'bg-green-500/10' 
    : type === 'removed' 
    ? 'bg-red-500/10' 
    : type === 'empty'
    ? 'bg-slate-800/50'
    : '';
  
  const borderClass = type === 'added'
    ? 'border-l-2 border-green-500'
    : type === 'removed'
    ? 'border-l-2 border-red-500'
    : 'border-l-2 border-transparent';

  const lineNumClass = type === 'empty' ? 'text-slate-700' : 'text-slate-500';

  if (type === 'empty') {
    return (
      <div className={`flex ${bgClass} ${borderClass}`}>
        <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs font-mono ${lineNumClass} select-none`}>
          
        </span>
        <span className="flex-1 px-4 py-0.5 text-xs font-mono text-slate-600">
          
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${bgClass} ${borderClass} hover:bg-slate-700/30 transition-colors`}>
      <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs font-mono ${lineNumClass} select-none`}>
        {lineNumber}
      </span>
      <Highlight theme={codeTheme} code={content || ' '} language={language}>
        {({ tokens, getTokenProps }) => (
          <span className="flex-1 px-4 py-0.5 text-xs font-mono whitespace-pre overflow-x-auto">
            {tokens[0].map((token, key) => (
              <span key={key} {...getTokenProps({ token })} />
            ))}
          </span>
        )}
      </Highlight>
    </div>
  );
}

export function CodeDiffViewer({ 
  oldCode, 
  newCode, 
  oldLabel = 'Previous', 
  newLabel = 'Current',
  language = 'java'
}) {
  const [viewMode, setViewMode] = useState('split'); // 'split' or 'unified'

  const { left, right } = useMemo(() => {
    return createSplitDiff(oldCode || '', newCode || '');
  }, [oldCode, newCode]);

  const stats = useMemo(() => {
    const allLines = [...left, ...right];
    const added = right.filter(l => l.type === 'added').length;
    const removed = left.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [left, right]);

  if (!newCode) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
        <FileCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No code to display</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-slate-300">Code Changes</h3>
          
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="w-3 h-3" />
              {stats.added} added
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="w-3 h-3" />
              {stats.removed} removed
            </span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-700/50 rounded p-0.5">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'split' 
                ? 'bg-slate-600 text-slate-100' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'unified' 
                ? 'bg-slate-600 text-slate-100' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code content */}
      {viewMode === 'split' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel (old code) */}
          <div className="flex-1 flex flex-col border-r border-slate-700 overflow-hidden">
            <div className="px-4 py-1.5 bg-red-500/10 border-b border-slate-700">
              <span className="text-xs font-medium text-red-400">{oldLabel}</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950">
              {left.map((line, i) => (
                <CodeLine 
                  key={i} 
                  content={line.content} 
                  lineNumber={line.lineNumber}
                  type={line.type}
                  language={language}
                />
              ))}
            </div>
          </div>

          {/* Right panel (new code) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-1.5 bg-green-500/10 border-b border-slate-700">
              <span className="text-xs font-medium text-green-400">{newLabel}</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950">
              {right.map((line, i) => (
                <CodeLine 
                  key={i} 
                  content={line.content} 
                  lineNumber={line.lineNumber}
                  type={line.type}
                  language={language}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Unified view */
        <div className="flex-1 overflow-y-auto bg-slate-950">
          <Highlight theme={codeTheme} code={newCode} language={language}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre className="text-xs font-mono">
                {tokens.map((line, i) => (
                  <div 
                    key={i} 
                    {...getLineProps({ line })}
                    className="flex hover:bg-slate-700/30 transition-colors"
                  >
                    <span className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-slate-500 select-none">
                      {i + 1}
                    </span>
                    <span className="flex-1 px-4 py-0.5 whitespace-pre overflow-x-auto">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}
    </div>
  );
}
