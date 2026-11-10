import vm from 'node:vm';
import assert from 'node:assert';

export function runSourceSuite({ source, tests, timeoutMs = 3000 }) {
  const sandbox = {
    assert,
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
  };
  vm.createContext(sandbox);

  const testBlocks = tests.map((test) => `
    try {
      await (async () => {
        ${test.code || ''}
      })();
      __results.push({ ok: true });
    } catch (error) {
      __results.push({ ok: false, error: String((error && error.message) || error) });
    }
  `).join('\n');

  const code = `
    (async () => {
      ${source || ''}
      const __results = [];
      ${testBlocks}
      return __results;
    })()
  `;

  let promise;
  try {
    promise = vm.runInContext(code, sandbox, { timeout: timeoutMs, filename: 'exercise.js' });
  } catch (error) {
    const message = String((error && error.message) || error);
    return tests.map((test) => ({ name: test.name, ok: false, error: message }));
  }

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
  });

  return Promise.race([promise, timeout])
    .then((results) => {
      clearTimeout(timer);
      if (results && results.__timeout) {
        return tests.map((test) => ({ name: test.name, ok: false, error: `TIMEOUT ${timeoutMs}ms` }));
      }
      return tests.map((test, index) => ({
        name: test.name,
        ok: Boolean(results?.[index]?.ok),
        error: results?.[index]?.error || '',
      }));
    })
    .catch((error) => {
      clearTimeout(timer);
      const message = String((error && error.message) || error);
      return tests.map((test) => ({ name: test.name, ok: false, error: message }));
    });
}

export async function checkJsExercise(task) {
  const tests = Array.isArray(task.tests) ? task.tests : [];
  const usingNodeTrack = !task.__track || task.__track === 'node';
  const solution = usingNodeTrack ? task.solution : task.python?.solution;
  const starter = usingNodeTrack ? task.starter : task.python?.starter;
  const solutionResults = await runSourceSuite({ source: solution, tests });
  const starterResults = await runSourceSuite({ source: starter, tests });
  return {
    solutionResults,
    starterResults,
    solutionPassed: solutionResults.every((result) => result.ok),
    starterFailed: starterResults.some((result) => !result.ok),
  };
}
