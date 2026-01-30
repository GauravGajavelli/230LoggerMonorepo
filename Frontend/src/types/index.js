/**
 * Type definitions for the CSSE 230 Feedback Tool
 * Using JSDoc for type annotations
 */

/**
 * @typedef {Object} Episode
 * @property {string} id
 * @property {number} startTime - seconds from start
 * @property {number} endTime - seconds from start
 * @property {string} label - e.g., "Fixed null check"
 * @property {Object} [snapshot] - reference to code state
 */

/**
 * @typedef {'pass' | 'fail' | 'error' | 'skip'} TestStatus
 */

/**
 * @typedef {Object} TestResult
 * @property {string} id
 * @property {string} name - e.g., "testInsertDuplicate"
 * @property {TestStatus} status
 * @property {boolean} changedThisRun - true if status changed from previous episode
 * @property {TestStatus} [previousStatus] - what it was before
 * @property {string} [errorMessage] - short error summary
 * @property {string} [stackTrace] - full stack trace
 */

/**
 * @typedef {Object} CodeLocation
 * @property {string} file
 * @property {number} startLine
 * @property {number} endLine
 */

/**
 * @typedef {Object} Drill
 * @property {string} title
 * @property {string} description
 */

/**
 * @typedef {'high' | 'medium' | 'low'} Confidence
 */

/**
 * @typedef {Object} Feedback
 * @property {string} testId
 * @property {string} pattern - e.g., "Off-by-one", "Null reference"
 * @property {Confidence} confidence
 * @property {string} explanation - 2-3 sentence explanation
 * @property {string[]} nextSteps - ordered list of suggestions
 * @property {CodeLocation} [relatedCodeLocation]
 * @property {Drill[]} [drills] - optional practice exercises
 */

/**
 * @typedef {Object} PlaybackState
 * @property {number} currentTime - seconds
 * @property {boolean} isPlaying
 * @property {number} playbackSpeed - 1, 2, 4
 * @property {string} currentEpisodeId
 */

/**
 * @typedef {Object} SubmissionContext
 * @property {string} studentId
 * @property {string} studentDisplayName - anonymized or real
 * @property {string} assignmentName
 * @property {string} assignmentId
 * @property {Date} submittedAt
 * @property {number} totalEpisodes
 */

/**
 * @typedef {Object} TestSummary
 * @property {number} passed
 * @property {number} failed
 * @property {number} total
 */

/**
 * @typedef {Object} ProgressDataPoint
 * @property {string} episodeId
 * @property {string} label
 * @property {number} passCount
 * @property {number} totalTests
 */

/**
 * @typedef {Object} StackFrame
 * @property {string} text
 * @property {'error' | 'causedBy' | 'userCode' | 'external'} type
 * @property {string} [file]
 * @property {number} [line]
 * @property {boolean} clickable
 */

/**
 * @typedef {Object} TestRun
 * @property {string} runId
 * @property {number} runIndex
 * @property {Date} timestamp
 * @property {TestResult[]} results
 * @property {TestSummary} summary
 */

/**
 * @typedef {Object} EpisodeTestData
 * @property {string} episodeId
 * @property {TestRun[]} runs
 */

/**
 * @typedef {Object} RunProgressDataPoint
 * @property {string} episodeId
 * @property {string} runId
 * @property {number} runIndex
 * @property {string} label
 * @property {number} passCount
 * @property {number} totalTests
 */

export {};
