import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { getTimelineColor, formatTimestamp } from '../utils/formatUtils';

export function PlaybackTimeline({
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
  const currentSubmission = submissions[currentIndex];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      {/* Top row: Controls and info */}
      <div className="flex items-center justify-between mb-3">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          {/* Jump to start */}
          <button
            onClick={() => onJumpTo(0)}
            disabled={currentIndex === 0}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Jump to start"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Step backward */}
          <button
            onClick={onStepBackward}
            disabled={currentIndex === 0}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous submission"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`p-2.5 rounded-full transition-colors ${
              isPlaying 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Step forward */}
          <button
            onClick={onStepForward}
            disabled={currentIndex >= submissions.length - 1}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next submission"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Jump to end */}
          <button
            onClick={() => onJumpTo(submissions.length - 1)}
            disabled={currentIndex >= submissions.length - 1}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Jump to end"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          {/* Speed control */}
          <button
            onClick={onCycleSpeed}
            className="ml-2 px-2.5 py-1 text-sm font-mono text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            title="Change playback speed"
          >
            {speed}x
          </button>
        </div>

        {/* Current position info */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Submission{' '}
            <span className="font-mono text-slate-200">
              {currentIndex + 1}
            </span>
            {' '}of{' '}
            <span className="font-mono text-slate-200">
              {submissions.length}
            </span>
          </span>
          
          {currentSubmission && (
            <span className="text-sm text-slate-500">
              {formatTimestamp(currentSubmission.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Track background */}
        <div className="h-8 bg-slate-900 rounded-lg overflow-hidden flex">
          {submissions.map((submission, index) => {
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;
            
            return (
              <button
                key={submission.id}
                onClick={() => onJumpTo(index)}
                className={`
                  flex-1 relative group transition-all duration-150
                  ${isActive ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900 z-10' : ''}
                `}
                title={`Submission ${index + 1}: ${submission.status}`}
              >
                {/* Segment color */}
                <div 
                  className={`
                    absolute inset-0.5 rounded transition-opacity
                    ${getTimelineColor(submission.status)}
                    ${isPast || isActive ? 'opacity-100' : 'opacity-30'}
                  `}
                />
                
                {/* Hover indicator */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                
                {/* Active marker */}
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Tests Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Tests Failed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>Compile Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}
