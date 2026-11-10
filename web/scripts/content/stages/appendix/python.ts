import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  'a1': [
    {
      code: `import math

def estimate_growth(samples):
    if len(samples) < 3:
        return 'unknown'
    seen = set()
    for sample in samples:
        n, ops = sample['n'], sample['ops']
        if not math.isfinite(n) or not math.isfinite(ops) or n <= 0 or ops <= 0:
            return 'unknown'
        seen.add(n)
    if len(seen) < 3:
        return 'unknown'
    candidates = [
        ('O(1)', lambda n: 1),
        ('O(log n)', lambda n: math.log2(n + 1)),
        ('O(n)', lambda n: n),
        ('O(n log n)', lambda n: n * math.log2(n + 1)),
        ('O(n^2)', lambda n: n * n),
    ]
    for label, f in candidates:
        ratios = [s['ops'] / f(s['n']) for s in samples]
        high, low = max(ratios), min(ratios)
        if high > 0 and (high - low) / high <= 0.15:
            return label
    return 'unknown'`,
      note: 'Python 用 math.isfinite 做与 Number.isFinite 等价的检查；候选函数按从简单到复杂排列，第一个 spread 不超过 0.15 的就是结论，因此并列时自然取简单者。'
    },
    {
      code: `import math

def summarize_benchmark(samples):
    if not samples:
        return {'count': 0, 'mean': 0, 'p50': 0, 'p95': 0, 'p99': 0, 'cv': 0, 'stable': False}
    values = [sample['ms'] for sample in samples]
    for value in values:
        if not math.isfinite(value) or value < 0:
            raise ValueError('INVALID_SAMPLE')
    ordered = sorted(values)
    n = len(values)
    mean = sum(values) / n
    variance = sum((value - mean) ** 2 for value in values) / n
    cv = 0 if mean == 0 else math.sqrt(variance) / mean
    def percentile(p):
        return ordered[max(0, math.ceil((p / 100) * n) - 1)]
    return {
        'count': n,
        'mean': mean,
        'p50': percentile(50),
        'p95': percentile(95),
        'p99': percentile(99),
        'cv': cv,
        'stable': cv <= 0.1,
    }`,
      note: '最近秩分位与总体方差必须与 JS 版逐位对齐；空样本返回全零并标记不稳定，非法样本直接抛错，不做静默丢弃。'
    }
  ],
  'a2': [
    {
      code: `TOMBSTONE_STATE = 2

class HashMap:
    def __init__(self, initial_capacity=8, max_load=0.75):
        self._capacity = max(1, int(initial_capacity))
        self._max_load = max_load
        self._keys = [None] * self._capacity
        self._values = [None] * self._capacity
        self._state = [0] * self._capacity
        self._size = 0
        self._tombstones = 0

    def _hash(self, key):
        total = 0
        for ch in str(key):
            total = (total + ord(ch)) & 0xFFFFFFFF
        return total

    def _find(self, key):
        start = self._hash(key) % self._capacity
        first_tombstone = -1
        for step in range(self._capacity):
            index = (start + step) % self._capacity
            if self._state[index] == 0:
                return (-1, first_tombstone if first_tombstone >= 0 else index)
            if self._state[index] == TOMBSTONE_STATE:
                if first_tombstone < 0:
                    first_tombstone = index
            elif self._keys[index] == key:
                return (index, index)
        return (-1, first_tombstone)

    def _resize(self):
        old_keys = self._keys
        old_values = self._values
        old_state = self._state
        self._capacity *= 2
        self._keys = [None] * self._capacity
        self._values = [None] * self._capacity
        self._state = [0] * self._capacity
        self._size = 0
        self._tombstones = 0
        for index, state in enumerate(old_state):
            if state == 1:
                self.set(old_keys[index], old_values[index])

    def set(self, key, value):
        index, insert = self._find(key)
        if index >= 0:
            self._values[index] = value
            return
        if insert < 0:
            self._resize()
            self.set(key, value)
            return
        self._keys[insert] = key
        self._values[insert] = value
        self._state[insert] = 1
        self._size += 1
        if (self._size + self._tombstones) / self._capacity > self._max_load:
            self._resize()

    def get(self, key):
        index, _ = self._find(key)
        return self._values[index] if index >= 0 else None

    def has(self, key):
        return self._find(key)[0] >= 0

    def delete(self, key):
        index, _ = self._find(key)
        if index < 0:
            return False
        self._state[index] = TOMBSTONE_STATE
        self._keys[index] = None
        self._values[index] = None
        self._size -= 1
        self._tombstones += 1
        return True

    def size(self):
        return self._size

    def load_factor(self):
        return (self._size + self._tombstones) / self._capacity

def create_hash_map(initial_capacity=8, max_load=0.75):
    return HashMap(initial_capacity, max_load)`,
      note: '用数组而不用 dict，才能真实体现探测过程；墓碑是独立状态而不是 None，否则删除会截断探测链。负载因子把墓碑计入分子，扩容后统一 rehash。'
    }
  ],
  'a3': [
    {
      code: `import math

class _Node:
    def __init__(self, leaf):
        self.leaf = leaf
        self.keys = []
        self.children = []
        self.next = None

class BPlusTree:
    def __init__(self, order):
        if not isinstance(order, int) or isinstance(order, bool) or order < 3:
            raise ValueError('INVALID_ORDER')
        self._max_keys = order - 1
        self._root = _Node(True)
        self._height = 1

    def _find_leaf(self, key):
        current = self._root
        while not current.leaf:
            index = 0
            while index < len(current.keys) and key >= current.keys[index]:
                index += 1
            current = current.children[index]
        return current

    def _split_leaf(self, leaf):
        mid = math.ceil(len(leaf.keys) / 2)
        right = _Node(True)
        right.keys = leaf.keys[mid:]
        right.next = leaf.next
        leaf.keys = leaf.keys[:mid]
        leaf.next = right
        return right.keys[0], right

    def _split_internal(self, node):
        mid = len(node.keys) // 2
        separator = node.keys[mid]
        right = _Node(False)
        right.keys = node.keys[mid + 1:]
        right.children = node.children[mid + 1:]
        node.keys = node.keys[:mid]
        node.children = node.children[:mid + 1]
        return separator, right

    def _insert_into(self, node, key):
        if node.leaf:
            index = 0
            while index < len(node.keys) and node.keys[index] < key:
                index += 1
            if index < len(node.keys) and node.keys[index] == key:
                return None
            node.keys.insert(index, key)
            return self._split_leaf(node) if len(node.keys) > self._max_keys else None
        index = 0
        while index < len(node.keys) and key >= node.keys[index]:
            index += 1
        split = self._insert_into(node.children[index], key)
        if split is None:
            return None
        separator, right = split
        node.keys.insert(index, separator)
        node.children.insert(index + 1, right)
        return self._split_internal(node) if len(node.keys) > self._max_keys else None

    def insert(self, key):
        split = self._insert_into(self._root, key)
        if split is not None:
            separator, right = split
            new_root = _Node(False)
            new_root.keys = [separator]
            new_root.children = [self._root, right]
            self._root = new_root
            self._height += 1

    def search(self, key):
        return key in self._find_leaf(key).keys

    def range(self, lo, hi):
        result = []
        leaf = self._find_leaf(lo)
        while leaf is not None:
            for key in leaf.keys:
                if key > hi:
                    return result
                if key >= lo:
                    result.append(key)
            leaf = leaf.next
        return result

    def keys(self):
        result = []
        leaf = self._root
        while not leaf.leaf:
            leaf = leaf.children[0]
        while leaf is not None:
            result.extend(leaf.keys)
            leaf = leaf.next
        return result

    def height(self):
        return self._height

def create_bplus_tree(order):
    return BPlusTree(order)`,
      note: '叶子分裂取 ceil 上半、内部节点分裂把中间 key 上提；叶子之间的 next 链让范围查询不必回到根节点。Python 的 int 无溢出问题，但 order 校验与 bool 排除仍要保留。'
    }
  ],
  'a4': [
    {
      code: `class MinHeap:
    def __init__(self):
        self._items = []

    def push(self, value):
        self._items.append(value)
        index = len(self._items) - 1
        while index > 0:
            parent = (index - 1) // 2
            if self._items[parent] <= self._items[index]:
                break
            self._items[parent], self._items[index] = self._items[index], self._items[parent]
            index = parent

    def pop(self):
        if not self._items:
            return None
        top = self._items[0]
        last = self._items.pop()
        if self._items:
            self._items[0] = last
            index = 0
            while True:
                left = index * 2 + 1
                right = left + 1
                smallest = index
                if left < len(self._items) and self._items[left] < self._items[smallest]:
                    smallest = left
                if right < len(self._items) and self._items[right] < self._items[smallest]:
                    smallest = right
                if smallest == index:
                    break
                self._items[index], self._items[smallest] = self._items[smallest], self._items[index]
                index = smallest
        return top

    def peek(self):
        return self._items[0] if self._items else None

    def size(self):
        return len(self._items)`,
      note: 'Python 的整数除法用 //；下沉必须先找出两个子节点中较小的那个，再与它交换，否则会破坏堆序。'
    },
    {
      code: `def top_k(nums, k):
    if not isinstance(k, int) or isinstance(k, bool) or k <= 0:
        return []
    heap = MinHeap()
    for num in nums:
        heap.push(num)
        if heap.size() > k:
            heap.pop()
    result = []
    while heap.size() > 0:
        result.append(heap.pop())
    result.reverse()
    return result

class MedianTracker:
    def __init__(self):
        self._low = MinHeap()
        self._high = MinHeap()

    def add(self, num):
        if self._low.size() == 0 or num <= -self._low.peek():
            self._low.push(-num)
        else:
            self._high.push(num)
        if self._low.size() > self._high.size() + 1:
            self._high.push(-self._low.pop())
        elif self._high.size() > self._low.size():
            self._low.push(-self._high.pop())

    def median(self):
        if self._low.size() == 0:
            return None
        if self._low.size() == self._high.size():
            return (-self._low.peek() + self._high.peek()) / 2
        return -self._low.peek()`,
      note: '左堆保存较小一半的相反数，于是最小堆的堆顶就是这一半的最大值；每次插入后立刻平衡，保证大小差不超过 1。'
    }
  ],
  'a5': [
    {
      code: `class RingBuffer:
    def __init__(self, capacity):
        if not isinstance(capacity, int) or isinstance(capacity, bool) or capacity <= 0:
            raise ValueError('INVALID_CAPACITY')
        self._capacity = capacity
        self._slots = [None] * capacity
        self._read_index = 0
        self._write_index = 0
        self._count = 0

    def push(self, value):
        self._slots[self._write_index] = value
        self._write_index = (self._write_index + 1) % self._capacity
        if self._count == self._capacity:
            self._read_index = (self._read_index + 1) % self._capacity
        else:
            self._count += 1

    def read(self):
        if self._count == 0:
            return None
        value = self._slots[self._read_index]
        self._read_index = (self._read_index + 1) % self._capacity
        self._count -= 1
        return value

    def available(self):
        return self._count

    def size(self):
        return self._capacity`,
      note: 'Python 的 % 对正数行为与 JS 相同；覆盖写时读指针和 count 必须一起处理，否则会读到已被覆盖的槽。'
    },
    {
      code: `class _LRUNode:
    __slots__ = ('key', 'value', 'prev', 'next')

    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRU:
    def __init__(self, capacity):
        if not isinstance(capacity, int) or isinstance(capacity, bool) or capacity <= 0:
            raise ValueError('INVALID_CAPACITY')
        self._capacity = capacity
        self._map = {}
        self._head = _LRUNode(None, None)
        self._tail = _LRUNode(None, None)
        self._head.next = self._tail
        self._tail.prev = self._head

    def _detach(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _attach_front(self, node):
        node.next = self._head.next
        node.prev = self._head
        self._head.next.prev = node
        self._head.next = node

    def _move_to_front(self, node):
        self._detach(node)
        self._attach_front(node)

    def get(self, key):
        node = self._map.get(key)
        if node is None:
            return None
        self._move_to_front(node)
        return node.value

    def put(self, key, value):
        existing = self._map.get(key)
        if existing is not None:
            existing.value = value
            self._move_to_front(existing)
            return
        node = _LRUNode(key, value)
        self._map[key] = node
        self._attach_front(node)
        if len(self._map) > self._capacity:
            oldest = self._tail.prev
            self._detach(oldest)
            del self._map[oldest.key]

    def keys(self):
        result = []
        node = self._head.next
        while node is not self._tail:
            result.append(node.key)
            node = node.next
        return result`,
      note: 'dict 只负责 O(1) 定位，顺序完全由双向链表维护；不能用 OrderedDict 的 move_to_end 代替，否则就绕过了本讲要练的结构。'
    }
  ],
  'a6': [
    {
      code: `class BloomFilter:
    def __init__(self, bits, hashes):
        if not isinstance(bits, int) or isinstance(bits, bool) or bits <= 0:
            raise ValueError('INVALID_BITS')
        if not hashes:
            raise ValueError('INVALID_HASHES')
        self._bits = bits
        self._hashes = list(hashes)
        self._slots = bytearray(bits)
        self._set_bits = 0

    def add(self, value):
        for hash_fn in self._hashes:
            index = abs(hash_fn(value)) % self._bits
            if self._slots[index] == 0:
                self._slots[index] = 1
                self._set_bits += 1

    def might_contain(self, value):
        return all(
            self._slots[abs(hash_fn(value)) % self._bits] == 1
            for hash_fn in self._hashes
        )

    def false_positive_rate(self):
        return (self._set_bits / self._bits) ** len(self._hashes)`,
      note: '用 bytearray 而不是 list，内存更接近位数组；误判率按已置位比例 p 的 k 次方估算。'
    },
    {
      code: `import math

class HyperLogLog:
    def __init__(self, precision):
        if not isinstance(precision, int) or isinstance(precision, bool) or precision < 4 or precision > 16:
            raise ValueError('INVALID_PRECISION')
        self._precision = precision
        self._bucket_count = 2 ** precision
        self._buckets = [0] * self._bucket_count

    def _fmix32(self, h):
        h ^= h >> 16
        h = (h * 0x85EBCA6B) & 0xFFFFFFFF
        h ^= h >> 13
        h = (h * 0xC2B2AE35) & 0xFFFFFFFF
        h ^= h >> 16
        return h & 0xFFFFFFFF

    def _hash64(self, value):
        h1 = 0x811C9DC5
        h2 = 0x9E3779B9
        for ch in str(value):
            h1 = ((h1 ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
            h2 = ((h2 ^ ord(ch)) * 0x85EBCA6B + 0x165667B1) & 0xFFFFFFFF
        return self._fmix32(h1), self._fmix32(h2)

    def add(self, value):
        h1, h2 = self._hash64(value)
        index = h1 >> (32 - self._precision)
        rank = 33 if h2 == 0 else 32 - h2.bit_length() + 1
        if rank > self._buckets[index]:
            self._buckets[index] = rank

    def estimate(self):
        m = self._bucket_count
        total = 0.0
        zeros = 0
        for value in self._buckets:
            total += 2 ** (-value)
            if value == 0:
                zeros += 1
        if m == 16:
            alpha = 0.673
        elif m == 32:
            alpha = 0.697
        elif m == 64:
            alpha = 0.709
        else:
            alpha = 0.7213 / (1 + 1.079 / m)
        raw = (alpha * m * m) / total
        if raw <= 2.5 * m and zeros > 0:
            raw = m * math.log(m / zeros)
        return raw`,
      note: '哈希必须做最终混合（fmix32），否则短字符串的高位分布不均，空桶数偏差会直接放大估算误差；rank 用 32 位前导零计算。'
    }
  ],
  'a8': [
    {
      code: `def create_weighted_round_robin(servers):
    entries = [
        {
            'name': server['name'],
            'weight': server['weight'],
            'healthy': server.get('healthy', True),
            'current': 0,
        }
        for server in servers
    ]

    class WeightedRoundRobin:
        def pick(self):
            candidates = [entry for entry in entries if entry['healthy'] and entry['weight'] > 0]
            if not candidates:
                return None
            total = 0
            best = None
            for entry in candidates:
                total += entry['weight']
                entry['current'] += entry['weight']
                if best is None or entry['current'] > best['current']:
                    best = entry
            best['current'] -= total
            return best['name']

    return WeightedRoundRobin()`,
      note: '平滑轮询必须遍历全部候选再减总权重；如果顺序遍历时立刻减去总权重，顺序会退化成连续命中高权重节点。'
    },
    {
      code: `def check_fd_budget(system_limit, worker_processes, connections_per_worker, files_per_connection, reserve):
    values = {
        'system_limit': system_limit,
        'worker_processes': worker_processes,
        'connections_per_worker': connections_per_worker,
        'files_per_connection': files_per_connection,
        'reserve': reserve,
    }
    for name, value in values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
            raise ValueError('INVALID_' + name.upper())
    required = worker_processes * connections_per_worker * files_per_connection + reserve
    return {
        'ok': required <= system_limit,
        'required': required,
        'headroom': system_limit - required,
    }`,
      note: 'Python 的 bool 是 int 的子类，校验时必须显式排除，否则 True 会被当成 1 通过预算检查。'
    }
  ],
  'a11': [
    {
      code: `def audit_test_portfolio(portfolio):
    unit = portfolio['unit']
    integration = portfolio['integration']
    e2e = portfolio['e2e']
    contract = portfolio['contract']
    flaky = portfolio['flaky']
    total = unit + integration + e2e + contract
    findings = []
    if total == 0:
        findings.append({
            'code': 'NO_TESTS',
            'severity': 'high',
            'detail': 'total=0; no tests configured',
        })
        return {'total': total, 'flakyRate': 0, 'findings': findings}
    if unit == 0:
        findings.append({'code': 'NO_UNIT_TESTS', 'severity': 'high', 'detail': f'unit=0 of total={total}'})
    if integration == 0:
        findings.append({'code': 'NO_INTEGRATION_TESTS', 'severity': 'medium', 'detail': f'integration=0 of total={total}'})
    if contract == 0:
        findings.append({'code': 'NO_CONTRACT_TESTS', 'severity': 'medium', 'detail': f'contract=0 of total={total}'})
    e2e_ratio = e2e / total
    if e2e_ratio > 0.2:
        findings.append({
            'code': 'E2E_TOO_HIGH',
            'severity': 'medium',
            'detail': f'e2e={e2e} of total={total}; ratio={e2e_ratio:.3f} > 0.200',
        })
    flaky_rate = flaky / total
    if flaky_rate > 0.01:
        findings.append({
            'code': 'FLAKY_RATE_HIGH',
            'severity': 'high',
            'detail': f'flaky={flaky} of total={total}; rate={flaky_rate:.3f} > 0.010',
        })
    rank = {'high': 0, 'medium': 1, 'low': 2}
    findings.sort(key=lambda item: (rank[item['severity']], item['code']))
    return {'total': total, 'flakyRate': flaky_rate, 'findings': findings}`,
      note: 'Python 用 f-string 的 :.3f 对齐 Node 的 toFixed(3)；排序用元组键，先严重度后 code，避免依赖不稳定的排序实现。'
    },
    {
      code: `def detect_flaky(history):
    rows = []
    for entry in history:
        results = entry['results']
        flips = sum(1 for i in range(1, len(results)) if results[i] != results[i - 1])
        rows.append({'name': entry['name'], 'flips': flips, 'flaky': flips >= 2})
    rows.sort(key=lambda row: (-row['flips'], row['name']))
    return rows`,
      note: '翻转次数只看相邻结果是否变化；排序键用负 flips 实现降序，name 升序作为并列时的稳定次序。'
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  'a1-ex-1': {
    starter: `def estimate_growth(samples):
    return 'unknown'

def summarize_benchmark(samples):
    return {'count': 0, 'mean': 0, 'p50': 0, 'p95': 0, 'p99': 0, 'cv': 0, 'stable': False}`,
    solution: `import math

def estimate_growth(samples):
    if len(samples) < 3:
        return 'unknown'
    seen = set()
    for sample in samples:
        n, ops = sample['n'], sample['ops']
        if not math.isfinite(n) or not math.isfinite(ops) or n <= 0 or ops <= 0:
            return 'unknown'
        seen.add(n)
    if len(seen) < 3:
        return 'unknown'
    candidates = [
        ('O(1)', lambda n: 1),
        ('O(log n)', lambda n: math.log2(n + 1)),
        ('O(n)', lambda n: n),
        ('O(n log n)', lambda n: n * math.log2(n + 1)),
        ('O(n^2)', lambda n: n * n),
    ]
    for label, f in candidates:
        ratios = [s['ops'] / f(s['n']) for s in samples]
        high, low = max(ratios), min(ratios)
        if high > 0 and (high - low) / high <= 0.15:
            return label
    return 'unknown'

def summarize_benchmark(samples):
    if not samples:
        return {'count': 0, 'mean': 0, 'p50': 0, 'p95': 0, 'p99': 0, 'cv': 0, 'stable': False}
    values = [sample['ms'] for sample in samples]
    for value in values:
        if not math.isfinite(value) or value < 0:
            raise ValueError('INVALID_SAMPLE')
    ordered = sorted(values)
    n = len(values)
    mean = sum(values) / n
    variance = sum((value - mean) ** 2 for value in values) / n
    cv = 0 if mean == 0 else math.sqrt(variance) / mean
    def percentile(p):
        return ordered[max(0, math.ceil((p / 100) * n) - 1)]
    return {
        'count': n,
        'mean': mean,
        'p50': percentile(50),
        'p95': percentile(95),
        'p99': percentile(99),
        'cv': cv,
        'stable': cv <= 0.1,
    }`,
    tests: [
      {
        name: '常数增长',
        code: `samples = [{'n': 100, 'ops': 5}, {'n': 1000, 'ops': 5}, {'n': 10000, 'ops': 5}]
assert_eq(estimate_growth(samples), 'O(1)')`
      },
      {
        name: '线性增长',
        code: `samples = [{'n': 100, 'ops': 200}, {'n': 200, 'ops': 400}, {'n': 400, 'ops': 800}]
assert_eq(estimate_growth(samples), 'O(n)')`
      },
      {
        name: '线性对数增长',
        code: `import math
f = lambda n: n * math.log2(n + 1)
samples = [{'n': 100, 'ops': f(100)}, {'n': 200, 'ops': f(200)}, {'n': 400, 'ops': f(400)}]
assert_eq(estimate_growth(samples), 'O(n log n)')`
      },
      {
        name: '平方增长',
        code: `samples = [{'n': 10, 'ops': 100}, {'n': 20, 'ops': 400}, {'n': 40, 'ops': 1600}]
assert_eq(estimate_growth(samples), 'O(n^2)')`
      },
      {
        name: '点数不足返回 unknown',
        code: `assert_eq(estimate_growth([{'n': 10, 'ops': 10}, {'n': 20, 'ops': 20}]), 'unknown')`
      },
      {
        name: '噪声数据返回 unknown',
        code: `samples = [{'n': 100, 'ops': 10}, {'n': 200, 'ops': 15}, {'n': 400, 'ops': 100}]
assert_eq(estimate_growth(samples), 'unknown')`
      },
      {
        name: '压测统计与分位',
        code: `result = summarize_benchmark([{'ms': 10}, {'ms': 20}, {'ms': 30}])
assert_eq(result['count'], 3)
assert_eq(result['mean'], 20)
assert_eq(result['p50'], 20)
assert_eq(result['p95'], 30)
assert_eq(result['p99'], 30)
assert abs(result['cv'] - 0.408248) < 0.001
assert_eq(result['stable'], False)`
      },
      {
        name: '稳定样本与最近秩边界',
        code: `result = summarize_benchmark([{'ms': 10}, {'ms': 20}, {'ms': 30}, {'ms': 40}, {'ms': 50}])
assert_eq(result['p50'], 30)
assert_eq(result['p95'], 50)
assert_eq(result['p99'], 50)
stable = summarize_benchmark([{'ms': 100}, {'ms': 100}, {'ms': 100}, {'ms': 100}])
assert_eq(stable['stable'], True)`
      },
      {
        name: '空样本返回全零且不稳定',
        code: `result = summarize_benchmark([])
assert_eq(result['count'], 0)
assert_eq(result['p99'], 0)
assert_eq(result['stable'], False)`
      },
      {
        name: '非法样本抛错',
        code: `caught = False
try:
    summarize_benchmark([{'ms': 10}, {'ms': -1}])
except Exception:
    caught = True
assert_eq(caught, True)`
      }
    ]
  },
  'a2-ex-1': {
    starter: `def create_hash_map(initial_capacity=8, max_load=0.75):
    return {
        'set': lambda key, value: None,
        'get': lambda key: None,
        'has': lambda key: False,
        'delete': lambda key: False,
        'size': lambda: 0,
        'loadFactor': lambda: 0,
    }`,
    solution: `class HashMap:
    def __init__(self, initial_capacity=8, max_load=0.75):
        self._capacity = max(1, int(initial_capacity))
        self._max_load = max_load
        self._keys = [None] * self._capacity
        self._values = [None] * self._capacity
        self._state = [0] * self._capacity
        self._size = 0
        self._tombstones = 0

    def _hash(self, key):
        total = 0
        for ch in str(key):
            total = (total + ord(ch)) & 0xFFFFFFFF
        return total

    def _find(self, key):
        start = self._hash(key) % self._capacity
        first_tombstone = -1
        for step in range(self._capacity):
            index = (start + step) % self._capacity
            if self._state[index] == 0:
                return (-1, first_tombstone if first_tombstone >= 0 else index)
            if self._state[index] == 2:
                if first_tombstone < 0:
                    first_tombstone = index
            elif self._keys[index] == key:
                return (index, index)
        return (-1, first_tombstone)

    def _resize(self):
        old_keys = self._keys
        old_values = self._values
        old_state = self._state
        self._capacity *= 2
        self._keys = [None] * self._capacity
        self._values = [None] * self._capacity
        self._state = [0] * self._capacity
        self._size = 0
        self._tombstones = 0
        for index, state in enumerate(old_state):
            if state == 1:
                self._set(old_keys[index], old_values[index])

    def _set(self, key, value):
        index, insert = self._find(key)
        if index >= 0:
            self._values[index] = value
            return
        if insert < 0:
            self._resize()
            self._set(key, value)
            return
        self._keys[insert] = key
        self._values[insert] = value
        self._state[insert] = 1
        self._size += 1
        if (self._size + self._tombstones) / self._capacity > self._max_load:
            self._resize()

    def set(self, key, value):
        self._set(key, value)
        return self

    def get(self, key):
        index, _ = self._find(key)
        return self._values[index] if index >= 0 else None

    def has(self, key):
        return self._find(key)[0] >= 0

    def delete(self, key):
        index, _ = self._find(key)
        if index < 0:
            return False
        self._state[index] = 2
        self._keys[index] = None
        self._values[index] = None
        self._size -= 1
        self._tombstones += 1
        return True

    def size(self):
        return self._size

    def loadFactor(self):
        return (self._size + self._tombstones) / self._capacity

def create_hash_map(initial_capacity=8, max_load=0.75):
    return HashMap(initial_capacity, max_load)`,
    tests: [
      {
        name: '基本读写',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
assert_eq(hash_map.get('a'), 1)
assert_eq(hash_map.size(), 1)`
      },
      {
        name: '覆盖已有 key',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
hash_map.set('a', 2)
assert_eq(hash_map.get('a'), 2)
assert_eq(hash_map.size(), 1)`
      },
      {
        name: '冲突后仍能查到两个 key',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
hash_map.set('i', 2)
assert_eq(hash_map.get('a'), 1)
assert_eq(hash_map.get('i'), 2)
assert_eq(hash_map.size(), 2)`
      },
      {
        name: 'has 与缺失 key',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
assert_eq(hash_map.has('a'), True)
assert_eq(hash_map.has('missing'), False)
assert_eq(hash_map.get('missing'), None)`
      },
      {
        name: '删除后不可见',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
hash_map.set('b', 2)
assert_eq(hash_map.delete('a'), True)
assert_eq(hash_map.has('a'), False)
assert_eq(hash_map.get('a'), None)
assert_eq(hash_map.size(), 1)
assert_eq(hash_map.delete('a'), False)`
      },
      {
        name: '墓碑可复用且不截断探测链',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
hash_map.set('i', 2)
hash_map.delete('a')
hash_map.set('q', 3)
assert_eq(hash_map.get('i'), 2)
assert_eq(hash_map.get('q'), 3)`
      },
      {
        name: '超过负载因子后扩容',
        code: `hash_map = create_hash_map()
for key in ['a', 'b', 'c', 'd', 'e', 'f', 'g']:
    hash_map.set(key, key)
assert_eq(hash_map.size(), 7)
assert_eq(hash_map.loadFactor(), 0.4375)
for key in ['a', 'b', 'c', 'd', 'e', 'f', 'g']:
    assert_eq(hash_map.get(key), key)`
      },
      {
        name: '负载因子包含墓碑',
        code: `hash_map = create_hash_map()
hash_map.set('a', 1)
hash_map.set('b', 2)
hash_map.set('c', 3)
assert_eq(hash_map.loadFactor(), 0.375)
hash_map.delete('b')
assert_eq(hash_map.size(), 2)
assert_eq(hash_map.loadFactor(), 0.375)`
      },
      {
        name: '大量 key 仍可检索',
        code: `hash_map = create_hash_map()
for i in range(20):
    hash_map.set('k' + str(i), i)
assert_eq(hash_map.size(), 20)
for i in range(20):
    assert_eq(hash_map.get('k' + str(i)), i)`
      },
      {
        name: '重复扩容后仍保持正确',
        code: `hash_map = create_hash_map(initial_capacity=2, max_load=0.5)
for i in range(30):
    hash_map.set('x' + str(i), i * 2)
assert_eq(hash_map.size(), 30)
for i in range(30):
    assert_eq(hash_map.get('x' + str(i)), i * 2)
assert hash_map.loadFactor() <= 0.5`
      }
    ]
  },
  'a3-ex-1': {
    starter: `def create_bplus_tree(order):
    return {
        'insert': lambda key: None,
        'search': lambda key: False,
        'range': lambda lo, hi: [],
        'height': lambda: 0,
        'keys': lambda: [],
    }`,
    solution: `import math

class _Node:
    def __init__(self, leaf):
        self.leaf = leaf
        self.keys = []
        self.children = []
        self.next = None

class BPlusTree:
    def __init__(self, order):
        if not isinstance(order, int) or isinstance(order, bool) or order < 3:
            raise ValueError('INVALID_ORDER')
        self._max_keys = order - 1
        self._root = _Node(True)
        self._height = 1

    def _find_leaf(self, key):
        current = self._root
        while not current.leaf:
            index = 0
            while index < len(current.keys) and key >= current.keys[index]:
                index += 1
            current = current.children[index]
        return current

    def _split_leaf(self, leaf):
        mid = math.ceil(len(leaf.keys) / 2)
        right = _Node(True)
        right.keys = leaf.keys[mid:]
        right.next = leaf.next
        leaf.keys = leaf.keys[:mid]
        leaf.next = right
        return right.keys[0], right

    def _split_internal(self, node):
        mid = len(node.keys) // 2
        separator = node.keys[mid]
        right = _Node(False)
        right.keys = node.keys[mid + 1:]
        right.children = node.children[mid + 1:]
        node.keys = node.keys[:mid]
        node.children = node.children[:mid + 1]
        return separator, right

    def _insert_into(self, node, key):
        if node.leaf:
            index = 0
            while index < len(node.keys) and node.keys[index] < key:
                index += 1
            if index < len(node.keys) and node.keys[index] == key:
                return None
            node.keys.insert(index, key)
            return self._split_leaf(node) if len(node.keys) > self._max_keys else None
        index = 0
        while index < len(node.keys) and key >= node.keys[index]:
            index += 1
        split = self._insert_into(node.children[index], key)
        if split is None:
            return None
        separator, right = split
        node.keys.insert(index, separator)
        node.children.insert(index + 1, right)
        return self._split_internal(node) if len(node.keys) > self._max_keys else None

    def insert(self, key):
        split = self._insert_into(self._root, key)
        if split is not None:
            separator, right = split
            new_root = _Node(False)
            new_root.keys = [separator]
            new_root.children = [self._root, right]
            self._root = new_root
            self._height += 1

    def search(self, key):
        return key in self._find_leaf(key).keys

    def range(self, lo, hi):
        result = []
        leaf = self._find_leaf(lo)
        while leaf is not None:
            for key in leaf.keys:
                if key > hi:
                    return result
                if key >= lo:
                    result.append(key)
            leaf = leaf.next
        return result

    def keys(self):
        result = []
        leaf = self._root
        while not leaf.leaf:
            leaf = leaf.children[0]
        while leaf is not None:
            result.extend(leaf.keys)
            leaf = leaf.next
        return result

    def height(self):
        return self._height

def create_bplus_tree(order):
    return BPlusTree(order)`,
    tests: [
      {
        name: '空树',
        code: `tree = create_bplus_tree(4)
assert_eq(tree.height(), 1)
assert_eq(tree.keys(), [])
assert_eq(tree.search(1), False)`
      },
      {
        name: '单个 key',
        code: `tree = create_bplus_tree(4)
tree.insert(10)
assert_eq(tree.search(10), True)
assert_eq(tree.height(), 1)
assert_eq(tree.keys(), [10])`
      },
      {
        name: '重复 key 被忽略',
        code: `tree = create_bplus_tree(4)
tree.insert(1)
tree.insert(1)
assert_eq(tree.keys(), [1])`
      },
      {
        name: '根分裂后树高增加',
        code: `tree = create_bplus_tree(4)
for key in [1, 2, 3, 4]:
    tree.insert(key)
assert_eq(tree.height(), 2)
for key in [1, 2, 3, 4]:
    assert_eq(tree.search(key), True)`
      },
      {
        name: '多层分裂',
        code: `tree = create_bplus_tree(4)
for key in range(1, 21):
    tree.insert(key)
assert tree.height() >= 3
assert_eq(len(tree.keys()), 20)
for key in range(1, 21):
    assert_eq(tree.search(key), True)`
      },
      {
        name: '范围查询覆盖闭区间',
        code: `tree = create_bplus_tree(4)
for key in range(1, 21):
    tree.insert(key)
assert_eq(tree.range(5, 12), [5, 6, 7, 8, 9, 10, 11, 12])
assert_eq(tree.range(100, 200), [])`
      },
      {
        name: '乱序插入后 keys 有序',
        code: `tree = create_bplus_tree(4)
for key in [7, 3, 9, 1, 5, 8, 2, 6, 4, 10]:
    tree.insert(key)
assert_eq(tree.keys(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])`
      },
      {
        name: '降序插入',
        code: `tree = create_bplus_tree(4)
for key in range(20, 0, -1):
    tree.insert(key)
assert_eq(tree.keys(), list(range(1, 21)))`
      },
      {
        name: '缺失 key 查找失败',
        code: `tree = create_bplus_tree(4)
for key in [2, 4, 6, 8]:
    tree.insert(key)
assert_eq(tree.search(5), False)
assert_eq(tree.search(9), False)`
      },
      {
        name: 'order 过小抛错',
        code: `caught = False
try:
    create_bplus_tree(2)
except Exception:
    caught = True
assert_eq(caught, True)`
      }
    ]
  },
  'a4-ex-1': {
    starter: `def create_min_heap():
    return {
        'push': lambda value: None,
        'pop': lambda: None,
        'peek': lambda: None,
        'size': lambda: 0,
    }

def top_k(nums, k):
    return []

def create_median_tracker():
    return {
        'add': lambda num: None,
        'median': lambda: None,
    }`,
    solution: `class MinHeap:
    def __init__(self):
        self._items = []

    def push(self, value):
        self._items.append(value)
        index = len(self._items) - 1
        while index > 0:
            parent = (index - 1) // 2
            if self._items[parent] <= self._items[index]:
                break
            self._items[parent], self._items[index] = self._items[index], self._items[parent]
            index = parent

    def pop(self):
        if not self._items:
            return None
        top = self._items[0]
        last = self._items.pop()
        if self._items:
            self._items[0] = last
            index = 0
            while True:
                left = index * 2 + 1
                right = left + 1
                smallest = index
                if left < len(self._items) and self._items[left] < self._items[smallest]:
                    smallest = left
                if right < len(self._items) and self._items[right] < self._items[smallest]:
                    smallest = right
                if smallest == index:
                    break
                self._items[index], self._items[smallest] = self._items[smallest], self._items[index]
                index = smallest
        return top

    def peek(self):
        return self._items[0] if self._items else None

    def size(self):
        return len(self._items)

def create_min_heap():
    return MinHeap()

def top_k(nums, k):
    if not isinstance(k, int) or isinstance(k, bool) or k <= 0:
        return []
    heap = MinHeap()
    for num in nums:
        heap.push(num)
        if heap.size() > k:
            heap.pop()
    result = []
    while heap.size() > 0:
        result.append(heap.pop())
    result.reverse()
    return result

class MedianTracker:
    def __init__(self):
        self._low = MinHeap()
        self._high = MinHeap()

    def add(self, num):
        if self._low.size() == 0 or num <= -self._low.peek():
            self._low.push(-num)
        else:
            self._high.push(num)
        if self._low.size() > self._high.size() + 1:
            self._high.push(-self._low.pop())
        elif self._high.size() > self._low.size():
            self._low.push(-self._high.pop())

    def median(self):
        if self._low.size() == 0:
            return None
        if self._low.size() == self._high.size():
            return (-self._low.peek() + self._high.peek()) / 2
        return -self._low.peek()

def create_median_tracker():
    return MedianTracker()`,
    tests: [
      {
        name: '堆序与极值',
        code: `heap = create_min_heap()
for value in [5, 3, 8, 1]:
    heap.push(value)
assert_eq(heap.peek(), 1)
assert_eq(heap.size(), 4)
assert_eq(heap.pop(), 1)
assert_eq(heap.pop(), 3)
assert_eq(heap.pop(), 5)
assert_eq(heap.pop(), 8)`
      },
      {
        name: '重复值保持堆序',
        code: `heap = create_min_heap()
for value in [2, 2, 2]:
    heap.push(value)
assert_eq(heap.pop(), 2)
assert_eq(heap.pop(), 2)
assert_eq(heap.pop(), 2)`
      },
      {
        name: '空堆行为',
        code: `heap = create_min_heap()
assert_eq(heap.pop(), None)
assert_eq(heap.peek(), None)
assert_eq(heap.size(), 0)`
      },
      {
        name: 'Top-K 降序',
        code: `assert_eq(top_k([3, 1, 4, 1, 5, 9, 2, 6], 3), [9, 6, 5])`
      },
      {
        name: 'k 大于长度时返回全部',
        code: `assert_eq(top_k([2, 1], 5), [2, 1])`
      },
      {
        name: '非法 k 返回空数组',
        code: `assert_eq(top_k([1, 2, 3], 0), [])
assert_eq(top_k([1, 2, 3], -1), [])
assert_eq(top_k([1, 2, 3], 1.5), [])`
      },
      {
        name: '中位数奇数个',
        code: `tracker = create_median_tracker()
for value in [5, 1, 3]:
    tracker.add(value)
assert_eq(tracker.median(), 3)`
      },
      {
        name: '中位数偶数个',
        code: `tracker = create_median_tracker()
for value in [1, 2, 3, 4]:
    tracker.add(value)
assert_eq(tracker.median(), 2.5)`
      },
      {
        name: '负数与乱序插入',
        code: `tracker = create_median_tracker()
for value in [-1, -5, -3]:
    tracker.add(value)
assert_eq(tracker.median(), -3)
tracker.add(-2)
assert_eq(tracker.median(), -2.5)`
      },
      {
        name: '大量数据堆排序正确',
        code: `heap = create_min_heap()
for value in range(100, 0, -1):
    heap.push(value)
ordered = []
while heap.size() > 0:
    ordered.append(heap.pop())
assert_eq(len(ordered), 100)
assert_eq(ordered[0], 1)
assert_eq(ordered[99], 100)
for i in range(1, len(ordered)):
    assert ordered[i - 1] <= ordered[i]`
      }
    ]
  },
  'a5-ex-1': {
    starter: `def create_ring_buffer(capacity):
    return {
        'push': lambda value: None,
        'read': lambda: None,
        'available': lambda: 0,
        'size': lambda: 0,
    }

def create_lru(capacity):
    return {
        'get': lambda key: None,
        'put': lambda key, value: None,
        'keys': lambda: [],
    }`,
    solution: `class RingBuffer:
    def __init__(self, capacity):
        if not isinstance(capacity, int) or isinstance(capacity, bool) or capacity <= 0:
            raise ValueError('INVALID_CAPACITY')
        self._capacity = capacity
        self._slots = [None] * capacity
        self._read_index = 0
        self._write_index = 0
        self._count = 0

    def push(self, value):
        self._slots[self._write_index] = value
        self._write_index = (self._write_index + 1) % self._capacity
        if self._count == self._capacity:
            self._read_index = (self._read_index + 1) % self._capacity
        else:
            self._count += 1

    def read(self):
        if self._count == 0:
            return None
        value = self._slots[self._read_index]
        self._read_index = (self._read_index + 1) % self._capacity
        self._count -= 1
        return value

    def available(self):
        return self._count

    def size(self):
        return self._capacity

class _LRUNode:
    __slots__ = ('key', 'value', 'prev', 'next')

    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None

class LRU:
    def __init__(self, capacity):
        if not isinstance(capacity, int) or isinstance(capacity, bool) or capacity <= 0:
            raise ValueError('INVALID_CAPACITY')
        self._capacity = capacity
        self._map = {}
        self._head = _LRUNode(None, None)
        self._tail = _LRUNode(None, None)
        self._head.next = self._tail
        self._tail.prev = self._head

    def _detach(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _attach_front(self, node):
        node.next = self._head.next
        node.prev = self._head
        self._head.next.prev = node
        self._head.next = node

    def _move_to_front(self, node):
        self._detach(node)
        self._attach_front(node)

    def get(self, key):
        node = self._map.get(key)
        if node is None:
            return None
        self._move_to_front(node)
        return node.value

    def put(self, key, value):
        existing = self._map.get(key)
        if existing is not None:
            existing.value = value
            self._move_to_front(existing)
            return
        node = _LRUNode(key, value)
        self._map[key] = node
        self._attach_front(node)
        if len(self._map) > self._capacity:
            oldest = self._tail.prev
            self._detach(oldest)
            del self._map[oldest.key]

    def keys(self):
        result = []
        node = self._head.next
        while node is not self._tail:
            result.append(node.key)
            node = node.next
        return result

def create_ring_buffer(capacity):
    return RingBuffer(capacity)

def create_lru(capacity):
    return LRU(capacity)`,
    tests: [
      {
        name: '环形缓冲覆盖最旧',
        code: `buffer = create_ring_buffer(3)
for value in [1, 2, 3, 4]:
    buffer.push(value)
assert_eq(buffer.read(), 2)
assert_eq(buffer.read(), 3)
assert_eq(buffer.read(), 4)
assert_eq(buffer.read(), None)`
      },
      {
        name: '读写交错保持顺序',
        code: `buffer = create_ring_buffer(4)
buffer.push(1)
buffer.push(2)
buffer.push(3)
assert_eq(buffer.read(), 1)
assert_eq(buffer.read(), 2)
buffer.push(4)
buffer.push(5)
assert_eq(buffer.read(), 3)
assert_eq(buffer.read(), 4)
assert_eq(buffer.read(), 5)`
      },
      {
        name: '空缓冲读取',
        code: `buffer = create_ring_buffer(2)
assert_eq(buffer.read(), None)
assert_eq(buffer.available(), 0)
assert_eq(buffer.size(), 2)`
      },
      {
        name: '容量为 1 时覆盖',
        code: `buffer = create_ring_buffer(1)
buffer.push(1)
buffer.push(2)
assert_eq(buffer.available(), 1)
assert_eq(buffer.read(), 2)
assert_eq(buffer.read(), None)`
      },
      {
        name: 'available 与 size 语义',
        code: `buffer = create_ring_buffer(3)
buffer.push('a')
buffer.push('b')
assert_eq(buffer.available(), 2)
assert_eq(buffer.size(), 3)
buffer.read()
assert_eq(buffer.available(), 1)
assert_eq(buffer.size(), 3)`
      },
      {
        name: 'LRU 命中刷新顺序',
        code: `lru = create_lru(2)
lru.put('a', 1)
lru.put('b', 2)
assert_eq(lru.get('a'), 1)
lru.put('c', 3)
assert_eq(lru.keys(), ['c', 'a'])
assert_eq(lru.get('b'), None)`
      },
      {
        name: 'LRU 淘汰最久未用',
        code: `lru = create_lru(3)
lru.put('a', 1)
lru.put('b', 2)
lru.put('c', 3)
assert_eq(lru.get('a'), 1)
lru.put('d', 4)
assert_eq(lru.keys(), ['d', 'a', 'c'])
assert_eq(lru.get('b'), None)`
      },
      {
        name: '更新已有 key 也刷新',
        code: `lru = create_lru(2)
lru.put('a', 1)
lru.put('b', 2)
lru.put('a', 3)
assert_eq(lru.get('a'), 3)
assert_eq(lru.keys(), ['a', 'b'])
lru.put('c', 4)
assert_eq(lru.get('b'), None)
assert_eq(lru.keys(), ['c', 'a'])`
      },
      {
        name: '容量为 1 的 LRU',
        code: `lru = create_lru(1)
lru.put('a', 1)
lru.put('b', 2)
assert_eq(lru.get('a'), None)
assert_eq(lru.get('b'), 2)
assert_eq(lru.keys(), ['b'])`
      },
      {
        name: '大量操作保持容量上限',
        code: `lru = create_lru(100)
for i in range(200):
    lru.put('k' + str(i), i)
assert_eq(len(lru.keys()), 100)
for i in range(100, 200):
    assert_eq(lru.get('k' + str(i)), i)
assert_eq(lru.get('k0'), None)
assert_eq(lru.keys()[0:2], ['k199', 'k198'])`
      }
    ]
  },
  'a6-ex-1': {
    starter: `def create_bloom_filter(bits, hashes):
    return {
        'add': lambda value: None,
        'might_contain': lambda value: False,
        'false_positive_rate': lambda: 0,
    }

def create_hll(precision):
    return {
        'add': lambda value: None,
        'estimate': lambda: 0,
    }`,
    solution: `import math

class BloomFilter:
    def __init__(self, bits, hashes):
        if not isinstance(bits, int) or isinstance(bits, bool) or bits <= 0:
            raise ValueError('INVALID_BITS')
        if not hashes:
            raise ValueError('INVALID_HASHES')
        self._bits = bits
        self._hashes = list(hashes)
        self._slots = bytearray(bits)
        self._set_bits = 0

    def add(self, value):
        for hash_fn in self._hashes:
            index = abs(hash_fn(value)) % self._bits
            if self._slots[index] == 0:
                self._slots[index] = 1
                self._set_bits += 1

    def might_contain(self, value):
        return all(
            self._slots[abs(hash_fn(value)) % self._bits] == 1
            for hash_fn in self._hashes
        )

    def false_positive_rate(self):
        return (self._set_bits / self._bits) ** len(self._hashes)

class HyperLogLog:
    def __init__(self, precision):
        if not isinstance(precision, int) or isinstance(precision, bool) or precision < 4 or precision > 16:
            raise ValueError('INVALID_PRECISION')
        self._precision = precision
        self._bucket_count = 2 ** precision
        self._buckets = [0] * self._bucket_count

    def _fmix32(self, h):
        h ^= h >> 16
        h = (h * 0x85EBCA6B) & 0xFFFFFFFF
        h ^= h >> 13
        h = (h * 0xC2B2AE35) & 0xFFFFFFFF
        h ^= h >> 16
        return h & 0xFFFFFFFF

    def _hash64(self, value):
        h1 = 0x811C9DC5
        h2 = 0x9E3779B9
        for ch in str(value):
            h1 = ((h1 ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
            h2 = ((h2 ^ ord(ch)) * 0x85EBCA6B + 0x165667B1) & 0xFFFFFFFF
        return self._fmix32(h1), self._fmix32(h2)

    def add(self, value):
        h1, h2 = self._hash64(value)
        index = h1 >> (32 - self._precision)
        rank = 33 if h2 == 0 else 32 - h2.bit_length() + 1
        if rank > self._buckets[index]:
            self._buckets[index] = rank

    def estimate(self):
        m = self._bucket_count
        total = 0.0
        zeros = 0
        for value in self._buckets:
            total += 2 ** (-value)
            if value == 0:
                zeros += 1
        if m == 16:
            alpha = 0.673
        elif m == 32:
            alpha = 0.697
        elif m == 64:
            alpha = 0.709
        else:
            alpha = 0.7213 / (1 + 1.079 / m)
        raw = (alpha * m * m) / total
        if raw <= 2.5 * m and zeros > 0:
            raw = m * math.log(m / zeros)
        return raw

def create_bloom_filter(bits, hashes):
    return BloomFilter(bits, hashes)

def create_hll(precision):
    return HyperLogLog(precision)`,
    tests: [
      {
        name: '加入的元素一定命中',
        code: `def h1(value):
    h = 0
    for ch in str(value):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h

def h2(value):
    h = 7
    for ch in str(value):
        h = (h * 131 + ord(ch) + 17) & 0xFFFFFFFF
    return h

filter = create_bloom_filter(256, [h1, h2])
for value in ['alpha', 'beta', 'gamma']:
    filter.add(value)
for value in ['alpha', 'beta', 'gamma']:
    assert_eq(filter.might_contain(value), True)`
      },
      {
        name: '未加入的元素可能被排除',
        code: `def h1(value):
    h = 0
    for ch in str(value):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h

def h2(value):
    h = 7
    for ch in str(value):
        h = (h * 131 + ord(ch) + 17) & 0xFFFFFFFF
    return h

filter = create_bloom_filter(1024, [h1, h2])
filter.add('alpha')
filter.add('beta')
assert_eq(filter.might_contain('zeta'), False)`
      },
      {
        name: '空过滤器误判率为零',
        code: `filter = create_bloom_filter(64, [lambda value: len(str(value))])
assert_eq(filter.false_positive_rate(), 0)
filter.add('abc')
assert filter.false_positive_rate() > 0 and filter.false_positive_rate() < 1`
      },
      {
        name: '误判率随置位比例上升',
        code: `def identity(value):
    h = 0
    for ch in str(value):
        h += ord(ch)
    return h

small = create_bloom_filter(8, [identity])
large = create_bloom_filter(1024, [identity])
small.add('a')
large.add('a')
assert small.false_positive_rate() > large.false_positive_rate()`
      },
      {
        name: '不同哈希个数仍保持语义',
        code: `def h1(value):
    return len(str(value)) * 7

def h2(value):
    return len(str(value)) * 13 + 1

def h3(value):
    return len(str(value)) * 29 + 3

one = create_bloom_filter(128, [h1])
three = create_bloom_filter(128, [h1, h2, h3])
one.add('hello')
three.add('hello')
assert_eq(one.might_contain('hello'), True)
assert_eq(three.might_contain('hello'), True)
assert 0 <= three.false_positive_rate() <= 1`
      },
      {
        name: 'HLL 空集估算为零',
        code: `hll = create_hll(8)
assert_eq(hll.estimate(), 0)`
      },
      {
        name: 'HLL 小基数估算接近实际',
        code: `hll = create_hll(8)
for value in ['a', 'b', 'c', 'd', 'e']:
    hll.add(value)
estimate = hll.estimate()
assert 3 <= estimate <= 8`
      },
      {
        name: 'HLL 重复元素不重复计数',
        code: `hll = create_hll(8)
for i in range(100):
    hll.add('same-key')
estimate = hll.estimate()
assert 0 <= estimate <= 2`
      },
      {
        name: 'HLL 大基数在误差范围内',
        code: `hll = create_hll(10)
for i in range(1000):
    hll.add('user-' + str(i))
estimate = hll.estimate()
assert 850 <= estimate <= 1150`
      },
      {
        name: '非法 precision 抛错',
        code: `caught_low = False
try:
    create_hll(3)
except Exception:
    caught_low = True
caught_high = False
try:
    create_hll(17)
except Exception:
    caught_high = True
assert_eq(caught_low, True)
assert_eq(caught_high, True)`
      }
    ]
  },
  'a8-ex-1': {
    starter: `def create_weighted_round_robin(servers):
    return {
        'pick': lambda: None,
    }

def check_fd_budget(system_limit, worker_processes, connections_per_worker, files_per_connection, reserve):
    return {'ok': False, 'required': 0, 'headroom': 0}`,
    solution: `def create_weighted_round_robin(servers):
    entries = [
        {
            'name': server['name'],
            'weight': server['weight'],
            'healthy': server.get('healthy', True),
            'current': 0,
        }
        for server in servers
    ]

    class WeightedRoundRobin:
        def pick(self):
            candidates = [entry for entry in entries if entry['healthy'] and entry['weight'] > 0]
            if not candidates:
                return None
            total = 0
            best = None
            for entry in candidates:
                total += entry['weight']
                entry['current'] += entry['weight']
                if best is None or entry['current'] > best['current']:
                    best = entry
            best['current'] -= total
            return best['name']

    return WeightedRoundRobin()

def check_fd_budget(system_limit, worker_processes, connections_per_worker, files_per_connection, reserve):
    values = {
        'system_limit': system_limit,
        'worker_processes': worker_processes,
        'connections_per_worker': connections_per_worker,
        'files_per_connection': files_per_connection,
        'reserve': reserve,
    }
    for name, value in values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
            raise ValueError('INVALID_' + name.upper())
    required = worker_processes * connections_per_worker * files_per_connection + reserve
    return {
        'ok': required <= system_limit,
        'required': required,
        'headroom': system_limit - required,
    }`,
    tests: [
      {
        name: '权重比例正确',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 5},
    {'name': 'b', 'weight': 1},
    {'name': 'c', 'weight': 1},
])
counts = {'a': 0, 'b': 0, 'c': 0}
for _ in range(7):
    counts[rr.pick()] += 1
assert_eq(counts, {'a': 5, 'b': 1, 'c': 1})`
      },
      {
        name: '平滑顺序而非连续命中',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 5},
    {'name': 'b', 'weight': 1},
    {'name': 'c', 'weight': 1},
])
sequence = [rr.pick() for _ in range(7)]
assert_eq(sequence, ['a', 'a', 'b', 'a', 'c', 'a', 'a'])`
      },
      {
        name: '跳过不健康节点',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 5},
    {'name': 'b', 'weight': 1, 'healthy': False},
    {'name': 'c', 'weight': 1},
])
sequence = [rr.pick() for _ in range(6)]
assert_eq(sequence, ['a', 'a', 'a', 'c', 'a', 'a'])`
      },
      {
        name: '全部不健康返回 null',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 1, 'healthy': False},
    {'name': 'b', 'weight': 1, 'healthy': False},
])
assert_eq(rr.pick(), None)`
      },
      {
        name: '权重为零的节点被跳过',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 1},
    {'name': 'b', 'weight': 0},
])
assert_eq(rr.pick(), 'a')
assert_eq(rr.pick(), 'a')`
      },
      {
        name: 'fd 预算通过',
        code: `result = check_fd_budget(
    system_limit=10000,
    worker_processes=4,
    connections_per_worker=100,
    files_per_connection=10,
    reserve=500,
)
assert_eq(result['ok'], True)
assert_eq(result['required'], 4500)
assert_eq(result['headroom'], 5500)`
      },
      {
        name: 'fd 预算不足',
        code: `result = check_fd_budget(
    system_limit=4000,
    worker_processes=4,
    connections_per_worker=100,
    files_per_connection=10,
    reserve=500,
)
assert_eq(result['ok'], False)
assert_eq(result['required'], 4500)
assert_eq(result['headroom'], -500)`
      },
      {
        name: '预算刚好等于上限',
        code: `result = check_fd_budget(
    system_limit=4500,
    worker_processes=4,
    connections_per_worker=100,
    files_per_connection=10,
    reserve=500,
)
assert_eq(result['ok'], True)
assert_eq(result['headroom'], 0)`
      },
      {
        name: '非法参数抛错',
        code: `def raises(call):
    try:
        call()
    except Exception:
        return True
    return False

