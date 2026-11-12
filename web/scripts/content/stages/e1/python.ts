import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  'e1-modular': [
    {
      code: `def analyze_graph(graph=None, rules=None):
    graph = graph or {}
    rules = rules or []
    names = set(graph)
    for deps in graph.values():
        names.update(deps or [])
    ordered = sorted(names)
    adjacency = {name: [] for name in ordered}
    for name in graph:
        adjacency[name] = sorted(set(graph.get(name) or []))

    color = {name: 0 for name in ordered}
    stack = []
    seen = set()
    cycles = []

    def canonical(path):
        opening = path[:-1]
        best = None
        for index in range(len(opening)):
            key = '>'.join(opening[index:] + opening[:index])
            if best is None or key < best:
                best = key
        return best

    def visit(name):
        color[name] = 1
        stack.append(name)
        for dep in adjacency.get(name, []):
            if dep not in adjacency:
                continue
            if color[dep] == 0:
                visit(dep)
            elif color[dep] == 1:
                start = stack.index(dep)
                path = stack[start:] + [dep]
                key = canonical(path)
                if key not in seen:
                    seen.add(key)
                    cycles.append(path)
        stack.pop()
        color[name] = 2

    for name in ordered:
        if color[name] == 0:
            visit(name)
    cycles.sort(key=lambda path: '>'.join(path))

    violations = []
    for rule in rules:
        source = rule.get('name') or rule.get('from')
        forbidden = rule.get('forbid') or []
        for dep in adjacency.get(source, []):
            if dep in forbidden:
                violations.append({
                    'from': source,
                    'to': dep,
                    'rule': rule.get('id') or source + '->' + dep,
                })
    return {'cycles': cycles, 'violations': violations}`,
      note: '三色标记区分「正在访问」与「已完成」：只有指向灰色节点的边才构成环。环路径做旋转归一，避免 a→b→a 与 b→a→b 重复；Python 的 set 迭代无序，所有遍历前先排序，保证输出稳定。'
    }
  ],
  'e1-consistency': [
    {
      code: `class Outbox:
    def __init__(self, store, publisher, now, max_attempts=5):
        self.store = store
        self.publisher = publisher
        self.now = now
        self.max_attempts = max_attempts

    def add(self, business_write, event):
        def run(tx):
            business_write(tx)
            return tx.insert_event({
                'eventId': event['eventId'],
                'type': event['type'],
                'payload': event['payload'],
                'attempts': 0,
                'sentAt': None,
                'failedAt': None,
                'createdAt': self.now(),
            })
        return self.store.transaction(run)

    async def publish_batch(self, limit=10):
        results = []
        for record in self.store.claim_pending(limit):
            try:
                await self.publisher['publish'](record)
                self.store.mark_sent(record['eventId'], self.now())
                results.append({'eventId': record['eventId'], 'ok': True})
            except Exception as error:
                self.store.mark_failed(
                    record['eventId'], str(error), self.max_attempts
                )
                results.append({
                    'eventId': record['eventId'],
                    'ok': False,
                    'error': str(error),
                })
        return results`,
      note: '先 publish 成功再 mark_sent；异常时也要释放 claim 锁并累加 attempts。真实实现里 claim_pending 对应 SELECT ... FOR UPDATE SKIP LOCKED，与标记动作在同一个数据库事务边界内。'
    },
    {
      code: `class Consumer:
    def __init__(self, apply):
        self.apply = apply
        self.processed = set()

    async def consume(self, event):
        if event['eventId'] in self.processed:
            return {'duplicate': True}
        await self.apply(event)
        self.processed.add(event['eventId'])
        return {'duplicate': False}


def create_consumer(apply):
    return Consumer(apply)`,
      note: '去重记录必须在业务成功之后写入；生产实现还要把「业务写入 + event_id 去重」放在同一数据库事务，并在 event_id 上加唯一索引，进程崩溃或并发重复投递时由数据库兜底。'
    }
  ],
  'e1-failures': [
    {
      code: `class Store:
    def __init__(self):
        self.data = {}
        self.locks = {}
        self._token = 0

    def get(self, key):
        return self.locks.get(key)

    def set(self, key, record):
        self.locks[key] = record

    def delete(self, key):
        self.locks.pop(key, None)

    def next_token(self):
        self._token += 1
        return self._token


class Lock:
    def __init__(self, store, now):
        self.store = store
        self.now = now

    def _active(self, key):
        record = self.store.get(key)
        if record is None:
            return None
        if record['expiresAt'] <= self.now():
            self.store.delete(key)
            return None
        return record

    def acquire(self, key, ttl_ms):
        if self._active(key) is not None:
            return None
        token = self.store.next_token()
        expires_at = self.now() + ttl_ms
        self.store.set(key, {'token': token, 'expiresAt': expires_at})
        return {'token': token, 'expiresAt': expires_at}

    def renew(self, key, token, ttl_ms):
        record = self._active(key)
        if record is None or record['token'] != token:
            return False
        record['expiresAt'] = self.now() + ttl_ms
        self.store.set(key, record)
        return True

    def write(self, key, token, value):
        record = self._active(key)
        if record is None or record['token'] != token:
            return {'ok': False, 'reason': 'STALE_TOKEN'}
        self.store.data[key] = value
        return {'ok': True}


def create_fenced_lock(store, now):
    return Lock(store, now)`,
      note: 'Python 里没有隐式的 this，状态放在 Store 与 Lock 两个对象上。关键是 _active：先检查过期并清理，再比较 token。写入由存储层拒绝旧 token，旧持有者醒来也只能拿到 STALE_TOKEN。'
    },
    {
      code: `import asyncio
import random
import time


class RetryableError(Exception):
    pass


class BudgetExhausted(Exception):
    pass


async def with_budget(deadline_ms, per_attempt_ms, fn):
    deadline = time.monotonic() + deadline_ms / 1000
    attempt = 0
    while time.monotonic() < deadline:
        remaining = deadline - time.monotonic()
        timeout_s = min(per_attempt_ms / 1000, remaining)
        attempt += 1
        try:
            return await asyncio.wait_for(
                fn({
                    'timeoutMs': timeout_s * 1000,
                    'attempt': attempt,
                    'deadline': deadline,
                }),
                timeout_s,
            )
        except RetryableError:
            backoff = min(0.1 * 2 ** attempt, remaining / 2)
            await asyncio.sleep(backoff * (0.5 + random.random()))
    raise BudgetExhausted('BUDGET_EXHAUSTED')`,
      note: 'deadline 在入口只计算一次，下游拿到的是剩余时间。asyncio.wait_for 负责单次超时；只捕获可重试错误，其余直接抛出。抖动打散同时失败的重试，避免它们在同一时刻再次冲击下游。'
    }
  ],
  'e1-datascale': [
    {
      code: `import bisect


def fnv1a(text):
    value = 2166136261
    for byte in text.encode('utf-8'):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value


class HashRing:
    def __init__(self, nodes, virtual_nodes=100, hash_fn=fnv1a):
        self.virtual_nodes = virtual_nodes
        self.hash_fn = hash_fn
        self.positions = []
        self.owners = []
        self.members = set()
        for node in nodes:
            self.add_node(node)

    def add_node(self, node):
        if node in self.members:
            return
        self.members.add(node)
        for index in range(self.virtual_nodes):
            self.positions.append(self.hash_fn('%s#%d' % (node, index)))
            self.owners.append(node)
        order = sorted(
            range(len(self.positions)),
            key=lambda i: self.positions[i],
        )
        self.positions = [self.positions[i] for i in order]
        self.owners = [self.owners[i] for i in order]

    def remove_node(self, node):
        if node not in self.members:
            return
        self.members.remove(node)
        kept = [
            (position, owner)
            for position, owner in zip(self.positions, self.owners)
            if owner != node
        ]
        self.positions = [position for position, _ in kept]
        self.owners = [owner for _, owner in kept]

    def get_node(self, key):
        if not self.positions:
            raise ValueError('EMPTY_RING')
        index = bisect.bisect_left(self.positions, self.hash_fn(key))
        if index == len(self.positions):
            index = 0
        return self.owners[index]`,
      note: 'bisect_left 找第一个 >= 目标位置的虚拟节点；越界时回绕到环首。删除节点只过滤该节点的虚拟节点，其余顺序不变，所以其他 key 的映射保持稳定。'
    },
    {
      code: `EPOCH = 1700000000000
NODE_BITS = 10
SEQUENCE_BITS = 12


def next_id(timestamp_ms, node_id, sequence):
    since_epoch = timestamp_ms - EPOCH
    return (
        (since_epoch << (NODE_BITS + SEQUENCE_BITS))
        | (node_id << SEQUENCE_BITS)
        | sequence
    )


class IdGenerator:
    def __init__(self, node_id):
        self.node_id = node_id
        self.last_ms = -1
        self.sequence = 0

    def next(self, timestamp_ms):
        if timestamp_ms == self.last_ms:
            self.sequence = (self.sequence + 1) & 0xFFF
            if self.sequence == 0:
                raise RuntimeError('SEQUENCE_EXHAUSTED')
        elif timestamp_ms < self.last_ms:
            raise RuntimeError('CLOCK_BACKWARDS')
        else:
            self.last_ms = timestamp_ms
            self.sequence = 0
        return next_id(timestamp_ms, self.node_id, self.sequence)`,
      note: 'Python 整数没有 32/64 位溢出问题，但仍要显式处理序列耗尽与时钟回拨。高位时间戳让 ID 趋势递增，节点位避免冲突；不要用 time.time() 的浮点秒，统一用毫秒整数。'
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  'e1-modular-ex-1': {
    starter: `def analyze_graph(graph=None, rules=None):
    graph = graph or {}
    rules = rules or []
    cycles = []
    for name, deps in graph.items():
        if name in (deps or []):
            cycles.append([name, name])
    violations = []
    for rule in rules:
        for dep in rule.get('forbid') or []:
            violations.append({
                'from': dep,
                'to': rule.get('name'),
                'rule': rule.get('id'),
            })
    return {'cycles': cycles, 'violations': violations}
`,
    solution: `def analyze_graph(graph=None, rules=None):
    graph = graph or {}
    rules = rules or []
    names = set(graph)
    for deps in graph.values():
        names.update(deps or [])
    ordered = sorted(names)
    adjacency = {name: [] for name in ordered}
    for name in graph:
        adjacency[name] = sorted(set(graph.get(name) or []))

    color = {name: 0 for name in ordered}
    stack = []
    seen = set()
    cycles = []

    def canonical(path):
        opening = path[:-1]
        best = None
        for index in range(len(opening)):
            key = '>'.join(opening[index:] + opening[:index])
            if best is None or key < best:
                best = key
        return best

    def visit(name):
        color[name] = 1
        stack.append(name)
        for dep in adjacency.get(name, []):
            if dep not in adjacency:
                continue
            if color[dep] == 0:
                visit(dep)
            elif color[dep] == 1:
                start = stack.index(dep)
                path = stack[start:] + [dep]
                key = canonical(path)
                if key not in seen:
                    seen.add(key)
                    cycles.append(path)
        stack.pop()
        color[name] = 2

    for name in ordered:
        if color[name] == 0:
            visit(name)
    cycles.sort(key=lambda path: '>'.join(path))

    violations = []
    for rule in rules:
        source = rule.get('name') or rule.get('from')
        forbidden = rule.get('forbid') or []
        for dep in adjacency.get(source, []):
            if dep in forbidden:
                violations.append({
                    'from': source,
                    'to': dep,
                    'rule': rule.get('id') or source + '->' + dep,
                })
    return {'cycles': cycles, 'violations': violations}
`,
    tests: [
      {
        name: '无环图返回空结果',
        code: `result = analyze_graph({
    'api': ['service'],
    'service': ['repo'],
    'repo': [],
})
assert_eq(result['cycles'], [])
assert_eq(result['violations'], [])`
      },
      {
        name: '直接环被识别',
        code: `result = analyze_graph({'a': ['b'], 'b': ['a']})
assert_eq(result['cycles'], [['a', 'b', 'a']])`
      },
      {
        name: '间接环被识别',
        code: `result = analyze_graph({
    'a': ['b'],
    'b': ['c'],
    'c': ['a'],
})
assert_eq(result['cycles'], [['a', 'b', 'c', 'a']])`
      },
      {
        name: '自依赖是环',
        code: `result = analyze_graph({'a': ['a'], 'b': []})
assert_eq(result['cycles'], [['a', 'a']])`
      },
      {
        name: '分层违规按规则报告',
        code: `rules = [{'id': 'api-no-infra', 'name': 'api', 'forbid': ['infra']}]
result = analyze_graph({
    'api': ['service', 'infra'],
    'service': ['infra'],
    'infra': [],
}, rules)
assert_eq(result['violations'], [
    {'from': 'api', 'to': 'infra', 'rule': 'api-no-infra'},
])`
      },
      {
        name: '未知模块与未知规则不崩溃',
        code: `first = analyze_graph({'api': ['external']})
assert_eq(first['cycles'], [])
assert_eq(first['violations'], [])
second = analyze_graph({}, [{'name': 'ghost', 'forbid': ['api']}])
assert_eq(second['cycles'], [])
assert_eq(second['violations'], [])`
      },
      {
        name: '多个环只报一次且顺序稳定',
        code: `graph = {
    'a': ['b'],
    'b': ['a'],
    'c': ['d'],
    'd': ['c'],
}
first = analyze_graph(graph)
assert_eq(first['cycles'], [['a', 'b', 'a'], ['c', 'd', 'c']])
second = analyze_graph(graph)
assert_eq(second['cycles'], first['cycles'])`
      }
    ]
  },
  'e1-consistency-ex-1': {
    starter: `class MemoryStore:
    def __init__(self):
        self.events = {}
        self.business = []
        self.locked = set()

    def transaction(self, run):
        return run(self)

    def insert_business(self, row):
        self.business.append(dict(row))

    def insert_event(self, event):
        self.events[event['eventId']] = dict(event)
        return dict(event)

    def claim_pending(self, limit):
        claimed = []
        for event in self.events.values():
            if len(claimed) >= limit:
                break
            if event['sentAt'] is not None or event['failedAt'] is not None:
                continue
            if event['eventId'] in self.locked:
                continue
            self.locked.add(event['eventId'])
            claimed.append(dict(event))
        return claimed

    def mark_sent(self, event_id, sent_at):
        self.events[event_id]['sentAt'] = sent_at
        self.locked.discard(event_id)

    def mark_failed(self, event_id, message, max_attempts):
        event = self.events[event_id]
        event['attempts'] += 1
        event['lastError'] = message
        if event['attempts'] >= max_attempts:
            event['failedAt'] = True
        self.locked.discard(event_id)


class Outbox:
    def __init__(self, store, publisher, now, max_attempts=5):
        self.store = store
        self.publisher = publisher
        self.now = now
        self.max_attempts = max_attempts

    def add(self, business_write, event):
        business_write(self.store)
        self.store.insert_event({
            'eventId': event['eventId'],
            'type': event['type'],
            'payload': event['payload'],
            'attempts': 0,
            'sentAt': None,
            'failedAt': None,
        })
        return event

    async def publish_batch(self, limit=10):
        batch = self.store.claim_pending(limit)
        for record in batch:
            self.store.mark_sent(record['eventId'], self.now())
            await self.publisher['publish'](record)
        return [{'eventId': record['eventId'], 'ok': True} for record in batch]


class Consumer:
    def __init__(self, apply):
        self.apply = apply
        self.processed = set()

    async def consume(self, event):
        self.processed.add(event['eventId'])
        await self.apply(event)
        return {'duplicate': False}


def create_outbox(store, publisher, now, max_attempts=5):
    return Outbox(store, publisher, now, max_attempts)


def create_consumer(apply):
    return Consumer(apply)
`,
    solution: `class MemoryStore:
    def __init__(self):
        self.events = {}
        self.business = []
        self.locked = set()

    def transaction(self, run):
        return run(self)

    def insert_business(self, row):
        self.business.append(dict(row))

    def insert_event(self, event):
        self.events[event['eventId']] = dict(event)
        return dict(event)

    def claim_pending(self, limit):
        claimed = []
        for event in self.events.values():
            if len(claimed) >= limit:
                break
            if event['sentAt'] is not None or event['failedAt'] is not None:
                continue
            if event['eventId'] in self.locked:
                continue
            self.locked.add(event['eventId'])
            claimed.append(dict(event))
        return claimed

    def mark_sent(self, event_id, sent_at):
        self.events[event_id]['sentAt'] = sent_at
        self.locked.discard(event_id)

    def mark_failed(self, event_id, message, max_attempts):
        event = self.events[event_id]
        event['attempts'] += 1
        event['lastError'] = message
        if event['attempts'] >= max_attempts:
            event['failedAt'] = True
        self.locked.discard(event_id)


class Outbox:
    def __init__(self, store, publisher, now, max_attempts=5):
        self.store = store
        self.publisher = publisher
        self.now = now
        self.max_attempts = max_attempts

    def add(self, business_write, event):
        def run(tx):
            business_write(tx)
            return tx.insert_event({
                'eventId': event['eventId'],
                'type': event['type'],
                'payload': event['payload'],
                'attempts': 0,
                'sentAt': None,
                'failedAt': None,
                'createdAt': self.now(),
            })
        return self.store.transaction(run)

    async def publish_batch(self, limit=10):
        results = []
        for record in self.store.claim_pending(limit):
            try:
                await self.publisher['publish'](record)
                self.store.mark_sent(record['eventId'], self.now())
                results.append({'eventId': record['eventId'], 'ok': True})
            except Exception as error:
                self.store.mark_failed(
                    record['eventId'], str(error), self.max_attempts
                )
                results.append({
                    'eventId': record['eventId'],
                    'ok': False,
                    'error': str(error),
                })
        return results


class Consumer:
    def __init__(self, apply):
        self.apply = apply
        self.processed = set()

    async def consume(self, event):
        if event['eventId'] in self.processed:
            return {'duplicate': True}
        await self.apply(event)
        self.processed.add(event['eventId'])
        return {'duplicate': False}


def create_outbox(store, publisher, now, max_attempts=5):
    return Outbox(store, publisher, now, max_attempts)


def create_consumer(apply):
    return Consumer(apply)
`,
    tests: [
      {
        name: '同事务写入业务与事件',
        code: `store = MemoryStore()
outbox = create_outbox(store, {'publish': lambda record: None}, lambda: 100)
record = outbox.add(
    lambda tx: tx.insert_business({'id': 'link-1'}),
    {'eventId': 'e1', 'type': 'click', 'payload': {'linkId': 'link-1'}},
)
assert_eq(len(store.business), 1)
assert_eq(record['eventId'], 'e1')
assert_eq(store.events['e1']['attempts'], 0)
assert_eq(store.events['e1']['sentAt'], None)
failed = False

def fail(tx):
    raise RuntimeError('business failed')

try:
    outbox.add(fail, {
        'eventId': 'e2',
        'type': 'click',
        'payload': {},
    })
except RuntimeError:
    failed = True
assert_eq(failed, True)
assert_eq('e2' in store.events, False)`
      },
      {
        name: '两个发布器抢占互斥',
        code: `store = MemoryStore()
started = asyncio.Event()
release = asyncio.Event()

async def publish(record):
    started.set()
    await release.wait()

outbox = create_outbox(store, {'publish': publish}, lambda: 1)
outbox.add(lambda tx: None, {'eventId': 'e1', 'type': 'click', 'payload': {}})
first = asyncio.ensure_future(outbox.publish_batch(10))
await started.wait()
second = await outbox.publish_batch(10)
assert_eq(second, [])
release.set()
results = await first
assert_eq(len(results), 1)
assert_eq(results[0]['ok'], True)`
      },
      {
        name: '发布成功标记 sentAt',
        code: `store = MemoryStore()
published = []

async def publish(record):
    published.append(record['eventId'])

outbox = create_outbox(store, {'publish': publish}, lambda: 500)
outbox.add(lambda tx: None, {'eventId': 'e1', 'type': 'click', 'payload': {}})
results = await outbox.publish_batch(5)
assert_eq(published, ['e1'])
assert_eq(results[0]['ok'], True)
assert_eq(store.events['e1']['sentAt'], 500)`
      },
      {
        name: '发布失败累加 attempts',
        code: `store = MemoryStore()

async def publish(record):
    raise RuntimeError('broker down')

outbox = create_outbox(store, {'publish': publish}, lambda: 1, max_attempts=3)
outbox.add(lambda tx: None, {'eventId': 'e1', 'type': 'click', 'payload': {}})
results = await outbox.publish_batch(5)
assert_eq(results[0]['ok'], False)
assert_eq(results[0]['error'], 'broker down')
assert_eq(store.events['e1']['attempts'], 1)
assert_eq(store.events['e1']['sentAt'], None)`
      },
      {
        name: '达到上限后不再抢占',
        code: `store = MemoryStore()
calls = []

async def publish(record):
    calls.append(record['eventId'])
    raise RuntimeError('nope')

outbox = create_outbox(store, {'publish': publish}, lambda: 1, max_attempts=2)
outbox.add(lambda tx: None, {'eventId': 'e1', 'type': 'click', 'payload': {}})
await outbox.publish_batch(5)
await outbox.publish_batch(5)
third = await outbox.publish_batch(5)
assert_eq(len(calls), 2)
assert_eq(third, [])
assert_eq(store.events['e1']['attempts'], 2)
assert_eq(store.events['e1']['failedAt'], True)`
      },
      {
        name: '重复投递只消费一次',
        code: `applied = []

async def apply(event):
    applied.append(event['eventId'])

consumer = create_consumer(apply)
event = {'eventId': 'e1', 'payload': {}}
first = await consumer.consume(event)
second = await consumer.consume(event)
assert_eq(len(applied), 1)
assert_eq(first['duplicate'], False)
assert_eq(second['duplicate'], True)`
      },
      {
        name: '消费失败可重试',
        code: `attempts = []

async def apply(event):
    attempts.append(event['eventId'])
    if len(attempts) == 1:
        raise RuntimeError('db down')

consumer = create_consumer(apply)
event = {'eventId': 'e1'}
failed = False
try:
    await consumer.consume(event)
except RuntimeError:
    failed = True
assert_eq(failed, True)
assert_eq('e1' in consumer.processed, False)
retry = await consumer.consume(event)
assert_eq(retry['duplicate'], False)
assert_eq(len(attempts), 2)
assert_eq('e1' in consumer.processed, True)`
      },
      {
        name: '空批次返回空数组',
        code: `store = MemoryStore()

async def publish(record):
    raise RuntimeError('should not publish')

outbox = create_outbox(store, {'publish': publish}, lambda: 1)
results = await outbox.publish_batch(10)
assert_eq(results, [])`
      }
    ]
  },
  'e1-failures-ex-1': {
    starter: `class Store:
    def __init__(self):
        self.data = {}
        self.locks = {}
        self._token = 0

    def get(self, key):
        return self.locks.get(key)

    def set(self, key, record):
        self.locks[key] = record

    def delete(self, key):
        self.locks.pop(key, None)

    def next_token(self):
        self._token += 1
        return self._token


class Lock:
    def __init__(self, store, now):
        self.store = store
        self.now = now

    def acquire(self, key, ttl_ms):
        if self.store.get(key):
            return None
        token = self.now()
        expires_at = self.now() + ttl_ms
        self.store.set(key, {'token': token, 'expiresAt': expires_at})
        return {'token': token, 'expiresAt': expires_at}

    def renew(self, key, token, ttl_ms):
        return True

    def release(self, key, token):
        self.store.delete(key)
        return True

    def write(self, key, token, value):
        if not self.store.get(key):
            return {'ok': False, 'reason': 'STALE_TOKEN'}
        self.store.data[key] = value
        return {'ok': True}


def create_fenced_lock(store, now):
    return Lock(store, now)`,
    solution: `class Store:
    def __init__(self):
        self.data = {}
        self.locks = {}
        self._token = 0

    def get(self, key):
        return self.locks.get(key)

    def set(self, key, record):
        self.locks[key] = record

    def delete(self, key):
        self.locks.pop(key, None)

    def next_token(self):
        self._token += 1
        return self._token


class Lock:
    def __init__(self, store, now):
        self.store = store
        self.now = now

    def _active(self, key):
        record = self.store.get(key)
        if record is None:
            return None
        if record['expiresAt'] <= self.now():
            self.store.delete(key)
            return None
        return record

    def acquire(self, key, ttl_ms):
        if self._active(key) is not None:
            return None
        token = self.store.next_token()
        expires_at = self.now() + ttl_ms
        self.store.set(key, {'token': token, 'expiresAt': expires_at})
        return {'token': token, 'expiresAt': expires_at}

    def renew(self, key, token, ttl_ms):
        record = self._active(key)
        if record is None or record['token'] != token:
            return False
        record['expiresAt'] = self.now() + ttl_ms
        self.store.set(key, record)
        return True

    def release(self, key, token):
        record = self._active(key)
        if record is None or record['token'] != token:
            return False
        self.store.delete(key)
        return True

    def write(self, key, token, value):
        record = self._active(key)
        if record is None or record['token'] != token:
            return {'ok': False, 'reason': 'STALE_TOKEN'}
        self.store.data[key] = value
        return {'ok': True}


def create_fenced_lock(store, now):
    return Lock(store, now)`,
    tests: [
      {
        name: '首次获取成功且 token 单调',
        code: `store = Store()
clock = [100]
lock = create_fenced_lock(store, lambda: clock[0])
lease = lock.acquire('job:1', 1000)
assert_eq(lease['token'], 1)
assert_eq(lease['expiresAt'], 1100)
assert_eq(lock.acquire('job:1', 1000), None)
other = lock.acquire('job:2', 1000)
assert_eq(other['token'], 2)`
      },
      {
        name: '续租延长过期时间',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
lease = lock.acquire('job:1', 1000)
clock[0] = 400
assert_eq(lock.renew('job:1', lease['token'], 5000), True)
assert_eq(store.get('job:1')['expiresAt'], 5400)
clock[0] = 5300
assert_eq(lock.acquire('job:1', 1000), None)`
      },
      {
        name: '过期后可被新锁获取',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
first = lock.acquire('job:1', 1000)
clock[0] = 1000
second = lock.acquire('job:1', 1000)
assert_eq(second is not None, True)
assert_eq(second['token'], 2)
assert_eq(second['token'] > first['token'], True)`
      },
      {
        name: '旧 token 写入被拒绝',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
first = lock.acquire('job:1', 1000)
clock[0] = 2000
lock.acquire('job:1', 1000)
result = lock.write('job:1', first['token'], 'stale-write')
assert_eq(result, {'ok': False, 'reason': 'STALE_TOKEN'})
assert_eq('job:1' in store.data, False)`
      },
      {
        name: '新 token 写入成功',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
lock.acquire('job:1', 1000)
clock[0] = 2000
second = lock.acquire('job:1', 1000)
assert_eq(lock.write('job:1', second['token'], 'fresh'), {'ok': True})
assert_eq(store.data['job:1'], 'fresh')`
      },
      {
        name: '续租过期锁失败',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
lease = lock.acquire('job:1', 1000)
assert_eq(lock.renew('job:1', lease['token'] + 99, 1000), False)
clock[0] = 1000
assert_eq(lock.renew('job:1', lease['token'], 1000), False)`
      },
      {
        name: '释放后新持有者获取',
        code: `store = Store()
clock = [0]
lock = create_fenced_lock(store, lambda: clock[0])
first = lock.acquire('job:1', 1000)
assert_eq(lock.release('job:1', first['token'] + 99), False)
assert_eq(lock.release('job:1', first['token']), True)
second = lock.acquire('job:1', 1000)
assert_eq(second['token'], 2)
assert_eq(
    lock.write('job:1', first['token'], 'old'),
    {'ok': False, 'reason': 'STALE_TOKEN'},
)
assert_eq(lock.write('job:1', second['token'], 'new'), {'ok': True})`
      }
    ]
  },
  'e1-datascale-ex-1': {
    starter: `import bisect


def fnv1a(text):
    value = 2166136261
    for byte in text.encode('utf-8'):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value


class HashRing:
    def __init__(self, nodes, virtual_nodes=100, hash_fn=fnv1a):
        self.virtual_nodes = virtual_nodes
        self.hash_fn = hash_fn
        self.members = list(nodes)

    def _build(self):
        return sorted((self.hash_fn(node), node) for node in self.members)

    def get_node(self, key):
        ring = self._build()
        if not ring:
            raise ValueError('EMPTY_RING')
        target = self.hash_fn(key)
        for position, node in ring:
            if position >= target:
                return node
        return None

    def add_node(self, node):
        self.members.append(node)

    def remove_node(self, node):
        self.members = [item for item in self.members if item != node]

    @property
    def nodes(self):
        return sorted(self.members)

    @property
    def size(self):
        return len(self.members)


def create_hash_ring(nodes, virtual_nodes=100, hash_fn=fnv1a):
    return HashRing(nodes, virtual_nodes, hash_fn)`,
    solution: `import bisect


def fnv1a(text):
    value = 2166136261
    for byte in text.encode('utf-8'):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value


class HashRing:
    def __init__(self, nodes, virtual_nodes=100, hash_fn=fnv1a):
        self.virtual_nodes = virtual_nodes
        self.hash_fn = hash_fn
        self.positions = []
        self.owners = []
        self.members = set()
        for node in nodes:
            self.add_node(node)

    def add_node(self, node):
        if node in self.members:
            return
        self.members.add(node)
        for index in range(self.virtual_nodes):
            self.positions.append(self.hash_fn('%s#%d' % (node, index)))
            self.owners.append(node)
        order = sorted(
            range(len(self.positions)),
            key=lambda i: self.positions[i],
        )
        self.positions = [self.positions[i] for i in order]
        self.owners = [self.owners[i] for i in order]

    def remove_node(self, node):
        if node not in self.members:
            return
        self.members.remove(node)
        kept = [
            (position, owner)
            for position, owner in zip(self.positions, self.owners)
            if owner != node
        ]
        self.positions = [position for position, _ in kept]
        self.owners = [owner for _, owner in kept]

    def get_node(self, key):
        if not self.positions:
            raise ValueError('EMPTY_RING')
        index = bisect.bisect_left(self.positions, self.hash_fn(key))
        if index == len(self.positions):
            index = 0
        return self.owners[index]

    @property
    def nodes(self):
        return sorted(self.members)

    @property
    def size(self):
        return len(self.positions)


def create_hash_ring(nodes, virtual_nodes=100, hash_fn=fnv1a):
    return HashRing(nodes, virtual_nodes, hash_fn)`,
    tests: [
      {
        name: '同一 key 稳定映射',
        code: `ring = create_hash_ring(['node-1', 'node-2', 'node-3'], virtual_nodes=50)
first = ring.get_node('link:42')
assert_eq(first in ['node-1', 'node-2', 'node-3'], True)
assert_eq(ring.get_node('link:42'), first)
assert_eq(ring.get_node('link:42'), first)
assert_eq(ring.nodes, ['node-1', 'node-2', 'node-3'])
assert_eq(ring.size, 150)`
      },
      {
        name: '五节点份额在 10% 到 30% 之间',
        code: `ring = create_hash_ring(
    ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'],
    virtual_nodes=100,
)
counts = {'node-1': 0, 'node-2': 0, 'node-3': 0, 'node-4': 0, 'node-5': 0}
for index in range(1000):
    counts[ring.get_node('link:%d' % index)] += 1
for node in counts:
    assert_eq(counts[node] >= 100, True)
    assert_eq(counts[node] <= 300, True)`
      },
      {
        name: '增加节点只接管新节点区间',
        code: `nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5']
keys = ['link:%d' % index for index in range(500)]
before = create_hash_ring(nodes, virtual_nodes=100)
after = create_hash_ring(nodes + ['node-6'], virtual_nodes=100)
stay = 0
for key in keys:
    old_node = before.get_node(key)
    new_node = after.get_node(key)
    assert_eq(new_node == old_node or new_node == 'node-6', True)
    if new_node == old_node:
        stay += 1
assert_eq(stay > 250, True)
assert_eq(stay < len(keys), True)`
      },
      {
        name: '删除节点只迁移该节点的 key',
        code: `nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5']
keys = ['link:%d' % index for index in range(500)]
before = create_hash_ring(nodes, virtual_nodes=100)
after = create_hash_ring(
    [node for node in nodes if node != 'node-3'],
    virtual_nodes=100,
)
for key in keys:
    old_node = before.get_node(key)
    new_node = after.get_node(key)
    if old_node == 'node-3':
        assert_eq(new_node != 'node-3', True)
    else:
        assert_eq(new_node, old_node)
assert_eq(after.size, 400)`
      },
      {
        name: '空环抛 EMPTY_RING',
        code: `ring = create_hash_ring([], virtual_nodes=10)
error = None
try:
    ring.get_node('link:1')
except ValueError as err:
    error = str(err)
assert_eq(error, 'EMPTY_RING')`
      },
      {
        name: '虚拟节点越多份额越均匀',
        code: `def max_share(ring):
    counts = {}
    for index in range(1000):
        node = ring.get_node('link:%d' % index)
        counts[node] = counts.get(node, 0) + 1
    return max(counts.values())


nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5']
single = max_share(create_hash_ring(nodes, virtual_nodes=1))
many = max_share(create_hash_ring(nodes, virtual_nodes=100))
assert_eq(many < single, True)`
      },
      {
        name: '重复添加删除幂等',
        code: `ring = create_hash_ring(['node-1', 'node-2'], virtual_nodes=10)
before = ring.get_node('link:7')
assert_eq(ring.size, 20)
ring.add_node('node-1')
assert_eq(ring.size, 20)
assert_eq(ring.nodes, ['node-1', 'node-2'])
ring.remove_node('node-9')
assert_eq(ring.size, 20)
assert_eq(ring.get_node('link:7'), before)`
      }
    ]
  }
} satisfies PythonTrackMap;
