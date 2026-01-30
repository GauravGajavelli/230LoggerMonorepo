import { useMemo } from 'react';
import { TestItem } from './TestItem';
import { RunSelector } from './RunSelector';
import { sortTests } from '../../utils/testSorting';

/**
 * Scrollable list of test results, prioritizing changed results
 *
 * @param {Object} props
 * @param {import('../../types').TestResult[]} props.tests
 * @param {string | null} props.selectedTestId
 * @param {(testId: string) => void} props.onTestSelect
 * @param {string} [props.maxHeight='300px'] - Max height for scrolling
 * @param {Object} [props.runSelection] - Run selection state from useRunSelection
 * @param {number} [props.runSelection.selectedRunIndex]
 * @param {number} [props.runSelection.totalRuns]
 * @param {boolean} [props.runSelection.isFirstRun]
 * @param {boolean} [props.runSelection.isLatestRun]
 * @param {() => void} [props.runSelection.stepRunForward]
 * @param {() => void} [props.runSelection.stepRunBackward]
 * @param {import('../../types').TestRun} [props.runSelection.currentRun]
 * @param {(testId: string) => 'stillFailing' | 'regression' | 'costlyDetour' | null} [props.getHighlightCategory] - Get highlight category for a test
 * @param {(testId: string) => number | null} [props.getOriginRun] - Get origin run number for a test
 * @param {(runNumber: number, testId: string) => void} [props.onJumpToOrigin] - Callback to jump to origin run
 */
export function TestList({ tests, selectedTestId, onTestSelect, maxHeight = '300px', runSelection, getHighlightCategory, getOriginRun, onJumpToOrigin }) {
  const { changed, other } = useMemo(() => sortTests(tests), [tests]);
  const showRunSelector = runSelection && runSelection.totalRuns > 1;

  return (
    <div
      className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700"
      style={{ maxHeight }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 space-y-2">
        <h3 className="text-sm font-medium text-slate-200">Test Results</h3>
        {showRunSelector && (
          <RunSelector
            currentRunIndex={runSelection.selectedRunIndex}
            totalRuns={runSelection.totalRuns}
            isFirstRun={runSelection.isFirstRun}
            isLatestRun={runSelection.isLatestRun}
            onPrevious={runSelection.stepRunBackward}
            onNext={runSelection.stepRunForward}
            timestamp={runSelection.currentRun?.timestamp}
          />
        )}
      </div>

      {/* Changed This Run section */}
      {changed.length > 0 && (
        <div className="border-l-2 border-yellow-500">
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Changed This Run
            </span>
          </div>
          <div className="px-2 pb-2 space-y-1">
            {changed.map(test => {
              const highlightCategory = getHighlightCategory?.(test.id) || null;
              const originRun = getOriginRun?.(test.id) || null;
              return (
                <TestItem
                  key={test.id}
                  test={test}
                  isSelected={selectedTestId === test.id}
                  onClick={() => onTestSelect(test.id)}
                  highlightCategory={highlightCategory}
                  originRun={originRun}
                  onJumpToOrigin={originRun && onJumpToOrigin ? () => onJumpToOrigin(originRun, test.id) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Other Tests section */}
      {other.length > 0 && (
        <div>
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Other Tests
            </span>
          </div>
          <div className="px-2 pb-2 space-y-1">
            {other.map(test => {
              const highlightCategory = getHighlightCategory?.(test.id) || null;
              const originRun = getOriginRun?.(test.id) || null;
              return (
                <TestItem
                  key={test.id}
                  test={test}
                  isSelected={selectedTestId === test.id}
                  onClick={() => onTestSelect(test.id)}
                  highlightCategory={highlightCategory}
                  originRun={originRun}
                  onJumpToOrigin={originRun && onJumpToOrigin ? () => onJumpToOrigin(originRun, test.id) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tests.length === 0 && (
        <div className="px-3 py-8 text-center text-gray-500 text-sm">
          No test results available
        </div>
      )}
    </div>
  );
}
