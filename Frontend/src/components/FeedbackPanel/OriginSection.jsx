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
    <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-4 h-4 text-yellow-600" />
        <h4 className="text-sm font-medium text-gray-900">Failure Timeline</h4>
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
              <span className="w-2 h-2 rounded-sm ring-2 ring-yellow-500 ring-offset-1 ring-offset-white" />
              origin
            </span>
          )}
        </div>
      </div>

      {/* Origin info and jump button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-700">
            <span className="text-yellow-600 font-medium">Origin:</span> Run {originRun}
            {isRegression && (
              <span className="ml-2 text-xs text-orange-600">(regression)</span>
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
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-[#800000] hover:text-[#a00000] hover:bg-red-50'
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
