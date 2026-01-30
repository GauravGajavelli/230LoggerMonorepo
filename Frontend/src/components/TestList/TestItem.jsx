import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';

/**
 * Individual test result item
 *
 * @param {Object} props
 * @param {import('../../types').TestResult} props.test
 * @param {boolean} props.isSelected
 * @param {() => void} props.onClick
 * @param {'stillFailing' | 'regression' | 'costlyDetour' | null} [props.highlightCategory] - Highlight category if test needs attention
 * @param {number | null} [props.originRun] - Origin run number for highlighted tests
 * @param {() => void} [props.onJumpToOrigin] - Callback to jump to origin run
 */
export function TestItem({ test, isSelected, onClick, highlightCategory, originRun, onJumpToOrigin }) {
  const isPassing = test.status === 'pass';
  const isError = test.status === 'error';
  const isSkip = test.status === 'skip';

  // Determine background color based on status and highlight category
  const getBgClass = () => {
    if (isPassing) return 'bg-green-50 hover:bg-green-100';
    if (isError) return 'bg-yellow-50 hover:bg-yellow-100';
    if (isSkip) return 'bg-gray-50 hover:bg-gray-100';
    // Highlighted failures get slightly different backgrounds
    if (highlightCategory === 'costlyDetour') return 'bg-yellow-50 hover:bg-yellow-100';
    return 'bg-red-50 hover:bg-red-100';
  };

  // Get left border class for highlighted tests
  const getBorderClass = () => {
    if (!highlightCategory) return '';
    switch (highlightCategory) {
      case 'stillFailing':
        return 'border-l-4 border-l-red-500';
      case 'regression':
        return 'border-l-4 border-l-orange-500';
      case 'costlyDetour':
        return 'border-l-4 border-l-yellow-500';
      default:
        return '';
    }
  };

  // Determine status dot color
  const getDotClass = () => {
    if (isPassing) return 'bg-green-500';
    if (isError) return 'bg-yellow-500';
    if (isSkip) return 'bg-gray-500';
    return 'bg-red-500';
  };

  // Determine change indicator
  const renderChangeIndicator = () => {
    if (!test.changedThisRun) return null;

    // Newly passing (was failing/error/skip)
    if (isPassing) {
      return (
        <ArrowUp className="w-4 h-4 text-green-400" />
      );
    }

    // Newly failing
    return (
      <ArrowDown className="w-4 h-4 text-red-400" />
    );
  };

  // Format previous status text
  const getPreviousStatusText = () => {
    if (!test.changedThisRun || !test.previousStatus) return null;

    switch (test.previousStatus) {
      case 'pass': return 'was: \u2713 passing';
      case 'fail': return 'was: \u2717 failing';
      case 'error': return 'was: ! error';
      case 'skip': return 'was: - skipped';
      default: return null;
    }
  };

  // Handle origin jump click
  const handleOriginClick = (e) => {
    e.stopPropagation(); // Don't trigger the main onClick
    onJumpToOrigin?.();
  };

  return (
    <div
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg cursor-pointer transition
        ${getBgClass()}
        ${getBorderClass()}
        ${isSelected ? 'ring-2 ring-[#800000]' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotClass()}`} />

          {/* Test name */}
          <span className="font-mono text-sm text-gray-900 truncate">
            {test.name}
          </span>

          {/* Category badge for highlighted tests */}
          {highlightCategory && (
            <CategoryBadge category={highlightCategory} size="compact" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Origin jump button for highlighted tests */}
          {highlightCategory && originRun && onJumpToOrigin && (
            <button
              onClick={handleOriginClick}
              className="flex items-center gap-0.5 text-xs text-[#800000] hover:text-[#a00000] transition"
              title={`Jump to run ${originRun}`}
            >
              origin
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {/* Change indicator */}
          {renderChangeIndicator()}
        </div>
      </div>

      {/* Previous status subtitle */}
      {test.changedThisRun && (
        <p className="text-xs text-gray-500 mt-0.5 ml-4">
          {getPreviousStatusText()}
        </p>
      )}
    </div>
  );
}
