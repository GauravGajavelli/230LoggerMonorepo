/**
 * Sparkline component for visualizing test status history
 *
 * Shows a compact timeline where each cell represents a run:
 * - Filled (red/orange) = fail/error
 * - Empty (green) = pass
 * - Gray = skip/unknown
 */

/**
 * @param {Object} props
 * @param {Object<number, string>} props.statusByRun - Map of run number to status
 * @param {number} [props.highlightRun] - Run number to highlight (e.g., origin)
 * @param {number} [props.currentRun] - Current run number (shows different highlight)
 * @param {(runNumber: number) => void} [props.onClickRun] - Callback when a run is clicked
 * @param {'compact' | 'normal' | 'large'} [props.size='normal'] - Size variant
 * @param {string} [props.className] - Additional CSS classes
 */
export function Sparkline({
  statusByRun,
  highlightRun,
  currentRun,
  onClickRun,
  size = 'normal',
  className = ''
}) {
  // Get sorted run numbers
  const runs = Object.entries(statusByRun || {})
    .map(([num, status]) => ({ runNumber: Number(num), status }))
    .sort((a, b) => a.runNumber - b.runNumber);

  if (runs.length === 0) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    compact: 'w-1 h-2 gap-px',
    normal: 'w-1.5 h-3 gap-px',
    large: 'w-2 h-4 gap-0.5'
  };

  const { width, height, gap } = {
    compact: { width: 'w-1', height: 'h-2', gap: 'gap-px' },
    normal: { width: 'w-1.5', height: 'h-3', gap: 'gap-px' },
    large: { width: 'w-2', height: 'h-4', gap: 'gap-0.5' }
  }[size];

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'bg-green-600';
      case 'fail':
        return 'bg-red-500';
      case 'error':
        return 'bg-orange-500';
      case 'skip':
        return 'bg-gray-500';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pass':
        return 'passing';
      case 'fail':
        return 'failing';
      case 'error':
        return 'error';
      case 'skip':
        return 'skipped';
      default:
        return 'unknown';
    }
  };

  return (
    <div
      className={`flex items-center ${gap} ${className}`}
      role="img"
      aria-label="Test status timeline"
    >
      {runs.map(({ runNumber, status }) => {
        const isHighlighted = highlightRun === runNumber;
        const isCurrent = currentRun === runNumber;
        const isClickable = !!onClickRun;

        return (
          <div
            key={runNumber}
            className={`
              ${width} ${height} rounded-sm transition-all
              ${getStatusColor(status)}
              ${isHighlighted ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-white' : ''}
              ${isCurrent ? 'ring-2 ring-[#800000] ring-offset-1 ring-offset-white' : ''}
              ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}
            `}
            onClick={() => onClickRun?.(runNumber)}
            title={`Run ${runNumber}: ${getStatusLabel(status)}`}
            role={isClickable ? 'button' : undefined}
            aria-label={`Run ${runNumber}: ${getStatusLabel(status)}${isHighlighted ? ' (origin)' : ''}${isCurrent ? ' (current)' : ''}`}
          />
        );
      })}
    </div>
  );
}

/**
 * Sparkline with legend showing what colors mean
 */
export function SparklineWithLegend({
  statusByRun,
  highlightRun,
  currentRun,
  onClickRun,
  size = 'normal',
  className = ''
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Sparkline
        statusByRun={statusByRun}
        highlightRun={highlightRun}
        currentRun={currentRun}
        onClickRun={onClickRun}
        size={size}
      />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-green-600" />
          pass
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          fail
        </span>
      </div>
    </div>
  );
}

export default Sparkline;
