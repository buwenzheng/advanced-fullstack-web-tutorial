import type { RunCaseResult, RunLog, RunResult } from './protocol.js';

export type { RunCaseResult, RunLog, RunResult } from './protocol.js';

interface BrowserConsole {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface AssertFn {
  (condition: unknown, message?: string): void;
  equal: (actual: unknown, expected: unknown, message?: string) => void;
  deepEqual: (actual: unknown, expected: unknown, message?: string) => void;
  deepStrictEqual: (actual: unknown, expected: unknown, message?: string) => void;
  strictEqual: (actual: unknown, expected: unknown, message?: string) => void;
  throws: (fn: () => unknown, matcher?: unknown, message?: string) => void;
  rejects: (promise: unknown, matcher?: unknown, message?: string) => Promise<void>;
  ok: AssertFn;
}

type RunFn = (name: string, fn: () => unknown) => void;

export function executeSuite(code: string, tests: string): Promise<RunResult> {
  const logs: RunLog[] = [];
  const results: RunCaseResult[] = [];
  let pending: Array<Promise<void>> = [];
  let testCount = 0;

  function fmt(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    try {
      return JSON.stringify(value) as string;
    } catch {
      return String(value);
    }
  }

  function push(level: string, args: ArrayLike<unknown>): void {
    const line = Array.prototype.slice.call(args).map(fmt).join(' ');
    logs.push({ level, text: line });
  }

  const fakeConsole: BrowserConsole = {
    log: function (...args: unknown[]) { push('log', args); },
    info: function (...args: unknown[]) { push('log', args); },
    debug: function (...args: unknown[]) { push('log', args); },
    warn: function (...args: unknown[]) { push('warn', args); },
    error: function (...args: unknown[]) { push('error', args); },
  };

  function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      const other = b as unknown[];
      if (a.length !== other.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], other[i])) return false;
      return true;
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const ka = Object.keys(left);
    const kb = Object.keys(right);
    if (ka.length !== kb.length) return false;
    for (let j = 0; j < ka.length; j++) {
      const key = ka[j]!;
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!deepEqual(left[key], right[key])) return false;
    }
    return true;
  }

  function AssertionError(message?: string): Error {
    const err = new Error(message);
    err.name = 'AssertionError';
    return err;
  }

  const assert = ((condition: unknown, message?: string) => {
    if (!condition) throw AssertionError(message || '断言失败');
  }) as AssertFn;
  assert.equal = function (actual: unknown, expected: unknown, message?: string): void {
    if (!deepEqual(actual, expected)) {
      throw AssertionError((message || '断言失败') + '｜期望 ' + fmt(expected) + '，实际 ' + fmt(actual));
    }
  };
  assert.deepEqual = assert.equal;
  assert.deepStrictEqual = assert.equal;
  assert.strictEqual = function (actual: unknown, expected: unknown, message?: string): void {
    if (actual !== expected) {
      throw AssertionError((message || '断言失败') + '｜期望 ' + fmt(expected) + '，实际 ' + fmt(actual));
    }
  };
  assert.throws = function (fn: () => unknown, matcher?: unknown, message?: string): void {
    try {
      fn();
    } catch (err) {
      if (matcher instanceof RegExp && !matcher.test(String((err as Error | null)?.message || err))) {
        throw AssertionError((message || '断言失败') + '｜异常消息不匹配：' + fmt((err as Error | null)?.message || err));
      }
      return;
    }
    throw AssertionError(message || '期望函数抛出异常');
  };
  assert.rejects = function (promise: unknown, matcher?: unknown, message?: string): Promise<void> {
    return Promise.resolve(promise).then(function () {
      throw AssertionError(message || '期望 Promise 拒绝');
    }, function (err: unknown) {
      if (matcher instanceof RegExp && !matcher.test(String((err as Error | null)?.message || err))) {
        throw AssertionError((message || '断言失败') + '｜异常消息不匹配：' + fmt((err as Error | null)?.message || err));
      }
    });
  };
  assert.ok = assert;

  const __run: RunFn = function (name, fn) {
    testCount += 1;
    const record = function (ok: boolean, error?: string): void {
      results.push({ name, ok, error });
    };
    try {
      const outcome = fn();
      if (outcome && typeof (outcome as PromiseLike<unknown>).then === 'function') {
        pending.push(Promise.resolve((outcome as PromiseLike<unknown>).then(
          function () { record(true); },
          function (err: unknown) { record(false, (err as Error | null)?.message || String(err)); },
        )));
      } else {
        record(true);
      }
    } catch (err) {
      record(false, (err as Error | null)?.message || String(err));
    }
  };

  function finish(resolve: (result: RunResult) => void): void {
    if (pending.length) {
      const current = pending;
      pending = [];
      Promise.all(current).then(function () { finish(resolve); });
      return;
    }
    resolve({ ok: results.every(function (r) { return r.ok; }), results, logs });
  }

  return new Promise((resolve) => {
    try {
      const body = code + '\n' + tests;
      const runner = new Function('console', 'assert', '__run', body) as (
        fake: BrowserConsole,
        assertFn: AssertFn,
        run: RunFn,
      ) => void;
      runner(fakeConsole, assert, __run);
      if (testCount === 0) results.push({ name: '代码执行', ok: true });
      finish(resolve);
    } catch (err) {
      results.push({ name: '代码执行', ok: false, error: (err as Error | null)?.message || String(err) });
      resolve({ ok: false, results, logs });
    }
  });
}
