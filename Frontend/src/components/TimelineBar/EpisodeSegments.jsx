import { useState, useMemo, useRef, useEffect } from 'react';

const ASSESSMENT_ICONS = {
  productive: '▲',
  stuck: '■',
  regressing: '▼',
  breakthrough: '★',
};

const ASSESSMENT_COLORS = {
  productive: 'text-green-600',
  stuck: 'text-amber-500',
  regressing: 'text-red-500',
  breakthrough: 'text-purple-600',
};

/**
 * Shortens a concept name for display in the timeline bar.
 * e.g. "binary search tree insertion" → "insertion"
 *      "tree traversal (in-order, pre-order)" → "traversal"
 *      "exception handling" → "exceptions"
 */
function shortenConcept(concept) {
  if (!concept) return '';
  // Strip common prefixes
  let short = concept
    .replace(/^binary search tree\s*/i, '')
    .replace(/^tree\s*/i, '')
    .replace(/\s*\(.*\)$/, '');  // strip parenthetical
  // Specific shortenings
  const map = {
    'insertion': 'insert',
    'deletion': 'delete',
    'traversal': 'traversal',
    'height computation': 'height',
    'height/size computation': 'height/size',
    'size computation': 'size',
    'properties': 'properties',
    'iterator implementation': 'iterators',
    'concurrent modification detection': 'concurrency',
    'concurrent modification': 'concurrency',
    'exception handling': 'exceptions',
    'input validation': 'validation',
    'null-pointer handling': 'null handling',
    'node structure': 'node structure',
    'search (contains)': 'search',
    'search/contains operations': 'search',
    'array conversion': 'conversion',
    'compilation errors': 'compilation',
    'compilation fixes': 'compilation',
    'recursive helper methods': 'recursion',
  };
  const lower = short.toLowerCase().trim();
  return map[lower] || (short.length > 14 ? short.slice(0, 12) + '…' : short);
}

/**
 * Derives a short display label for the timeline segment.
 * Format: "1: concept, concept2" — kept short to fit in segment.
 */
function getShortLabel(episode) {
  const sem = episode.semantics;
  if (!sem) return episode.label;

  const num = episode.id?.replace(/\D/g, '') || '';

  const concepts = sem.conceptsAddressed?.slice(0, 2).map(shortenConcept).filter(Boolean);
  if (concepts && concepts.length > 0) {
    return `${num}: ${concepts.join(', ')}`;
  }

  const intent = sem.dominantIntent;
  if (intent) {
    return `${num}: ${intent}`;
  }

  return episode.label;
}

/**
 * Builds a detailed tooltip for hover.
 */
function getTooltipLabel(episode) {
  const sem = episode.semantics;
  if (!sem) return episode.label;

  const num = episode.id?.replace(/\D/g, '') || '';
  const intent = sem.dominantIntent
    ? sem.dominantIntent.charAt(0).toUpperCase() + sem.dominantIntent.slice(1)
    : '';
  const assessment = sem.progressAssessment || '';
  const concepts = sem.conceptsAddressed?.join(', ') || '';

  const parts = [`Episode ${num}`];
  if (intent) parts.push(intent);
  if (concepts) parts.push(concepts);
  if (assessment) parts.push(`(${assessment})`);
  return parts.join(' — ');
}

/**
 * Episode segments in the timeline with hover popup showing runs.
 * Horizontally scrollable with smooth auto-scroll during playback.
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
  const [hasOverflow, setHasOverflow] = useState(false);
  const scrollRef = useRef(null);
  const segmentRefs = useRef({});

  // Detect whether the episode bar actually overflows
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const check = () => setHasOverflow(container.scrollWidth > container.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [episodes]);

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

  // Smooth-scroll the current episode into view during playback (only when overflowing)
  useEffect(() => {
    if (!hasOverflow) return;
    if (!currentEpisodeId || !segmentRefs.current[currentEpisodeId]) return;
    const el = segmentRefs.current[currentEpisodeId];
    const container = scrollRef.current;
    if (!container) return;

    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    // Only scroll if the element is not fully visible
    if (elLeft < viewLeft || elRight > viewRight) {
      const targetScroll = elLeft - (container.clientWidth / 2) + (el.offsetWidth / 2);
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [currentEpisodeId, hasOverflow]);

  if (!episodes || episodes.length === 0 || totalDuration === 0) {
    return <div className="flex-1 h-8 bg-gray-300 rounded-lg" />;
  }

  // Minimum width per segment so labels are readable
  const MIN_SEGMENT_WIDTH = 110;

  return (
    <div
      ref={scrollRef}
      className={`flex-1 h-8 bg-gray-300 rounded-lg flex relative
        ${hasOverflow ? 'overflow-x-auto overflow-y-hidden scroll-smooth' : 'overflow-hidden'}`}
    >
      {episodes.map((episode, index) => {
        const duration = episode.endTime - episode.startTime;
        const widthPercent = (duration / totalDuration) * 100;
        const isCurrent = episode.id === currentEpisodeId;
        const isEven = index % 2 === 0;
        const isHovered = episode.id === hoveredEpisodeId;
        const hasOrigin = episodeContainsHighlight[episode.id];
        const isFirst = index === 0;
        const isLast = index === episodes.length - 1;

        const sem = episode.semantics;
        const assessment = sem?.progressAssessment;
        const icon = assessment ? ASSESSMENT_ICONS[assessment] : null;
        const iconColor = assessment ? ASSESSMENT_COLORS[assessment] : '';

        return (
          <div
            key={episode.id}
            ref={el => { segmentRefs.current[episode.id] = el; }}
            className="relative flex-shrink-0"
            style={{
              width: `${widthPercent}%`,
              minWidth: `${MIN_SEGMENT_WIDTH}px`,
            }}
            onMouseEnter={() => setHoveredEpisodeId(episode.id)}
            onMouseLeave={() => setHoveredEpisodeId(null)}
          >
            <div
              onClick={() => onEpisodeClick(episode.id)}
              className={`
                h-full flex items-center cursor-pointer transition-colors
                hover:brightness-95
                ${isEven ? 'bg-gray-100' : 'bg-gray-50'}
                ${isCurrent ? 'ring-2 ring-[#800000] ring-inset' : ''}
                ${hasOrigin ? 'ring-2 ring-yellow-500 ring-inset' : ''}
                ${isFirst ? 'rounded-l-lg' : ''}
                ${isLast ? 'rounded-r-lg' : ''}
              `}
              title={getTooltipLabel(episode)}
            >
              {icon && (
                <span className={`text-[10px] pl-1.5 flex-shrink-0 ${iconColor}`}>
                  {icon}
                </span>
              )}
              <span className="text-xs text-gray-700 truncate px-1.5">
                {getShortLabel(episode)}
              </span>
            </div>

            {/* Run popup on hover */}
            {isHovered && hoveredRuns.length > 0 && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                              bg-white border border-gray-200 rounded-lg p-2 z-20
                              whitespace-nowrap shadow-lg max-w-xs">
                <div className="text-xs font-medium text-gray-800 mb-1">
                  {getTooltipLabel(episode)}
                </div>
                {episode.semantics?.summary && (
                  <div className="text-xs text-gray-500 mb-1.5 whitespace-normal line-clamp-2">
                    {episode.semantics.summary}
                  </div>
                )}
                <div className="flex gap-1 flex-wrap">
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
