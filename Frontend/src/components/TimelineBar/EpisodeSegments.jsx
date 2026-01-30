import { useState, useMemo } from 'react';

/**
 * Episode segments in the timeline with hover popup showing runs
 *
 * @param {Object} props
 * @param {import('../../types').Episode[]} props.episodes
 * @param {string} props.currentEpisodeId
 * @param {number} props.totalDuration
 * @param {(episodeId: string) => void} props.onEpisodeClick
 * @param {import('../../types').FlatRunData[]} [props.allRuns] - Flat list of all runs
 * @param {number} [props.globalRunIndex] - Current global run index
 * @param {(globalIndex: number) => void} [props.onRunClick] - Callback when run is clicked
 * @param {number | null} [props.highlightedOriginRun] - Run number to highlight as origin
 */
export function EpisodeSegments({
  episodes,
  currentEpisodeId,
  totalDuration,
  onEpisodeClick,
  allRuns,
  globalRunIndex,
  onRunClick,
  highlightedOriginRun
}) {
  const [hoveredEpisodeId, setHoveredEpisodeId] = useState(null);

  // Get runs for hovered episode
  const hoveredRuns = useMemo(() => {
    if (!hoveredEpisodeId || !allRuns) return [];
    return allRuns.filter(r => r.episodeId === hoveredEpisodeId);
  }, [hoveredEpisodeId, allRuns]);

  // Determine which episode contains the highlighted origin run
  const episodeContainsHighlight = useMemo(() => {
    if (!highlightedOriginRun || !allRuns) return {};
    const runData = allRuns.find(r => r.runNumber === highlightedOriginRun);
    if (!runData) return {};
    return { [runData.episodeId]: true };
  }, [highlightedOriginRun, allRuns]);

  if (!episodes || episodes.length === 0 || totalDuration === 0) {
    return <div className="flex-1 h-8 bg-gray-200 rounded-lg" />;
  }

  return (
    <div className="flex-1 h-8 bg-gray-200 rounded-lg flex overflow-hidden relative">
      {episodes.map((episode, index) => {
        const duration = episode.endTime - episode.startTime;
        const widthPercent = (duration / totalDuration) * 100;
        const isCurrent = episode.id === currentEpisodeId;
        const isEven = index % 2 === 0;
        const isHovered = episode.id === hoveredEpisodeId;
        const hasOrigin = episodeContainsHighlight[episode.id];
        const isFirst = index === 0;
        const isLast = index === episodes.length - 1;

        return (
          <div
            key={episode.id}
            className="relative"
            style={{ width: `${widthPercent}%` }}
            onMouseEnter={() => setHoveredEpisodeId(episode.id)}
            onMouseLeave={() => setHoveredEpisodeId(null)}
          >
            {/* Existing segment */}
            <div
              onClick={() => onEpisodeClick(episode.id)}
              className={`
                h-full flex items-center cursor-pointer transition
                hover:brightness-95
                ${isEven ? 'bg-gray-100' : 'bg-gray-50'}
                ${isCurrent ? 'ring-2 ring-[#800000] ring-inset' : ''}
                ${hasOrigin ? 'ring-2 ring-yellow-500 ring-inset' : ''}
                ${isFirst ? 'rounded-l-lg' : ''}
                ${isLast ? 'rounded-r-lg' : ''}
              `}
              title={episode.label}
            >
              <span className="text-xs text-gray-700 truncate px-2">
                {episode.label}
              </span>
            </div>

            {/* Run popup on hover */}
            {isHovered && hoveredRuns.length > 0 && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                              bg-white border border-gray-200 rounded-lg p-2 z-20
                              whitespace-nowrap shadow-lg">
                <div className="text-xs text-gray-600 mb-1">{episode.label}</div>
                <div className="flex gap-1">
                  {hoveredRuns.map((runData, idx) => {
                    const isCurrent = runData.globalIndex === globalRunIndex;
                    const isOrigin = runData.runNumber === highlightedOriginRun;
                    return (
                      <button
                        key={runData.run.runId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunClick?.(runData.globalIndex);
                        }}
                        className={`w-6 h-6 rounded text-xs font-medium transition
                          ${isCurrent
                            ? 'bg-[#800000] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                          ${isOrigin ? 'ring-2 ring-yellow-500' : ''}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
