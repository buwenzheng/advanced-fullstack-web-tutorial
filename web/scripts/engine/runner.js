const WORKER_SOURCE = `
self.onmessage = function (event) {
  var data = event.data || {};
  var logs = [];
  var results = [];
  var pending = [];
  var testCount = 0;

  function fmt(value) {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    try { return JSON.stringify(value); } catch (err) { return String(value); }
  }

  function push(level, args) {
    var line = Array.prototype.slice.call(args).map(fmt).join(' ');
    logs.push({ level: level, text: line });
  }

  var fakeConsole = {
    log: function () { push('log', arguments); },
    info: function () { push('log', arguments); },
    debug: function () { push('log', arguments); },
    warn: function () { push('warn', arguments); },
    error: function () { push('error', arguments); }
  };

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[j])) return false;
      if (!deepEqual(a[ka[j]], b[ka[j]])) return false;
    }
    return true;
  }

  function AssertionError(message) {
    var err = new Error(message);
    err.name = 'AssertionError';
    return err;
  }

  function assert(condition, message) {
    if (!condition) throw AssertionError(message || '断言失败');
  }
  assert.equal = function (actual, expected, message) {
    if (!deepEqual(actual, expected)) {
      throw AssertionError((message || '断言失败') + '｜期望 ' + fmt(expected) + '，实际 ' + fmt(actual));
    }
  };
  assert.deepEqual = assert.equal;
  assert.deepStrictEqual = assert.equal;
  assert.strictEqual = function (actual, expected, message) {
    if (actual !== expected) {
      throw AssertionError((message || '断言失败') + '｜期望 ' + fmt(expected) + '，实际 ' + fmt(actual));
    }
  };
  assert.throws = function (fn, matcher, message) {
    try {
      fn();
    } catch (err) {
      if (matcher instanceof RegExp && !matcher.test(String((err && err.message) || err))) {
        throw AssertionError((message || '断言失败') + '｜异常消息不匹配：' + fmt((err && err.message) || err));
      }
      return;
    }
    throw AssertionError(message || '期望函数抛出异常');
  };
  assert.rejects = function (promise, matcher, message) {
    return Promise.resolve(promise).then(function () {
      throw AssertionError(message || '期望 Promise 拒绝');
    }, function (err) {
      if (matcher instanceof RegExp && !matcher.test(String((err && err.message) || err))) {
        throw AssertionError((message || '断言失败') + '｜异常消息不匹配：' + fmt((err && err.message) || err));
      }
    });
  };
  assert.ok = assert;

  function __run(name, fn) {
    testCount += 1;
    var record = function (ok, error) {
      results.push({ name: name, ok: ok, error: error });
    };
    try {
      var outcome = fn();
      if (outcome && typeof outcome.then === 'function') {
        pending.push(outcome.then(
          function () { record(true); },
          function (err) { record(false, (err && err.message) || String(err)); }
        ));
      } else {
        record(true);
      }
    } catch (err) {
      record(false, (err && err.message) || String(err));
    }
  }

  function finish() {
    if (pending.length) {
      var current = pending;
      pending = [];
      Promise.all(current).then(finish);
      return;
    }
    self.postMessage({ ok: results.every(function (r) { return r.ok; }), results: results, logs: logs });
  }

  try {
    var body = data.code + '\\n' + data.tests;
    /* eslint-disable no-new-func */
    var runner = new Function('console', 'assert', '__run', body);
    runner(fakeConsole, assert, __run);
    if (testCount === 0) results.push({ name: '代码执行', ok: true });
    finish();
  } catch (err) {
    results.push({ name: '代码执行', ok: false, error: (err && err.message) || String(err) });
    self.postMessage({ ok: false, results: results, logs: logs });
  }
};
`;

let cachedUrl = null;

function workerUrl() {
  if (!cachedUrl) {
    cachedUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  }
  return cachedUrl;
}

export function runTests(code, tests, options = {}) {
  const timeout = options.timeout || 6000;
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(workerUrl());
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

    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, results: [{ name: '执行失败', ok: false, error: event.message || '未知错误' }], logs: [] });
    };
    worker.postMessage({ code: String(code || ''), tests: String(tests || '') });
  });
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
