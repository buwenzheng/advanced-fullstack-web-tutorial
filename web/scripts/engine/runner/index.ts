import type { RunResult } from './protocol.js';

export type { RunCaseResult, RunLog, RunResult } from './protocol.js';

export interface RunTestsOptions {
  timeout?: number;
}

const WORKER_TIMEOUT = 6000;

export function runTests(code: string, tests: string, options: RunTestsOptions = {}): Promise<RunResult> {
  const timeout = options.timeout || WORKER_TIMEOUT;
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./js.worker.js', import.meta.url), { type: 'module' });
    } catch {
      resolve({ ok: false, results: [{ name: '沙箱启动', ok: false, error: '当前浏览器无法创建 Worker 沙箱' }], logs: [] });
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({
        ok: false,
        results: [{ name: '执行超时', ok: false, error: `运行超过 ${timeout} ms，可能是死循环或缺少 await` }],
        logs: [],
      });
    }, timeout);

    worker.onmessage = (event: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, results: [{ name: '执行失败', ok: false, error: event.message || '未知错误' }], logs: [] });
    };
    worker.postMessage({ code: String(code || ''), tests: String(tests || '') });
  });
}
