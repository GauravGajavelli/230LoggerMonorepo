import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { HighlightItem } from './HighlightItem';

const MAX_VISIBLE = 5;

export function FailureHighlights({
  stillFailing = [],
  regressions = [],
  costlyDetours = [],
  selectedTestId,
  onTestSelect,
  onJumpToOrigin,
  getOriginRun
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const totalHighlights = stillFailing.length + regressions.length + costlyDetours.length;

  // Merge all highlights, tag with category, sort by meaningfulness, cap at 5
  const allSorted = useMemo(() => {
    const tagged = [
      ...stillFailing.map(t => ({ test: t, category: 'stillFailing', icon: '\u{1F534}', title: 'Still Failing' })),
      ...regressions.map(t => ({ test: t, category: 'regression', icon: '\u{1F504}', title: 'Recurring' })),
      ...costlyDetours.map(t => ({ test: t, category: 'costlyDetour', icon: '\u23F1\uFE0F', title: 'Costly Detour' })),
    ];
    return tagged.sort((a, b) => (b.test.meaningfulnessScore || 0) - (a.test.meaningfulnessScore || 0));
  }, [stillFailing, regressions, costlyDetours]);

  if (totalHighlights === 0) {
    return null;
  }

  const visible = isExpanded ? allSorted : allSorted.slice(0, MAX_VISIBLE);
  const hiddenCount = totalHighlights - MAX_VISIBLE;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <h3 className="text-sm font-medium text-gray-900">
            Summary
          </h3>
          <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
            {totalHighlights}
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 py-3 space-y-1.5">
          {visible.map(({ test: testHistory, category }) => {
            const originRun = getOriginRun?.(testHistory.testId);
            return (
              <HighlightItem
                key={testHistory.testId}
                testHistory={testHistory}
                category={category}
                originRun={originRun}
                isSelected={selectedTestId === testHistory.testId}
                onSelect={() => onTestSelect(testHistory.testId)}
                onJumpToOrigin={() => originRun && onJumpToOrigin(originRun, testHistory.testId)}
              />
            );
          })}

          {!isExpanded && hiddenCount > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-2 w-full py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition"
            >
              Show all {totalHighlights} highlights
            </button>
          )}
          {isExpanded && hiddenCount > 0 && (
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-2 w-full py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default FailureHighlights;
