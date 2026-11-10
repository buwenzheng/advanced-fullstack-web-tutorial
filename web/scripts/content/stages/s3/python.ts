import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  's3-l1': [
    {
      code: `class TtlCache:
    def __init__(self, ttl=60_000, max_size=500, now=time.time):
        self.ttl = ttl
        self.max_size = max_size
        self.now = now
        self.store = {}

    def get(self, key):
        entry = self.store.get(key)
        if entry is None:
            return None
        if entry["expires_at"] <= self.now():
            del self.store[key]
            return None
        return entry["value"]

    def set(self, key, value, lifetime=None):
        if key not in self.store and len(self.store) >= self.max_size:
            oldest = next(iter(self.store))
            del self.store[oldest]
        life = self.ttl if lifetime is None else lifetime
        self.store[key] = {"value": value, "expires_at": self.now() + life}

    def delete(self, key):
        self.store.pop(key, None)`,
      note: 'Python 的 dict 从 3.7 起保持插入顺序，next(iter(...)) 可以模拟「最早写入」淘汰；生产实现应换 LRU。题目要求毫秒整数时钟，示例用 time.time 只是结构示意，测试与练习都注入 now。'
    },
    {
      code: `import asyncio

_MISS = object()


class LoaderCache:
    def __init__(self, ttl=60_000, negative_ttl=5_000, now=time.time):
        self.ttl = ttl
        self.negative_ttl = negative_ttl
        self.now = now
        self.values = {}
        self.inflight = {}

    async def get(self, key, loader):
        entry = self.values.get(key)
        if entry is not None and entry["expires_at"] > self.now():
            return entry["value"]
        if key in self.inflight:
            return await self.inflight[key]
        task = asyncio.ensure_future(self._load(key, loader))
        self.inflight[key] = task
        return await task

    async def _load(self, key, loader):
        try:
            value = await loader()
            lifetime = self.negative_ttl if value is None else self.ttl
            self.values[key] = {"value": value, "expires_at": self.now() + lifetime}
            return value
        except Exception:
            self.values.pop(key, None)
            raise
        finally:
            self.inflight.pop(key, None)`,
      note: 'asyncio 的 Task 只创建一次，后续并发调用 await 同一个 Task，这就是 single-flight。注意字典里「没有 key」与「缓存了 None」是两种状态：这里用 entry is not None 判断，不能用 values.get(key) 的真值。'
    }
  ],
  's3-l2': [
    {
      code: `class VisibilityQueue:
    def __init__(self, visibility_timeout=1000, max_attempts=3, now=None):
        self.visibility_timeout = visibility_timeout
        self.max_attempts = max_attempts
        self.now = now or (lambda: 0)
        self.sequence = 0
        self.pending = []
        self.inflight = {}
        self.dead = []

    def enqueue(self, payload):
        self.sequence += 1
        message_id = "msg-" + str(self.sequence)
        self.pending.append({
            "id": message_id,
            "payload": payload,
            "attempt": 0,
            "visibleAt": self.now(),
        })
        return message_id

    def _requeue_expired(self):
        for message_id in list(self.inflight):
            message = self.inflight[message_id]
            if message["visibleAt"] > self.now():
                continue
            del self.inflight[message_id]
            if message["attempt"] >= self.max_attempts:
                self.dead.append(message.copy())
            else:
                self.pending.append({**message, "visibleAt": self.now()})

    def reserve(self):
        self._requeue_expired()
        for index, message in enumerate(self.pending):
            if message["visibleAt"] <= self.now():
                self.pending.pop(index)
                attempt = message["attempt"] + 1
                self.inflight[message["id"]] = {
                    **message,
                    "attempt": attempt,
                    "visibleAt": self.now() + self.visibility_timeout,
                }
                return {"id": message["id"], "payload": message["payload"], "attempt": attempt}
        return None

    def ack(self, message_id):
        self.inflight.pop(message_id, None)

    def nack(self, message_id):
        self._requeue_expired()
        message = self.inflight.pop(message_id, None)
        if message is None:
            return
        if message["attempt"] >= self.max_attempts:
            self.dead.append(message.copy())
        else:
            self.pending.append({**message, "visibleAt": self.now()})

    def dead_letters(self):
        return [message.copy() for message in self.dead]`,
      note: 'Python 的 None 同时表示「没有消息」与「payload 是 None」会有歧义；这里 reserve 返回 None 只表示队列为空，payload 放在 dict 里，不改变返回类型。真实实现还应处理并发 reserve 的原子性，单进程字典演示做不到跨进程互斥。'
    },
    {
      code: `import inspect


async def consume(queue, handler, processed):
    message = queue.reserve()
    if message is None:
        return None
    payload = message.get("payload") or {}
    event_id = payload.get("eventId")
    if event_id and event_id in processed:
        queue.ack(message["id"])
        return {"id": message["id"], "duplicate": True}
    try:
        result = handler(message)
        if inspect.isawaitable(result):
            await result
        if event_id:
            processed.add(event_id)
        queue.ack(message["id"])
        return {"id": message["id"], "duplicate": False}
    except Exception as error:
        queue.nack(message["id"])
        return {"id": message["id"], "duplicate": False, "error": error}`,
      note: 'inspect.isawaitable 让 handler 既可以是普通函数也可以是协程函数；生产环境 processed 应是数据库或 Redis 中的持久化去重集合，不能是进程内 set。ack 必须在副作用成功之后执行。'
    }
  ],
  's3-l3': [
    {
      code: `import math


class TokenBucket:
    def __init__(self, capacity, refill_per_second, now=None):
        if not capacity > 0:
            raise ValueError('capacity must be positive')
        if not refill_per_second >= 0:
            raise ValueError('refill_per_second must be >= 0')
        self.capacity = capacity
        self.rate = refill_per_second
        self.now = now or (lambda: 0)
        self.tokens = capacity
        self.last = self.now()

    def _refill(self):
        current = self.now()
        elapsed = max(0, current - self.last)
        if elapsed == 0:
            return
        self.tokens = min(self.capacity, self.tokens + elapsed / 1000 * self.rate)
        self.last = current

    def try_consume(self, amount=1):
        if not amount > 0:
            raise ValueError('tokens must be positive')
        self._refill()
        if self.tokens >= amount:
            self.tokens -= amount
            return {'allowed': True, 'remaining': self.tokens, 'retryAfterMs': 0}
        missing = amount - self.tokens
        if self.rate == 0:
            retry_after = float('inf')
        else:
            retry_after = math.ceil(missing / self.rate * 1000)
        return {'allowed': False, 'remaining': self.tokens, 'retryAfterMs': retry_after}`,
      note: 'Python 的浮点 token 与 JS 同样有精度问题；展示里用近似断言。时间统一为毫秒整数，now 必须注入，否则测试会依赖真实时钟。'
    },
    {
      code: `import math


def build_rate_limit_response(retry_after_ms, limit, remaining, request_id):
    if retry_after_ms == float('inf'):
        retry_after_seconds = 60
    else:
        retry_after_seconds = max(1, math.ceil(retry_after_ms / 1000))
    return {
        'status': 429,
        'headers': {
            'Retry-After': str(retry_after_seconds),
            'RateLimit-Limit': str(limit),
            'RateLimit-Remaining': str(max(0, int(remaining))),
            'X-Request-Id': request_id,
        },
        'body': {
            'error': {
                'code': 'rate_limited',
                'message': '请求过于频繁，请稍后重试',
                'requestId': request_id,
            },
        },
    }`,
      note: 'Retry-After 至少 1 秒；无限等待时给一个有限默认值，避免客户端永久休眠。响应头名称要固定一套并写进契约文档。'
    }
  ],
  's3-resilience': [
    {
      code: `def plan_retries(max_attempts=3, base_delay_ms=100, max_delay_ms=10000, budget=float('inf'), random=None):
    if not max_attempts >= 1:
        raise ValueError('max_attempts must be >= 1')
    if not base_delay_ms >= 0:
        raise ValueError('base_delay_ms must be >= 0')
    rng = random or (lambda: 0.5)
    delays = []
    total = 0
    for index in range(max_attempts - 1):
        base = min(max_delay_ms, base_delay_ms * 2 ** index)
        jitter = 0.5 + rng()
        delay = min(max_delay_ms, int(base * jitter + 0.5))
        if total + delay > budget:
            break
        delays.append(delay)
        total += delay
    return delays`,
      note: 'Python 的 round 是银行家舍入，这里用 int(x + 0.5) 对齐 JS 的 Math.round；random 注入让测试完全确定。'
    },
    {
      code: `class CircuitOpenError(Exception):
    pass


class CircuitBreaker:
    def __init__(self, failure_threshold=3, cooldown_ms=1000, now=None):
        if not failure_threshold >= 1:
            raise ValueError('failure_threshold must be >= 1')
        if not cooldown_ms >= 0:
            raise ValueError('cooldown_ms must be >= 0')
        self.failure_threshold = failure_threshold
        self.cooldown_ms = cooldown_ms
        self.now = now or (lambda: 0)
        self._state = 'closed'
        self.failures = 0
        self.opened_at = 0
        self.probing = False

    @property
    def state(self):
        self._refresh()
        return self._state

    def _refresh(self):
        if self._state == 'open' and self.now() - self.opened_at >= self.cooldown_ms:
            self._state = 'half-open'
            self.probing = False

    def execute(self, fn):
        self._refresh()
        if self._state == 'open':
            raise CircuitOpenError('circuit is open')
        if self._state == 'half-open':
            if self.probing:
                raise CircuitOpenError('probe in progress')
            self.probing = True
        try:
            result = fn()
        except Exception:
            if self._state == 'half-open':
                self._state = 'open'
                self.opened_at = self.now()
                self.probing = False
            else:
                self.failures += 1
                if self.failures >= self.failure_threshold:
                    self._state = 'open'
                    self.opened_at = self.now()
            raise
        self._state = 'closed'
        self.failures = 0
        self.probing = False
        return result`,
      note: '同步版本用 try/except 包住调用；半开失败要重置 opened_at，否则下一次调用会立即再次半开。生产实现还要给下游调用加超时。'
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  's3-l1-ex-1': {
    starter: `class Cache:
    def __init__(self, ttl=60000, negative_ttl=5000, max_size=500, now=None):
        self.ttl = ttl
        self.negative_ttl = negative_ttl
        self.max_size = max_size
        self.now = now or (lambda: 0)
        self.values = {}

    async def get(self, key, loader):
        entry = self.values.get(key)
        if entry is not None and entry['expiresAt'] > self.now():
            return entry['value']
        value = await loader()
        self.values[key] = {'value': value, 'expiresAt': self.now() + self.ttl}
        return value

    def set(self, key, value, ttl=None):
        self.values[key] = {'value': value, 'expiresAt': self.now() + self.ttl}

    def delete(self, key):
        self.values.pop(key, None)

def create_cache(ttl=60000, negative_ttl=5000, max_size=500, now=None):
    return Cache(ttl=ttl, negative_ttl=negative_ttl, max_size=max_size, now=now)
`,
    solution: `import asyncio

class Cache:
    def __init__(self, ttl=60000, negative_ttl=5000, max_size=500, now=None):
        self.ttl = ttl
        self.negative_ttl = negative_ttl
        self.max_size = max_size
        self.now = now or (lambda: 0)
        self.values = {}
        self.inflight = {}

    def _read(self, key):
        entry = self.values.get(key)
        if entry is None:
            return None
        if entry['expiresAt'] <= self.now():
            del self.values[key]
            return None
        return entry

    def _write(self, key, value, lifetime):
        if key not in self.values and len(self.values) >= self.max_size:
            oldest = next(iter(self.values))
            del self.values[oldest]
        self.values[key] = {'value': value, 'expiresAt': self.now() + lifetime}

    async def _load(self, key, loader):
        try:
            value = await loader()
            lifetime = self.negative_ttl if value is None else self.ttl
            self._write(key, value, lifetime)
            return value
        except Exception:
            self.values.pop(key, None)
            raise
        finally:
            self.inflight.pop(key, None)

    async def get(self, key, loader):
        cached = self._read(key)
        if cached is not None:
            return cached['value']
        if key in self.inflight:
            return await self.inflight[key]
        task = asyncio.ensure_future(self._load(key, loader))
        self.inflight[key] = task
        return await task

    def set(self, key, value, ttl=None):
        lifetime = ttl if ttl is not None else (self.negative_ttl if value is None else self.ttl)
        self._write(key, value, lifetime)

    def delete(self, key):
        self.values.pop(key, None)

def create_cache(ttl=60000, negative_ttl=5000, max_size=500, now=None):
    return Cache(ttl=ttl, negative_ttl=negative_ttl, max_size=max_size, now=now)
`,
    tests: [
      {
        name: '命中后不再调用 loader',
        code: `clock = [0]
calls = [0]
cache = create_cache(ttl=1000, now=lambda: clock[0])
async def loader():
    calls[0] += 1
    return 'v1'
assert_eq(await cache.get('link:1', loader), 'v1')
clock[0] = 500
async def loader2():
    calls[0] += 1
    return 'v2'
assert_eq(await cache.get('link:1', loader2), 'v1')
assert_eq(calls[0], 1)`
      },
      {
        name: '过期后重新调用 loader',
        code: `clock = [0]
calls = [0]
cache = create_cache(ttl=100, now=lambda: clock[0])
async def loader():
    calls[0] += 1
    return 'v' + str(calls[0])
assert_eq(await cache.get('k', loader), 'v1')
clock[0] = 100
assert_eq(await cache.get('k', loader), 'v2')
assert_eq(calls[0], 2)`
      },
      {
        name: '并发 miss 只调用一次 loader',
        code: `import asyncio
pending = asyncio.get_running_loop().create_future()
calls = [0]
cache = create_cache(ttl=1000, now=lambda: 0)
async def loader():
    calls[0] += 1
    return await pending
first = asyncio.ensure_future(cache.get('hot', loader))
second = asyncio.ensure_future(cache.get('hot', loader))
await asyncio.sleep(0)
pending.set_result('shared')
results = await asyncio.gather(first, second)
assert_eq(results, ['shared', 'shared'])
assert_eq(calls[0], 1)`
      },
      {
        name: 'loader 失败不缓存且可重试',
        code: `attempts = [0]
cache = create_cache(ttl=100, now=lambda: 0)
async def failing():
    attempts[0] += 1
    raise RuntimeError('boom')
error = None
try:
    await cache.get('k', failing)
except RuntimeError as caught:
    error = caught
assert error is not None
assert_eq(attempts[0], 1)
async def working():
    attempts[0] += 1
    return 'ok'
assert_eq(await cache.get('k', working), 'ok')
assert_eq(attempts[0], 2)`
      },
      {
        name: '空结果按 negative_ttl 缓存',
        code: `clock = [0]
calls = [0]
cache = create_cache(ttl=1000, negative_ttl=50, now=lambda: clock[0])
async def missing():
    calls[0] += 1
    return None
assert_eq(await cache.get('missing', missing), None)
clock[0] = 25
assert_eq(await cache.get('missing', missing), None)
assert_eq(calls[0], 1)
clock[0] = 60
async def found():
    calls[0] += 1
    return 'found'
assert_eq(await cache.get('missing', found), 'found')
assert_eq(calls[0], 2)`
      },
      {
        name: 'delete 后下一次回源',
        code: `calls = [0]
cache = create_cache(ttl=1000, now=lambda: 0)
async def loader():
    calls[0] += 1
    return 'v' + str(calls[0])
assert_eq(await cache.get('k', loader), 'v1')
cache.delete('k')
assert_eq(await cache.get('k', loader), 'v2')
assert_eq(calls[0], 2)`
      },
      {
        name: '容量上限触发淘汰后回源',
        code: `calls = [0]
cache = create_cache(ttl=10000, max_size=2, now=lambda: 0)
def make(name):
    async def loader():
        calls[0] += 1
        return name
    return loader
await cache.get('a', make('a'))
await cache.get('b', make('b'))
await cache.get('c', make('c'))
await cache.get('a', make('a'))
assert_eq(calls[0], 4)`
      }
    ]
  },
  's3-l2-ex-1': {
    starter: `class Queue:
    def __init__(self, max_attempts=3, now=None):
        self.items = []
        self.sequence = 0

    def enqueue(self, payload):
        self.sequence += 1
        message_id = 'msg-' + str(self.sequence)
        self.items.append({'id': message_id, 'payload': payload})
        return message_id

    def reserve(self):
        if not self.items:
            return None
        message = self.items.pop(0)
        return {'id': message['id'], 'payload': message['payload'], 'attempt': 1}

    def ack(self, message_id):
        pass

    def nack(self, message_id):
        pass

    def dead_letters(self):
        return []

def create_queue(visibility_timeout=1000, max_attempts=3, now=None):
    return Queue(max_attempts=max_attempts, now=now)

async def consume(queue, handler, processed):
    message = queue.reserve()
    if message is None:
        return None
    queue.ack(message['id'])
    await handler(message)
    return {'id': message['id'], 'duplicate': False}
`,
    solution: `import inspect

class VisibilityQueue:
    def __init__(self, visibility_timeout=1000, max_attempts=3, now=None):
        self.visibility_timeout = visibility_timeout
        self.max_attempts = max_attempts
        self.now = now or (lambda: 0)
        self.sequence = 0
        self.pending = []
        self.inflight = {}
        self.dead = []

    def enqueue(self, payload):
        self.sequence += 1
        message_id = 'msg-' + str(self.sequence)
        self.pending.append({'id': message_id, 'payload': payload, 'attempt': 0, 'visibleAt': self.now()})
        return message_id

    def _requeue_expired(self):
        for message_id in list(self.inflight):
            message = self.inflight[message_id]
            if message['visibleAt'] > self.now():
                continue
            del self.inflight[message_id]
            if message['attempt'] >= self.max_attempts:
                self.dead.append(message.copy())
            else:
                self.pending.append({**message, 'visibleAt': self.now()})

    def reserve(self):
        self._requeue_expired()
        for index, message in enumerate(self.pending):
            if message['visibleAt'] <= self.now():
                self.pending.pop(index)
                attempt = message['attempt'] + 1
                self.inflight[message['id']] = {**message, 'attempt': attempt, 'visibleAt': self.now() + self.visibility_timeout}
                return {'id': message['id'], 'payload': message['payload'], 'attempt': attempt}
        return None

    def ack(self, message_id):
        self.inflight.pop(message_id, None)

    def nack(self, message_id):
        self._requeue_expired()
        message = self.inflight.pop(message_id, None)
        if message is None:
            return
        if message['attempt'] >= self.max_attempts:
            self.dead.append(message.copy())
        else:
            self.pending.append({**message, 'visibleAt': self.now()})

    def dead_letters(self):
        return [message.copy() for message in self.dead]

def create_queue(visibility_timeout=1000, max_attempts=3, now=None):
    return VisibilityQueue(visibility_timeout=visibility_timeout, max_attempts=max_attempts, now=now)

async def consume(queue, handler, processed):
    message = queue.reserve()
    if message is None:
        return None
    payload = message.get('payload') or {}
    event_id = payload.get('eventId')
    if event_id and event_id in processed:
        queue.ack(message['id'])
        return {'id': message['id'], 'duplicate': True}
    try:
        result = handler(message)
        if inspect.isawaitable(result):
            await result
        if event_id:
            processed.add(event_id)
        queue.ack(message['id'])
        return {'id': message['id'], 'duplicate': False}
    except Exception as error:
        queue.nack(message['id'])
        return {'id': message['id'], 'duplicate': False, 'error': error}
`,
    tests: [
      {
        name: '正常 ack 后不再投递',
        code: `queue = create_queue(visibility_timeout=100, max_attempts=3, now=lambda: 0)
message_id = queue.enqueue({'eventId': 'evt-1', 'linkId': 'l1'})
message = queue.reserve()
assert_eq(message['id'], message_id)
assert_eq(message['attempt'], 1)
queue.ack(message_id)
assert_eq(queue.reserve(), None)`
      },
      {
        name: '未 ack 超时后重投且 attempt 递增',
        code: `clock = [0]
queue = create_queue(visibility_timeout=100, max_attempts=3, now=lambda: clock[0])
message_id = queue.enqueue({'eventId': 'evt-1'})
queue.reserve()
clock[0] = 50
assert_eq(queue.reserve(), None)
clock[0] = 101
second = queue.reserve()
assert_eq(second['id'], message_id)
assert_eq(second['attempt'], 2)`
      },
      {
        name: 'nack 后立即重投',
        code: `queue = create_queue(visibility_timeout=100, max_attempts=3, now=lambda: 0)
message_id = queue.enqueue({'eventId': 'evt-1'})
queue.reserve()
queue.nack(message_id)
second = queue.reserve()
assert_eq(second['id'], message_id)
assert_eq(second['attempt'], 2)`
      },
      {
        name: '达到最大次数进入死信',
        code: `queue = create_queue(visibility_timeout=100, max_attempts=2, now=lambda: 0)
message_id = queue.enqueue({'eventId': 'evt-1'})
queue.reserve()
queue.nack(message_id)
queue.reserve()
queue.nack(message_id)
assert_eq(queue.reserve(), None)
dead = queue.dead_letters()
assert_eq(len(dead), 1)
assert_eq(dead[0]['id'], message_id)`
      },
      {
        name: '相同 eventId 只执行一次副作用',
        code: `calls = [0]
processed = set()
queue = create_queue(visibility_timeout=100, max_attempts=3, now=lambda: 0)
queue.enqueue({'eventId': 'evt-1', 'linkId': 'l1'})
queue.enqueue({'eventId': 'evt-1', 'linkId': 'l1'})
async def handler(message):
    calls[0] += 1
first = await consume(queue, handler, processed)
second = await consume(queue, handler, processed)
assert_eq(calls[0], 1)
assert_eq(first['duplicate'], False)
assert_eq(second['duplicate'], True)`
      },
      {
        name: '空队列 reserve 返回 None',
        code: `queue = create_queue(now=lambda: 0)
assert_eq(queue.reserve(), None)`
      },
      {
        name: 'handler 失败不 ack 且消息可重投',
        code: `processed = set()
queue = create_queue(visibility_timeout=100, max_attempts=3, now=lambda: 0)
message_id = queue.enqueue({'eventId': 'evt-1'})
async def handler(message):
    raise RuntimeError('boom')
result = await consume(queue, handler, processed)
assert_eq(result['error'].args[0], 'boom')
assert_eq(len(processed), 0)
retry = queue.reserve()
assert_eq(retry['id'], message_id)
assert_eq(retry['attempt'], 2)`
      }
    ]
  },
  's3-l3-ex-1': {
    starter: `class TokenBucket:
    def __init__(self, capacity, refill_per_second, now=None):
        self.capacity = capacity
        self.tokens = capacity

    def try_consume(self, amount=1):
        if self.tokens >= amount:
            self.tokens -= amount
            return {'allowed': True, 'remaining': self.tokens, 'retryAfterMs': 0}
        return {'allowed': False, 'remaining': self.tokens, 'retryAfterMs': 1}

def create_token_bucket(capacity, refill_per_second, now=None):
    return TokenBucket(capacity, refill_per_second, now=now)
`,
    solution: `import math

class TokenBucket:
    def __init__(self, capacity, refill_per_second, now=None):
        if not capacity > 0:
            raise ValueError('capacity must be positive')
        if not refill_per_second >= 0:
            raise ValueError('refill_per_second must be >= 0')
        self.capacity = capacity
        self.rate = refill_per_second
        self.now = now or (lambda: 0)
        self.tokens = capacity
        self.last = self.now()

    def _refill(self):
        current = self.now()
        elapsed = max(0, current - self.last)
        if elapsed == 0:
            return
        self.tokens = min(self.capacity, self.tokens + elapsed / 1000 * self.rate)
        self.last = current

    def try_consume(self, amount=1):
        if not amount > 0:
            raise ValueError('tokens must be positive')
        self._refill()
        if self.tokens >= amount:
            self.tokens -= amount
            return {'allowed': True, 'remaining': self.tokens, 'retryAfterMs': 0}
        missing = amount - self.tokens
        if self.rate == 0:
            retry_after = float('inf')
        else:
            retry_after = math.ceil(missing / self.rate * 1000)
        return {'allowed': False, 'remaining': self.tokens, 'retryAfterMs': retry_after}

def create_token_bucket(capacity, refill_per_second, now=None):
    return TokenBucket(capacity, refill_per_second, now=now)
`,
    tests: [
      {
        name: '初始满桶可一次消耗完',
        code: `bucket = create_token_bucket(capacity=5, refill_per_second=1, now=lambda: 0)
first = bucket.try_consume(3)
assert_eq(first['allowed'], True)
assert_eq(first['remaining'], 2)
assert_eq(first['retryAfterMs'], 0)
second = bucket.try_consume(3)
assert_eq(second['allowed'], False)
assert_eq(second['remaining'], 2)
assert_eq(second['retryAfterMs'], 1000)`
      },
      {
        name: '支持小数 token 消耗',
        code: `bucket = create_token_bucket(capacity=2, refill_per_second=0.5, now=lambda: 0)
result = bucket.try_consume(0.25)
assert_eq(result['allowed'], True)
assert abs(result['remaining'] - 1.75) < 1e-9`
      },
      {
        name: '按经过时间补充 token',
        code: `clock = [0]
bucket = create_token_bucket(capacity=10, refill_per_second=2, now=lambda: clock[0])
bucket.try_consume(10)
clock[0] = 1000
refilled = bucket.try_consume(2)
assert_eq(refilled['allowed'], True)
assert abs(refilled['remaining']) < 1e-9`
      },
      {
        name: '耗尽后拒绝并给出 retryAfterMs',
        code: `clock = [0]
bucket = create_token_bucket(capacity=2, refill_per_second=2, now=lambda: clock[0])
bucket.try_consume(2)
denied = bucket.try_consume(1)
assert_eq(denied['allowed'], False)
assert_eq(denied['retryAfterMs'], 500)
clock[0] = 500
allowed = bucket.try_consume(1)
assert_eq(allowed['allowed'], True)
assert_eq(allowed['retryAfterMs'], 0)`
      },
      {
        name: '补充不超过容量上限',
        code: `clock = [0]
bucket = create_token_bucket(capacity=3, refill_per_second=1, now=lambda: clock[0])
bucket.try_consume(1)
clock[0] = 1000000
all_tokens = bucket.try_consume(3)
assert_eq(all_tokens['allowed'], True)
assert_eq(all_tokens['remaining'], 0)`
      },
      {
        name: '非法参数与非正 token 抛 ValueError',
        code: `capacity_error = None
try:
    create_token_bucket(capacity=0, refill_per_second=1, now=lambda: 0)
except ValueError as caught:
    capacity_error = caught
assert capacity_error is not None
bucket = create_token_bucket(capacity=1, refill_per_second=1, now=lambda: 0)
amount_error = None
try:
    bucket.try_consume(0)
except ValueError as caught:
    amount_error = caught
assert amount_error is not None`
      },
      {
        name: '恒定速率下按秒补充并可继续消耗',
        code: `clock = [0]
bucket = create_token_bucket(capacity=4, refill_per_second=1, now=lambda: clock[0])
bucket.try_consume(4)
assert_eq(bucket.try_consume(1)['allowed'], False)
for second in range(1, 5):
    clock[0] = second * 1000
    assert_eq(bucket.try_consume(1)['allowed'], True)
assert_eq(bucket.try_consume(1)['allowed'], False)`
      }
    ]
  },
  's3-resilience-ex-1': {
    starter: `class CircuitOpenError(Exception):
    pass

def plan_retries(max_attempts=3, base_delay_ms=100, max_delay_ms=10000, budget=float('inf'), random=None):
    return [base_delay_ms * 2 ** index for index in range(max(0, max_attempts - 1))]

class CircuitBreaker:
    def __init__(self, failure_threshold=3, cooldown_ms=1000, now=None):
        self.failures = 0

    @property
    def state(self):
        return 'closed'

    def execute(self, fn):
        return fn()

def create_circuit_breaker(failure_threshold=3, cooldown_ms=1000, now=None):
    return CircuitBreaker(failure_threshold, cooldown_ms, now=now)
`,
    solution: `class CircuitOpenError(Exception):
    pass

def plan_retries(max_attempts=3, base_delay_ms=100, max_delay_ms=10000, budget=float('inf'), random=None):
    if not max_attempts >= 1:
        raise ValueError('max_attempts must be >= 1')
    if not base_delay_ms >= 0:
        raise ValueError('base_delay_ms must be >= 0')
    rng = random or (lambda: 0.5)
    delays = []
    total = 0
    for index in range(max_attempts - 1):
        base = min(max_delay_ms, base_delay_ms * 2 ** index)
        jitter = 0.5 + rng()
        delay = min(max_delay_ms, int(base * jitter + 0.5))
        if total + delay > budget:
            break
        delays.append(delay)
        total += delay
    return delays

class CircuitBreaker:
    def __init__(self, failure_threshold=3, cooldown_ms=1000, now=None):
        if not failure_threshold >= 1:
            raise ValueError('failure_threshold must be >= 1')
        if not cooldown_ms >= 0:
            raise ValueError('cooldown_ms must be >= 0')
        self.failure_threshold = failure_threshold
        self.cooldown_ms = cooldown_ms
        self.now = now or (lambda: 0)
        self._state = 'closed'
        self.failures = 0
        self.opened_at = 0
        self.probing = False

    @property
    def state(self):
        self._refresh()
        return self._state

    def _refresh(self):
        if self._state == 'open' and self.now() - self.opened_at >= self.cooldown_ms:
            self._state = 'half-open'
            self.probing = False

    def execute(self, fn):
        self._refresh()
        if self._state == 'open':
            raise CircuitOpenError('circuit is open')
        if self._state == 'half-open':
            if self.probing:
                raise CircuitOpenError('probe in progress')
            self.probing = True
        try:
            result = fn()
        except Exception:
            if self._state == 'half-open':
                self._state = 'open'
                self.opened_at = self.now()
                self.probing = False
            else:
                self.failures += 1
                if self.failures >= self.failure_threshold:
                    self._state = 'open'
                    self.opened_at = self.now()
            raise
        self._state = 'closed'
        self.failures = 0
        self.probing = False
        return result

def create_circuit_breaker(failure_threshold=3, cooldown_ms=1000, now=None):
    return CircuitBreaker(failure_threshold=failure_threshold, cooldown_ms=cooldown_ms, now=now)
`,
    tests: [
      {
        name: '重试延迟指数递增',
        code: `delays = plan_retries(max_attempts=4, base_delay_ms=100, max_delay_ms=10000, budget=float('inf'), random=lambda: 0.5)
assert_eq(delays, [100, 200, 400])`
      },
      {
        name: '抖动落在 0.5 到 1.5 倍之间',
        code: `lower = plan_retries(max_attempts=2, base_delay_ms=100, max_delay_ms=10000, random=lambda: 0)
upper = plan_retries(max_attempts=2, base_delay_ms=100, max_delay_ms=10000, random=lambda: 1)
assert_eq(lower, [50])
assert_eq(upper, [150])`
      },
      {
        name: '每次延迟封顶 maxDelayMs',
        code: `delays = plan_retries(max_attempts=5, base_delay_ms=100, max_delay_ms=300, random=lambda: 0.5)
assert_eq(delays, [100, 200, 300, 300])`
      },
      {
        name: '预算不足时提前停止',
        code: `delays = plan_retries(max_attempts=5, base_delay_ms=100, max_delay_ms=10000, budget=250, random=lambda: 0.5)
assert_eq(delays, [100])`
      },
      {
        name: 'maxAttempts 为 1 时没有重试',
        code: `assert_eq(plan_retries(max_attempts=1), [])`
      },
      {
        name: '连续失败达到阈值打开熔断',
        code: `clock = [0]
calls = [0]
breaker = create_circuit_breaker(failure_threshold=2, cooldown_ms=1000, now=lambda: clock[0])
def failing():
    calls[0] += 1
    raise RuntimeError('boom')
for index in range(2):
    try:
        breaker.execute(failing)
    except RuntimeError:
        pass
assert_eq(breaker.state, 'open')
open_error = None
try:
    breaker.execute(failing)
except CircuitOpenError as caught:
    open_error = caught
assert_eq(calls[0], 2)
assert open_error is not None`
      },
      {
        name: '冷却后半开探测成功回到 closed',
        code: `clock = [0]
breaker = create_circuit_breaker(failure_threshold=1, cooldown_ms=100, now=lambda: clock[0])
def failing():
    raise RuntimeError('down')
try:
    breaker.execute(failing)
except RuntimeError:
    pass
assert_eq(breaker.state, 'open')
clock[0] = 100
result = breaker.execute(lambda: 'ok')
assert_eq(result, 'ok')
assert_eq(breaker.state, 'closed')`
      },
      {
        name: '半开探测失败回到 open 且冷却重置',
        code: `clock = [0]
breaker = create_circuit_breaker(failure_threshold=1, cooldown_ms=100, now=lambda: clock[0])
def failing():
    raise RuntimeError('down')
try:
    breaker.execute(failing)
except RuntimeError:
    pass
clock[0] = 100
try:
    breaker.execute(failing)
except RuntimeError:
    pass
assert_eq(breaker.state, 'open')
called = [False]
def probe():
    called[0] = True
    return 'ok'
try:
    breaker.execute(probe)
except CircuitOpenError:
    pass
assert_eq(called[0], False)`
      },
      {
        name: '成功调用重置失败计数',
        code: `clock = [0]
breaker = create_circuit_breaker(failure_threshold=2, cooldown_ms=1000, now=lambda: clock[0])
def failing():
    raise RuntimeError('boom')
def ok():
    return 'ok'
try:
    breaker.execute(failing)
except RuntimeError:
    pass
breaker.execute(ok)
try:
    breaker.execute(failing)
except RuntimeError:
    pass
assert_eq(breaker.state, 'closed')
try:
    breaker.execute(failing)
except RuntimeError:
    pass
assert_eq(breaker.state, 'open')`
      }
    ]
  }
} satisfies PythonTrackMap;
