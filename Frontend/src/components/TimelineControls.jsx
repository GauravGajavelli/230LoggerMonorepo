import { useMemo } from 'react';

/**
 * Format milliseconds offset to MM:SS format
 */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Timeline controls with slider and playback buttons
 * Button order: Jump Start, Step Back, Play/Pause, Step Forward, Jump End, Speed
 */
export function TimelineControls({
  submissions,
  currentIndex,
  isPlaying,
  speed,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onJumpTo,
  onCycleSpeed
}) {
  // Calculate timestamps relative to first submission
  const { startTime, endTime, currentTime } = useMemo(() => {
    if (!submissions.length) {
      return { startTime: 0, endTime: 0, currentTime: 0 };
    }

    const firstTimestamp = new Date(submissions[0].timestamp).getTime();
    const lastTimestamp = new Date(submissions[submissions.length - 1].timestamp).getTime();
    const currentTimestamp = submissions[currentIndex]
      ? new Date(submissions[currentIndex].timestamp).getTime()
      : firstTimestamp;

    return {
      startTime: 0,
      endTime: lastTimestamp - firstTimestamp,
      currentTime: currentTimestamp - firstTimestamp
    };
  }, [submissions, currentIndex]);

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex >= submissions.length - 1;

  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    onJumpTo(newIndex);
  };

  const handleJumpStart = () => onJumpTo(0);
  const handleJumpEnd = () => onJumpTo(submissions.length - 1);

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-3">
      {/* Slider row */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400 font-mono w-14 text-right">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={submissions.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500
                     [&::-webkit-slider-thumb]:hover:bg-blue-400
                     [&::-webkit-slider-thumb]:transition-colors"
        />

        <span className="text-sm text-slate-400 font-mono w-14">
          {formatTime(endTime)}
        </span>
      </div>

      {/* Button row: |<< << Play/Pause >> >>| [Speed] */}
      <div className="flex items-center justify-center gap-2">
        {/* Jump to Start */}
        <button
          onClick={handleJumpStart}
          disabled={isAtStart}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Jump to start"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Step Back */}
        <button
          onClick={onStepBackward}
          disabled={isAtStart}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Step back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Step Forward */}
        <button
          onClick={onStepForward}
          disabled={isAtEnd}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Step forward"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Jump to End */}
        <button
          onClick={handleJumpEnd}
          disabled={isAtEnd}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Jump to end"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        {/* Speed selector */}
        <button
          onClick={onCycleSpeed}
          className="ml-4 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors font-mono text-sm min-w-[48px]"
          title="Change playback speed"
        >
          {speed}x
        </button>
      </div>

      {/* Snapshot indicator */}
      <div className="text-center text-xs text-slate-500">
        Snapshot {currentIndex + 1} of {submissions.length}
      </div>
    </div>
  );
}
