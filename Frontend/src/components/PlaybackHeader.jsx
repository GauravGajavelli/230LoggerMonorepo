/**
 * Header component displaying submission context and overall test status
 *
 * @param {Object} props
 * @param {import('../types').SubmissionContext} props.context
 * @param {import('../types').TestSummary} props.testSummary
 * @param {import('../types').Episode} props.currentEpisode
 * @param {number} props.currentEpisodeIndex - 0-based index
 */
export function PlaybackHeader({ context, testSummary, currentEpisode, currentEpisodeIndex }) {
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <header className="bg-[#800000] border-b border-[#600000] px-6 py-4 rounded-lg">
      <div className="flex items-center justify-between">
        {/* Left: Title and context */}
        <div>
          <h1 className="text-xl font-semibold text-white">
            CSSE 230 – {context.assignmentName || 'Assignment'}
          </h1>
          <p className="text-sm text-gray-200 mt-0.5">
            Student: {context.studentDisplayName || context.studentId || 'Student'} • Submitted: {formatDate(new Date(context.submittedAt))}
          </p>
        </div>

        {/* Right: Episode and test status */}
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded px-3 py-1.5 font-mono text-sm text-white">
            Episode {currentEpisodeIndex + 1}/{context.totalEpisodes}
          </div>
          <div className={`bg-white/20 rounded px-3 py-1.5 font-mono text-sm ${
            testSummary.passed === testSummary.total
              ? 'text-green-300'
              : testSummary.failed > 0
                ? 'text-red-300'
                : 'text-white'
          }`}>
            {testSummary.passed}/{testSummary.total} passing
          </div>
        </div>
      </div>
    </header>
  );
}
