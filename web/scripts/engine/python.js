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

let worker = null;
let objectUrl = null;
let ready = false;
let fatal = null;
let seq = 0;
let status = 'idle';
const pending = new Map();
const statusListeners = new Set();

function setStatus(next, error = null) {
  fatal = next === 'error' ? (error || fatal) : fatal;
  if (status === next) return;
  status = next;
  statusListeners.forEach((fn) => fn(status));
}

export function pythonStatus() {
  return status;
}

export function onPythonStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export function pythonReady() {
  return ready;
}

export function pythonLoadError() {
  return fatal;
}

function resetWorker() {
  if (worker) worker.terminate();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  worker = null;
  objectUrl = null;
  ready = false;
}

function failAll(message) {
  pending.forEach((task) => {
    clearTimeout(task.timer);
    task.reject(new Error(message));
  });
  pending.clear();
}

function ensureWorker() {
  if (worker) return worker;
  objectUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  worker = new Worker(objectUrl);
  setStatus('loading');
  worker.onmessage = (event) => {
    const data = event.data || {};
    if (data.type === 'ready') {
      ready = true;
      setStatus('ready');
      return;
    }
    if (data.type === 'fatal') {
      failAll(`Python 运行时加载失败：${data.error}`);
      resetWorker();
      setStatus('error', data.error);
      return;
    }
    const task = pending.get(data.id);
    if (!task) return;
    pending.delete(data.id);
    clearTimeout(task.timer);
    if (!data.ok) {
      task.reject(new Error(data.error || 'Python 执行失败'));
      return;
    }
    let payload;
    try {
      payload = JSON.parse(data.payload);
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
        .map((text) => ({ level: 'log', text })),
    });
  };
  worker.onerror = (event) => {
    failAll(`Python 沙箱异常：${event.message || '未知错误'}`);
    resetWorker();
    setStatus('error', event.message || 'Worker 异常');
  };
  return worker;
}

export function warmPython() {
  if (worker || fatal) return;
  try {
    ensureWorker();
  } catch (err) {
    setStatus('error', (err && err.message) || String(err));
  }
}

export function runPythonTests(code, tests, options = {}) {
  const timeout = options.timeout || 8000;
  const loadTimeout = options.loadTimeout || 90000;
  return new Promise((resolve, reject) => {
    if (fatal) {
      reject(new Error(`Python 运行时不可用：${fatal}`));
      return;
    }
    let target;
    try {
      target = ensureWorker();
    } catch (err) {
      reject(new Error(`当前浏览器无法创建 Python 沙箱：${(err && err.message) || err}`));
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
