import { 
  Sparkles, 
  Search, 
  ListChecks, 
  BookOpen, 
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

function PriorityBadge({ priority }) {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30'
  };

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded border ${colors[priority]}`}>
      {priority}
    </span>
  );
}

function ConfidenceMeter({ confidence }) {
  const percentage = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">{percentage}%</span>
    </div>
  );
}

export function AIFeedbackPanel({ feedback }) {
  if (!feedback) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
        <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No feedback available</p>
      </div>
    );
  }

  const { bugPattern, nextSteps = [], conceptLinks = [] } = feedback;
  const isAllPassing = bugPattern?.type === 'none';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-slate-200">AI Debugging Coach</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Bug Pattern Analysis */}
        {bugPattern && (
          <div className={`p-3 rounded-lg border ${
            isAllPassing 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div className="flex items-start gap-3">
              {isAllPassing ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Search className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`text-sm font-medium ${isAllPassing ? 'text-green-400' : 'text-amber-400'}`}>
                    {isAllPassing ? 'All Tests Passing!' : 'Likely Bug Pattern'}
                  </h4>
                  {!isAllPassing && <ConfidenceMeter confidence={bugPattern.confidence} />}
                </div>
                
                {!isAllPassing && bugPattern.type && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/50 rounded text-xs font-mono text-slate-300 mb-2">
                    <AlertCircle className="w-3 h-3" />
                    {bugPattern.type.replace(/_/g, ' ')}
                  </div>
                )}
                
                <p className="text-xs text-slate-300 leading-relaxed">
                  {bugPattern.description}
                </p>

                {bugPattern.affectedLines?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Affected lines: {bugPattern.affectedLines.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-medium text-slate-200">Next Steps</h4>
            </div>
            <div className="space-y-2">
              {nextSteps.map((step, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium flex-shrink-0">
                    {step.step}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {step.action}
                    </p>
                  </div>
                  <PriorityBadge priority={step.priority} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Concept Links */}
        {conceptLinks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-medium text-slate-200">Related Concepts</h4>
            </div>
            <div className="space-y-2">
              {conceptLinks.map((link, index) => (
                <div 
                  key={index}
                  className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">
                      {link.concept}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-5">
                    {link.relevance}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational footer when all passing */}
        {isAllPassing && (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm text-slate-400">
              Excellent debugging work! Keep building those skills.
            </p>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-700">
        <p className="text-[10px] text-slate-500 text-center">
          AI suggestions are for guidance only. Always verify with course materials.
        </p>
      </div>
    </div>
  );
}
