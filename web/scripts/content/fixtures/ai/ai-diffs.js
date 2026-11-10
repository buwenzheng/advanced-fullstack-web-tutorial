export const reviewPolicy = {
  maxFiles: 5,
  maxChangedLines: 200,
  allowedPaths: ['web/src/', 'web/tests/'],
  forbiddenPaths: ['.github/', 'infra/'],
  allowNewDeps: false,
  requireTests: true
};

export const aiChanges = {
  clean: {
    files: [
      { path: 'web/src/link/labels.js', additions: 20, deletions: 4, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 30, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ export function labelsFor(link) { return link.tags; }'
  },
  deletedTest: {
    files: [
      { path: 'web/src/link/labels.js', additions: 12, deletions: 2, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 0, deletions: 18, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 1, changed: 1 },
    depsAdded: [],
    diffText: '- test("rejects empty tag", () => { ... });'
  },
  skippedTest: {
    files: [
      { path: 'web/src/link/labels.js', additions: 8, deletions: 1, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 6, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 10, skipped: 2, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ test.skip("flaky case", () => { ... });'
  },
  failedTest: {
    files: [
      { path: 'web/src/link/labels.js', additions: 14, deletions: 3, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 10, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 10, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ return tags.slice(0, 3);'
  },
  newDep: {
    files: [
      { path: 'web/src/link/labels.js', additions: 9, deletions: 0, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 9, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: ['slugify'],
    diffText: '+ import slugify from "slugify";'
  },
  forbiddenPath: {
    files: [
      { path: '.github/workflows/ci.yml', additions: 4, deletions: 1, status: 'modified' },
      { path: 'web/src/link/labels.js', additions: 9, deletions: 1, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 9, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ permissions: write-all'
  },
  outOfScope: {
    files: [
      { path: 'scripts/deploy.sh', additions: 6, deletions: 0, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 7, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ ./deploy.sh --force'
  },
  secretLeak: {
    files: [
      { path: 'web/src/config.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/tests/config.test.js', additions: 6, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ const token = "sk-testtesttesttesttest";'
  },
  tooManyFiles: {
    files: [
      { path: 'web/src/a.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/src/b.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/src/c.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/src/d.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/src/e.js', additions: 2, deletions: 0, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 6, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ const a = 1;'
  },
  largeDiff: {
    files: [
      { path: 'web/src/link/labels.js', additions: 150, deletions: 80, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 20, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ // 大量格式化改动'
  },
  emptyChange: {
    files: [],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 0 },
    depsAdded: [],
    diffText: ''
  },
  behaviorWithoutTests: {
    files: [
      { path: 'web/src/link/labels.js', additions: 11, deletions: 3, status: 'modified' }
    ],
    tests: { total: 12, passed: 12, skipped: 0, deleted: 0, changed: 0 },
    depsAdded: [],
    diffText: '+ return tags.slice(0, 3);'
  },
  testsNotRun: {
    files: [
      { path: 'web/src/link/labels.js', additions: 5, deletions: 0, status: 'modified' }
    ],
    tests: { total: 0, passed: 0, skipped: 0, deleted: 0, changed: 0 },
    depsAdded: [],
    diffText: '+ const limit = 3;'
  },
  multiple: {
    files: [
      { path: 'web/src/link/labels.js', additions: 4, deletions: 0, status: 'modified' },
      { path: 'web/src/link/alias.js', additions: 4, deletions: 0, status: 'modified' },
      { path: 'web/src/link/domain.js', additions: 4, deletions: 0, status: 'modified' },
      { path: 'web/src/link/tags.js', additions: 4, deletions: 0, status: 'modified' },
      { path: 'web/src/link/notes.js', additions: 4, deletions: 0, status: 'modified' },
      { path: 'web/tests/labels.test.js', additions: 30, deletions: 0, status: 'modified' }
    ],
    tests: { total: 12, passed: 11, skipped: 1, deleted: 0, changed: 1 },
    depsAdded: [],
    diffText: '+ const note = "ghp_000000000000000000000000000000000000";'
  }
};
