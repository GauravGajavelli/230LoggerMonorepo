import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Individual test result item
 *
 * @param {Object} props
 * @param {import('../../types').TestResult} props.test
 * @param {boolean} props.isSelected
 * @param {() => void} props.onClick
 */
export function TestItem({ test, isSelected, onClick }) {
  const isPassing = test.status === 'pass';
  const isError = test.status === 'error';
  const isSkip = test.status === 'skip';

  // Determine background color based on status
  const getBgClass = () => {
    if (isPassing) return 'bg-green-900/20 hover:bg-green-900/30';
    if (isError) return 'bg-yellow-900/20 hover:bg-yellow-900/30';
    if (isSkip) return 'bg-gray-700/20 hover:bg-gray-700/30';
    return 'bg-red-900/20 hover:bg-red-900/30';
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

  return (
    <div
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg cursor-pointer transition
        ${getBgClass()}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full ${getDotClass()}`} />

          {/* Test name */}
          <span className="font-mono text-sm text-gray-200">
            {test.name}
          </span>
        </div>

        {/* Change indicator */}
        {renderChangeIndicator()}
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
