import { ExternalLink } from 'lucide-react';

/**
 * Get confidence badge styling
 * @param {'high' | 'medium' | 'low'} confidence
 */
function getConfidenceBadge(confidence) {
  switch (confidence) {
    case 'high':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'High confidence'
      };
    case 'medium':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Medium confidence'
      };
    case 'low':
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        label: 'Low confidence'
      };
  }
}

/**
 * Display AI-generated explanation and next steps
 *
 * @param {Object} props
 * @param {import('../../types').Feedback} props.feedback
 * @param {boolean} [props.compact=false] - For inline display
 * @param {(location: { file: string, line: number }) => void} [props.onJumpToCode]
 */
export function FeedbackContent({ feedback, compact = false, onJumpToCode }) {
  const confidenceBadge = getConfidenceBadge(feedback.confidence);

  const handleJumpToCode = () => {
    if (feedback.relatedCodeLocation && onJumpToCode) {
      onJumpToCode({
        file: feedback.relatedCodeLocation.file,
        line: feedback.relatedCodeLocation.startLine
      });
    }
  };

  return (
    <div className={`space-y-4 ${compact ? 'text-sm' : ''}`}>
      {/* Header with confidence badge */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">What's happening</h4>
        <span className={`px-1.5 py-0.5 rounded text-xs ${confidenceBadge.bg} ${confidenceBadge.text}`}>
          {confidenceBadge.label}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-sm text-gray-600">
        {feedback.explanation}
      </p>

      {/* Next steps */}
      {feedback.nextSteps && feedback.nextSteps.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Next steps to try</h4>
          <ol className="space-y-2">
            {feedback.nextSteps.map((step, index) => (
              <li key={index} className="text-sm text-gray-600 flex">
                <span className="text-[#800000] font-medium mr-2 flex-shrink-0">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Related code location */}
      {feedback.relatedCodeLocation && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Related: Lines {feedback.relatedCodeLocation.startLine}-{feedback.relatedCodeLocation.endLine} in{' '}
              {feedback.relatedCodeLocation.file}
            </span>
            {onJumpToCode && (
              <button
                onClick={handleJumpToCode}
                className="text-[#800000] hover:text-[#a00000] cursor-pointer flex items-center gap-1"
              >
                Jump <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Practice drills (if available) */}
      {feedback.drills && feedback.drills.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2 text-sm">Practice Exercises</h4>
          <div className="space-y-2">
            {feedback.drills.map((drill, index) => (
              <div key={index} className="bg-gray-100 rounded p-2">
                <div className="text-sm text-gray-700 font-medium">{drill.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{drill.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
