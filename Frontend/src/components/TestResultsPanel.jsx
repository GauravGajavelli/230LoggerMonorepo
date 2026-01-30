import { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  FileCode
} from 'lucide-react';
import { getStatusColor, getStatusBgColor } from '../utils/formatUtils';

function TestFailureItem({ failure, isExpanded, onToggle }) {
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800 hover:bg-slate-700/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm font-mono text-slate-200 truncate">
          {failure.testName}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-3 bg-slate-900 border-t border-slate-700 space-y-3">
          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Expected</span>
              <p className="text-xs font-mono text-green-400 mt-1 p-2 bg-green-500/10 rounded">
                {failure.expected}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Actual</span>
              <p className="text-xs font-mono text-red-400 mt-1 p-2 bg-red-500/10 rounded">
                {failure.actual}
              </p>
            </div>
          </div>

          {/* Stack trace */}
          {failure.stackTrace && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Stack Trace</span>
              <pre className="text-xs font-mono text-slate-400 mt-1 p-2 bg-slate-950 rounded overflow-x-auto max-h-32 overflow-y-auto">
                {failure.stackTrace}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TestResultsPanel({ testResults, status }) {
  const [expandedTests, setExpandedTests] = useState(new Set([0])); // First one expanded by default

  if (!testResults) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
        <FileCode className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No test results available</p>
      </div>
    );
  }

  const { passed, failed, total, failures = [] } = testResults;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  const toggleTest = (index) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700">
        <h3 className="text-sm font-medium text-slate-300">Test Results</h3>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-slate-700">
        {/* Pass/Fail counts */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {passed === total ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : failed > 0 ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
            <span className={`text-lg font-semibold ${getStatusColor(status)}`}>
              {passed}/{total}
            </span>
            <span className="text-sm text-slate-400">tests passed</span>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(status)}`}>
            {percentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              passed === total ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1.5 text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {passed} passed
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              {failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Failed tests list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {failures.length > 0 ? (
          failures.map((failure, index) => (
            <TestFailureItem
              key={index}
              failure={failure}
              isExpanded={expandedTests.has(index)}
              onToggle={() => toggleTest(index)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500/50 mb-3" />
            <p className="text-sm text-green-400 font-medium">All tests passing!</p>
            <p className="text-xs text-slate-500 mt-1">Great work! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}
