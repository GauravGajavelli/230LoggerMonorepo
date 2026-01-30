/**
 * Sort tests into changed and other categories
 * @param {import('../types').TestResult[]} tests
 * @returns {{ changed: import('../types').TestResult[], other: import('../types').TestResult[] }}
 */
export function sortTests(tests) {
  const changed = tests
    .filter(t => t.changedThisRun)
    .sort((a, b) => {
      // Newly failing first, then newly passing
      if (a.status === 'fail' && b.status !== 'fail') return -1;
      if (a.status !== 'fail' && b.status === 'fail') return 1;
      return a.name.localeCompare(b.name);
    });

  const other = tests
    .filter(t => !t.changedThisRun)
    .sort((a, b) => {
      // Failing first, then by name
      if (a.status === 'fail' && b.status !== 'fail') return -1;
      if (a.status !== 'fail' && b.status === 'fail') return 1;
      return a.name.localeCompare(b.name);
    });

  return { changed, other };
}
