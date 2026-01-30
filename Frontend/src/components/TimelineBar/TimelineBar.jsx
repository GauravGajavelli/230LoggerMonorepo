import { useCallback } from 'react';
import { PlayControls } from './PlayControls';
import { EpisodeSegments } from './EpisodeSegments';

/**
 * Unified timeline bar with playback controls
 * Single source of truth for playback state - controls both code viewer and timeline
 *
 * @param {Object} props
 * @param {import('../../types').Episode[]} props.episodes
 * @param {Object} props.playback - Playback state from usePlayback hook
 * @param {string} props.currentEpisodeId - Current episode derived from submission
 * @param {(episodeId: string) => void} props.onEpisodeClick
 * @param {import('../../types').FlatRunData[]} [props.allRuns] - Flat list of all runs for hover popup
 */
export function TimelineBar({
  episodes,
  playback,
  currentEpisodeId,
  onEpisodeClick,
  allRuns
}) {
  const {
    isPlaying,
    speed,
    toggle,
    setSpeed,
    currentIndex,
    totalCount
  } = playback;

  const handlePlayPause = useCallback(() => {
    toggle();
  }, [toggle]);

  const handleSpeedChange = useCallback((newSpeed) => {
    setSpeed(newSpeed);
  }, [setSpeed]);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Play controls */}
        <PlayControls
          isPlaying={isPlaying}
          speed={speed}
          onPlayPause={handlePlayPause}
          onSpeedChange={handleSpeedChange}
        />

        {/* Episode segments */}
        <div className="flex-1">
          <EpisodeSegments
            episodes={episodes}
            currentEpisodeId={currentEpisodeId}
            totalDuration={episodes.length > 0 ? episodes[episodes.length - 1].endTime : 0}
            onEpisodeClick={onEpisodeClick}
            allRuns={allRuns}
            globalRunIndex={currentIndex}
            onRunClick={(index) => playback.jumpTo(index)}
          />
        </div>

        {/* Snapshot counter */}
        <div className="text-sm font-mono text-gray-400 whitespace-nowrap">
          Snapshot {currentIndex + 1} of {totalCount}
        </div>
      </div>
    </div>
  );
}
