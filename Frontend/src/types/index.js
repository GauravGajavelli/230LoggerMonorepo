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

/**
 * @typedef {Object} FailureInterval
 * @property {number} startRun - Run number where test started failing
 * @property {number|null} endRun - Run number where test was fixed (null if still failing)
 * @property {number} duration - Number of runs in this failure interval
 * @property {boolean} isLingering - True if still failing at final run
 * @property {boolean} isRegression - True if test was previously passing
 * @property {number} [effortTimeMs] - Optional: time spent while failing
 * @property {number} [runsWhileFailing] - Optional: runs while failing
 */

/**
 * @typedef {Object} TestHistory
 * @property {string} testId
 * @property {string} testName
 * @property {Object<number, string>} statusByRun - Status at each run number (map from run number to status)
 * @property {FailureInterval[]} failureIntervals - All failure periods
 * @property {boolean} isLingeringFailure - True if still failing at final run
 * @property {boolean} isRegression - Had at least one regression (pass→fail)
 * @property {number} recursCount - Number of failure intervals (how many times test failed)
 * @property {number} flipsWithin - Total pass↔fail transitions
 * @property {number} totalFailedRuns - Count of runs where test failed
 * @property {number} meaningfulnessScore - Computed score for ranking
 * @property {string|null} highlightCategory - "stillFailing" | "regression" | "costlyDetour" | null
 */

/**
 * @typedef {Object} FailureHighlights
 * @property {string[]} stillFailing - Test IDs of tests still failing
 * @property {string[]} regressions - Test IDs of tests with regressions
 * @property {string[]} costlyDetours - Test IDs of tests that were costly detours
 */

/**
 * @typedef {Object} FileContent
 * @property {string} name - e.g., "BinarySearchTree.java"
 * @property {string} language - e.g., "java"
 * @property {string} content - Full file content
 */

/**
 * @typedef {Object} CodeSnapshot
 * @property {number} runNumber
 * @property {FileContent[]} files
 */

/**
 * @typedef {Object} FrontendOutput
 * @property {SubmissionContext} context
 * @property {Episode[]} episodes
 * @property {EpisodeTestData[]} episodeTestData
 * @property {Feedback[]} feedback
 * @property {TestHistory[]} testHistories
 * @property {FailureHighlights} failureHighlights
 * @property {CodeSnapshot[]} [codeSnapshots] - Optional code snapshots per run
 */

export {};
