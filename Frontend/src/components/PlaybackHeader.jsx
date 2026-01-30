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
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Title and context */}
        <div>
          <h1 className="text-xl font-semibold text-white">
            CSSE 230 – {context.assignmentName}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Student: {context.studentDisplayName} • Submitted: {formatDate(context.submittedAt)}
          </p>
        </div>

        {/* Right: Episode and test status */}
        <div className="flex items-center gap-4">
          <div className="bg-gray-800 rounded px-3 py-1.5 font-mono text-sm text-gray-300">
            Episode {currentEpisodeIndex + 1}/{context.totalEpisodes}
          </div>
          <div className={`bg-gray-800 rounded px-3 py-1.5 font-mono text-sm ${
            testSummary.passed === testSummary.total
              ? 'text-green-400'
              : testSummary.failed > 0
                ? 'text-red-400'
                : 'text-gray-300'
          }`}>
            {testSummary.passed}/{testSummary.total} passing
          </div>
        </div>
      </div>
    </header>
  );
}
