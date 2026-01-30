import { useState, useMemo } from 'react';

/**
 * Bar chart showing passing test count over time/episodes with multiple runs per episode
 *
 * @param {Object} props
 * @param {import('../types').RunProgressDataPoint[]} props.dataPoints
 * @param {number} [props.globalRunIndex=0] - Global run index across all episodes (used for highlighting)
 * @param {number} [props.height=80] - Chart height in pixels
 * @param {(globalIndex: number) => void} [props.onRunClick] - Callback when a run bar is clicked
 */
export function ProgressChart({ dataPoints, globalRunIndex = 0, height = 80, onRunClick }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Group data points by episode
  const episodeGroups = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    dataPoints.forEach((point, index) => {
      if (!currentGroup || currentGroup.episodeId !== point.episodeId) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          episodeId: point.episodeId,
          label: point.label,
          runs: []
        };
      }
      currentGroup.runs.push({ ...point, globalIndex: index });
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [dataPoints]);

  if (!dataPoints || dataPoints.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Progress Over Time
      </h3>

      {/* Bar container with episode groups */}
      <div
        className="flex items-end gap-2"
        style={{ height: `${height - 32}px` }}
      >
        {episodeGroups.map((group) => {
          return (
            <div
              key={group.episodeId}
              className="flex-1 flex items-end gap-px h-full"
            >
              {group.runs.map((run, runIdx) => {
                const heightPercent = run.totalTests > 0
                  ? (run.passCount / run.totalTests) * 100
                  : 0;
                // Use globalRunIndex for highlighting the current run during playback
                const isCurrentRun = run.globalIndex === globalRunIndex;
                const isPastRun = run.globalIndex < globalRunIndex;
                const isHovered = hoveredIndex === run.globalIndex;

                // Determine bar color
                let barColorClass;
                if (isCurrentRun) {
                  barColorClass = 'bg-green-500';
                } else if (isPastRun) {
                  barColorClass = 'bg-green-300';
                } else {
                  barColorClass = 'bg-gray-200';
                }

                return (
                  <div
                    key={run.runId}
                    className="relative flex-1 flex flex-col justify-end h-full min-w-[6px]"
                    onMouseEnter={() => setHoveredIndex(run.globalIndex)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => onRunClick?.(run.globalIndex)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-xs text-gray-900 px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-200 shadow-lg">
                        <div className="font-medium">{group.label}</div>
                        <div className="text-gray-600">
                          Run {runIdx + 1}: {run.passCount}/{run.totalTests} passing
                        </div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className={`rounded-t transition-all cursor-pointer hover:opacity-80 ${barColorClass}`}
                      style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gray-500">Start</span>
        <span className="text-xs text-gray-500">End</span>
      </div>
    </div>
  );
}
