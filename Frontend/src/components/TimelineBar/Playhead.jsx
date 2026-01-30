/**
 * Playhead indicator on the timeline
 *
 * @param {Object} props
 * @param {number} props.currentTime - Current position in seconds
 * @param {number} props.totalDuration - Total duration in seconds
 */
export function Playhead({ currentTime, totalDuration }) {
  if (totalDuration === 0) return null;

  const positionPercent = (currentTime / totalDuration) * 100;

  return (
    <div
      className="absolute top-0 h-8 pointer-events-none z-10"
      style={{ left: `${positionPercent}%` }}
    >
      {/* Top circle */}
      <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5" />

      {/* Vertical line */}
      <div className="w-0.5 h-8 bg-red-500 -mt-1.5 ml-[5px]" />
    </div>
  );
}
