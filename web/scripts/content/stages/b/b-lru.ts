export const bLru = {
  "id": "b-lru",
  "title": "环形缓冲与 LRU：固定内存下的秩序",
  "subtitle": "内存有上限时，结构决定退化方式：环形缓冲覆盖最旧，LRU 淘汰最久未用。",
  "duration": 65,
  "status": "ready",
  "objectives": [
    "实现固定容量环形缓冲，处理满/空判定与覆盖写。",
    "实现 O(1) 的 LRU，理解哈希表与双向链表的组合。",
    "区分 LRU、LFU 与 TTL 的适用场景和失效模式。",
    "为日志或指标缓冲选择丢弃策略，并用背压保护内存。"
  ],
  "keywords": ["环形缓冲", "LRU", "LFU", "TTL", "背压", "双向链表"],
  "blocks": [
    {
      "type": "analogy",
      "title": "行车记录仪循环覆盖",
      "html": "行车记录仪的内存卡容量固定，新视频会覆盖最旧的片段；你永远保留最近一段时间的画面，而不是等卡满了就停止录制。环形缓冲就是这套机制：写指针绕圈前进，空间复用，最旧的数据自然让位。<br>这个类比的边界是「覆盖谁」：行车记录仪覆盖最旧的视频通常符合需求，因为事故更可能发生在刚刚；但审计日志覆盖旧记录可能是灾难。覆盖策略不是数据结构决定的，而是业务决定的。"
    },
    {
      "type": "text",
      "title": "环形缓冲",
      "html": "环形缓冲用一块固定大小的数组和两个指针工作：写指针指向下一个可写位置，读指针指向下一个可读位置。写入后写指针前进；读出一项后读指针前进；两个指针都对容量取模，于是走到末尾会回到开头。<br>难点是满与空的判定。如果只看两个指针是否相等，满和空无法区分；常见做法是额外维护元素个数，或者故意留一个空槽。元素个数方案更直观：count 为 0 是空，count 等于容量是满。缓冲区满时再写入，有两种选择：覆盖最旧元素（读指针前进一格），或者拒绝写入并通知调用方。前者保证数据新鲜，后者保证不丢数据，选择取决于业务。<br>环形缓冲的优点是写入与读取都是 O(1)，内存一次分配、不会随流量增长；缺点是容量固定，突发流量下要么覆盖要么阻塞。它适合日志尾部、指标窗口、音频采样这类「只关心最近 N 个」的场景，不适合需要完整历史的审计数据。"
    },
    {
      "type": "code",
      "title": "环形缓冲",
      "lang": "javascript",
      "code": "function createRingBuffer(capacity) {\n  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_CAPACITY');\n  const slots = new Array(capacity);\n  let readIndex = 0;\n  let writeIndex = 0;\n  let count = 0;\n  return {\n    push(value) {\n      slots[writeIndex] = value;\n      writeIndex = (writeIndex + 1) % capacity;\n      if (count === capacity) readIndex = (readIndex + 1) % capacity;\n      else count += 1;\n    },\n    read() {\n      if (count === 0) return undefined;\n      const value = slots[readIndex];\n      readIndex = (readIndex + 1) % capacity;\n      count -= 1;\n      return value;\n    },\n    available() {\n      return count;\n    },\n    size() {\n      return capacity;\n    }\n  };\n}",
      "note": "覆盖写时读指针也要前进，否则会把已覆盖的槽当成可读数据；count 用来区分满与空。"
    },
    {
      "type": "text",
      "title": "LRU 原理与失效模式",
      "html": "LRU 的核心假设是「最近用过的数据，接下来还会用」。实现需要两个能力：按 key 在 O(1) 内找到节点，以及在 O(1) 内把节点移动到「最近使用」的一端。哈希表负责第一个，双向链表负责第二个；每次 get 命中或 put 更新，都把节点摘下来挂到链表头，容量超限时删除链表尾。<br>LRU 的失效模式很明确：一次全表扫描会把所有历史热点挤出缓存，即使它们马上还会被访问。这类扫描型负载下，LFU（按访问频率）或 TTL（按时间过期）可能更合适；但 LFU 需要维护计数，且历史高频数据可能长期占据缓存，TTL 则可能在同一时刻集体过期。真实系统经常组合策略，例如 Redis 使用近似 LRU 采样，用少量随机样本估算最久未用的 key，避免维护全局链表的成本与锁竞争。<br>选择淘汰策略前，先回答三个问题：访问分布是热点集中还是均匀扫描；数据是否有明确的过期时间；命中率下降时业务能否接受回源成本。没有一种策略在所有负载下都最优。"
    },
    {
      "type": "code",
      "title": "LRU",
      "lang": "javascript",
      "code": "function createLRU(capacity) {\n  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_CAPACITY');\n  const map = new Map();\n  const head = { prev: null, next: null };\n  const tail = { prev: null, next: null };\n  head.next = tail;\n  tail.prev = head;\n  const detach = (node) => {\n    node.prev.next = node.next;\n    node.next.prev = node.prev;\n  };\n  const attachFront = (node) => {\n    node.next = head.next;\n    node.prev = head;\n    head.next.prev = node;\n    head.next = node;\n  };\n  const moveToFront = (node) => {\n    detach(node);\n    attachFront(node);\n  };\n  return {\n    get(key) {\n      const node = map.get(key);\n      if (!node) return undefined;\n      moveToFront(node);\n      return node.value;\n    },\n    put(key, value) {\n      const existing = map.get(key);\n      if (existing) {\n        existing.value = value;\n        moveToFront(existing);\n        return;\n      }\n      const node = { key, value, prev: null, next: null };\n      map.set(key, node);\n      attachFront(node);\n      if (map.size > capacity) {\n        const oldest = tail.prev;\n        detach(oldest);\n        map.delete(oldest.key);\n      }\n    },\n    keys() {\n      const result = [];\n      let node = head.next;\n      while (node !== tail) {\n        result.push(node.key);\n        node = node.next;\n      }\n      return result;\n    }\n  };\n}",
      "note": "命中与更新都要移到链表头；淘汰的是 tail.prev，不是 head.next；keys() 从最近使用到最久未用。"
    },
    {
      "type": "table",
      "title": "LRU vs LFU vs TTL",
      "head": ["策略", "淘汰依据", "实现成本", "适用与风险"],
      "rows": [
        ["LRU", "最久未被访问", "哈希表 + 双向链表，O(1)", "热点集中时有效；全表扫描会冲掉热点"],
        ["LFU", "访问频率最低", "需维护计数与频次桶，成本更高", "长期热点稳定；历史高频数据可能挤占缓存"],
        ["TTL", "到期时间", "每 key 记录过期时间或使用时间轮", "适合有时效的数据；可能集体过期造成回源洪峰"],
        ["近似 LRU", "随机采样后淘汰最久未用", "成本低、易并发", "Redis 常用；命中率略低于严格 LRU"]
      ]
    },
    {
      "type": "case",
      "title": "指标缓冲打满导致阻塞",
      "context": "一个采集代理把指标先写入内存环形缓冲，再由后台线程批量上报。缓冲容量按平均值设定，云端偶发网络抖动。",
      "symptom": "网络抖动期间采集线程全部阻塞在写入调用上，业务请求延迟上升；抖动结束后缓冲里混着很旧的指标，时间戳已经失去意义。",
      "cause": "环形缓冲满时的策略选择了「阻塞等待」，而不是覆盖或丢弃；容量没有考虑峰值与下游故障时间。缓冲的语义是「最近数据」，但实现把背压直接传给了业务线程。",
      "fix": "改为满时丢弃最旧数据并计数；上报失败时快速失败并降级到本地聚合；把容量按峰值速率乘以可接受的下游故障时长估算。",
      "prevention": "缓冲设计必须显式选择满时行为：覆盖、丢弃新数据、阻塞还是落盘；同时暴露丢弃计数与缓冲水位，避免静默丢数据。",
      "metric": "调整后采集线程不再阻塞，P99 请求延迟回到基线；丢弃计数在上报恢复后归零。"
    },
    {
      "type": "pitfall",
      "title": "用数组 splice 做 LRU、无上限、覆盖未读数据",
      "html": "现象一：用数组保存缓存顺序，每次命中调用 splice 把元素移到末尾。看起来是 O(n)，在缓存几万条、QPS 上千时，CPU 会消耗在数组搬移上。正确做法是哈希表定位节点，双向链表 O(1) 摘挂。<br>现象二：缓冲没有容量上限，或者上限只在启动时检查一次。流量突增时内存持续增长，最后 OOM。固定内存结构的意义就是把上限写进构造参数，并让满时行为可预测。<br>现象三：环形缓冲覆盖写时只移动写指针，没有同步移动读指针，导致读到已经被覆盖的旧槽，数据错乱。满时写入必须同时处理读指针与 count。<br>预防方式：为结构写不变量（容量恒定、count 范围、链表首尾关系），并用边界测试覆盖容量 1、满时写入、空时读取、连续覆盖。"
    },
    {
      "type": "steps",
      "title": "为日志采集设计缓冲",
      "steps": [
        { "title": "明确数据价值", "html": "日志是用于排障还是审计；能否接受丢失，能接受丢最旧还是最新。" },
        { "title": "估算峰值速率", "html": "用每秒日志条数乘以单条大小，再乘以可接受的下游故障时长，得到缓冲容量。" },
        { "title": "选择满时行为", "html": "排障日志通常覆盖最旧；审计日志应阻塞或落盘；任何选择都要有计数与告警。" },
        { "title": "处理下游失败", "html": "上报失败要快速失败或降级，不能让后台线程无限重试把缓冲拖死。" },
        { "title": "验证边界", "html": "测试容量 1、持续满写入、下游长时间不可用、恢复后的排空行为。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试常问「Redis 为什么用近似 LRU 而不是严格 LRU」。可以回答：严格 LRU 需要维护全局链表，每次访问都要移动节点，在并发与内存上都昂贵；Redis 通过随机采样若干 key，淘汰其中最久未用的那个，用很小的成本逼近 LRU 效果。接着补充代价：近似策略在极端访问分布下命中率会下降，但换来的是可预测的延迟与更低的内存开销。<br>如果被追问「LRU 一定比 FIFO 好吗」，要说明取决于访问分布：热点集中时 LRU 明显更好；顺序扫描时 LRU 可能不如 FIFO，因为两者都会被冲垮，而 FIFO 至少实现更简单。"
    }
  ],
  "checks": [
    {
      "id": "b-lru-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "环形缓冲",
      "prompt": "固定容量的环形缓冲已满，此时再写入一个新元素，会发生什么？",
      "question": "固定容量的环形缓冲已满，此时再写入一个新元素，会发生什么？",
      "options": [
        { "text": "覆盖最旧的元素，读指针前进一格，可读数量保持不变", "correct": true },
        { "text": "写入失败并抛出异常，必须由调用方清空缓冲", "correct": false },
        { "text": "自动扩容为两倍容量，保证所有数据都不丢", "correct": false },
        { "text": "覆盖最新的元素，保留最旧的数据", "correct": false }
      ],
      "explain": "环形缓冲满时的典型行为是覆盖最旧元素：写指针前进，读指针也前进，count 保持容量。拒绝写入或扩容是另外的策略，需要在设计时显式选择。"
    },
    {
      "id": "b-lru-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "LRU",
      "prompt": "要让 LRU 的 get 与 put 都达到 O(1)，实现必须依赖哪些部分？",
      "question": "要让 LRU 的 get 与 put 都达到 O(1)，实现必须依赖哪些部分？",
      "options": [
        { "text": "哈希表按 key 在 O(1) 内定位缓存节点", "correct": true },
        { "text": "双向链表在 O(1) 内摘除节点并挂到头部", "correct": true },
        { "text": "命中或更新时把节点移动到最近使用端", "correct": true },
        { "text": "每次访问后对全部缓存排序", "correct": false },
        { "text": "用数组 splice 维护顺序，因为数组访问是 O(1)", "correct": false }
      ],
      "explain": "哈希表负责定位，双向链表负责 O(1) 移动；排序与 splice 都会引入额外线性成本，破坏 O(1)。"
    },
    {
      "id": "b-lru-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "丢弃策略",
      "prompt": "日志缓冲满时，应该丢弃新日志还是旧日志？判断依据是什么？",
      "question": "日志缓冲满时，应该丢弃新日志还是旧日志？判断依据是什么？",
      "options": [
        { "text": "取决于业务更关心最新数据还是完整性、以及是否允许丢失，不能一概而论", "correct": true },
        { "text": "永远丢弃新日志，因为旧日志更重要", "correct": false },
        { "text": "永远丢弃旧日志，因为新日志一定更重要", "correct": false },
        { "text": "不应该丢弃任何日志，必须无限扩容", "correct": false }
      ],
      "explain": "丢弃策略是业务决策：排障日志通常保留最新、覆盖最旧；审计日志不能丢，应阻塞或落盘。无上限扩容只是把内存风险推迟到 OOM。"
    }
  ],
  "exercises": [
    {
      "id": "b-lru-ex-1",
      "kind": "code",
      "title": "环形缓冲 + LRU",
      "brief": "实现两个结构。<code>createRingBuffer(capacity)</code> 返回 <code>{ push, read, available, size }</code>：容量必须为正整数；满时 <code>push</code> 覆盖最旧元素；<code>read</code> 按写入顺序返回未读元素，空时返回 <code>undefined</code>；<code>available()</code> 返回当前可读数量，<code>size()</code> 返回固定容量。<br><code>createLRU(capacity)</code> 返回 <code>{ get, put, keys }</code>：<code>get</code> 命中后刷新最近使用并返回值，未命中返回 <code>undefined</code>；<code>put</code> 超出容量时淘汰最久未用；<code>keys()</code> 按最近使用到最久未用排序。",
      "hint": "环形缓冲用 count 区分满与空；LRU 用 Map 定位节点，再用双向链表的头尾维护顺序，淘汰 tail.prev。",
      "starter": "function createRingBuffer(capacity) {\n  return {\n    push() {},\n    read() { return undefined; },\n    available() { return 0; },\n    size() { return 0; }\n  };\n}\n\nfunction createLRU(capacity) {\n  return {\n    get() { return undefined; },\n    put() {},\n    keys() { return []; }\n  };\n}",
      "solution": "function createRingBuffer(capacity) {\n  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_CAPACITY');\n  const slots = new Array(capacity);\n  let readIndex = 0;\n  let writeIndex = 0;\n  let count = 0;\n  return {\n    push(value) {\n      slots[writeIndex] = value;\n      writeIndex = (writeIndex + 1) % capacity;\n      if (count === capacity) readIndex = (readIndex + 1) % capacity;\n      else count += 1;\n    },\n    read() {\n      if (count === 0) return undefined;\n      const value = slots[readIndex];\n      readIndex = (readIndex + 1) % capacity;\n      count -= 1;\n      return value;\n    },\n    available() {\n      return count;\n    },\n    size() {\n      return capacity;\n    }\n  };\n}\n\nfunction createLRU(capacity) {\n  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_CAPACITY');\n  const map = new Map();\n  const head = { prev: null, next: null };\n  const tail = { prev: null, next: null };\n  head.next = tail;\n  tail.prev = head;\n  const detach = (node) => {\n    node.prev.next = node.next;\n    node.next.prev = node.prev;\n  };\n  const attachFront = (node) => {\n    node.next = head.next;\n    node.prev = head;\n    head.next.prev = node;\n    head.next = node;\n  };\n  const moveToFront = (node) => {\n    detach(node);\n    attachFront(node);\n  };\n  return {\n    get(key) {\n      const node = map.get(key);\n      if (!node) return undefined;\n      moveToFront(node);\n      return node.value;\n    },\n    put(key, value) {\n      const existing = map.get(key);\n      if (existing) {\n        existing.value = value;\n        moveToFront(existing);\n        return;\n      }\n      const node = { key, value, prev: null, next: null };\n      map.set(key, node);\n      attachFront(node);\n      if (map.size > capacity) {\n        const oldest = tail.prev;\n        detach(oldest);\n        map.delete(oldest.key);\n      }\n    },\n    keys() {\n      const result = [];\n      let node = head.next;\n      while (node !== tail) {\n        result.push(node.key);\n        node = node.next;\n      }\n      return result;\n    }\n  };\n}",
      "tests": [
        {
          "name": "环形缓冲覆盖最旧",
          "code": "const buffer = createRingBuffer(3);\nfor (const value of [1, 2, 3, 4]) buffer.push(value);\nassert.equal(buffer.read(), 2);\nassert.equal(buffer.read(), 3);\nassert.equal(buffer.read(), 4);\nassert.equal(buffer.read(), undefined);"
        },
        {
          "name": "读写交错保持顺序",
          "code": "const buffer = createRingBuffer(4);\nbuffer.push(1);\nbuffer.push(2);\nbuffer.push(3);\nassert.equal(buffer.read(), 1);\nassert.equal(buffer.read(), 2);\nbuffer.push(4);\nbuffer.push(5);\nassert.equal(buffer.read(), 3);\nassert.equal(buffer.read(), 4);\nassert.equal(buffer.read(), 5);"
        },
        {
          "name": "空缓冲读取",
          "code": "const buffer = createRingBuffer(2);\nassert.equal(buffer.read(), undefined);\nassert.equal(buffer.available(), 0);\nassert.equal(buffer.size(), 2);"
        },
        {
          "name": "容量为 1 时覆盖",
          "code": "const buffer = createRingBuffer(1);\nbuffer.push(1);\nbuffer.push(2);\nassert.equal(buffer.available(), 1);\nassert.equal(buffer.read(), 2);\nassert.equal(buffer.read(), undefined);"
        },
        {
          "name": "available 与 size 语义",
          "code": "const buffer = createRingBuffer(3);\nbuffer.push('a');\nbuffer.push('b');\nassert.equal(buffer.available(), 2);\nassert.equal(buffer.size(), 3);\nbuffer.read();\nassert.equal(buffer.available(), 1);\nassert.equal(buffer.size(), 3);"
        },
        {
          "name": "LRU 命中刷新顺序",
          "code": "const lru = createLRU(2);\nlru.put('a', 1);\nlru.put('b', 2);\nassert.equal(lru.get('a'), 1);\nlru.put('c', 3);\nassert.deepEqual(lru.keys(), ['c', 'a']);\nassert.equal(lru.get('b'), undefined);"
        },
        {
          "name": "LRU 淘汰最久未用",
          "code": "const lru = createLRU(3);\nlru.put('a', 1);\nlru.put('b', 2);\nlru.put('c', 3);\nassert.equal(lru.get('a'), 1);\nlru.put('d', 4);\nassert.deepEqual(lru.keys(), ['d', 'a', 'c']);\nassert.equal(lru.get('b'), undefined);"
        },
        {
          "name": "更新已有 key 也刷新",
          "code": "const lru = createLRU(2);\nlru.put('a', 1);\nlru.put('b', 2);\nlru.put('a', 3);\nassert.equal(lru.get('a'), 3);\nassert.deepEqual(lru.keys(), ['a', 'b']);\nlru.put('c', 4);\nassert.equal(lru.get('b'), undefined);\nassert.deepEqual(lru.keys(), ['c', 'a']);"
        },
        {
          "name": "容量为 1 的 LRU",
          "code": "const lru = createLRU(1);\nlru.put('a', 1);\nlru.put('b', 2);\nassert.equal(lru.get('a'), undefined);\nassert.equal(lru.get('b'), 2);\nassert.deepEqual(lru.keys(), ['b']);"
        },
        {
          "name": "大量操作保持容量上限",
          "code": "const lru = createLRU(100);\nfor (let i = 0; i < 200; i += 1) lru.put('k' + i, i);\nassert.equal(lru.keys().length, 100);\nfor (let i = 100; i < 200; i += 1) assert.equal(lru.get('k' + i), i);\nassert.equal(lru.get('k0'), undefined);\nassert.deepEqual(lru.keys().slice(0, 2), ['k199', 'k198']);"
        }
      ]
    }
  ]
};
