import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  'm3-otel': [
    {
      code: `import json
from datetime import datetime, timezone

SENSITIVE = {'password', 'token', 'authorization', 'email'}


def redact(fields):
    return {
        key: '[redacted]' if key in SENSITIVE else value
        for key, value in fields.items()
    }


def create_logger(context, sink=print, now=None):
    clock = now or (lambda: 0)
    base = {
        **context,
        'ts': datetime.fromtimestamp(clock() / 1000, tz=timezone.utc).isoformat(),
    }

    def write(level, event, fields=None):
        payload = {'level': level, 'event': event, **base, **redact(fields or {})}
        sink(json.dumps(payload, ensure_ascii=False))

    return {
        'info': lambda event, fields=None: write('info', event, fields),
        'error': lambda event, fields=None: write('error', event, fields),
    }`,
      note: 'Python 的 logging 模块可以用 extra 传结构化字段，但默认 formatter 仍会把它们拼进文本；这里直接输出 JSON 一行，便于检索。requestId 与 traceId 要在入口生成，并通过 context 传给下游调用与队列消息。'
    },
    {
      code: `import copy
import math


class Metrics:
    def __init__(self):
        self.registry = {}

    def _metric(self, name, type_name):
        existing = self.registry.get(name)
        if existing is not None and existing['type'] != type_name:
            raise ValueError('metric ' + name + ' already registered as ' + existing['type'])
        if existing is None:
            existing = {'type': type_name, 'series': {}}
            if type_name == 'histogram':
                existing['series'][''] = []
            self.registry[name] = existing
        return existing

    @staticmethod
    def _normalize(labels):
        labels = labels or {}
        return ','.join(key + '=' + str(labels[key]) for key in sorted(labels))

    def counter(self, name, labels=None):
        metric = self._metric(name, 'counter')
        key = self._normalize(labels)
        value = metric['series'].get(key, 0) + 1
        metric['series'][key] = value
        return value

    def histogram(self, name, value):
        metric = self._metric(name, 'histogram')
        samples = metric['series'].setdefault('', [])
        samples.append(value)
        return len(samples)

    @staticmethod
    def _percentile(sorted_values, p):
        if not sorted_values:
            return 0
        index = max(0, math.ceil(p / 100 * len(sorted_values)) - 1)
        return sorted_values[index]

    def snapshot(self):
        out = {}
        for name, metric in self.registry.items():
            out[name] = {'type': metric['type'], 'series': []}
            for labels, value in metric['series'].items():
                if metric['type'] != 'histogram':
                    out[name]['series'].append({'labels': labels, 'value': value})
                    continue
                ordered = sorted(value)
                out[name]['series'].append({
                    'labels': labels,
                    'count': len(ordered),
                    'sum': sum(ordered),
                    'p50': self._percentile(ordered, 50),
                    'p95': self._percentile(ordered, 95),
                    'p99': self._percentile(ordered, 99),
                })
        return copy.deepcopy(out)


def create_metrics():
    return Metrics()`,
      note: '标签 key 排序后拼接，保证 {a,b} 与 {b,a} 是同一条序列。snapshot 用 deepcopy 隔离内部状态；生产实现要避免在高频路径上做深拷贝，改为增量导出或序列化。'
    }
  ],
  'm3-perf': [
    {
      code: `import math


def summarize_load_test(samples, duration_sec):
    if not duration_sec > 0:
        raise ValueError('duration_sec must be positive')
    ok_samples = [sample for sample in samples if sample['ok']]
    latencies = sorted(sample['latencyMs'] for sample in ok_samples)

    def percentile(p):
        if not latencies:
            return 0
        index = max(0, math.ceil(p / 100 * len(latencies)) - 1)
        return latencies[index]

    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    count = len(samples)
    return {
        'count': count,
        'throughput': count / duration_sec,
        'errorRate': (count - len(ok_samples)) / count if count else 0,
        'p50': percentile(50),
        'p95': percentile(95),
        'p99': percentile(99),
        'avgConcurrency': (len(ok_samples) / duration_sec) * (avg_latency / 1000),
    }`,
      note: 'Python 的 sorted 返回新列表，不会改动输入；分位仍用最近秩。错误样本不进入延迟分位，但会进入错误率。Little 定律的并发估算只用成功请求的完成速率与平均延迟。'
    }
  ],
  'm3-container': [
    {
      code: `import asyncio
import signal


class GracefulServer:
    def __init__(self, server, drain_timeout=10.0):
        self.server = server
        self.drain_timeout = drain_timeout
        self.state = 'running'
        self._stop = asyncio.Event()

    def install_signal_handlers(self):
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self._stop.set)

    @property
    def accepting(self):
        return self.state == 'running'

    async def serve_until_stopped(self):
        await self._stop.wait()
        self.state = 'draining'
        try:
            await self.server.close()
            await asyncio.wait_for(self.server.drain(), self.drain_timeout)
        except asyncio.TimeoutError:
            self.state = 'closed'
            return {'forced': True, 'reason': 'TIMEOUT'}
        self.state = 'closed'
        return {'forced': False}`,
      note: '顺序是先停止接收新连接，再排空在途请求；timeout 是兜底而不是主路径。state 供 readiness 探针读取，draining 阶段必须让新请求被拒绝或路由走。真实服务还要关闭数据库连接池与消息消费者。'
    }
  ],
  'm3-cicd': [
    {
      code: `FNV_OFFSET = 2166136261
FNV_PRIME = 16777619
MASK = 0xFFFFFFFF


def fnv1a(text):
    digest = FNV_OFFSET
    for byte in text.encode('utf-8'):
        digest ^= byte
        digest = (digest * FNV_PRIME) & MASK
    return digest


def bucket_of(flag_key, user_id):
    return fnv1a(flag_key + ':' + str(user_id)) % 100


def evaluate_flag(flag, context=None):
    context = context or {}
    user_id = context.get('userId')
    if flag is None:
        return {'enabled': False, 'reason': 'UNKNOWN_FLAG'}
    if flag.get('killSwitch'):
        return {'enabled': False, 'reason': 'KILL_SWITCH'}
    if user_id is not None and user_id in flag.get('denylist', []):
        return {'enabled': False, 'reason': 'DENY_LIST'}
    if user_id is not None and user_id in flag.get('allowlist', []):
        return {'enabled': True, 'reason': 'ALLOW_LIST'}
    if flag.get('enabled') is False:
        return {'enabled': False, 'reason': 'DISABLED'}
    percentage = flag.get('percentage')
    if percentage == 100:
        return {'enabled': True, 'reason': 'FULL_ROLLOUT'}
    if not percentage:
        return {'enabled': False, 'reason': 'NOT_IN_ROLLOUT'}
    if user_id is None:
        return {'enabled': False, 'reason': 'NO_IDENTITY'}
    bucket = bucket_of(flag.get('key', ''), user_id)
    if bucket < percentage:
        return {'enabled': True, 'reason': 'IN_ROLLOUT'}
    return {'enabled': False, 'reason': 'OUT_OF_ROLLOUT'}`,
      note: 'Python 整数不会溢出，用 & 0xFFFFFFFF 显式截断到 32 位才能与 JS 的 Math.imul 结果一致。百分比必须按 userId 稳定哈希，不能用 random 或请求序号；否则同一用户会在开与关之间抖动。'
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  'm3-otel-ex-1': {
    starter: `class Metrics:
    def __init__(self):
        self.data = {}

    def counter(self, name, labels=None):
        self.data[name] = self.data.get(name, 0) + 1
        return self.data[name]

    def gauge(self, name, value):
        self.data[name] = value
        return value

    def histogram(self, name, value):
        self.data.setdefault(name, []).append(value)
        return len(self.data[name])

    def snapshot(self):
        return self.data


def create_metrics():
    return Metrics()
`,
    solution: `import copy
import math


class Metrics:
    def __init__(self):
        self.registry = {}

    def _metric(self, name, type_name):
        existing = self.registry.get(name)
        if existing is not None and existing['type'] != type_name:
            raise ValueError('metric ' + name + ' already registered as ' + existing['type'])
        if existing is None:
            existing = {'type': type_name, 'series': {}}
            if type_name == 'histogram':
                existing['series'][''] = []
            self.registry[name] = existing
        return existing

    @staticmethod
    def _normalize(labels):
        labels = labels or {}
        return ','.join(key + '=' + str(labels[key]) for key in sorted(labels))

    def counter(self, name, labels=None):
        metric = self._metric(name, 'counter')
        key = self._normalize(labels)
        value = metric['series'].get(key, 0) + 1
        metric['series'][key] = value
        return value

    def gauge(self, name, value):
        metric = self._metric(name, 'gauge')
        metric['series'][''] = value
        return value

    def histogram(self, name, value):
        metric = self._metric(name, 'histogram')
        samples = metric['series'].setdefault('', [])
        samples.append(value)
        return len(samples)

    @staticmethod
    def _percentile(sorted_values, p):
        if not sorted_values:
            return 0
        index = max(0, math.ceil(p / 100 * len(sorted_values)) - 1)
        return sorted_values[index]

    def snapshot(self):
        out = {}
        for name, metric in self.registry.items():
            out[name] = {'type': metric['type'], 'series': []}
            for labels, value in metric['series'].items():
                if metric['type'] != 'histogram':
                    out[name]['series'].append({'labels': labels, 'value': value})
                    continue
                ordered = sorted(value)
                out[name]['series'].append({
                    'labels': labels,
                    'count': len(ordered),
                    'sum': sum(ordered),
                    'p50': self._percentile(ordered, 50),
                    'p95': self._percentile(ordered, 95),
                    'p99': self._percentile(ordered, 99),
                })
        return copy.deepcopy(out)


def create_metrics():
    return Metrics()
`,
    tests: [
      {
        name: '计数按标签区分',
        code: `metrics = create_metrics()
assert_eq(metrics.counter('http_requests', {'route': '/jump'}), 1)
assert_eq(metrics.counter('http_requests', {'route': '/jump'}), 2)
assert_eq(metrics.counter('http_requests', {'route': '/create'}), 1)
snapshot = metrics.snapshot()
assert_eq(len(snapshot['http_requests']['series']), 2)`
      },
      {
        name: 'gauge 覆盖旧值',
        code: `metrics = create_metrics()
metrics.gauge('queue_depth', 3)
metrics.gauge('queue_depth', 7)
series = metrics.snapshot()['queue_depth']['series']
assert_eq(len(series), 1)
assert_eq(series[0]['value'], 7)`
      },
      {
        name: '直方图返回分位数',
        code: `metrics = create_metrics()
for value in [10, 20, 30, 40, 50]:
    metrics.histogram('latency', value)
stats = metrics.snapshot()['latency']['series'][0]
assert_eq(stats['count'], 5)
assert_eq(stats['sum'], 150)
assert_eq(stats['p50'], 30)
assert_eq(stats['p95'], 50)
assert_eq(stats['p99'], 50)`
      },
      {
        name: '单样本分位与未注册指标',
        code: `metrics = create_metrics()
metrics.histogram('latency', 10)
assert_eq(metrics.snapshot()['latency']['series'][0]['p50'], 10)
empty = create_metrics()
assert_eq(empty.snapshot().get('latency'), None)`
      },
      {
        name: '同名字段类型冲突抛错',
        code: `metrics = create_metrics()
metrics.counter('requests')
error = None
try:
    metrics.gauge('requests', 1)
except ValueError as caught:
    error = caught
assert error is not None
assert 'requests' in str(error)`
      },
      {
        name: '快照与内部状态隔离',
        code: `metrics = create_metrics()
metrics.counter('requests')
snapshot = metrics.snapshot()
snapshot['requests']['series'][0]['value'] = 999
snapshot['requests']['series'].append({'labels': 'fake', 'value': 1})
assert_eq(len(metrics.snapshot()['requests']['series']), 1)
assert_eq(metrics.snapshot()['requests']['series'][0]['value'], 1)`
      },
      {
        name: '标签顺序不同仍是同一条序列',
        code: `metrics = create_metrics()
metrics.counter('requests', {'b': 2, 'a': 1})
metrics.counter('requests', {'a': 1, 'b': 2})
series = metrics.snapshot()['requests']['series']
assert_eq(len(series), 1)
assert_eq(series[0]['value'], 2)
assert_eq(series[0]['labels'], 'a=1,b=2')`
      }
    ]
  },
  'm3-perf-ex-1': {
    starter: `def summarize_load_test(samples, duration_sec):
    times = [sample['latencyMs'] for sample in samples]
    average = sum(times) / len(times) if times else 0
    return {
        'count': len(samples),
        'throughput': len(samples) / duration_sec,
        'errorRate': 0,
        'p50': average,
        'p95': average,
        'p99': average,
        'avgConcurrency': 0,
    }
`,
    solution: `import math


def summarize_load_test(samples, duration_sec):
    if not duration_sec > 0:
        raise ValueError('duration_sec must be positive')
    ok_samples = [sample for sample in samples if sample['ok']]
    latencies = sorted(sample['latencyMs'] for sample in ok_samples)

    def percentile(p):
        if not latencies:
            return 0
        index = max(0, math.ceil(p / 100 * len(latencies)) - 1)
        return latencies[index]

    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    count = len(samples)
    return {
        'count': count,
        'throughput': count / duration_sec,
        'errorRate': (count - len(ok_samples)) / count if count else 0,
        'p50': percentile(50),
        'p95': percentile(95),
        'p99': percentile(99),
        'avgConcurrency': (len(ok_samples) / duration_sec) * (avg_latency / 1000),
    }
`,
    tests: [
      {
        name: '空样本返回零值且不报错',
        code: `result = summarize_load_test([], 10)
assert_eq(result, {
    'count': 0,
    'throughput': 0,
    'errorRate': 0,
    'p50': 0,
    'p95': 0,
    'p99': 0,
    'avgConcurrency': 0,
})`
      },
      {
        name: '全成功样本按最近秩计算分位',
        code: `samples = [{'latencyMs': value, 'ok': True} for value in [10, 20, 30, 40, 50]]
result = summarize_load_test(samples, 5)
assert_eq(result['count'], 5)
assert_eq(result['throughput'], 1)
assert_eq(result['errorRate'], 0)
assert_eq(result['p50'], 30)
assert_eq(result['p95'], 50)
assert_eq(result['p99'], 50)`
      },
      {
        name: '错误样本不计入延迟分位',
        code: `samples = [
    {'latencyMs': 10, 'ok': True},
    {'latencyMs': 20, 'ok': True},
    {'latencyMs': 30, 'ok': False},
    {'latencyMs': 40, 'ok': True},
    {'latencyMs': 50, 'ok': True},
]
result = summarize_load_test(samples, 2)
assert_eq(result['count'], 5)
assert_eq(result['throughput'], 2.5)
assert_eq(result['errorRate'], 0.2)
assert_eq(result['p50'], 20)
assert_eq(result['p95'], 50)
assert_eq(result['p99'], 50)`
      },
      {
        name: '单样本时各分位相等',
        code: `result = summarize_load_test([{'latencyMs': 7, 'ok': True}], 1)
assert_eq(result['p50'], 7)
assert_eq(result['p95'], 7)
assert_eq(result['p99'], 7)
assert_eq(result['errorRate'], 0)
assert abs(result['avgConcurrency'] - 0.007) < 1e-9`
      },
      {
        name: '全部失败时延迟与并发为零',
        code: `samples = [
    {'latencyMs': 100, 'ok': False},
    {'latencyMs': 50, 'ok': False},
]
result = summarize_load_test(samples, 2)
assert_eq(result['count'], 2)
assert_eq(result['throughput'], 1)
assert_eq(result['errorRate'], 1)
assert_eq(result['p50'], 0)
assert_eq(result['p95'], 0)
assert_eq(result['p99'], 0)
assert_eq(result['avgConcurrency'], 0)`
      },
      {
        name: '按 Little 定律估算平均并发',
        code: `samples = [{'latencyMs': 200, 'ok': True} for _ in range(10)]
result = summarize_load_test(samples, 2)
assert_eq(result['throughput'], 5)
assert abs(result['avgConcurrency'] - 1) < 1e-9`
      },
      {
        name: '非法时长抛 ValueError',
        code: `for duration in [0, -1]:
    error = None
    try:
        summarize_load_test([], duration)
    except ValueError as caught:
        error = caught
    assert error is not None
missing = None
try:
    summarize_load_test([])
except TypeError as caught:
    missing = caught
assert missing is not None`
      }
    ]
  },
  'm3-container-ex-1': {
    starter: `def create_shutdown(server, timeout_ms=10000, on_drain=None, scheduler=None):
    class Naive:
        state = 'running'

        def shutdown(self):
            server.close()
            return {'forced': False}

        def try_accept(self):
            return True

    return Naive()
`,
    solution: `import asyncio


class Shutdown:
    def __init__(self, server, timeout_ms, on_drain):
        self.server = server
        self.timeout_ms = timeout_ms
        self.on_drain = on_drain
        self.state = 'running'
        self._pending = None
        self._closed = None
        self._result = None

    def try_accept(self):
        return self.state == 'running'

    def shutdown(self):
        if self._pending is not None:
            return self._pending
        if self.state == 'closed':
            future = asyncio.get_running_loop().create_future()
            future.set_result(self._result)
            return future
        self.state = 'draining'
        self._closed = asyncio.get_running_loop().create_future()
        self.server.close(self._on_closed)
        self._pending = asyncio.ensure_future(self._wait())
        return self._pending

    def _on_closed(self, error=None):
        if self._closed.done():
            return
        if error is not None:
            self._closed.set_exception(error)
        else:
            self._closed.set_result(None)

    async def _wait(self):
        try:
            await asyncio.wait_for(self._drain(), self.timeout_ms / 1000)
        except asyncio.TimeoutError:
            return self._finalize({'forced': True, 'reason': 'TIMEOUT'})
        except Exception as error:
            return self._finalize({'forced': False, 'error': error})
        return self._finalize({'forced': False})

    async def _drain(self):
        await self._closed
        await self.on_drain()

    def _finalize(self, result):
        self.state = 'closed'
        self._result = result
        return result


def create_shutdown(server, timeout_ms=10000, on_drain=None, scheduler=None):
    return Shutdown(server, timeout_ms, on_drain or (lambda: asyncio.sleep(0)))
`,
    tests: [
      {
        name: '正常排空后进入 closed',
        code: `class Server:
    def __init__(self):
        self.calls = 0
        self.callback = None

    def close(self, callback=None):
        self.calls += 1
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()
drained = []

async def on_drain():
    drained.append(True)

shutdown = create_shutdown(server, timeout_ms=1000, on_drain=on_drain)
job = shutdown.shutdown()
assert_eq(shutdown.state, 'draining')
assert_eq(shutdown.try_accept(), False)
server.finish()
result = await job
assert_eq(result, {'forced': False})
assert_eq(shutdown.state, 'closed')
assert_eq(drained, [True])
assert_eq(server.calls, 1)`
      },
      {
        name: '重复调用返回同一 Future',
        code: `class Server:
    def __init__(self):
        self.calls = 0
        self.callback = None

    def close(self, callback=None):
        self.calls += 1
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()
shutdown = create_shutdown(server, timeout_ms=1000)
first = shutdown.shutdown()
second = shutdown.shutdown()
assert first is second
server.finish()
await first`
      },
      {
        name: '超时强制关闭并标记 TIMEOUT',
        code: `class Server:
    def __init__(self):
        self.calls = 0

    def close(self, callback=None):
        self.calls += 1

server = Server()
shutdown = create_shutdown(server, timeout_ms=0)
result = await shutdown.shutdown()
assert_eq(result['forced'], True)
assert_eq(result['reason'], 'TIMEOUT')
assert_eq(shutdown.state, 'closed')`
      },
      {
        name: '排空抛错仍进入 closed 并暴露错误',
        code: `class Server:
    def __init__(self):
        self.callback = None

    def close(self, callback=None):
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()

async def broken_drain():
    raise RuntimeError('drain failed')

shutdown = create_shutdown(server, timeout_ms=1000, on_drain=broken_drain)
job = shutdown.shutdown()
server.finish()
result = await job
assert_eq(result['forced'], False)
assert isinstance(result['error'], RuntimeError)
assert_eq(shutdown.state, 'closed')`
      },
      {
        name: 'draining 阶段拒绝新请求',
        code: `class Server:
    def __init__(self):
        self.callback = None

    def close(self, callback=None):
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()
shutdown = create_shutdown(server, timeout_ms=1000)
assert_eq(shutdown.try_accept(), True)
job = shutdown.shutdown()
assert_eq(shutdown.try_accept(), False)
server.finish()
await job
assert_eq(shutdown.try_accept(), False)`
      },
      {
        name: '状态不可逆且不重复关闭',
        code: `class Server:
    def __init__(self):
        self.calls = 0
        self.callback = None

    def close(self, callback=None):
        self.calls += 1
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()
shutdown = create_shutdown(server, timeout_ms=1000)
job = shutdown.shutdown()
server.finish()
await job
assert_eq(shutdown.state, 'closed')
again = await shutdown.shutdown()
assert_eq(again, {'forced': False})
assert_eq(server.calls, 1)`
      },
      {
        name: '超时后忽略迟到的 close 回调',
        code: `class Server:
    def __init__(self):
        self.calls = 0
        self.callback = None

    def close(self, callback=None):
        self.calls += 1
        self.callback = callback

    def finish(self):
        if self.callback is not None:
            self.callback()

server = Server()
shutdown = create_shutdown(server, timeout_ms=0)
result = await shutdown.shutdown()
assert_eq(result['reason'], 'TIMEOUT')
server.finish()
again = await shutdown.shutdown()
assert_eq(again['reason'], 'TIMEOUT')
assert_eq(shutdown.state, 'closed')
assert_eq(server.calls, 1)`
      }
    ]
  },
  'm3-cicd-ex-1': {
    starter: `def evaluate_flag(flag, context=None):
    context = context or {}
    if flag is None:
        return {'enabled': False, 'reason': 'UNKNOWN_FLAG'}
    user_id = context.get('userId')
    if flag.get('enabled') is False:
        return {'enabled': False, 'reason': 'DISABLED'}
    if not user_id:
        return {'enabled': False, 'reason': 'NO_IDENTITY'}
    text = str(user_id)
    bucket = int(text) % 100 if text.isdigit() else 0
    if bucket < flag.get('percentage', 0):
        return {'enabled': True, 'reason': 'IN_ROLLOUT'}
    return {'enabled': False, 'reason': 'OUT_OF_ROLLOUT'}
`,
    solution: `def fnv1a(text):
    digest = 2166136261
    for byte in text.encode('utf-8'):
        digest ^= byte
        digest = (digest * 16777619) & 0xFFFFFFFF
    return digest


def evaluate_flag(flag, context=None):
    context = context or {}
    if flag is None:
        return {'enabled': False, 'reason': 'UNKNOWN_FLAG'}
    if flag.get('killSwitch'):
        return {'enabled': False, 'reason': 'KILL_SWITCH'}
    user_id = context.get('userId')
    if user_id is not None and user_id in (flag.get('denylist') or []):
        return {'enabled': False, 'reason': 'DENY_LIST'}
    if user_id is not None and user_id in (flag.get('allowlist') or []):
        return {'enabled': True, 'reason': 'ALLOW_LIST'}
    if flag.get('enabled') is False:
        return {'enabled': False, 'reason': 'DISABLED'}
    percentage = flag.get('percentage')
    if percentage == 100:
        return {'enabled': True, 'reason': 'FULL_ROLLOUT'}
    if percentage is None or percentage == 0:
        return {'enabled': False, 'reason': 'NOT_IN_ROLLOUT'}
    if user_id is None:
        return {'enabled': False, 'reason': 'NO_IDENTITY'}
    bucket = fnv1a(flag.get('key', '') + ':' + str(user_id)) % 100
    if bucket < percentage:
        return {'enabled': True, 'reason': 'IN_ROLLOUT'}
    return {'enabled': False, 'reason': 'OUT_OF_ROLLOUT'}
`,
    tests: [
      {
        name: '全开与全关',
        code: `open_flag = {'key': 'new-ui', 'enabled': True, 'percentage': 100}
closed_flag = {'key': 'new-ui', 'enabled': False, 'percentage': 100}
assert_eq(evaluate_flag(open_flag, {'userId': 'u1'}), {'enabled': True, 'reason': 'FULL_ROLLOUT'})
assert_eq(evaluate_flag(closed_flag, {'userId': 'u1'}), {'enabled': False, 'reason': 'DISABLED'})`
      },
      {
        name: '白名单优先于百分比',
        code: `flag = {'key': 'beta', 'enabled': True, 'percentage': 0, 'allowlist': ['u2']}
assert_eq(evaluate_flag(flag, {'userId': 'u2'})['reason'], 'ALLOW_LIST')
assert_eq(evaluate_flag(flag, {'userId': 'u3'})['reason'], 'NOT_IN_ROLLOUT')`
      },
      {
        name: '黑名单优先于白名单',
        code: `flag = {
    'key': 'beta',
    'enabled': True,
    'percentage': 100,
    'allowlist': ['u2'],
    'denylist': ['u2'],
}
assert_eq(evaluate_flag(flag, {'userId': 'u2'})['reason'], 'DENY_LIST')`
      },
      {
        name: '百分比对同一用户稳定',
        code: `flag = {'key': 'rollout', 'enabled': True, 'percentage': 50}
reasons = set()
for index in range(100):
    user_id = 'user-' + str(index)
    first = evaluate_flag(flag, {'userId': user_id})
    second = evaluate_flag(flag, {'userId': user_id})
    assert_eq(first, second)
    reasons.add(first['reason'])
assert 'IN_ROLLOUT' in reasons
assert 'OUT_OF_ROLLOUT' in reasons`
      },
      {
        name: 'kill switch 覆盖其他规则',
        code: `flag = {
    'key': 'beta',
    'enabled': True,
    'percentage': 100,
    'allowlist': ['u2'],
    'killSwitch': True,
}
assert_eq(evaluate_flag(flag, {'userId': 'u2'}), {'enabled': False, 'reason': 'KILL_SWITCH'})
assert_eq(evaluate_flag(None, {'userId': 'u2'}), {'enabled': False, 'reason': 'UNKNOWN_FLAG'})`
      },
      {
        name: '匿名用户不能进入百分比灰度',
        code: `flag = {'key': 'beta', 'enabled': True, 'percentage': 50}
assert_eq(evaluate_flag(flag, {})['reason'], 'NO_IDENTITY')
assert_eq(evaluate_flag(flag, None)['reason'], 'NO_IDENTITY')
assert_eq(evaluate_flag({'key': 'beta', 'enabled': True, 'percentage': 100}, {})['reason'], 'FULL_ROLLOUT')`
      },
      {
        name: '未知 flag 默认关闭',
        code: `assert_eq(evaluate_flag(None, {'userId': 'u1'}), {'enabled': False, 'reason': 'UNKNOWN_FLAG'})
assert_eq(evaluate_flag({}, {'userId': 'u1'})['reason'], 'NOT_IN_ROLLOUT')`
      }
    ]
  }
} satisfies PythonTrackMap;
