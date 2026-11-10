import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSuite } from '../engine/runner/core.js';
import { runTests } from '../engine/runner/index.js';

describe('runner core', () => {
  it('同步与异步断言全部通过并输出日志级别', async () => {
    const code = [
      'function sum(a, b) { return a + b; }',
      'function boom() { throw new Error("boom"); }',
      'console.log("hello", { a: 1 }, null, undefined);',
      'console.info("info-line");',
      'console.debug("debug-line");',
      'console.warn("warn-line");',
      'console.error("error-line");',
      'const circular = {}; circular.self = circular; console.log(circular);',
      'console.log(1n);',
    ].join('\n');
    const tests = [
      '__run("equal", () => { assert.equal(sum(1, 2), 3); });',
      '__run("deepEqual", () => { assert.deepEqual({ a: [1, 2] }, { a: [1, 2] }); });',
      '__run("deepStrictEqual", () => { assert.deepStrictEqual([1], [1]); });',
      '__run("strictEqual", () => { assert.strictEqual(sum(2, 2), 4); });',
      '__run("ok", () => { assert.ok(true); assert(true); });',
      '__run("throws", () => { assert.throws(() => boom(), /boom/); });',
      '__run("throws without matcher", () => { assert.throws(() => boom()); });',
      '__run("rejects", async () => { await assert.rejects(Promise.reject(new Error("bad")), /bad/); });',
      '__run("async pass", async () => { await Promise.resolve(); assert.strictEqual(sum(1, 1), 2); });',
    ].join('\n');

    const result = await executeSuite(code, tests);
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(9);
    expect(result.results.every((item) => item.ok)).toBe(true);
    const levels = result.logs.map((log) => log.level);
    expect(levels).toEqual(['log', 'log', 'log', 'warn', 'error', 'log', 'log']);
    expect(result.logs[0]!.text).toBe('hello {"a":1} null undefined');
    expect(result.logs[5]!.text).toBe('[object Object]');
    expect(result.logs[6]!.text).toBe('1');
  });

  it('断言失败返回期望与实际', async () => {
    const result = await executeSuite('', [
      '__run("equal-fail", () => { assert.equal(1, 2); });',
      '__run("strict-fail", () => { assert.strictEqual("1", 1); });',
      '__run("deep-fail", () => { assert.equal({ a: 1 }, { a: 2 }); });',
      '__run("custom", () => { assert.ok(false, "自定义信息"); });',
    ].join('\n'));
    expect(result.ok).toBe(false);
    expect(result.results.map((item) => item.ok)).toEqual([false, false, false, false]);
    expect(result.results[0]!.error).toBe('断言失败｜期望 2，实际 1');
    expect(result.results[1]!.error).toBe('断言失败｜期望 1，实际 1');
    expect(result.results[2]!.error).toBe('断言失败｜期望 {"a":2}，实际 {"a":1}');
    expect(result.results[3]!.error).toBe('自定义信息');
  });

  it('throws/rejects 的失败路径', async () => {
    const result = await executeSuite(
      'const noThrow = () => 1;',
      [
        '__run("no-throw", () => { assert.throws(() => noThrow()); });',
        '__run("wrong-message", () => { assert.throws(() => { throw new Error("actual"); }, /expected/); });',
        '__run("resolved", async () => { await assert.rejects(Promise.resolve(1), /x/); });',
        '__run("reject-message", async () => { await assert.rejects(Promise.reject(new Error("nope")), /expected/); });',
      ].join('\n'),
    );
    expect(result.ok).toBe(false);
    expect(result.results[0]!.error).toBe('期望函数抛出异常');
    expect(result.results[1]!.error).toBe('断言失败｜异常消息不匹配：actual');
    expect(result.results[2]!.error).toBe('期望 Promise 拒绝');
    expect(result.results[3]!.error).toBe('断言失败｜异常消息不匹配：nope');
  });

  it('代码抛错时记录执行失败', async () => {
    const result = await executeSuite('throw new Error("top-level");', '');
    expect(result.ok).toBe(false);
    expect(result.results).toEqual([{ name: '代码执行', ok: false, error: 'top-level' }]);
  });

  it('没有测试时补一条通过项', async () => {
    const result = await executeSuite('const value = 1;', '');
    expect(result.ok).toBe(true);
    expect(result.results).toEqual([{ name: '代码执行', ok: true }]);
    expect(result.logs).toEqual([]);
  });

  it('多个异步测试全部等待完成', async () => {
    const result = await executeSuite('', [
      '__run("slow", async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });',
      '__run("fast", async () => { await Promise.resolve(); });',
      '__run("sync", () => {});',
    ].join('\n'));
    expect(result.ok).toBe(true);
    expect(result.results.filter((item) => item.ok)).toHaveLength(3);
  });
});

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  constructor(url: URL, options?: unknown) {
    void url;
    void options;
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('runner worker bridge', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('投递代码并把 worker 结果原样返回', async () => {
    const promise = runTests('const a = 1;', 'run();');
    const worker = FakeWorker.instances.at(-1)!;
    expect(worker.posted).toEqual([{ code: 'const a = 1;', tests: 'run();' }]);

    const payload = { ok: true, results: [{ name: 'ok', ok: true }], logs: [] };
    worker.onmessage!({ data: payload });
    await expect(promise).resolves.toBe(payload);
    expect(worker.terminated).toBe(true);
  });

  it('构造函数抛错时回退到沙箱不可用提示', async () => {
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('blocked');
      }
    });
    await expect(runTests('', '')).resolves.toEqual({
      ok: false,
      results: [{ name: '沙箱启动', ok: false, error: '当前浏览器无法创建 Worker 沙箱' }],
      logs: [],
    });
  });

  it('超时终止 worker 并返回可读信息', async () => {
    vi.useFakeTimers();
    const promise = runTests('while (true) {}', '', { timeout: 10 });
    const worker = FakeWorker.instances.at(-1)!;
    vi.advanceTimersByTime(10);
    await expect(promise).resolves.toEqual({
      ok: false,
      results: [{ name: '执行超时', ok: false, error: '运行超过 10 ms，可能是死循环或缺少 await' }],
      logs: [],
    });
    expect(worker.terminated).toBe(true);
  });

  it('worker.onerror 返回执行失败', async () => {
    const promise = runTests('', '');
    const worker = FakeWorker.instances.at(-1)!;
    worker.onerror!({ message: 'boom' });
    await expect(promise).resolves.toEqual({
      ok: false,
      results: [{ name: '执行失败', ok: false, error: 'boom' }],
      logs: [],
    });
    expect(worker.terminated).toBe(true);
  });

  it('worker.onerror 没有消息时使用未知错误', async () => {
    const promise = runTests('', '');
    FakeWorker.instances.at(-1)!.onerror!({});
    const result = await promise;
    expect(result.results[0]!.error).toBe('未知错误');
  });
});