assert_eq(raises(lambda: check_fd_budget(-1, 1, 1, 1, 1)), True)
assert_eq(raises(lambda: check_fd_budget(10, 0, 1, 1, 1)), True)
assert_eq(raises(lambda: check_fd_budget(10, 1, 1, 1, 0)), True)`
      },
      {
        name: '多轮循环后比例仍正确',
        code: `rr = create_weighted_round_robin([
    {'name': 'a', 'weight': 3},
    {'name': 'b', 'weight': 2},
    {'name': 'c', 'weight': 1},
])
counts = {'a': 0, 'b': 0, 'c': 0}
for _ in range(12):
    counts[rr.pick()] += 1
assert_eq(counts, {'a': 6, 'b': 4, 'c': 2})`
      }
    ]
  },
  'a11-ex-1': {
    starter: `def audit_test_portfolio(portfolio):
    return {'total': 0, 'flakyRate': 0, 'findings': []}

def detect_flaky(history):
    return [{'name': entry['name'], 'flips': 0, 'flaky': False} for entry in history]`,
    solution: `def audit_test_portfolio(portfolio):
    unit = portfolio['unit']
    integration = portfolio['integration']
    e2e = portfolio['e2e']
    contract = portfolio['contract']
    flaky = portfolio['flaky']
    total = unit + integration + e2e + contract
    findings = []
    if total == 0:
        findings.append({
            'code': 'NO_TESTS',
            'severity': 'high',
            'detail': 'total=0; no tests configured',
        })
        return {'total': total, 'flakyRate': 0, 'findings': findings}
    if unit == 0:
        findings.append({'code': 'NO_UNIT_TESTS', 'severity': 'high', 'detail': f'unit=0 of total={total}'})
    if integration == 0:
        findings.append({'code': 'NO_INTEGRATION_TESTS', 'severity': 'medium', 'detail': f'integration=0 of total={total}'})
    if contract == 0:
        findings.append({'code': 'NO_CONTRACT_TESTS', 'severity': 'medium', 'detail': f'contract=0 of total={total}'})
    e2e_ratio = e2e / total
    if e2e_ratio > 0.2:
        findings.append({
            'code': 'E2E_TOO_HIGH',
            'severity': 'medium',
            'detail': f'e2e={e2e} of total={total}; ratio={e2e_ratio:.3f} > 0.200',
        })
    flaky_rate = flaky / total
    if flaky_rate > 0.01:
        findings.append({
            'code': 'FLAKY_RATE_HIGH',
            'severity': 'high',
            'detail': f'flaky={flaky} of total={total}; rate={flaky_rate:.3f} > 0.010',
        })
    rank = {'high': 0, 'medium': 1, 'low': 2}
    findings.sort(key=lambda item: (rank[item['severity']], item['code']))
    return {'total': total, 'flakyRate': flaky_rate, 'findings': findings}

