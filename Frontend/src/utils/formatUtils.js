/**
 * Format a timestamp for display
 */
export function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatTimestamp(isoString);
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Format test results as a string
 */
export function formatTestResults(passed, total) {
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  return `${passed}/${total} (${percentage}%)`;
}

/**
 * Get status color class based on submission status
 */
export function getStatusColor(status) {
  switch (status) {
    case 'pass':
      return 'text-green-400';
    case 'fail':
      return 'text-red-400';
    case 'error':
    case 'compile_error':
      return 'text-amber-400';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get status background color class
 */
export function getStatusBgColor(status) {
  switch (status) {
    case 'pass':
      return 'bg-green-500/20 border-green-500/50';
    case 'fail':
      return 'bg-red-500/20 border-red-500/50';
    case 'error':
    case 'compile_error':
      return 'bg-amber-500/20 border-amber-500/50';
    default:
      return 'bg-slate-500/20 border-slate-500/50';
  }
}

/**
 * Get timeline segment color class
 */
export function getTimelineColor(status) {
  switch (status) {
    case 'pass':
      return 'bg-green-500';
    case 'fail':
      return 'bg-red-500';
    case 'error':
    case 'compile_error':
      return 'bg-amber-500';
    default:
      return 'bg-slate-500';
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Parse stack trace and extract key info
 */
export function parseStackTrace(stackTrace) {
  const lines = stackTrace.split('\n');
  const result = {
    message: lines[0] || '',
    frames: []
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/at\s+(.+)\((.+):(\d+)\)/);
    if (match) {
      result.frames.push({
        method: match[1],
        file: match[2],
        line: parseInt(match[3], 10)
      });
    }
  }

  return result;
}
