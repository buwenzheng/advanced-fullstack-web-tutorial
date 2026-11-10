export const s5L3 = {
  id: 's5-l3',
  title: '分布式系统的陷阱：失败是常态',
  subtitle: '部分失败、超时预算、重试放大、租约与 fencing token、时钟与顺序。',
  duration: 85,
  status: 'ready',
  objectives: [
    '把部分失败、超时与未知结果当成常态，不用二值思维写调用代码。',
    '设计跨服务超时预算与重试预算，避免重试放大。',
    '用租约 + fencing token 处理锁过期后的旧写入。',
    '解释时钟偏移、乱序与「看起来的先后」如何制造错误。'
  ],
  keywords: ['部分失败', '未知结果', '超时预算', '重试放大', 'fencing token', '租约', '时钟偏移', 'CAP', 'PACELC', '幂等'],
  blocks: [
    {
      type: 'analogy',
      title: '网络不是函数调用',
      html: '前端写 `await fetch(...)` 时，超时、断网、服务器 500 都能被捕捉成一个异常，代码里看起来只有成功和失败两种结果。但服务之间的调用不是本地函数：请求可能已经到了对方、已经改完数据，只是响应在路上丢了。这时调用方看到的是超时，真实结果是「不知道」。<br>更麻烦的是重试：用户点一次「发布」，前端因为超时自动重发，后端可能收到两次；服务 A 调服务 B 超时后重试，B 可能把同一笔操作执行两遍。前端可以靠禁用按钮缓解，后端必须靠幂等键、状态查询与对账来解决。把网络当函数调用，是分布式 bug 的起点。'
    },
    {
      type: 'text',
      title: '部分失败：成功、失败与未知',
      html: '单机程序里，函数要么返回要么抛错；分布式系统里还有第三种状态：结果未知。请求发出后超时，可能对方没收到，也可能收到了、执行了、响应丢了。把超时当失败并直接重试，会把「可能已成功」的操作再做一遍；把超时当成功并继续，又可能丢失一次本该重试的操作。<br>工程上的处理顺序是：先让操作可重试（幂等键、唯一约束、去重表），再决定重试策略；对不可幂等的操作，先查询状态或对账，而不是盲目重试。调用方还要区分「可重试错误」（连接失败、明确的可重试状态码）与「不可重试错误」（参数错误、权限不足、业务规则拒绝）。未知结果既不是可重试也不是不可重试，它需要幂等保护与状态确认。'
    },
    {
      type: 'table',
      title: '五类失败模式与防线',
      head: ['失败模式', '典型现象', '错误假设', '防线'],
      rows: [
        ['崩溃', '进程消失，连接被重置，请求可能已执行', '连接断了就等于没执行', '幂等键 + 状态查询 + 对账'],
        ['变慢', '响应超时，但对方仍在处理', '超时等于失败', '超时预算 + 幂等重试 + 后台确认'],
        ['分区', '部分实例互相不可达，两边都认为对方挂了', '对方挂了，我可以接管', '多数派/租约 + fencing token'],
        ['重复', '同一消息或请求被投递多次', '一次请求只处理一次', 'eventId 去重 + 唯一索引'],
        ['乱序', '后发的消息先到，状态被旧值覆盖', '到达顺序等于发生顺序', '版本号 + 条件更新 + 幂等状态机']
      ],
      note: '这五类失败可以叠加：分区期间发生重试，就会同时出现重复与乱序。防线要组合使用，不能指望单一机制解决所有问题。'
    },
    {
      type: 'code',
      title: 'Fencing Token 锁',
      lang: 'javascript',
      code: `function createFencedLock({ store, now }) {
  function active(key) {
    const record = store.get(key);
    if (!record) return null;
    if (record.expiresAt <= now()) {
      store.delete(key);        // 过期即视为无锁
      return null;
    }
    return record;
  }

  return {
    acquire(key, ttlMs) {
      if (active(key)) return null;
      const token = store.nextToken();   // 全局单调递增
      const expiresAt = now() + ttlMs;
      store.set(key, { token, expiresAt });
      return { token, expiresAt };
    },
    renew(key, token, ttlMs) {
      const record = active(key);
      if (!record || record.token !== token) return false;
      record.expiresAt = now() + ttlMs;
      store.set(key, record);
      return true;
    },
    write(key, token, value) {
      const record = active(key);
      if (!record || record.token !== token) {
        return { ok: false, reason: 'STALE_TOKEN' };
      }
      store.data[key] = value;           // 存储层拒绝旧 token
      return { ok: true };
    },
  };
}`,
      note: '锁本身只保证「同一时刻一个持有者」，真正防旧写入的是存储层对 token 的校验。新持有者拿到的 token 必然更大，旧持有者即使从 GC 停顿中醒来，也只能收到 STALE_TOKEN。'
    },
    {
      type: 'code',
      title: '跨服务重试预算',
      lang: 'javascript',
      code: `function createRetryBudget(deadlineMs, perAttemptMs) {
  const deadline = Date.now() + deadlineMs;
  let attempts = 0;

  return {
    async run(fn) {
      while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        const timeoutMs = Math.min(perAttemptMs, remaining);
        attempts += 1;
        try {
          // 把剩余截止时间传给下游，而不是每层重新计时
          return await fn({ timeoutMs, attempt: attempts, deadline });
        } catch (error) {
          if (!error.retryable) throw error;      // 4xx 与业务拒绝不重试
          const backoff = Math.min(100 * 2 ** attempts, remaining / 2);
          await sleep(backoff * (0.5 + Math.random())); // 抖动打散重试
        }
      }
      throw new Error('BUDGET_EXHAUSTED');
    },
    get attempts() { return attempts; },
  };
}`,
      note: '预算的核心是「整条调用链共享一个截止时间」：入口给 800ms，下游拿到的只能是剩余时间，而不是各自 800ms。只允许在最外层重试，内层要么快速失败要么带预算，否则每层重试会指数放大。抖动让同时失败的一批客户端错开重试。'
    },
    {
      type: 'pitfall',
      title: '锁过期后的旧写入与重试风暴',
      html: '现象：分布式任务偶尔被两个实例同时执行；锁明明还在，数据却被旧实例覆盖；高峰时下游被打垮，日志里全是重试；同一个操作执行了两遍，账单或计数翻倍。<br>原因：持有者发生长时间 GC 或网络延迟，租约到期后锁被新实例拿走，旧实例醒来后继续写入；代码只检查「锁存在」，不比较 token；调用链每一层都自动重试，且没有预算与抖动；把超时当失败，对非幂等操作直接重发。<br>发现方式：统计同一任务的并发执行次数；对比锁 token 与写入记录；观察重试次数与下游 QPS 的相关性；构造 GC 停顿或网络分区演练。<br>修复：写入时校验 token（或版本号），旧 token 一律拒绝；重试只放在最外层并共享截止时间；非幂等操作先查询状态或使用幂等键；为锁加上可观测的续租与过期指标。<br>预防：把「结果未知」写进错误分类；对所有跨服务写操作设计幂等键；定期做分区与停顿演练。'
    },
    {
      type: 'steps',
      title: '两服务故障演练：从注入到复测',
      steps: [
        { title: '画出依赖与关键路径', html: '标明同步调用、异步消息与共享存储。观察点：每个依赖的超时预算是多少，谁是单点。' },
        { title: '注入延迟与错误', html: '让下游延迟超过超时、随机返回 5xx、断开部分连接。观察点：调用方是快速失败还是无限等待。' },
        { title: '注入分区与重复', html: '断开两个实例之间的网络，重复投递同一条消息。观察点：是否出现双写、重复计数或旧值覆盖。' },
        { title: '记录现象与恢复时间', html: '记录错误率、P99、重试次数、队列积压与恢复耗时。观察点：是否有重试风暴的放大迹象。' },
        { title: '修复并加防线', html: '补幂等键、token 校验、重试预算与降级开关。观察点：同样的演练是否不再产生副作用。' },
        { title: '复测并固化为演练脚本', html: '把注入参数与判定标准写进仓库，纳入发布前检查。观察点：每次发布都能重复验证。' }
      ]
    },
    {
      type: 'compare',
      title: '锁、租约与版本号',
      cols: [
        { title: '分布式锁', items: ['保证同一时刻一个持有者', '通常带过期时间，否则死锁', '锁失效后旧持有者仍可能写入', '需要配 token 或版本号才安全'] },
        { title: '租约 + fencing token', items: ['锁带有效期，持有者可续租', 'token 单调递增', '存储层拒绝旧 token 写入', '适合任务抢占、主节点切换'] },
        { title: '版本号 / 条件更新', items: ['每次写入携带期望版本', '数据库用 WHERE version = ? 原子更新', '不依赖锁，冲突时失败重试', '适合高并发计数与状态机'] }
      ],
      note: '三者不是互斥的：租约负责「谁来干活」，token 或版本号负责「旧人不能写」。只上锁不校验 token，等于把安全性寄托在「锁永不过期」这个不成立的假设上。'
    },
    {
      type: 'text',
      title: '深挖：CAP 与 PACELC 的直觉',
      html: 'CAP 说的是：当网络分区发生时，系统只能在一致性与可用性之间取舍。分区不是罕见故障，而是常态之一；因此真正的问题不是「选哪两个」，而是「分区时这个业务更怕读到旧数据，还是更怕不可用」。短链跳转显然选可用性：宁可短暂读到旧缓存，也不能让用户打不开链接。账户余额扣减则更怕不一致，宁可拒绝服务也不能重复扣款。<br>PACELC 补上了另一半：即使没有分区（Else），系统仍要在延迟（Latency）与一致性（Consistency）之间取舍。跨地域强一致意味着每次写都要等待远程确认，延迟上升；异步复制降低延迟，但读副本可能落后。把这些取舍写进接口契约，比背定理有用：跳转接口承诺「最终一致，延迟 ≤ 30 秒」，余额接口承诺「强一致，失败可重试」。<br>CAP 常被误用成「三选二」的口号。分区期间如果选择一致性，系统可能拒绝部分请求；选择可用性，就要接受冲突与后续合并。无论选哪边，都要有监控、降级与恢复路径，而不是宣称「我们的系统是 CP」。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「调用超时后到底成功没有」回答：不知道。超时只是本地观察，可能对方没收到，也可能已执行但响应丢失。正确做法是让操作幂等（幂等键或唯一约束），重试前尽量查询状态，并对不可幂等操作做对账。<br>「分布式锁真的安全吗」回答：单靠「锁未过期」不安全。GC 停顿与网络延迟会让旧持有者误以为还持锁。需要租约 + 单调递增的 fencing token，由存储层拒绝旧 token 写入；或者干脆用版本号做条件更新。再补一句「锁解决互斥，不解决旧写入」。'
    }
  ],
  checks: [
    {
      id: 's5-l3-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '部分失败',
      prompt: '服务 A 调用服务 B 修改订单状态，等待 2 秒后超时。此时最准确的认识是什么？',
      question: '服务 A 调用服务 B 修改订单状态，等待 2 秒后超时。此时最准确的认识是什么？',
      options: [
        { text: '结果未知：B 可能没收到，也可能已修改但响应丢失', correct: true },
        { text: '一定失败，可以直接重试', correct: false },
        { text: '一定成功，只是响应慢', correct: false },
        { text: '超时时间太长，改成 200ms 就不会有未知结果', correct: false }
      ],
      explain: '超时是本地观察，不是对方的执行结论。缩短超时只会更早进入未知状态。正确做法是幂等 + 状态查询，而不是假设成功或失败。'
    },
    {
      id: 's5-l3-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: 'fencing token',
      prompt: '关于租约 + fencing token，哪些说法正确？',
      question: '关于租约 + fencing token，哪些说法正确？',
      options: [
        { text: '存储层校验 token 后，旧持有者的迟到写入会被拒绝', correct: true },
        { text: 'token 必须单调递增，新持有者的 token 大于旧持有者', correct: true },
        { text: '它不能替代幂等：重复请求仍可能被处理两次', correct: true },
        { text: '它能防止旧持有者已经发出的外部副作用（如发邮件）', correct: false },
        { text: '它能消除时钟偏移，让所有节点时间一致', correct: false }
      ],
      explain: 'fencing token 保护的是存储层写入：旧 token 被拒。它不撤销已经发生的外部副作用，也不修复时钟。重复请求仍需幂等键或去重表。'
    },
    {
      id: 's5-l3-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '重试',
      prompt: '一次下游抖动后，整个系统 QPS 反而暴涨并持续不降，最可能的根因是什么？',
      question: '一次下游抖动后，整个系统 QPS 反而暴涨并持续不降，最可能的根因是什么？',
      options: [
        { text: '调用链每一层都自动重试，且没有预算与抖动', correct: true },
        { text: '下游恢复了，所以 QPS 自然上涨', correct: false },
        { text: '日志打得太多，占用了 CPU', correct: false },
        { text: '数据库索引失效，导致查询变慢', correct: false }
      ],
      explain: '分层重试会让一次失败放大成多次请求：3 层各重试 3 次就是 27 倍流量。修复是共享截止时间、只在外层重试、加抖动与熔断。'
    }
  ],
  exercises: [
    {
      id: 's5-l3-ex-1',
      kind: 'code',
      title: 'Fencing Token 锁',
      brief: '实现 createFencedLock({ store, now })。store 提供 get/set/delete 与单调递增的 nextToken()，并用 data 保存写入值。acquire(key, ttlMs) 在无锁或锁已过期时生成新 token 并写入，返回 { token, expiresAt }；否则返回 null。renew(key, token, ttlMs) 只在锁未过期且 token 匹配时延长并返回 true。release(key, token) 只在 token 匹配时释放。write(key, token, value) 只有 token 等于当前锁 token 且未过期才写入 store.data，返回 { ok: true }；否则返回 { ok: false, reason: \'STALE_TOKEN\' }。',
      hint: '先写一个 active(key) 辅助函数：不存在或 expiresAt <= now() 就视为无锁并删除。所有操作都通过它取当前锁，再比较 token。',
      starter: `function createStore() {
  const locks = new Map();
  const data = {};
  let token = 0;
  return {
    data,
    get(key) { return locks.get(key) || null; },
    set(key, record) { locks.set(key, record); },
    delete(key) { locks.delete(key); },
    nextToken() { token += 1; return token; },
  };
}

function createFencedLock({ store, now }) {
  return {
    acquire(key, ttlMs) {
      if (store.get(key)) return null;
      const token = now();
      const expiresAt = now() + ttlMs;
      store.set(key, { token, expiresAt });
      return { token, expiresAt };
    },
    renew(key) {
      return true;
    },
    release(key) {
      store.delete(key);
      return true;
    },
    write(key, token, value) {
      if (!store.get(key)) return { ok: false, reason: 'STALE_TOKEN' };
      store.data[key] = value;
      return { ok: true };
    },
  };
}`,
      solution: `function createStore() {
  const locks = new Map();
  const data = {};
  let token = 0;
  return {
    data,
    get(key) { return locks.get(key) || null; },
    set(key, record) { locks.set(key, record); },
    delete(key) { locks.delete(key); },
    nextToken() { token += 1; return token; },
  };
}

function createFencedLock({ store, now }) {
  function active(key) {
    const record = store.get(key);
    if (!record) return null;
    if (record.expiresAt <= now()) {
      store.delete(key);
      return null;
    }
    return record;
  }

  return {
    acquire(key, ttlMs) {
      if (active(key)) return null;
      const token = store.nextToken();
      const expiresAt = now() + ttlMs;
      store.set(key, { token, expiresAt });
      return { token, expiresAt };
    },
    renew(key, token, ttlMs) {
      const record = active(key);
      if (!record || record.token !== token) return false;
      record.expiresAt = now() + ttlMs;
      store.set(key, record);
      return true;
    },
    release(key, token) {
      const record = active(key);
      if (!record || record.token !== token) return false;
      store.delete(key);
      return true;
    },
    write(key, token, value) {
      const record = active(key);
      if (!record || record.token !== token) {
        return { ok: false, reason: 'STALE_TOKEN' };
      }
      store.data[key] = value;
      return { ok: true };
    },
  };
}`,
      tests: [
        {
          name: '首次获取成功且 token 单调',
          code: `const store = createStore();
let clock = 100;
const lock = createFencedLock({ store, now: () => clock });
const lease = lock.acquire('job:1', 1000);
assert.equal(lease.token, 1);
assert.equal(lease.expiresAt, 1100);
assert.equal(lock.acquire('job:1', 1000), null);
const other = lock.acquire('job:2', 1000);
assert.equal(other.token, 2);`
        },
        {
          name: '续租延长过期时间',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
const lease = lock.acquire('job:1', 1000);
clock = 400;
assert.equal(lock.renew('job:1', lease.token, 5000), true);
assert.equal(store.get('job:1').expiresAt, 5400);
clock = 5300;
assert.equal(lock.acquire('job:1', 1000), null);`
        },
        {
          name: '过期后可被新锁获取',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
const first = lock.acquire('job:1', 1000);
clock = 1000;
const second = lock.acquire('job:1', 1000);
assert.ok(second);
assert.equal(second.token, 2);
assert.ok(second.token > first.token);`
        },
        {
          name: '旧 token 写入被拒绝',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
const first = lock.acquire('job:1', 1000);
clock = 2000;
lock.acquire('job:1', 1000);
const result = lock.write('job:1', first.token, 'stale-write');
assert.deepEqual(result, { ok: false, reason: 'STALE_TOKEN' });
assert.equal(store.data['job:1'], undefined);`
        },
        {
          name: '新 token 写入成功',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
lock.acquire('job:1', 1000);
clock = 2000;
const second = lock.acquire('job:1', 1000);
assert.deepEqual(lock.write('job:1', second.token, 'fresh'), { ok: true });
assert.equal(store.data['job:1'], 'fresh');`
        },
        {
          name: '续租过期锁失败',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
const lease = lock.acquire('job:1', 1000);
assert.equal(lock.renew('job:1', lease.token + 99, 1000), false);
clock = 1000;
assert.equal(lock.renew('job:1', lease.token, 1000), false);`
        },
        {
          name: '释放后新持有者获取',
          code: `const store = createStore();
let clock = 0;
const lock = createFencedLock({ store, now: () => clock });
const first = lock.acquire('job:1', 1000);
assert.equal(lock.release('job:1', first.token + 99), false);
assert.equal(lock.release('job:1', first.token), true);
const second = lock.acquire('job:1', 1000);
assert.equal(second.token, 2);
assert.deepEqual(lock.write('job:1', first.token, 'old'), { ok: false, reason: 'STALE_TOKEN' });
assert.deepEqual(lock.write('job:1', second.token, 'new'), { ok: true });`
        }
      ]
    },
    {
      id: 's5-l3-ex-2',
      kind: 'design',
      title: 'LinkHub 分布式失败预案',
      brief: '为 LinkHub 的跳转链路与统计服务设计一份分布式失败预案，覆盖同步调用、异步消息、锁与降级。',
      checklist: [
        '依赖图：列出跳转、统计、数据库、MQ 的依赖关系与关键路径',
        '超时预算：为每一跳分配超时，并说明整条链路的截止时间',
        '错误分类：区分可重试、不可重试与未知结果，并给出处理方式',
        '幂等设计：为每个跨服务写操作定义幂等键或唯一约束',
        '锁与 fencing：说明哪里需要锁/租约，以及如何拒绝旧持有者写入',
        '降级策略：统计服务失败、MQ 不可用时跳转如何继续',
        '演练计划：列出延迟、错误、分区、重复投递的注入方式',
        '监控指标：错误率、P99、重试次数、积压、锁过期与 token 拒绝次数',
        '恢复目标：给出恢复时间与数据对账方式'
      ],
      reference: '跳转链路是最高优先级：超时预算不超过 100ms，统计只写本地事件，失败直接降级，不影响 302。统计事件通过 Outbox 发出，消费者按 eventId 幂等，重复投递只计一次。发布器与消费者都带重试预算与退避，MQ 不可用时事件留在 outbox，恢复后继续投递。锁只用于定时聚合任务，使用租约 + fencing token，聚合结果按版本号条件写入，旧 token 被拒绝。演练至少覆盖：消费者 kill -9、MQ 断连 5 分钟、重复投递 100 条、读从库延迟 10 秒。监控看四类数字：跳转 P99、统计延迟、重试次数、outbox 积压。恢复目标写成可验证的句子，例如「统计服务重启后 60 秒内追平积压，重复事件不改变计数」。'
    }
  ]
};
