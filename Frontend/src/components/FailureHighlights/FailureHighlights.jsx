import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { HighlightItem } from './HighlightItem';

/**
 * Panel showing tests that need attention, organized by category
 *
 * Categories:
 * - Still Failing: Tests that are failing at the final run
 * - Recurring: Tests that failed, were fixed, then failed again
 * - Costly Detours: Tests that took many runs to fix (now passing)
 *
 * @param {Object} props
 * @param {import('../../types').TestHistory[]} props.stillFailing - Still failing tests
 * @param {import('../../types').TestHistory[]} props.regressions - Recurring regression tests
 * @param {import('../../types').TestHistory[]} props.costlyDetours - Costly detour tests
 * @param {string | null} props.selectedTestId - Currently selected test ID
 * @param {(testId: string) => void} props.onTestSelect - Callback when a test is selected
 * @param {(runNumber: number, testId: string) => void} props.onJumpToOrigin - Callback to jump to origin run
 * @param {(testId: string) => number | null} props.getOriginRun - Function to get origin run for a test
 */
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

  const totalHighlights = stillFailing.length + regressions.length + costlyDetours.length;

  // Don't render if there are no highlights
  if (totalHighlights === 0) {
    return null;
  }

  const renderCategory = (title, icon, tests, category) => {
    if (tests.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <span>{icon}</span>
          <span>{title} ({tests.length})</span>
        </h4>
        <div className="space-y-1.5">
          {tests.map(testHistory => {
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
        </div>
      </div>
    );
  };

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
        <div className="px-4 py-3 space-y-4">
          {renderCategory('Still Failing', '🔴', stillFailing, 'stillFailing')}
          {renderCategory('Recurring', '🔄', regressions, 'regression')}
          {renderCategory('Costly Detours', '⏱️', costlyDetours, 'costlyDetour')}
        </div>
      )}
    </div>
  );
}

export default FailureHighlights;
