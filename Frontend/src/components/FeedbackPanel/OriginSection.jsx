import { ArrowLeft, GitBranch } from 'lucide-react';
import { Sparkline } from '../Sparkline';

/**
 * Section showing failure origin info with sparkline and navigation
 *
 * @param {Object} props
 * @param {import('../../types').TestHistory | null} props.testHistory - Test history data
 * @param {number | null} props.originRun - The run where this failure originated
 * @param {number} [props.currentRun] - Current run number for highlighting
 * @param {boolean} props.isRegression - Whether this is a regression (was passing before)
 * @param {() => void} props.onJumpToOrigin - Callback when jump button is clicked
 * @param {(runNumber: number) => void} [props.onClickRun] - Callback when sparkline cell is clicked
 */
export function OriginSection({
  testHistory,
  originRun,
  currentRun,
  isRegression,
  onJumpToOrigin,
  onClickRun
}) {
  if (!testHistory || !originRun) {
    return null;
  }

  // Determine description based on failure type
  const getOriginDescription = () => {
    if (testHistory.isLingeringFailure) {
      if (isRegression) {
        return `Last worked at run ${originRun - 1}, broke at run ${originRun}`;
      }
      return `Failing since run ${originRun}`;
    }

    // For fixed failures (costly detours or regressions)
    const intervals = testHistory.failureIntervals || [];
    const lastInterval = intervals[intervals.length - 1];
    if (lastInterval && lastInterval.endRun) {
      return `Failed from run ${lastInterval.startRun} to ${lastInterval.endRun}`;
    }

    return `Started failing at run ${originRun}`;
  };

  // Find which episode contains the origin
  const getEpisodeInfo = () => {
    // This would need episode data passed in, for now we just show run number
    return null;
  };

  return (
    <div className="border-b border-slate-700 px-6 py-3 bg-slate-800/50">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-yellow-500" />
        <h4 className="text-sm font-medium text-slate-200">Failure Timeline</h4>
      </div>

      {/* Sparkline */}
      <div className="mb-3">
        <Sparkline
          statusByRun={testHistory.statusByRun}
          highlightRun={originRun}
          currentRun={currentRun}
          onClickRun={onClickRun}
          size="normal"
        />
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-600" />
            pass
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500" />
            fail
          </span>
          {originRun && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-800" />
              origin
            </span>
          )}
        </div>
      </div>

      {/* Origin info and jump button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-300">
            <span className="text-yellow-500 font-medium">Origin:</span> Run {originRun}
            {isRegression && (
              <span className="ml-2 text-xs text-orange-400">(regression)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {getOriginDescription()}
          </p>
        </div>

        {(() => {
          const isAtOrigin = currentRun === originRun;
          return (
            <button
              onClick={onJumpToOrigin}
              disabled={isAtOrigin}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition ${
                isAtOrigin
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              {isAtOrigin ? 'At origin' : 'Jump to origin'}
            </button>
          );
        })()}
      </div>
    </div>
  );
}

export default OriginSection;