def detect_flaky(history):
    rows = []
    for entry in history:
        results = entry['results']
        flips = sum(1 for i in range(1, len(results)) if results[i] != results[i - 1])
        rows.append({'name': entry['name'], 'flips': flips, 'flaky': flips >= 2})
    rows.sort(key=lambda row: (-row['flips'], row['name']))
    return rows`,
    tests: [
      {
        name: '健康组合无发现',
        code: `result = audit_test_portfolio({'unit': 40, 'integration': 10, 'e2e': 2, 'contract': 5, 'flaky': 0})
assert_eq(result['total'], 57)
assert_eq(result['flakyRate'], 0)
assert_eq(result['findings'], [])`
      },
      {
        name: '缺契约测试',
        code: `result = audit_test_portfolio({'unit': 20, 'integration': 5, 'e2e': 2, 'contract': 0, 'flaky': 0})
assert_eq(result['total'], 27)
assert_eq([item['code'] for item in result['findings']], ['NO_CONTRACT_TESTS'])
assert_eq(result['findings'][0]['severity'], 'medium')
assert_eq(result['findings'][0]['detail'], 'contract=0 of total=27')`
      },
      {
        name: '端到端占比过高',
        code: `result = audit_test_portfolio({'unit': 10, 'integration': 2, 'e2e': 4, 'contract': 2, 'flaky': 0})
