const PYODIDE_VERSION = '0.29.5';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const DRIVER = `import io, json, contextlib, traceback, inspect

async def __lab_execute(source):
    results = []
    tests = []
    buf = io.StringIO()

    def __run(name, fn):
        tests.append((name, fn))

    def __eq(actual, expected, message=''):
        if actual != expected:
            raise AssertionError((message + '｜' if message else '') + '期望 ' + repr(expected) + '，实际 ' + repr(actual))

    ns = {
        '__name__': '__main__',
        '__builtins__': __builtins__,
        '__run': __run,
        'assert_eq': __eq,
        '__eq': __eq,
    }
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            exec(compile(source, '<exercise>', 'exec'), ns)
        except BaseException:
            lines = traceback.format_exc().strip().splitlines()
            results.append({'name': '代码执行', 'ok': False, 'error': lines[-1] if lines else '执行失败'})
        else:
            for name, fn in tests:
                try:
                    value = fn()
                    if inspect.isawaitable(value):
                        await value
                    results.append({'name': name, 'ok': True})
                except Exception as exc:
                    results.append({'name': name, 'ok': False, 'error': str(exc) or type(exc).__name__})
    return {'results': results, 'logs': buf.getvalue()}

async def __lab_main():
    global __lab_payload
    outcome = await __lab_execute(__lab_source)
    __lab_payload = json.dumps(outcome)
`;

const WORKER_SOURCE = `
var DRIVER = ${JSON.stringify(DRIVER)};
var PYODIDE_URL = ${JSON.stringify(PYODIDE_URL)};
var pyodide = null;
var loading = null;

function boot() {
  if (!loading) {
    importScripts(PYODIDE_URL + 'pyodide.js');
    loading = loadPyodide({ indexURL: PYODIDE_URL }).then(function (py) {
      py.runPython(DRIVER);
      pyodide = py;
      self.postMessage({ type: 'ready' });
      return py;
    });
  }
  return loading;
}

boot().catch(function (err) {
  self.postMessage({ type: 'fatal', error: String((err && err.message) || err) });
});

self.onmessage = function (event) {
  var data = event.data || {};
  if (data.type !== 'run') return;
  boot().then(function (py) {
    py.globals.set('__lab_source', data.source);
    return py.runPythonAsync('await __lab_main()').then(function () {
      var payload = py.globals.get('__lab_payload');
      self.postMessage({ id: data.id, ok: true, payload: String(payload) });
    });
  }).catch(function (err) {
    self.postMessage({ id: data.id, ok: false, error: String((err && err.message) || err) });
  });
};
`;

export type PythonStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PythonCaseResult {
  name: string;
  ok: boolean;
  error?: string;
}

export interface PythonRunResult {
  ok: true;
  results: PythonCaseResult[];
  logs: Array<{ level: 'log'; text: string }>;
}

interface PendingTask {
  resolve: (result: PythonRunResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface WorkerMessage {
  type?: string;
  error?: string;
  id?: number;
  ok?: boolean;
  payload?: string;
}

let worker: Worker | null = null;
let objectUrl: string | null = null;
let ready = false;
let fatal: string | null = null;
let seq = 0;
let status: PythonStatus = 'idle';
const pending = new Map<number, PendingTask>();
const statusListeners = new Set<(status: PythonStatus) => void>();

function setStatus(next: PythonStatus, error: string | null = null): void {
  fatal = next === 'error' ? (error || fatal) : fatal;
  if (status === next) return;
  status = next;
  statusListeners.forEach((fn) => fn(status));
}

export function pythonStatus(): PythonStatus {
  return status;
}

export function onPythonStatus(fn: (status: PythonStatus) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export function pythonReady(): boolean {
  return ready;
}

export function pythonLoadError(): string | null {
  return fatal;
}

function resetWorker(): void {
  if (worker) worker.terminate();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  worker = null;
  objectUrl = null;
  ready = false;
}

function failAll(message: string): void {
  pending.forEach((task) => {
    clearTimeout(task.timer);
    task.reject(new Error(message));
  });
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  objectUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  const created = new Worker(objectUrl);
  worker = created;
  setStatus('loading');
  created.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data || {};
    if (data.type === 'ready') {
      ready = true;
      setStatus('ready');
      return;
    }
    if (data.type === 'fatal') {
      failAll(`Python 运行时加载失败：${data.error}`);
      resetWorker();
      setStatus('error', data.error ?? null);
      return;
    }
    const task = pending.get(data.id!);
    if (!task) return;
    pending.delete(data.id!);
    clearTimeout(task.timer);
    if (!data.ok) {
      task.reject(new Error(data.error || 'Python 执行失败'));
      return;
    }
    let payload: { results?: PythonCaseResult[]; logs?: string };
    try {
      payload = JSON.parse(data.payload ?? '');
    } catch {
      task.reject(new Error('Python 返回结果无法解析'));
      return;
    }
    task.resolve({
      ok: true,
      results: Array.isArray(payload.results) ? payload.results : [],
      logs: String(payload.logs || '')
        .split('\n')
        .filter((line) => line.length)
        .map((text) => ({ level: 'log' as const, text })),
    });
  };
  created.onerror = (event: ErrorEvent) => {
    failAll(`Python 沙箱异常：${event.message || '未知错误'}`);
    resetWorker();
    setStatus('error', event.message || 'Worker 异常');
  };
  return created;
}

export function warmPython(): void {
  if (worker || fatal) return;
  try {
    ensureWorker();
  } catch (err) {
    setStatus('error', (err as Error | null)?.message || String(err));
  }
}

export interface PythonRunOptions {
  timeout?: number;
  loadTimeout?: number;
}

export function runPythonTests(
  code: string,
  tests: string,
  options: PythonRunOptions = {},
): Promise<PythonRunResult> {
  const timeout = options.timeout || 8000;
  const loadTimeout = options.loadTimeout || 90000;
  return new Promise((resolve, reject) => {
    if (fatal) {
      reject(new Error(`Python 运行时不可用：${fatal}`));
      return;
    }
    let target: Worker;
    try {
      target = ensureWorker();
    } catch (err) {
      reject(new Error(`当前浏览器无法创建 Python 沙箱：${(err as Error | null)?.message || err}`));
      return;
    }
    const id = ++seq;
    const source = `${code}\n\n${tests}\n`;
    const timer = setTimeout(() => {
      // 先记下当前是否已加载完成：resetWorker 会把 ready 置回 false，
      // 之后再用它判断，就会把「执行超时」误报成「加载超时」。
      const wasReady = ready;
      pending.delete(id);
      resetWorker();
      setStatus('idle');
      reject(new Error(wasReady
        ? `Python 执行超过 ${Math.round(timeout / 1000)} 秒，可能是死循环`
        : 'Python 运行时加载超时，请检查网络后重试'));
    }, ready ? timeout : loadTimeout);
    pending.set(id, { resolve, reject, timer });
    target.postMessage({ type: 'run', id, source });
  });
}
