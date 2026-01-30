/**
 * Compact navigation for selecting between test runs within an episode
 *
 * @param {Object} props
 * @param {number} props.currentRunIndex - Currently selected run index (0-based)
 * @param {number} props.totalRuns - Total number of runs
 * @param {boolean} props.isFirstRun - Whether current is the first run
 * @param {boolean} props.isLatestRun - Whether current is the latest run
 * @param {() => void} props.onPrevious - Navigate to previous run
 * @param {() => void} props.onNext - Navigate to next run
 * @param {Date} [props.timestamp] - Timestamp of current run
 */
export function RunSelector({
  currentRunIndex,
  totalRuns,
  isFirstRun,
  isLatestRun,
  onPrevious,
  onNext,
  timestamp
}) {
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex items-center justify-between text-xs text-gray-400">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Run:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            disabled={isFirstRun}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              isFirstRun
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700'
            }`}
            aria-label="Previous run"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-gray-300 min-w-[4ch] text-center">
            {currentRunIndex + 1} of {totalRuns}
          </span>
          <button
            onClick={onNext}
            disabled={isLatestRun}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              isLatestRun
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700'
            }`}
            aria-label="Next run"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      {timestamp && (
        <span className="text-gray-500">
          {formatTime(timestamp)}
        </span>
      )}
    </div>
  );
}
