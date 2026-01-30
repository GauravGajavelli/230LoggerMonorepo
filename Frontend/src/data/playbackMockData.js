/**
 * Mock data for the Playback interface
 */

/** @type {import('../types').SubmissionContext} */
export const mockContext = {
  studentId: 'stu-001',
  studentDisplayName: 'jsmith123',
  assignmentName: 'Assignment 3: Binary Search Trees',
  assignmentId: 'asn-003',
  submittedAt: new Date('2024-10-15T23:47:00'),
  totalEpisodes: 5
};

/** @type {import('../types').Episode[]} */
export const mockEpisodes = [
  {
    id: 'ep-1',
    startTime: 0,
    endTime: 720,
    label: 'Initial'
  },
  {
    id: 'ep-2',
    startTime: 720,
    endTime: 1440,
    label: 'Added insert'
  },
  {
    id: 'ep-3',
    startTime: 1440,
    endTime: 2160,
    label: 'Fixed null check'
  },
  {
    id: 'ep-4',
    startTime: 2160,
    endTime: 2880,
    label: 'Refactored'
  },
  {
    id: 'ep-5',
    startTime: 2880,
    endTime: 3600,
    label: 'Final fixes'
  }
];

/** @type {Map<string, import('../types').EpisodeTestData>} */
export const mockTestResults = new Map([
  ['ep-1', {
    episodeId: 'ep-1',
    runs: [
      {
        runId: 'ep-1-run-1',
        runIndex: 0,
        timestamp: new Date('2024-10-15T22:30:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'fail', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'fail', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'fail', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'fail', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'fail', changedThisRun: false }
        ],
        summary: { passed: 0, failed: 6, total: 6 }
      }
    ]
  }],
  ['ep-2', {
    episodeId: 'ep-2',
    runs: [
      {
        runId: 'ep-2-run-1',
        runIndex: 0,
        timestamp: new Date('2024-10-15T22:45:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: true, previousStatus: 'fail' },
          { id: 't2', name: 'testInsertSingle', status: 'fail', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'fail', changedThisRun: false, errorMessage: 'Expected size 1, got 2', stackTrace: `java.lang.AssertionError: Expected size 1, got 2
  at org.junit.Assert.fail(Assert.java:89)
  at org.junit.Assert.assertEquals(Assert.java:118)
  at BSTTest.testInsertDuplicate(BSTTest.java:45)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
  at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
  at java.lang.reflect.Method.invoke(Method.java:498)
Caused by:
  at BinarySearchTree.insert(BinarySearchTree.java:23)
  at BinarySearchTree.insertHelper(BinarySearchTree.java:31)` },
          { id: 't4', name: 'testDeleteRoot', status: 'fail', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: true, previousStatus: 'fail' }
        ],
        summary: { passed: 2, failed: 4, total: 6 }
      },
      {
        runId: 'ep-2-run-2',
        runIndex: 1,
        timestamp: new Date('2024-10-15T22:52:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: true, previousStatus: 'fail' },
          { id: 't3', name: 'testInsertDuplicate', status: 'fail', changedThisRun: false, errorMessage: 'Expected size 1, got 2', stackTrace: `java.lang.AssertionError: Expected size 1, got 2
  at org.junit.Assert.fail(Assert.java:89)
  at org.junit.Assert.assertEquals(Assert.java:118)
  at BSTTest.testInsertDuplicate(BSTTest.java:45)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)` },
          { id: 't4', name: 'testDeleteRoot', status: 'fail', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 3, failed: 3, total: 6 }
      }
    ]
  }],
  ['ep-3', {
    episodeId: 'ep-3',
    runs: [
      {
        runId: 'ep-3-run-1',
        runIndex: 0,
        timestamp: new Date('2024-10-15T23:00:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: true, previousStatus: 'fail' },
          { id: 't4', name: 'testDeleteRoot', status: 'fail', changedThisRun: false, errorMessage: 'NullPointerException at line 67', stackTrace: `java.lang.NullPointerException
  at BinarySearchTree.delete(BinarySearchTree.java:67)
  at BSTTest.testDeleteRoot(BSTTest.java:78)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)` },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 3, failed: 3, total: 6 }
      },
      {
        runId: 'ep-3-run-2',
        runIndex: 1,
        timestamp: new Date('2024-10-15T23:08:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: true, previousStatus: 'fail' },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 4, failed: 2, total: 6 }
      },
      {
        runId: 'ep-3-run-3',
        runIndex: 2,
        timestamp: new Date('2024-10-15T23:15:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false, errorMessage: 'Tree not balanced after insert', stackTrace: `java.lang.AssertionError: Tree not balanced after insert
  at BSTTest.testBalanceAfterInsert(BSTTest.java:102)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)` },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 4, failed: 2, total: 6 }
      }
    ]
  }],
  ['ep-4', {
    episodeId: 'ep-4',
    runs: [
      {
        runId: 'ep-4-run-1',
        runIndex: 0,
        timestamp: new Date('2024-10-15T23:25:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'fail', changedThisRun: false, errorMessage: 'Tree not balanced after insert', stackTrace: `java.lang.AssertionError: Tree not balanced after insert
  at BSTTest.testBalanceAfterInsert(BSTTest.java:102)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)` },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 4, failed: 2, total: 6 }
      },
      {
        runId: 'ep-4-run-2',
        runIndex: 1,
        timestamp: new Date('2024-10-15T23:35:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'pass', changedThisRun: true, previousStatus: 'fail' },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: false }
        ],
        summary: { passed: 5, failed: 1, total: 6 }
      }
    ]
  }],
  ['ep-5', {
    episodeId: 'ep-5',
    runs: [
      {
        runId: 'ep-5-run-1',
        runIndex: 0,
        timestamp: new Date('2024-10-15T23:40:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'pass', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'fail', changedThisRun: true, previousStatus: 'pass', errorMessage: 'Traversal order incorrect', stackTrace: `java.lang.AssertionError: Traversal order incorrect
  at BSTTest.testTraversalInOrder(BSTTest.java:120)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)` }
        ],
        summary: { passed: 5, failed: 1, total: 6 }
      },
      {
        runId: 'ep-5-run-2',
        runIndex: 1,
        timestamp: new Date('2024-10-15T23:47:00'),
        results: [
          { id: 't1', name: 'testInsertEmpty', status: 'pass', changedThisRun: false },
          { id: 't2', name: 'testInsertSingle', status: 'pass', changedThisRun: false },
          { id: 't3', name: 'testInsertDuplicate', status: 'pass', changedThisRun: false },
          { id: 't4', name: 'testDeleteRoot', status: 'pass', changedThisRun: false },
          { id: 't5', name: 'testBalanceAfterInsert', status: 'pass', changedThisRun: false },
          { id: 't6', name: 'testTraversalInOrder', status: 'pass', changedThisRun: true, previousStatus: 'fail' }
        ],
        summary: { passed: 6, failed: 0, total: 6 }
      }
    ]
  }]
]);

/** @type {Map<string, import('../types').Feedback>} */
export const mockFeedback = new Map([
  ['t3', {
    testId: 't3',
    pattern: 'Duplicate Handling',
    confidence: 'high',
    explanation: 'Your insert method adds nodes even when the value already exists. Binary search trees typically either reject duplicates or update the existing node. The test expects that inserting the same value twice should result in a tree with size 1.',
    nextSteps: [
      'Add a check: if (value.equals(current.data)) before creating a new node',
      'Decide: should duplicates go left, right, or be rejected?',
      'Review: What does the assignment spec say about duplicates?'
    ],
    relatedCodeLocation: {
      file: 'BinarySearchTree.java',
      startLine: 23,
      endLine: 25
    }
  }],
  ['t4', {
    testId: 't4',
    pattern: 'Null Reference',
    confidence: 'high',
    explanation: 'When deleting the root node, your code doesn\'t properly handle the case where the root becomes null or when reassigning the root reference. This causes a NullPointerException when traversing.',
    nextSteps: [
      'Check if the node to delete is the root before proceeding',
      'Handle the special case where the root has no children',
      'Ensure you update the root reference after deletion'
    ],
    relatedCodeLocation: {
      file: 'BinarySearchTree.java',
      startLine: 65,
      endLine: 70
    },
    drills: [
      {
        title: 'BST Delete Practice',
        description: 'Practice deleting nodes in various positions of a BST'
      }
    ]
  }],
  ['t5', {
    testId: 't5',
    pattern: 'Balance Factor',
    confidence: 'medium',
    explanation: 'The tree is not maintaining its balance property after insertions. This suggests the rotation logic may not be triggering correctly or the balance factor calculation is off.',
    nextSteps: [
      'Verify your balance factor calculation: height(left) - height(right)',
      'Check that rotations are called when |balance factor| > 1',
      'Make sure height updates propagate up the tree after insertion'
    ],
    relatedCodeLocation: {
      file: 'BinarySearchTree.java',
      startLine: 89,
      endLine: 95
    }
  }]
]);

/**
 * Get all runs for an episode
 * @param {string} episodeId
 * @returns {import('../types').TestRun[]}
 */
export function getRunsForEpisode(episodeId) {
  const episodeData = mockTestResults.get(episodeId);
  return episodeData?.runs || [];
}

/**
 * Get tests for a specific run in an episode
 * @param {string} episodeId
 * @param {number} runIndex
 * @returns {import('../types').TestResult[]}
 */
export function getTestsForRun(episodeId, runIndex) {
  const runs = getRunsForEpisode(episodeId);
  if (runIndex < 0 || runIndex >= runs.length) {
    return runs[runs.length - 1]?.results || [];
  }
  return runs[runIndex]?.results || [];
}

/**
 * Get progress data points with run information for the chart
 * @returns {import('../types').RunProgressDataPoint[]}
 */
export function getProgressDataPointsWithRuns() {
  const dataPoints = [];

  mockEpisodes.forEach(episode => {
    const episodeData = mockTestResults.get(episode.id);
    if (!episodeData) return;

    episodeData.runs.forEach((run) => {
      dataPoints.push({
        episodeId: episode.id,
        runId: run.runId,
        runIndex: run.runIndex,
        label: episode.label,
        passCount: run.summary.passed,
        totalTests: run.summary.total
      });
    });
  });

  return dataPoints;
}

/**
 * Get progress data points for the chart (legacy - uses latest run per episode)
 * @returns {import('../types').ProgressDataPoint[]}
 */
export function getProgressDataPoints() {
  return mockEpisodes.map(episode => {
    const episodeData = mockTestResults.get(episode.id);
    const latestRun = episodeData?.runs[episodeData.runs.length - 1];

    return {
      episodeId: episode.id,
      label: episode.label,
      passCount: latestRun?.summary.passed || 0,
      totalTests: latestRun?.summary.total || 0
    };
  });
}

/**
 * Get test summary for an episode (uses latest run)
 * @param {string} episodeId
 * @param {number} [runIndex=-1] - Run index, or -1 for latest
 * @returns {import('../types').TestSummary}
 */
export function getTestSummary(episodeId, runIndex = -1) {
  const runs = getRunsForEpisode(episodeId);
  if (runs.length === 0) {
    return { passed: 0, failed: 0, total: 0 };
  }

  const effectiveIndex = runIndex < 0 ? runs.length - 1 : Math.min(runIndex, runs.length - 1);
  return runs[effectiveIndex]?.summary || { passed: 0, failed: 0, total: 0 };
}

/**
 * Get a flat list of all runs across all episodes
 * @returns {Array<{episodeId: string, episodeIndex: number, run: import('../types').TestRun, globalIndex: number}>}
 */
export function getAllRunsFlat() {
  const flatRuns = [];
  mockEpisodes.forEach((episode, episodeIndex) => {
    const episodeData = mockTestResults.get(episode.id);
    if (!episodeData) return;
    episodeData.runs.forEach((run) => {
      flatRuns.push({
        episodeId: episode.id,
        episodeIndex,
        run,
        globalIndex: flatRuns.length
      });
    });
  });
  return flatRuns;
}