assert_eq(result['total'], 18)
assert_eq([item['code'] for item in result['findings']], ['E2E_TOO_HIGH'])
assert_eq(result['findings'][0]['detail'], 'e2e=4 of total=18; ratio=0.222 > 0.200')`
      },
      {
        name: 'flaky 率过高',
        code: `result = audit_test_portfolio({'unit': 100, 'integration': 20, 'e2e': 2, 'contract': 5, 'flaky': 2})
assert_eq(result['total'], 127)
assert_eq([item['code'] for item in result['findings']], ['FLAKY_RATE_HIGH'])
assert_eq(result['findings'][0]['severity'], 'high')
assert_eq(result['findings'][0]['detail'], 'flaky=2 of total=127; rate=0.016 > 0.010')`
      },
      {
        name: '边界值恰好不报',
        code: `result = audit_test_portfolio({'unit': 80, 'integration': 15, 'e2e': 2, 'contract': 3, 'flaky': 1})
assert_eq(result['total'], 100)
assert_eq(result['flakyRate'], 0.01)
assert_eq(result['findings'], [])`
      },
      {
        name: '空组合只报 NO_TESTS',
        code: `result = audit_test_portfolio({'unit': 0, 'integration': 0, 'e2e': 0, 'contract': 0, 'flaky': 0})
