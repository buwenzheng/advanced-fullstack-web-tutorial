import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PythonModule = typeof import('../engine/python/index.js');

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: Record<string, unknown> }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  posted: Array<Record<string, unknown>> = [];
  terminated = false;

  constructor(url: string) {
    void url;
    FakeWorker.instances.push(this);
  }

  postMessage(message: Record<string, unknown>): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const createObjectURL = vi.fn(() => 'blob:python');
const revokeObjectURL = vi.fn();

async function loadModule(): Promise<PythonModule> {
  vi.resetModules();
  return import('../engine/python/index.js');
}

beforeEach(() => {
  FakeWorker.instances = [];
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('python runtime bridge', () => {
  it('状态订阅立即回调，warmPython 复用同一 worker', async () => {
    const mod = await loadModule();
    const seen: string[] = [];
    expect(mod.pythonStatus()).toBe('idle');
    expect(mod.pythonReady()).toBe(false);
    expect(mod.pythonLoadError()).toBeNull();

    const off = mod.onPythonStatus((status) => seen.push(status));
    expect(seen).toEqual(['idle']);

    mod.warmPython();
    expect(mod.pythonStatus()).toBe('loading');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(FakeWorker.instances).toHaveLength(1);
    const fake = FakeWorker.instances[0]!;

    fake.onmessage!({ data: { type: 'ready' } });
    expect(mod.pythonStatus()).toBe('ready');
    expect(mod.pythonReady()).toBe(true);
    expect(seen).toEqual(['idle', 'loading', 'ready']);

    mod.warmPython();
    expect(FakeWorker.instances).toHaveLength(1);

    off();
    fake.onmessage!({ data: { type: 'ready' } });
    expect(seen).toEqual(['idle', 'loading', 'ready']);
  });

  it('投递 run 消息并把结果、日志与空字段归一化', async () => {
    const mod = await loadModule();
    const pending = mod.runPythonTests('print(1)', 'assert_eq(1, 1)', {});
    const fake = FakeWorker.instances[0]!;
    expect(fake.posted).toHaveLength(1);
    const message = fake.posted[0]!;
    expect(message).toMatchObject({ type: 'run', source: 'print(1)\n\nassert_eq(1, 1)\n' });
    expect(typeof message.id).toBe('number');

    fake.onmessage!({ data: { type: 'ready' } });
    fake.onmessage!({
      data: {
        id: message.id,
        ok: true,
        payload: JSON.stringify({
          results: [{ name: '用例', ok: true }],
          logs: '第一行\n\n第二行\n',
        }),
      },
    });
    await expect(pending).resolves.toEqual({
      ok: true,
      results: [{ name: '用例', ok: true }],
      logs: [
        { level: 'log', text: '第一行' },
        { level: 'log', text: '第二行' },
      ],
    });

    const minimal = mod.runPythonTests('x', 'y', { timeout: 1000 });
    fake.onmessage!({ data: { id: fake.posted[1]!.id, ok: true, payload: '{}' } });
    await expect(minimal).resolves.toEqual({ ok: true, results: [], logs: [] });
  });

  it('失败消息、坏 payload 与未知 id 各自处理', async () => {
    const mod = await loadModule();
    const first = mod.runPythonTests('a', 'b');
    const fake = FakeWorker.instances[0]!;

    fake.onmessage!({ data: { id: 999, ok: true, payload: '{}' } });

    fake.onmessage!({ data: { id: fake.posted[0]!.id, ok: false } });
    await expect(first).rejects.toThrow('Python 执行失败');

    const second = mod.runPythonTests('a', 'b');
    fake.onmessage!({ data: { id: fake.posted[1]!.id, ok: true, payload: 'not-json' } });
    await expect(second).rejects.toThrow('Python 返回结果无法解析');

    const third = mod.runPythonTests('a', 'b');
    fake.onmessage!({ data: { id: fake.posted[2]!.id, ok: false, error: 'boom' } });
    await expect(third).rejects.toThrow('boom');
  });

  it('fatal 消息拒绝挂起任务、终止 worker 并阻止后续执行', async () => {
    const mod = await loadModule();
    const pending = mod.runPythonTests('a', 'b');
    const fake = FakeWorker.instances[0]!;
    expect(mod.pythonStatus()).toBe('loading');

    fake.onmessage!({ data: { type: 'fatal', error: 'CDN 不可达' } });
    await expect(pending).rejects.toThrow('Python 运行时加载失败：CDN 不可达');
    expect(mod.pythonStatus()).toBe('error');
    expect(mod.pythonLoadError()).toBe('CDN 不可达');
    expect(fake.terminated).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    await expect(mod.runPythonTests('a', 'b')).rejects.toThrow('Python 运行时不可用：CDN 不可达');
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('worker onerror 拒绝挂起任务并记录错误', async () => {
    const mod = await loadModule();
    const pending = mod.runPythonTests('a', 'b');
    FakeWorker.instances[0]!.onerror!({ message: '渲染进程崩溃' });
    await expect(pending).rejects.toThrow('Python 沙箱异常：渲染进程崩溃');
    expect(mod.pythonStatus()).toBe('error');
    expect(mod.pythonLoadError()).toBe('渲染进程崩溃');

    const modWithoutMessage = await loadModule();
    const second = modWithoutMessage.runPythonTests('a', 'b');
    FakeWorker.instances.at(-1)!.onerror!({});
    await expect(second).rejects.toThrow('Python 沙箱异常：未知错误');
    expect(modWithoutMessage.pythonStatus()).toBe('error');
    expect(modWithoutMessage.pythonLoadError()).toBe('Worker 异常');
  });

  it('加载超时与执行超时给出不同提示并重置状态', async () => {
    vi.useFakeTimers();
    const mod = await loadModule();
    const loading = mod.runPythonTests('a', 'b', { loadTimeout: 1000 });
    const fake = FakeWorker.instances[0]!;
    const loadingAssertion = expect(loading).rejects.toThrow(
      'Python 运行时加载超时，请检查网络后重试',
    );
    await vi.advanceTimersByTimeAsync(1000);
    await loadingAssertion;
    expect(fake.terminated).toBe(true);
    expect(mod.pythonStatus()).toBe('idle');

    mod.warmPython();
    const readyWorker = FakeWorker.instances.at(-1)!;
    readyWorker.onmessage!({ data: { type: 'ready' } });
    const executing = mod.runPythonTests('a', 'b', { timeout: 2000 });
    const executingAssertion = expect(executing).rejects.toThrow(
      'Python 执行超过 2 秒，可能是死循环',
    );
    await vi.advanceTimersByTimeAsync(2000);
    await executingAssertion;
    expect(readyWorker.terminated).toBe(true);
    expect(mod.pythonStatus()).toBe('idle');
  });

  it('无法创建 Worker 时直接拒绝并记录不可用原因', async () => {
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('被策略阻止');
      }
    });
    const mod = await loadModule();
    await expect(mod.runPythonTests('a', 'b')).rejects.toThrow(
      '当前浏览器无法创建 Python 沙箱：被策略阻止',
    );
    mod.warmPython();
    expect(mod.pythonStatus()).toBe('error');
    expect(mod.pythonLoadError()).toBe('被策略阻止');
    await expect(mod.runPythonTests('a', 'b')).rejects.toThrow('Python 运行时不可用：被策略阻止');
  });
});