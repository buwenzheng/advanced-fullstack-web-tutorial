export const e1Datascale = {
  id: 'e1-datascale',
  title: '数据复制、分片与读写分离',
  subtitle: '主从复制、复制延迟、read-your-writes、分片键、一致性哈希与分布式 ID。',
  duration: 85,
  status: 'ready',
  objectives: [
    '解释主从复制、复制延迟与 read-your-writes，并选择补救手段。',
    '选择分片键，识别热点、跨分片查询与重分片代价。',
    '设计分布式 ID 与一致性哈希环，解释增删节点的最小迁移。',
    '对读写分离与分片做取舍，知道什么时候不该分片。'
  ],
  keywords: ['主从复制', '复制延迟', 'read-your-writes', '读写分离', '分片键', '一致性哈希', '虚拟节点', '分布式 ID', 'Snowflake', '重分片'],
  blocks: [
    {
      type: 'analogy',
      title: '前端缓存与副本',
      html: '前端把用户资料缓存在内存里，用户改了昵称，页面立即更新本地状态，但另一个标签页或另一台设备可能还显示旧昵称。缓存副本提升了读取速度，代价是「你看到的不一定是最新」。数据库的读副本也是同一回事：写主库、同步到从库、读请求打到从库，复制需要时间。<br>差别在于用户预期：前端可以靠「保存成功」提示掩盖几百毫秒的延迟；后端接口如果承诺「写入后立刻能读到」，就必须处理复制延迟。读写分离不是免费的性能，它把「最新」变成了需要设计的一致性属性。'
    },
    {
      type: 'text',
      title: '主从复制：延迟从哪里来',
      html: '主从复制的常见形态是：写请求到主库，主库写日志（binlog/WAL），从库拉取并重放日志，之后才能读到新数据。同步复制要等从库确认，延迟高但切换时不易丢数据；异步复制主库提交即返回，延迟低，但主库崩溃时可能丢失尚未复制的写。<br>复制延迟不是恒定值：大事务、批量更新、从库重放单线程、网络抖动、从库负载高都会让延迟从毫秒级涨到分钟级。延迟还可能是「跳变」的：从库追上了，但某个大事务又把它拖回去。监控复制延迟要看分位数与最坏值，不能只看平均值。故障切换时还要面对「新主库是不是最新的」这个问题——异步复制下，答案通常是否定的。'
    },
    {
      type: 'flow',
      title: '写主 → 复制 → 读从：延迟窗口在哪',
      steps: [
        { name: '写主库', detail: '主库提交事务并返回成功。失败表现：业务收到成功，但日志还未落盘（取决于持久化配置）。' },
        { name: '生成复制日志', detail: '主库把变更写入 binlog/WAL。失败表现：日志写入与事务提交不同步，崩溃后丢失。' },
        { name: '从库拉取', detail: '从库通过网络拉取日志。失败表现：网络抖动或大事务导致积压。' },
        { name: '从库重放', detail: '从库应用变更，完成后才可读。失败表现：重放线程成为瓶颈，延迟持续上升。' },
        { name: '读请求', detail: '读从库可能读到旧值。失败表现：用户刚保存就刷新，看不到自己的修改。' },
        { name: '延迟监控', detail: '记录复制位点差与时间差。失败表现：只看平均值，错过长尾延迟。' }
      ]
    },
    {
      type: 'code',
      title: '一致性哈希环',
      lang: 'javascript',
      code: `function createHashRing(nodes, { virtualNodes = 100, hash = fnv1a } = {}) {
  const ring = [];              // { position, node }，按 position 排序
  const members = new Set();

  function addNode(node) {
    if (members.has(node)) return;        // 幂等
    members.add(node);
    for (let i = 0; i < virtualNodes; i += 1) {
      ring.push({ position: hash(\`\${node}#\${i}\`), node });
    }
    ring.sort((a, b) => a.position - b.position);
  }

  function getNode(key) {
    if (ring.length === 0) throw new Error('EMPTY_RING');
    const target = hash(key);
    // 二分找第一个 position >= target 的虚拟节点；找不到则回绕到环首
    let low = 0;
    let high = ring.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (ring[mid].position < target) low = mid + 1;
      else high = mid;
    }
    if (ring[low].position < target) low = 0;
    return ring[low].node;
  }

  nodes.forEach(addNode);
  return {
    getNode,
    addNode,
    removeNode(node) {
      if (!members.delete(node)) return;
      for (let i = ring.length - 1; i >= 0; i -= 1) {
        if (ring[i].node === node) ring.splice(i, 1);
      }
    },
    get nodes() { return [...members].sort(); },
    get size() { return ring.length; },
  };
}`,
      note: '虚拟节点让每个物理节点在环上出现多次，缓解数据倾斜；增加一个节点只接管相邻区间的 key，其他节点的映射不变。哈希函数必须固定且两端一致，否则同一 key 会被映射到不同节点。'
    },
    {
      type: 'table',
      title: '分片键候选与代价',
      head: ['分片键', '优点', '风险', '适用查询'],
      rows: [
        ['用户/租户 ID', '天然按业务隔离，跨分片查询少', '大租户可能形成热点', '按用户查链接、查统计'],
        ['链接 code 哈希', '跳转请求均匀分布，单链接不热点', '按用户列出全部链接要跨分片', '短链跳转'],
        ['时间 + 自增 ID', '范围查询友好，写入集中', '最新数据集中在一个分片', '日志、按时间归档'],
        ['随机 UUID', '写入均匀，无中心热点', '范围查询与分页代价高', '键值型点查']
      ],
      note: '没有对所有查询都最优的分片键。选择时先列出高频查询，再看哪个键能覆盖大多数查询；跨分片查询应尽量移到读模型或异步聚合。'
    },
    {
      type: 'code',
      title: '分布式 ID：时间戳 + 节点 + 序列',
      lang: 'javascript',
      code: `const EPOCH = 1700000000000n;
const NODE_BITS = 10n;
const SEQUENCE_BITS = 12n;

function nextId(timestampMs, nodeId, sequence) {
  const sinceEpoch = BigInt(timestampMs) - EPOCH;
  return (sinceEpoch << (NODE_BITS + SEQUENCE_BITS))
    | (BigInt(nodeId) << SEQUENCE_BITS)
    | BigInt(sequence);
}

// 同一毫秒内 sequence 递增；用尽则等待下一毫秒
function nextSequence(state, timestampMs) {
  if (timestampMs === state.lastMs) {
    state.sequence = (state.sequence + 1) & 0xfff;
    if (state.sequence === 0) {
      // 实际实现应等待到下一毫秒，或直接拒绝并让调用方重试
      throw new Error('SEQUENCE_EXHAUSTED');
    }
  } else if (timestampMs < state.lastMs) {
    throw new Error('CLOCK_BACKWARDS');   // 时钟回拨：拒绝或使用逻辑时钟
  } else {
    state.lastMs = timestampMs;
    state.sequence = 0;
  }
  return nextId(timestampMs, state.nodeId, state.sequence);
}`,
      note: '高位是时间戳，所以 ID 趋势递增，B+tree 插入更友好；节点位避免不同机器冲突；序列位支持同毫秒并发。代价是依赖时钟，必须显式处理回拨与序列耗尽。ID 的具体位宽可以按业务调整，结构思想不变。'
    },
    {
      type: 'pitfall',
      title: '自增 ID 分片热点与跨分片查询',
      html: '现象：分片后写入仍然集中在一个分片；按用户查询要扫全部分片；分页接口越来越慢；重分片期间数据不一致；从库延迟导致用户看不到刚创建的记录。<br>原因：用自增 ID 取模分片，新数据永远落在最新分片；分片键与高频查询条件不匹配，只能广播查询；分页依赖全局排序，跨分片无法高效实现；重分片没有双写与校验；读写分离后立刻读从库。<br>发现方式：统计每个分片的 QPS 与数据量；记录跨分片查询比例；观察分片键与查询条件的匹配度；测量复制延迟分位数。<br>修复：选择高基数且与查询匹配的分片键；把跨分片聚合移到读模型；用一致性哈希或预分片降低重分片成本；写后读走主库或带位点等待。<br>预防：分片前先做索引与缓存优化；为分片键变更设计迁移路径；把「分片后仍可能更慢」写进方案评审。'
    },
    {
      type: 'steps',
      title: '分片方案与重分片 playbook',
      steps: [
        { title: '列出高频查询与数据增长', html: '统计查询模式、QPS、数据量与增长速率。观察点：哪些查询不带候选分片键。' },
        { title: '选键并验证分布', html: '用真实数据采样，计算分片份额与热点。观察点：最大分片是否超过总容量的 1.5 倍。' },
        { title: '预分片与双写', html: '新老结构双写，读仍走旧路径。观察点：双写失败是否有补偿与对账。' },
        { title: '迁移与校验', html: '按范围迁移历史数据，逐段校验数量与校验和。观察点：迁移期间延迟与错误率是否可接受。' },
        { title: '切读与回滚预案', html: '灰度切换读流量，保留快速回滚开关。观察点：切读后错误率与 P99 是否稳定。' },
        { title: '下线旧路径并监控', html: '确认无回滚需求后停止双写，保留归档。观察点：分片间数据量与 QPS 是否持续均衡。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：read-your-writes 与会话一致性',
      html: 'read-your-writes 是最小的一致性保证：用户自己写的内容，自己后续读必须能看到。它比全局强一致弱得多，但对交互体验至关重要——用户不能接受「刚保存就消失」。在读写分离架构里，写走主库、读走从库，复制延迟会直接破坏这个保证。<br>常见补救有四种。第一，粘主：同一会话的读在写入后的一段时间内强制走主库，简单但会占用主库容量。第二，位点等待：写操作返回一个复制位点或时间戳，后续读带上它，从库等到位点追平再返回；语义精确，但需要把位点透传给客户端或会话存储。第三，版本号比较：读到的记录带版本，客户端发现版本落后就重试或回主库。第四，产品层兜底：写入成功后本地先展示，后台确认后再刷新，接受短暂不一致。<br>这些手段都有代价：粘主牺牲读扩展性，位点等待增加延迟，版本号需要接口支持。选择取决于业务承诺：个人资料页适合粘主或位点等待；公开的短链跳转根本不需要 read-your-writes，因为它读的是不可变的目标 URL。把「哪些读需要最新」列清楚，比笼统地说「我们的系统最终一致」更有用。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「什么时候不该分片」回答：单表还能通过索引、缓存、读写分离与归档撑住时，不应分片。分片会带来跨分片查询、分布式事务、重分片与运维复杂度；先证明瓶颈在数据量或写入，而不是查询写法。<br>「分片后怎么做聚合查询」回答：优先把聚合移到读模型或离线任务；按分片键预聚合；需要实时全局结果时使用汇总表或近似结构；避免在线跨分片 JOIN 与全局分页。最后补一句「分片键的选择决定了哪些查询会变贵」。'
    }
  ],
  checks: [
    {
      id: 'e1-datascale-check-1',
      kind: 'mcq',
      type: 'single',
      tag: 'read-your-writes',
      prompt: '用户保存个人资料后立即刷新页面，读请求被路由到从库，看到了旧昵称。最合适的修复是什么？',
      question: '用户保存个人资料后立即刷新页面，读请求被路由到从库，看到了旧昵称。最合适的修复是什么？',
      options: [
        { text: '写入后短时间内的读走主库，或带复制位点等待', correct: true },
        { text: '关闭读写分离，所有请求都走主库', correct: false },
        { text: '把从库的复制延迟调成 0', correct: false },
        { text: '让前端自己缓存昵称，永远不读后端', correct: false }
      ],
      explain: '复制延迟无法消除，只能管理。粘主或位点等待是针对性修复；全部走主库会放弃读扩展性，前端缓存会制造更多不一致。'
    },
    {
      id: 'e1-datascale-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '分片键',
      prompt: '一个好的分片键通常应满足哪些条件？',
      question: '一个好的分片键通常应满足哪些条件？',
      options: [
        { text: '基数高、分布均匀，避免单分片热点', correct: true },
        { text: '大多数高频查询能带上这个键', correct: true },
        { text: '值稳定，不会频繁变更导致跨分片迁移', correct: true },
        { text: '必须是全局自增 ID，方便排序', correct: false },
        { text: '必须让所有跨分片 JOIN 都能高效执行', correct: false }
      ],
      explain: '分片键要兼顾分布、查询匹配与稳定性。自增 ID 会造成写入热点；跨分片 JOIN 本来就应该避免或移到读模型。'
    },
    {
      id: 'e1-datascale-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '分布式 ID',
      prompt: '把分布式 ID 设计成「时间戳 + 节点 + 序列」，最主要的收益是什么？',
      question: '把分布式 ID 设计成「时间戳 + 节点 + 序列」，最主要的收益是什么？',
      options: [
        { text: '趋势递增，索引插入友好，同时避免节点冲突', correct: true },
        { text: '完全不依赖时钟，永远不会重复', correct: false },
        { text: 'ID 长度固定，可以替代所有业务主键', correct: false },
        { text: '可以保证跨节点严格按时间排序', correct: false }
      ],
      explain: '趋势递增来自高位时间戳，节点位避免冲突。但它依赖时钟，需要处理回拨；也不能保证跨节点严格因果顺序。'
    }
  ],
  exercises: [
    {
      id: 'e1-datascale-ex-1',
      kind: 'code',
      title: '一致性哈希环',
      brief: '实现 createHashRing(nodes, { virtualNodes = 100, hash = fnv1a })。每个物理节点映射 virtualNodes 个虚拟节点，位置为 hash(node + "#" + replicaIndex) % 2^32。返回 { getNode, addNode, removeNode, nodes, size }：getNode(key) 二分查找第一个位置 >= hash(key) 的虚拟节点，找不到则回绕到环首；空环抛 Error("EMPTY_RING")。addNode/removeNode 增量更新，重复调用幂等。nodes 返回去重排序后的物理节点，size 返回环上虚拟节点总数。',
      hint: '先实现 utf8Bytes 与 fnv1a；环数组按 position 排序。删除节点时只移除该节点的虚拟节点，不要重建整个环。',
      starter: `function utf8Bytes(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createHashRing(nodes, options = {}) {
  const virtualNodes = options.virtualNodes ?? 100;
  const hash = options.hash ?? fnv1a;
  let members = [...nodes];

  function build() {
    const ring = members.map((node) => ({ position: hash(node), node }));
    ring.sort((a, b) => a.position - b.position);
    return ring;
  }

  return {
    getNode(key) {
      const ring = build();
      if (ring.length === 0) throw new Error('EMPTY_RING');
      const target = hash(key);
      return ring.find((entry) => entry.position >= target).node;
    },
    addNode(node) {
      members.push(node);
    },
    removeNode(node) {
      members = members.filter((item) => item !== node);
    },
    get nodes() {
      return [...members].sort();
    },
    get size() {
      return members.length;
    },
  };
}`,
      solution: `function utf8Bytes(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createHashRing(nodes, options = {}) {
  const virtualNodes = options.virtualNodes ?? 100;
  const hash = options.hash ?? fnv1a;
  const ring = [];
  const members = new Set();

  function addNode(node) {
    if (members.has(node)) return;
    members.add(node);
    for (let i = 0; i < virtualNodes; i += 1) {
      ring.push({ position: hash(\`\${node}#\${i}\`), node });
    }
    ring.sort((a, b) => a.position - b.position);
  }

  function removeNode(node) {
    if (!members.delete(node)) return;
    for (let i = ring.length - 1; i >= 0; i -= 1) {
      if (ring[i].node === node) ring.splice(i, 1);
    }
  }

  function getNode(key) {
    if (ring.length === 0) throw new Error('EMPTY_RING');
    const target = hash(key);
    let low = 0;
    let high = ring.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (ring[mid].position < target) low = mid + 1;
      else high = mid;
    }
    if (ring[low].position < target) low = 0;
    return ring[low].node;
  }

  nodes.forEach(addNode);
  return {
    getNode,
    addNode,
    removeNode,
    get nodes() {
      return [...members].sort();
    },
    get size() {
      return ring.length;
    },
  };
}`,
      tests: [
        {
          name: '同一 key 稳定映射',
          code: `const ring = createHashRing(['node-1', 'node-2', 'node-3'], { virtualNodes: 50 });
const first = ring.getNode('link:42');
assert.ok(['node-1', 'node-2', 'node-3'].includes(first));
assert.equal(ring.getNode('link:42'), first);
assert.equal(ring.getNode('link:42'), first);
assert.deepEqual(ring.nodes, ['node-1', 'node-2', 'node-3']);
assert.equal(ring.size, 150);`
        },
        {
          name: '五节点份额在 10% 到 30% 之间',
          code: `const ring = createHashRing(['node-1', 'node-2', 'node-3', 'node-4', 'node-5'], { virtualNodes: 100 });
const counts = { 'node-1': 0, 'node-2': 0, 'node-3': 0, 'node-4': 0, 'node-5': 0 };
for (let i = 0; i < 1000; i += 1) {
  counts[ring.getNode('link:' + i)] += 1;
}
for (const node of Object.keys(counts)) {
  assert.ok(counts[node] >= 100, node + ' 份额过低: ' + counts[node]);
  assert.ok(counts[node] <= 300, node + ' 份额过高: ' + counts[node]);
}`
        },
        {
          name: '增加节点只接管新节点区间',
          code: `const nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
const keys = Array.from({ length: 500 }, (_, i) => 'link:' + i);
const before = createHashRing(nodes, { virtualNodes: 100 });
const after = createHashRing([...nodes, 'node-6'], { virtualNodes: 100 });
let stay = 0;
for (const key of keys) {
  const oldNode = before.getNode(key);
  const newNode = after.getNode(key);
  assert.ok(newNode === oldNode || newNode === 'node-6', key + ' 迁移到了意外的节点');
  if (newNode === oldNode) stay += 1;
}
assert.ok(stay > 250, '应有一半以上的 key 保持不动');
assert.ok(stay < keys.length, '新节点应接管一部分 key');`
        },
        {
          name: '删除节点只迁移该节点的 key',
          code: `const nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
const keys = Array.from({ length: 500 }, (_, i) => 'link:' + i);
const before = createHashRing(nodes, { virtualNodes: 100 });
const after = createHashRing(nodes.filter((node) => node !== 'node-3'), { virtualNodes: 100 });
for (const key of keys) {
  if (before.getNode(key) === 'node-3') {
    assert.ok(after.getNode(key) !== 'node-3', '被删除节点的 key 应迁移到其他节点');
  } else {
    assert.equal(after.getNode(key), before.getNode(key));
  }
}
assert.equal(after.size, 400);`
        },
        {
          name: '空环抛 EMPTY_RING',
          code: `const ring = createHashRing([], { virtualNodes: 10 });
let error = null;
try {
  ring.getNode('link:1');
} catch (err) {
  error = err;
}
assert.ok(error);
assert.equal(error.message, 'EMPTY_RING');`
        },
        {
          name: '虚拟节点越多份额越均匀',
          code: `function maxShare(ring) {
  const counts = {};
  for (let i = 0; i < 1000; i += 1) {
    const node = ring.getNode('link:' + i);
    counts[node] = (counts[node] || 0) + 1;
  }
  return Math.max(...Object.values(counts));
}
const nodes = ['node-1', 'node-2', 'node-3', 'node-4', 'node-5'];
const single = maxShare(createHashRing(nodes, { virtualNodes: 1 }));
const many = maxShare(createHashRing(nodes, { virtualNodes: 100 }));
assert.ok(many < single, '虚拟节点增加后最大份额应下降: ' + single + ' -> ' + many);`
        },
        {
          name: '重复添加删除幂等',
          code: `const ring = createHashRing(['node-1', 'node-2'], { virtualNodes: 10 });
const before = ring.getNode('link:7');
assert.equal(ring.size, 20);
ring.addNode('node-1');
assert.equal(ring.size, 20);
assert.deepEqual(ring.nodes, ['node-1', 'node-2']);
ring.removeNode('node-9');
assert.equal(ring.size, 20);
assert.equal(ring.getNode('link:7'), before);`
        }
      ]
    },
    {
      id: 'e1-datascale-ex-2',
      kind: 'design',
      title: 'LinkHub 分片方案',
      brief: '为 LinkHub 的链接表与点击统计设计分片与读写分离方案，说明分片键、跨分片查询与重分片路径。',
      checklist: [
        '分片键：为链接表与统计表各选一个键，并说明理由',
        '热点评估：用真实或估算数据说明最大分片份额',
        '跨分片查询：列出会变贵的查询及替代方案',
        '分布式 ID：说明链接 ID 或事件 ID 的生成方式与时钟处理',
        '重分片路径：双写、迁移、校验、切读、回滚',
        '读写分离：哪些读可以走从库，哪些必须走主库',
        '一致性：写后读如何满足 read-your-writes',
        '运维成本：备份、扩容、监控与故障切换',
        '不分的理由：在什么规模下应暂缓分片'
      ],
      reference: '链接表按 tenant/user 分片，避免单链接成为热点；跳转按 code 哈希路由，缓存命中后不回源；统计事件按 link_id 分片，读模型按「日期 + link_id」聚合，避免在线跨分片 JOIN。分布式 ID 用时间戳 + 节点 + 序列，处理时钟回拨与序列耗尽。重分片先预分片、再双写与迁移、逐段校验后灰度切读，保留回滚开关。读多写少的公开跳转可读从库；用户查看「我的链接」在写入后短时间粘主。分片前先用索引、缓存、读写分离与归档验证瓶颈；若单表仍能在目标 P99 内服务，暂不分片。'
    }
  ]
};