assert_eq(result['total'], 0)
assert_eq(result['flakyRate'], 0)
assert_eq(len(result['findings']), 1)
assert_eq(result['findings'][0]['code'], 'NO_TESTS')
assert_eq(result['findings'][0]['severity'], 'high')`
      },
      {
        name: '发现按严重度与代码排序',
        code: `result = audit_test_portfolio({'unit': 0, 'integration': 0, 'e2e': 5, 'contract': 0, 'flaky': 1})
assert_eq(result['total'], 5)
assert_eq([item['code'] for item in result['findings']], [
    'FLAKY_RATE_HIGH',
    'NO_UNIT_TESTS',
    'E2E_TOO_HIGH',
    'NO_CONTRACT_TESTS',
    'NO_INTEGRATION_TESTS',
])
assert_eq([item['severity'] for item in result['findings']], ['high', 'high', 'medium', 'medium', 'medium'])`
      },
      {
        name: '无翻转的测试稳定',
        code: `result = detect_flaky([
    {'name': 'stable', 'results': [True, True, True, True]},
    {'name': 'broken', 'results': [False, False, False]},
])
assert_eq([item['name'] for item in result], ['broken', 'stable'])
assert_eq([item['flips'] for item in result], [0, 0])
assert_eq([item['flaky'] for item in result], [False, False])`
      },
      {
        name: '多次翻转判定为 flaky 并按翻转排序',
        code: `result = detect_flaky([
    {'name': 'c', 'results': [True, True, False, False, True]},
    {'name': 'a', 'results': [True, False, True]},
    {'name': 'b', 'results': [True, False, True, False]},
])
assert_eq([item['name'] for item in result], ['b', 'a', 'c'])
assert_eq([item['flips'] for item in result], [3, 2, 2])
assert_eq([item['flaky'] for item in result], [True, True, True])`
      },
      {
        name: '空历史与空结果',
        code: `assert_eq(detect_flaky([]), [])
result = detect_flaky([{'name': 'single', 'results': [True]}, {'name': 'empty', 'results': []}])
assert_eq([item['name'] for item in result], ['empty', 'single'])
assert_eq([item['flips'] for item in result], [0, 0])
assert_eq([item['flaky'] for item in result], [False, False])`
      }
    ]
  }
} satisfies PythonTrackMap;
