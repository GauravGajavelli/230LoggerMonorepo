import { ArrowRight } from 'lucide-react';
import { Sparkline } from '../Sparkline';

/**
 * Individual highlight row showing a test that needs attention
 *
 * @param {Object} props
 * @param {import('../../types').TestHistory} props.testHistory - Test history data
 * @param {'stillFailing' | 'regression' | 'costlyDetour'} props.category - Highlight category
 * @param {number} [props.originRun] - The run number where this issue originated
 * @param {boolean} props.isSelected - Whether this test is currently selected
 * @param {() => void} props.onSelect - Callback when test name is clicked
 * @param {() => void} props.onJumpToOrigin - Callback when jump button is clicked
 */
export function HighlightItem({
  testHistory,
  category,
  originRun,
  isSelected,
  onSelect,
  onJumpToOrigin
}) {
  // Category icon and colors
  const getCategoryConfig = () => {
    switch (category) {
      case 'stillFailing':
        return {
          icon: '🔴',
          label: 'still failing',
          borderColor: 'border-l-red-500',
          bgColor: 'bg-red-900/20'
        };
      case 'regression':
        return {
          icon: '🔄',
          label: 'recurring',
          borderColor: 'border-l-orange-500',
          bgColor: 'bg-orange-900/20'
        };
      case 'costlyDetour':
        return {
          icon: '⏱️',
          label: 'costly detour',
          borderColor: 'border-l-yellow-500',
          bgColor: 'bg-yellow-900/20'
        };
      default:
        return {
          icon: '⚠️',
          label: 'attention',
          borderColor: 'border-l-gray-500',
          bgColor: 'bg-gray-900/20'
        };
    }
  };

  const config = getCategoryConfig();

  // Generate description text
  const getDescription = () => {
    const intervals = testHistory.failureIntervals || [];

    if (category === 'stillFailing') {
      if (intervals.length > 0) {
        const latestInterval = intervals[intervals.length - 1];
        if (latestInterval.isRegression && originRun) {
          return `failing since run ${originRun} (was passing before)`;
        }
      }
      return 'failing since start';
    }

    if (category === 'regression') {
      const recurs = intervals.length;
      return `broke ${recurs} time${recurs > 1 ? 's' : ''} after being fixed`;
    }

    if (category === 'costlyDetour') {
      const maxDuration = Math.max(...intervals.map(i => i.duration || 1), 0);
      return `took ${maxDuration} runs to fix (now passing)`;
    }

    return '';
  };

  return (
    <div
      className={`
        rounded-lg border-l-4 ${config.borderColor} ${config.bgColor}
        transition-all
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="px-3 py-2">
        {/* Test name row */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onSelect}
            className="flex items-center gap-2 text-left hover:text-white transition flex-1 min-w-0"
          >
            <span className="text-sm">{config.icon}</span>
            <span className="font-mono text-sm text-gray-200 truncate">
              {testHistory.testName}
            </span>
          </button>

          {/* Jump to origin button */}
          {originRun && (
            <button
              onClick={onJumpToOrigin}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition whitespace-nowrap"
              title={`Jump to run ${originRun}`}
            >
              Jump to origin
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Description and sparkline row */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-xs text-gray-500">
            {getDescription()}
          </span>

          {/* Mini sparkline */}
          <Sparkline
            statusByRun={testHistory.statusByRun}
            highlightRun={originRun}
            size="compact"
          />
        </div>
      </div>
    </div>
  );
}

export default HighlightItem;
