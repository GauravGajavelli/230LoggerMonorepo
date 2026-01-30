import { Play, Pause } from 'lucide-react';

/**
 * Play/Pause button and speed dropdown
 *
 * @param {Object} props
 * @param {boolean} props.isPlaying
 * @param {number} props.speed
 * @param {() => void} props.onPlayPause
 * @param {(speed: number) => void} props.onSpeedChange
 */
export function PlayControls({ isPlaying, speed, onPlayPause, onSpeedChange }) {
  return (
    <div className="flex items-center gap-2">
      {/* Play/Pause button */}
      <button
        onClick={onPlayPause}
        className="w-10 h-10 rounded-full bg-[#800000] hover:bg-[#a00000] flex items-center justify-center transition"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" />
        )}
      </button>

      {/* Speed dropdown */}
      <select
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="bg-white border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#800000]"
      >
        <option value={0.25}>0.25x</option>
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>
    </div>
  );
}
