export const s1L3 = {
  id: 's1-l3',
  title: '事务、隔离级别与 MVCC',
  subtitle: 'ACID、四类异常、隔离级别、MVCC 快照、行锁与连接池上限。',
  duration: 80,
  status: 'ready',
  objectives: [
    '用 LinkHub 场景解释 ACID，区分脏读、不可重复读、幻读与丢失更新，并判断一个现象属于哪一类。',
    '说明标准隔离级别与 PostgreSQL/MySQL InnoDB 默认值的差异，用 MVCC 的快照读与当前读解释并发行为。',
    '为创建短链、点击跳转、更新链接选择事务边界，说明哪些操作必须同事务、哪些应该异步。',
    '实现版本号 + 比较并交换的乐观更新与有上限重试，并诊断长事务与连接池耗尽。'
  ],
  keywords: ['ACID', '隔离级别', 'MVCC', '快照读', '当前读', '丢失更新', '乐观并发', '连接池'],
  blocks: [
    {
      type: 'analogy',
      title: '共享文档的同时编辑',
      html: '两个人同时打开同一份在线文档：A 在第三段加了一句话，B 在第五段改了措辞。如果后保存的人用整份文档覆盖，A 的修改就消失了；如果系统在保存时比较版本号并提示冲突，双方就能基于最新版本合并。<br>数据库里的并发写入是同一个问题：快照决定你看到的是哪个版本，锁决定谁能先写，冲突检测决定后写的人要不要重试。区别在于数据库事务可以跨多行、多表，还有自动回滚和重试机制；文档编辑器的「合并」通常要人参与，数据库的冲突处理必须由代码给出上限与失败行为。'
    },
    {
      type: 'text',
      title: 'ACID 与四类异常',
      html: '事务把多个操作打包成一个执行单元。原子性（Atomicity）保证失败时全部回滚；一致性（Consistency）要求提交时约束与业务不变量成立；隔离性（Isolation）决定并发事务能看到彼此的哪些中间状态；持久性（Durability）保证提交后的数据在崩溃后仍然存在。<br>四类常见异常：脏读是读到了别人未提交的写入；不可重复读是同一事务内两次读同一行得到不同值；幻读是同一范围查询的行集合发生变化；丢失更新是两个事务都基于旧值写回，后提交的覆盖先提交的。<br>LinkHub 的例子：两个编辑者都读到 <code>version=1</code>，各自改完写回，先提交的修改会消失。ACID 不会自动阻止这种应用层读改写，需要锁、版本号或串行化冲突检测。'
    },
    {
      type: 'table',
      title: '隔离级别 vs 异常',
      head: ['隔离级别', '脏读', '不可重复读', '幻读', '典型说明'],
      rows: [
        ['READ UNCOMMITTED', '可能', '可能', '可能', '标准允许脏读；具体实现可能更严格'],
        ['READ COMMITTED', '不会', '可能', '可能', 'PostgreSQL 默认；每条语句看最新已提交快照'],
        ['REPEATABLE READ', '不会', '不会', '标准允许，实现可能减少', 'MySQL InnoDB 默认；行为取决于语句与版本'],
        ['SERIALIZABLE', '不会', '不会', '不会', '冲突时可能中止事务，调用方必须重试']
      ]
    },
    {
      type: 'flow',
      title: 'MVCC 快照读与当前读',
      steps: [
        { name: '开始事务，取得快照', detail: '事务开始时确定可见范围；READ COMMITTED 下每条语句取新快照，REPEATABLE READ 下事务内复用快照。失败表现：以为同一事务里两次读一定一致。' },
        { name: '普通 SELECT 走快照', detail: '沿版本链找到对当前事务可见的版本，不加行锁，读不被写阻塞。失败表现：把快照读当成最新值，页面展示旧数据却没有提示。' },
        { name: 'UPDATE / DELETE 走当前读', detail: '写操作读取最新已提交版本并申请行锁；锁被占用时等待或超时。失败表现：高并发更新排队，接口 P99 上升。' },
        { name: '写入新版本，提交后可见', detail: '更新产生新版本，旧版本保留给仍在读的事务；提交后新版本才对后续快照可见。失败表现：长事务让旧版本无法清理，表与 undo 膨胀。' },
        { name: '冲突与重试', detail: '写写冲突、唯一约束冲突或序列化失败会中止事务；应用要有上限地重试或向用户报冲突。失败表现：无限重试，或把业务错误也当成冲突重试。' }
      ]
    },
    {
      type: 'code',
      title: '创建短链 + 审计同事务',
      lang: 'javascript',
      code: `// client 必须是同一个连接：连接池的不同连接之间不共享事务
async function createLink(client, input) {
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      await client.query('BEGIN');

      const inserted = await client.query(
        'INSERT INTO links (user_id, slug, target_url) VALUES ($1, $2, $3) RETURNING id, slug',
        [input.userId, input.slug, input.targetUrl]
      );

      await client.query(
        'INSERT INTO audit_logs (actor_id, action, entity_id) VALUES ($1, $2, $3)',
        [input.userId, 'link.create', inserted.rows[0].id]
      );

      await client.query('COMMIT');
      return inserted.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      // 23505 唯一冲突、40001 序列化失败可以重试；业务校验错误不重试
      const retryable = error.code === '23505' || error.code === '40001';
      if (!retryable || attempt === 2) throw error;
    }
  }
}`,
      note: '不要在事务里调用第三方 HTTP 接口或发消息：网络等待期间连接、锁与快照都被占着。审计记录与链接必须同生共死，所以它们留在同一个事务里。'
    },
    {
      type: 'code',
      title: '乐观更新：版本号 + 比较并交换',
      lang: 'javascript',
      code: `async function updateWithRetry(db, id, targetUrl, { maxRetries = 3 } = {}) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const found = await db.query(
      'SELECT id, target_url, version FROM links WHERE id = $1',
      [id]
    );
    if (found.rows.length === 0) throw new Error('link not found');

    const current = found.rows[0];
    // 对应 SQL: UPDATE links SET target_url = $2, version = version + 1
    //           WHERE id = $1 AND version = $3; rowCount = 0 即冲突
    const result = await db.query(
      'UPDATE links SET target_url = $2, version = version + 1 WHERE id = $1 AND version = $3',
      [id, targetUrl, current.version]
    );

    if (result.rowCount === 1) {
      return { ...current, target_url: targetUrl, version: current.version + 1 };
    }
    // 冲突：不要拿旧快照再写一次；循环会重新读取最新版本
  }
  throw new Error('conflict after retries');
}`,
      note: '这段代码只演示机制，错误类型、等待策略与重试上限由业务决定。练习中会要求把冲突耗尽变成可识别的 ConflictError，并证明两个并发更新都不会丢。'
    },
    {
      type: 'pitfall',
      title: '长事务与连接池',
      html: '现象：接口 P99 从 200ms 涨到数秒，连接池等待数持续升高，数据库出现大量 <code>idle in transaction</code> 与锁等待。<br>原因：事务里调用了第三方 HTTP 接口或发送消息，连接与锁在等待网络时一直被占用；连接池有上限，慢事务把池占满后，其他请求只能排队，超时后的重试又放大压力。<br>发现方式：看 <code>pg_stat_activity</code> 的 state 与 query_start，结合连接池的等待数、获取连接耗时和事务时长分布；在 APM 里找事务内跨度最长的外部调用。<br>修复：先把外部调用移出事务、缩短事务、设置语句与锁超时；止血可以终止 <code>idle in transaction</code> 会话，但根治要改代码边界。<br>预防：代码评审禁止在事务内做网络调用；为事务时长与池等待设告警；容量评估用持有时长与并发量推导，而不是只调大池。'
    },
    {
      type: 'steps',
      title: '复现丢失更新',
      steps: [
        { title: '准备一张计数表', html: '创建 <code>counters(id, value)</code>，插入 <code>id=1, value=0</code>。这是最小复现，不需要业务表。' },
        { title: '会话 A 读旧值', html: 'A 执行 <code>BEGIN; SELECT value FROM counters WHERE id = 1;</code> 读到 0，先不提交。观察点：A 持有事务与快照。' },
        { title: '会话 B 也读旧值', html: 'B 在另一个连接执行同样的查询，也读到 0。观察点：普通读不阻塞，两个会话都以为当前值是 0。' },
        { title: 'A 写回并提交', html: 'A 执行 <code>UPDATE counters SET value = 1 WHERE id = 1; COMMIT;</code>。观察点：A 成功，表里是 1。' },
        { title: 'B 按旧值写回', html: 'B 执行 <code>UPDATE counters SET value = 1 WHERE id = 1; COMMIT;</code>。观察点：最终仍是 1，A 的更新被覆盖，这就是丢失更新。' },
        { title: '加版本列后重试', html: '给表加 <code>version</code>，两个会话都用 <code>UPDATE ... WHERE id = 1 AND version = ?</code>；失败方重新读取最新值再写。观察点：最终 <code>value=2</code>，<code>version</code> 递增两次。' }
      ]
    },
    {
      type: 'compare',
      title: '乐观 vs 悲观 vs 串行化',
      cols: [
        {
          title: '乐观并发（版本号 / CAS）',
          items: ['冲突处理：写入时比较版本，失败重试', '锁与等待：读取不加锁，写入只锁一瞬', '重试成本：冲突多时重试放大', '吞吐：低冲突场景高', '适用：编辑表单、低频更新、读多写少', '失败模式：重试耗尽、旧快照反复失败']
        },
        {
          title: '悲观锁（SELECT ... FOR UPDATE）',
          items: ['冲突处理：写前先锁住行', '锁与等待：等待者排队，可能超时或死锁', '重试成本：通常不重试，但等待成本高', '吞吐：高冲突场景稳定但并发受限', '适用：库存扣减、余额、强顺序操作', '失败模式：锁等待、死锁、连接被占住']
        },
        {
          title: '串行化（SERIALIZABLE）',
          items: ['冲突处理：数据库检测危险交错并中止事务', '锁与等待：依赖实现，可能有更多冲突', '重试成本：必须处理序列化失败', '吞吐：冲突高时下降明显', '适用：跨多行不变量、复杂事务', '失败模式：中止率上升、重试风暴']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：连接池算术',
      html: '连接池的容量可以由「并发占用量约等于到达率乘以平均持有时长」估算。假设每个请求平均持有连接 20ms、峰值 500 QPS，那么平均同时占用约 10 条连接；如果事务里多了一次 200ms 的外部调用，持有时长变成 220ms，占用就接近 110 条，20 条连接的池会立刻排队。<br>这就是为什么先缩短事务比先调大池更有效。池的上限还要乘以应用实例数、后台任务与只读副本，并低于数据库允许的最大连接数；否则只是把排队从应用搬到数据库。容量评估要用峰值 QPS、P99 持有时长与等待超时一起算，再留出故障时的余量。上述数字是示例假设，不是实测基准。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '面试常问「什么时候该用 SERIALIZABLE」。好的回答不是「最安全」，而是先看业务不变量能否用唯一约束、CHECK、单行条件更新或固定锁顺序表达；能表达就用更低隔离级别加约束与重试，只有在跨多行不变量无法用这些手段保证时才用 SERIALIZABLE，并接受中止与重试成本。<br>「死锁怎么排查」要回答：看数据库的死锁日志与锁等待视图，确认两个事务加锁顺序相反；修复是统一锁顺序、缩短事务、减少一次事务内的行数，并用并发测试复现。只回答「重启数据库」不合格。'
    }
  ],
  checks: [
    {
      id: 's1-l3-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '异常分类',
      prompt: '两个会话都读到 links.clicks = 10，A 写回 11 并提交，B 仍按自己读到的 10 写回 11 并提交，最终值是 11 而不是 12。这属于哪类异常？',
      question: '两个会话都读到 links.clicks = 10，A 写回 11 并提交，B 仍按自己读到的 10 写回 11 并提交，最终值是 11 而不是 12。这属于哪类异常？',
      options: [
        { text: '脏读：B 读到了 A 未提交的数据', correct: false },
        { text: '不可重复读：同一事务内两次读到不同值', correct: false },
        { text: '丢失更新：B 的写入覆盖了 A 已提交的更新', correct: true },
        { text: '幻读：同一范围查询返回了新的行', correct: false }
      ],
      explain: '脏读是读到未提交数据；不可重复读是同一事务内同一行被别的事务改动；幻读是同一范围查询的行集合变化；这里的核心是两次基于旧值的写回导致一次更新消失。提高隔离级别不一定自动消除应用层读改写造成的丢失更新，需要锁、版本号或串行化冲突检测。'
    },
    {
      id: 's1-l3-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: 'MVCC 与隔离级别',
      prompt: '关于隔离级别与 MVCC，以下哪些说法正确？',
      question: '关于隔离级别与 MVCC，以下哪些说法正确？',
      options: [
        { text: 'PostgreSQL 默认隔离级别是 READ COMMITTED', correct: true },
        { text: 'MySQL InnoDB 默认隔离级别是 REPEATABLE READ', correct: true },
        { text: '普通 SELECT 在 MVCC 下读取快照，UPDATE 需要读取当前最新版本并加锁', correct: true },
        { text: '所有数据库的 MVCC 实现与快照时机完全相同', correct: false },
        { text: '只要使用 READ COMMITTED，就不会发生丢失更新', correct: false }
      ],
      explain: '默认级别是两个数据库的已知差异；MVCC 的读路径与写路径不同，写操作仍要处理并发；不同数据库的版本链、快照时机与清理机制不同；丢失更新取决于应用是否做了读改写与冲突检测，不是单靠隔离级别名称就能消除。'
    },
    {
      id: 's1-l3-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '长事务诊断',
      prompt: '接口 P99 从 200ms 升到 3s，连接池等待数持续升高，监控显示部分事务里在调用第三方 HTTP 接口。第一步应该做什么？',
      question: '接口 P99 从 200ms 升到 3s，连接池等待数持续升高，监控显示部分事务里在调用第三方 HTTP 接口。第一步应该做什么？',
      options: [
        { text: '立刻把连接池上限调到数据库最大连接数', correct: false },
        { text: '定位并缩短持有连接的事务，把外部调用移出事务，再根据事务时长与并发量重新评估池大小', correct: true },
        { text: '把隔离级别改成 SERIALIZABLE', correct: false },
        { text: '直接重启数据库实例释放连接', correct: false }
      ],
      explain: '池等待高是症状，根因是连接被长事务长期占用；先缩短持有时长，再谈容量。直接加连接会把压力转移到数据库，可能更慢；SERIALIZABLE 增加冲突与重试；重启只能短暂清空会话，不能改变事务持有时长。'
    }
  ],
  exercises: [
    {
      id: 's1-l3-ex-1',
      kind: 'code',
      title: '乐观并发更新与重试',
      brief: '实现 updateWithRetry(store, id, mutate, { maxRetries = 3 })，用版本号 + 比较并交换避免丢失更新。store.get(id) 返回当前记录或 null；store.compareAndSet(id, expectedVersion, next) 只在版本匹配时原子写入并返回 true。mutate 接收最新快照，返回下一版本的字段，可以是同步或异步函数；id 与 version 由函数维护。冲突耗尽抛 ConflictError（包含 id 与 attempts），记录不存在抛 NotFoundError，mutate 的业务错误直接传播且不能写入。maxRetries 是首次尝试之后的重试次数。',
      hint: '每次尝试都重新 get；mutate 必须基于最新快照；CAS 失败不要拿旧快照再写；用 maxRetries + 1 控制总尝试次数；只把 CAS 返回 false 当冲突，不要把 mutate 抛出的错误也重试。',
      starter: `class ConflictError extends Error {
  constructor(id, attempts) {
    super('更新 ' + id + ' 冲突，已尝试 ' + attempts + ' 次');
    this.name = 'ConflictError';
    this.id = id;
    this.attempts = attempts;
  }
}

class NotFoundError extends Error {
  constructor(id) {
    super('记录 ' + id + ' 不存在');
    this.name = 'NotFoundError';
    this.id = id;
  }
}

async function updateWithRetry(store, id, mutate, { maxRetries = 3 } = {}) {
  const snapshot = await store.get(id);
  if (!snapshot) throw new NotFoundError(id);
  const next = mutate(snapshot);
  const candidate = { ...next, id, version: snapshot.version + 1 };
  const ok = await store.compareAndSet(id, snapshot.version, candidate);
  if (!ok) throw new Error('update conflict');
  return candidate;
}`,
      solution: `class ConflictError extends Error {
  constructor(id, attempts) {
    super('更新 ' + id + ' 冲突，已尝试 ' + attempts + ' 次');
    this.name = 'ConflictError';
    this.id = id;
    this.attempts = attempts;
  }
}

class NotFoundError extends Error {
  constructor(id) {
    super('记录 ' + id + ' 不存在');
    this.name = 'NotFoundError';
    this.id = id;
  }
}

async function updateWithRetry(store, id, mutate, { maxRetries = 3 } = {}) {
  const attempts = maxRetries + 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const snapshot = await store.get(id);
    if (!snapshot) throw new NotFoundError(id);

    const next = await mutate(snapshot);
    const candidate = { ...next, id, version: snapshot.version + 1 };
    const ok = await store.compareAndSet(id, snapshot.version, candidate);
    if (ok) return candidate;
  }
  throw new ConflictError(id, attempts);
}`,
      tests: [
        {
          name: '无冲突时一次成功并递增版本',
          code: `const rows = { 1: { id: 1, count: 0, version: 1 } };
let writes = 0;
const store = {
  async get(id) { return rows[id] ? { ...rows[id] } : null; },
  async compareAndSet(id, expectedVersion, next) {
    if (rows[id].version !== expectedVersion) return false;
    rows[id] = { ...next };
    writes += 1;
    return true;
  },
};
const result = await updateWithRetry(store, 1, (snapshot) => ({ ...snapshot, count: snapshot.count + 1 }));
assert.deepStrictEqual(result, { id: 1, count: 1, version: 2 });
assert.equal(writes, 1);`
        },
        {
          name: '冲突后基于最新版本重试成功',
          code: `const rows = { 1: { id: 1, count: 0, version: 1 } };
const calls = { cas: 0, mutate: 0 };
const store = {
  async get(id) { return { ...rows[id] }; },
  async compareAndSet(id, expectedVersion, next) {
    calls.cas += 1;
    if (calls.cas === 1) {
      rows[id] = { ...rows[id], count: 5, version: 2 };
      return false;
    }
    if (rows[id].version !== expectedVersion) return false;
    rows[id] = { ...next };
    return true;
  },
};
const result = await updateWithRetry(store, 1, (snapshot) => {
  calls.mutate += 1;
  return { ...snapshot, count: snapshot.count + 1 };
});
assert.equal(result.count, 6);
assert.equal(result.version, 3);
assert.equal(calls.mutate, 2);`
        },
        {
          name: '重试耗尽抛出 ConflictError 并带上尝试次数',
          code: `const calls = { cas: 0, mutate: 0 };
const store = {
  async get(id) { return { id, count: 0, version: 1 }; },
  async compareAndSet() { calls.cas += 1; return false; },
};
let error = null;
try {
  await updateWithRetry(store, 2, (snapshot) => {
    calls.mutate += 1;
    return { ...snapshot };
  }, { maxRetries: 2 });
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof ConflictError);
assert.equal(error.attempts, 3);
assert.equal(calls.cas, 3);
assert.equal(calls.mutate, 3);`
        },
        {
          name: '两个并发更新都生效，不丢更新',
          code: `const rows = { 7: { id: 7, count: 0, version: 1 } };
let writes = 0;
const store = {
  async get(id) {
    await Promise.resolve();
    return rows[id] ? { ...rows[id] } : null;
  },
  async compareAndSet(id, expectedVersion, next) {
    await Promise.resolve();
    if (rows[id].version !== expectedVersion) return false;
    rows[id] = { ...next };
    writes += 1;
    return true;
  },
};
const mutate = (snapshot) => ({ ...snapshot, count: snapshot.count + 1 });
const results = await Promise.all([
  updateWithRetry(store, 7, mutate),
  updateWithRetry(store, 7, mutate),
]);
assert.equal(rows[7].count, 2);
assert.equal(rows[7].version, 3);
assert.equal(writes, 2);
assert.deepStrictEqual(results.map((item) => item.version).sort(), [2, 3]);`
        },
        {
          name: 'mutate 抛错时不写入并原样传播',
          code: `let writes = 0;
const store = {
  async get(id) { return { id, count: 0, version: 1 }; },
  async compareAndSet() { writes += 1; return true; },
};
let error = null;
try {
  await updateWithRetry(store, 3, () => { throw new Error('invalid target'); });
} catch (caught) {
  error = caught;
}
assert.equal(error.message, 'invalid target');
assert.equal(writes, 0);`
        },
        {
          name: '记录不存在时抛 NotFoundError 且不写',
          code: `const calls = { cas: 0, mutate: 0 };
const store = {
  async get() { return null; },
  async compareAndSet() { calls.cas += 1; return true; },
};
let error = null;
try {
  await updateWithRetry(store, 404, () => { calls.mutate += 1; return {}; });
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof NotFoundError);
assert.equal(calls.cas, 0);
assert.equal(calls.mutate, 0);`
        }
      ]
    },
    {
      id: 's1-l3-ex-2',
      kind: 'design',
      title: 'LinkHub 事务边界',
      brief: 'LinkHub 要同时处理三类写入：创建短链并写审计记录；点击跳转并记录点击事件；编辑链接并写审计记录。当前实现把三类操作都塞进同一个长事务，第三方统计接口也在事务里调用，导致 P99 升高、连接池等待增加。请给出事务边界、隔离级别、失败重试、幂等与监控方案，并说明哪些操作应移出事务异步执行。',
      checklist: [
        '明确「创建链接 + 审计」必须同事务，失败一起回滚',
        '明确点击事件在跳转链路上不能阻塞响应，改为异步或批量写入，并说明丢失与重复的取舍',
        '明确「更新链接 + 审计」必须放进同一事务边界，外部通知在提交后执行',
        '为三类写入选定隔离级别并说明理由，不默认使用最高级别',
        '为唯一键冲突、版本冲突与序列化失败分别给出重试上限、退避与最终失败行为',
        '为审计与点击事件设计幂等键或去重策略，保证重试不会写重复记录',
        '说明锁顺序或单行更新策略，避免死锁',
        '明确事务内不调用外部服务，并给出长事务的监控指标与超时',
        '给出可观察证据：事务时长、锁等待、连接池等待、重试次数、重复写入计数'
      ],
      reference: '<ul><li><strong>创建 + 审计同事务：</strong>链接与审计是同一个业务动作，任一失败都应回滚；唯一冲突重试有上限。</li><li><strong>点击事件异步：</strong>跳转先返回，点击事件异步批量写入；用事件 ID 幂等，允许极端情况下丢失低价值统计，但不能阻塞跳转。</li><li><strong>外部副作用：</strong>数据库提交后再执行通知等外部操作；不要在事务内等待第三方接口，失败进入有界重试。</li><li><strong>隔离级别：</strong>创建与更新用 READ COMMITTED 加唯一约束/版本号；只有跨多行不变量无法用约束或固定锁顺序表达时才考虑 SERIALIZABLE。</li><li><strong>重试：</strong>只重试唯一冲突、序列化失败与 CAS 冲突；业务校验错误不重试；指数退避并设总时长上限。</li><li><strong>幂等：</strong>审计与点击事件带幂等键，数据库唯一约束兜底；重试不产生重复行。</li><li><strong>锁顺序：</strong>一次事务只更新一行链接；需要多行时按主键升序加锁，缩短持锁时间。</li><li><strong>监控：</strong>事务时长分布、锁等待、池等待、重试次数、重复写入计数；告警看 P99 与池等待，不只看平均值。</li></ul>'
    }
  ]
};
