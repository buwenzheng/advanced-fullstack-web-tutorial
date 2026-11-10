export const s3Resilience = {
  id: 's3-resilience',
  title: '超时、重试、熔断与幂等',
  subtitle: '让失败发生在可控范围内：分层超时、重试预算、三态熔断与幂等边界。',
  duration: 85,
  status: 'ready',
  objectives: [
    '设计分层超时与截止时间传播，避免下游超时晚于上游。',
    '实现带预算与抖动的重试计划，区分可重试错误，避免重试风暴。',
    '实现熔断器三态与隔离舱，说明阈值、冷却与半开探测的取舍。',
    '实现幂等键语义，理解分布式锁与 fencing token 的边界。'
  ],
  keywords: ['超时', 'deadline', '重试预算', '指数退避', '抖动', '熔断器', '半开', '幂等键', 'fencing token', '隔离舱'],
  blocks: [
    {
      type: 'analogy',
      title: '前端 fetch 重试与后端重试预算',
      html: '前端给 <code>fetch</code> 加两次重试，最坏情况只是这个用户多等一会；服务端给一个下游调用加两次重试，意味着失败时下游看到 3 倍流量。如果是热点接口、所有请求一起失败，重试会把「已经过载」的下游再压一遍。<br>类比失效的地方在于共享：前端没有给别的用户制造流量，后端重试消耗的是所有请求共享的下游容量。所以后端重试必须有预算、退避与抖动，并且只对确定的错误类型启用。'
    },
    {
      type: 'text',
      title: '超时分层',
      html: '每一层都要比它的上游短：客户端 3 秒、网关 2.5 秒、服务 2 秒、下游 1.5 秒。如果反过来，上游已经放弃并返回 504，下游还在占用连接与线程重试，故障期间资源只出不进。<br>deadline 要向下传：入口把剩余时间写进请求上下文，每经过一跳减去已耗时；下游用「剩余时间」而不是自己的默认值，避免上游只剩 200 毫秒时下游还在跑 2 秒。重试的退避时间也要计入总预算，否则三轮重试早就超过调用方的耐心。超时之后不要假设写操作没发生：服务端可能已经提交，只是响应丢了，这时只有幂等键能兜底。'
    },
    {
      type: 'table',
      title: '重试策略与可重试错误',
      head: ['策略', '延迟形态', '优点', '风险', '适用'],
      rows: [
        ['固定延迟', '每次相同', '简单可预测', '失败时同时重试，容易撞在一起', '低频内部任务'],
        ['指数退避', '100ms、200ms、400ms', '给下游恢复时间', '尾巴长，占用预算', '大多数远程调用'],
        ['指数 + 抖动', '在指数基础上乘随机系数', '打散重试峰值', '延迟不直观，需观测', '高并发入口'],
        ['重试预算', '按总时间/总次数封顶', '防止重试风暴', '需要跨调用传递', '整条请求链路']
      ],
      note: '可重试：连接失败、超时、502/503/504、429（按 Retry-After）。不可重试：400/401/403/404/422。非幂等 POST 只有在带幂等键时才能重试。'
    },
    {
      type: 'code',
      title: '重试计划：指数、抖动与预算',
      lang: 'javascript',
      code: `function planRetries({
  maxAttempts = 3,
  baseDelayMs = 100,
  maxDelayMs = 10000,
  budget = Infinity,
  random = Math.random,
} = {}) {
  if (!(maxAttempts >= 1)) throw new RangeError('maxAttempts must be >= 1');
  if (!(baseDelayMs >= 0)) throw new RangeError('baseDelayMs must be >= 0');

  const delays = [];
  let total = 0;

  for (let index = 0; index < maxAttempts - 1; index += 1) {
    const base = Math.min(maxDelayMs, baseDelayMs * 2 ** index);
    // 抖动落在 [0.5, 1.5)，打散同时重试的峰值
    const jitter = 0.5 + random();
    const delay = Math.min(maxDelayMs, Math.round(base * jitter));
    if (total + delay > budget) break;
    delays.push(delay);
    total += delay;
  }

  return delays;
}`,
      note: 'random 注入是为了可测试：测试用固定值验证上下界，生产用 Math.random。预算是「所有重试延迟之和」的上限，真实系统还要把每次尝试的耗时计入调用方 deadline。'
    },
    {
      type: 'flow',
      title: '熔断器三态',
      steps: [
        { name: 'closed', detail: '正常放行并统计结果。连续失败达到阈值 → open。观察点：失败计数在成功时清零，不是累计总数。' },
        { name: 'open', detail: '直接拒绝，不再调用下游，保护它与自己。观察点：拒绝要快速失败并带可识别的错误，不能伪装成业务失败。' },
        { name: '冷却结束', detail: '冷却时间到后进入 half-open，只放一个探测。观察点：冷却从「最后一次失败」或「打开时刻」算，团队要统一。' },
        { name: 'half-open 成功', detail: '探测成功 → closed，失败计数清零。观察点：恢复后要逐步放量，避免瞬间打满。' },
        { name: 'half-open 失败', detail: '探测失败 → 回到 open，重置冷却起点。观察点：半开并发只允许一个探测，否则一次故障恢复会被多个探测再次打垮。' }
      ]
    },
    {
      type: 'code',
      title: '熔断器：冷却、半开与单探测',
      lang: 'javascript',
      code: `class CircuitOpenError extends Error {
  constructor(message = 'circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

function createCircuitBreaker({ failureThreshold = 3, cooldownMs = 1000, now = Date.now } = {}) {
  if (!(failureThreshold >= 1)) throw new RangeError('failureThreshold must be >= 1');
  if (!(cooldownMs >= 0)) throw new RangeError('cooldownMs must be >= 0');

  let state = 'closed';
  let failures = 0;
  let openedAt = 0;
  let probing = false;

  function refresh() {
    if (state === 'open' && now() - openedAt >= cooldownMs) {
      state = 'half-open';
      probing = false;
    }
  }

  async function execute(fn) {
    refresh();
    if (state === 'open') throw new CircuitOpenError();
    if (state === 'half-open') {
      if (probing) throw new CircuitOpenError('probe in progress');
      probing = true;
    }
    try {
      const result = await fn();
      state = 'closed';
      failures = 0;
      probing = false;
      return result;
    } catch (error) {
      if (state === 'half-open') {
        state = 'open';
        openedAt = now();
        probing = false;
      } else {
        failures += 1;
        if (failures >= failureThreshold) {
          state = 'open';
          openedAt = now();
        }
      }
      throw error;
    }
  }

  return {
    execute,
    get state() {
      refresh();
      return state;
    },
  };
}`,
      note: '半开探测失败时重置 openedAt，否则下一次 execute 会立刻再次半开，形成连续探测。真实实现还要加超时：没有超时的熔断器会被慢调用一直卡在 closed。'
    },
    {
      type: 'table',
      title: '幂等键的实现维度',
      head: ['维度', '要决定什么', '常见错误'],
      rows: [
        ['存储', '数据库唯一索引、Redis SET NX 或独立幂等表', '只存在进程内，重启或多实例后失效'],
        ['作用域', '租户 + 端点 + 客户端传入的 key', '只用 key，跨用户/跨端点互相覆盖'],
        ['TTL', '保留多久允许重放，与业务补偿窗口对齐', 'TTL 太短，客户端重试拿不到首次结果'],
        ['同 body 重放', '返回首次的状态码与响应体', '重新执行一次，产生第二条记录'],
        ['不同 body 同 key', '返回 409 冲突，拒绝第二次执行', '静默覆盖或当成新请求'],
        ['执行中重放', '返回 409/202 或让客户端轮询结果', '并发两次都看到「无记录」一起执行']
      ],
      note: '并发安全靠唯一索引或原子写入，不靠「先查再写」；后者在两个请求同时到达时会同时通过。'
    },
    {
      type: 'pitfall',
      title: '重试非幂等 POST',
      html: '现象：用户只点了一次「创建短链」，库里出现两条相同记录；故障恢复后下游流量比平时高几倍；熔断器打开后接口仍然卡住；锁过期后旧请求写入了新值。<br>原因：对没有幂等键的 POST 自动重试，超时只代表响应没回来，不代表服务端没执行；重试没有预算与抖动，所有客户端同时重试；熔断只拦请求但下游调用没有超时；分布式锁过期时旧持有者还活着。<br>发现方式：对比创建接口的请求量与记录增量；统计重试次数与下游 QPS 的相关性；检查 open 期间是否仍有慢调用；用锁过期 + 慢写入复现旧写入。<br>修复：非幂等写只在带幂等键时重试；重试加指数退避、抖动与总预算；熔断的下游调用必须有超时；锁之外加版本号或 fencing token，存储拒绝过期持有者的写入。<br>预防：测试覆盖「超时后重放」与「锁过期后写入」；重试量与 429/5xx 一起监控；演练时主动注入慢下游。'
    },
    {
      type: 'steps',
      title: '故障演练：用故障验证参数',
      steps: [
        { title: '写假设', html: '先写清预期：下游超时 30% 时，跳转仍成功、统计降级、5 分钟内自动恢复。观察点：假设可被数据证伪。' },
        { title: '注入故障', html: '让统计服务延迟 2 秒并返回 503；同时把重试预算调小。观察点：故障只影响统计链路。' },
        { title: '观察行为', html: '看重试次数、熔断状态、429/503 比例、P99 与队列积压。观察点：重试没有放大成风暴。' },
        { title: '调整参数', html: '调整超时、阈值、冷却与预算，一次只改一个。观察点：每个参数有对应指标变化。' },
        { title: '复测', html: '重复同一故障，确认指标回到预期区间。观察点：结果可重复，不靠巧合。' },
        { title: '记录与回滚', html: '记录参数、现象与恢复时间；保留回滚值。观察点：下次故障能直接复用结论。' }
      ]
    },
    {
      type: 'compare',
      title: '幂等键 vs 去重表 vs exactly-once',
      cols: [
        {
          title: '幂等键',
          items: ['作用域：客户端 + 端点 + 租户', '存储：唯一索引或键值对', '冲突：同键不同 body 返回 409', '成本：一次额外写入', '边界：只覆盖带键的请求']
        },
        {
          title: '去重表',
          items: ['作用域：通常是消息 ID 或业务主键', '存储：独立表 + TTL 清理', '冲突：已处理则跳过', '成本：表膨胀与清理任务', '边界：需要消费端正确写表']
        },
        {
          title: 'exactly-once 宣称',
          items: ['作用域：端到端，不只消费端', '存储：需要事务或两阶段确认', '冲突：依赖幂等与去重组合', '成本：高，跨系统难保证', '边界：多数系统实际是至少一次 + 幂等']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：分布式锁与 fencing token',
      html: '分布式锁通常是一个带租约的键：持有者拿到锁后开始工作，租约到期自动释放。问题在于「持有者以为自己还持有」：进程 GC 停顿、网络分区、时钟漂移都会让锁在持有者不知情时过期，新持有者进入，旧持有者恢复后继续写，两个写入同时发生。<br>fencing token 的思路是让每次加锁返回单调递增的令牌，存储端记录见过的最大令牌，拒绝更小的令牌写入。这样即使旧持有者恢复，它的写也会被存储拒绝。锁只用来减少冲突与优化性能，正确性要靠唯一约束、版本号或 fencing token。不同实现的租约与时钟假设不同，不能把「有锁」当成强一致的证明。',
      note: 'Redis 单实例、Redlock 与数据库锁的假设不同；本讲只讲机制边界，具体选型在 S5 与项目里讨论。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「重试越多越可靠吗」先给结论：不是。每次重试都放大下游流量，错误类型不对时只是制造风暴；应该说明可重试错误、退避与抖动、总预算、幂等前提，以及如何观测重试量。<br>「熔断和限流有什么区别」限流控制进入系统的速率，熔断根据下游健康状态快速失败；限流保护自己不被压垮，熔断保护调用方不被慢下游拖死。两者都要有可观察状态与恢复策略。'
    }
  ],
  checks: [
    {
      id: 's3-resilience-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '可重试判定',
      prompt: '下面哪种情况最适合自动重试？',
      question: '下面哪种情况最适合自动重试？',
      options: [
        { text: '创建短链的 POST 返回 400，因为 slug 格式不合法', correct: false },
        { text: '下游连接超时或返回 503，且该请求是幂等的或带幂等键', correct: true },
        { text: '所有 4xx 都应该重试，直到成功', correct: false },
        { text: '没有幂等键的 POST 超时后立即重试两次', correct: false }
      ],
      explain: '400 是参数错误，重试不会变对；4xx 中只有 429 等少数情况适合按 Retry-After 重试；非幂等 POST 超时后服务端可能已执行，直接重试会产生重复记录，必须先有幂等键。'
    },
    {
      id: 's3-resilience-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '熔断器状态',
      prompt: '关于熔断器的状态与转换，以下哪些说法正确？',
      question: '关于熔断器的状态与转换，以下哪些说法正确？',
      options: [
        { text: 'closed 连续失败达到阈值后进入 open', correct: true },
        { text: 'open 冷却结束后进入 half-open，只放有限探测', correct: true },
        { text: 'half-open 探测成功回到 closed 并清零失败计数', correct: true },
        { text: 'half-open 探测失败回到 open，并重置冷却起点', correct: true },
        { text: 'open 期间应该继续放行所有请求，避免误伤', correct: false },
        { text: 'half-open 应该一次放全部流量，尽快恢复', correct: false }
      ],
      explain: '三态转换的核心是「打开后快速失败、冷却后小流量探测、探测结果决定恢复或继续打开」。open 放行全部等于没有熔断；half-open 放全部流量会让尚未恢复的下游再次被压垮。'
    },
    {
      id: 's3-resilience-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '幂等键冲突',
      prompt: '同一个幂等键、但请求 body 不同，服务端应该怎么处理？',
      question: '同一个幂等键、但请求 body 不同，服务端应该怎么处理？',
      options: [
        { text: '当成新请求执行第二次', correct: false },
        { text: '返回冲突（如 409），拒绝执行第二次', correct: true },
        { text: '静默覆盖第一次的结果', correct: false },
        { text: '忽略幂等键，按 body 去重', correct: false }
      ],
      explain: '幂等键绑定的是「这一次操作」，同键不同 body 说明客户端复用了键或请求被篡改，继续执行会产生不可预期的结果。正确做法是返回冲突并记录审计信息；同键同 body 才返回首次结果。'
    }
  ],
  exercises: [
    {
      id: 's3-resilience-ex-1',
      kind: 'code',
      title: '重试计划与熔断器',
      brief: '实现两个契约。A：planRetries({ maxAttempts = 3, baseDelayMs = 100, maxDelayMs = 10000, budget = Infinity, random = Math.random } = {}) 返回每次重试的延迟数组；第 i 次基础延迟 baseDelayMs * 2^i 并封顶 maxDelayMs；抖动系数为 0.5 + random()；加入下一次延迟会超过 budget 时停止；maxAttempts = 1 返回空数组。B：createCircuitBreaker({ failureThreshold = 3, cooldownMs = 1000, now = Date.now } = {})，execute(fn) 异步执行；closed 连续失败达到阈值进入 open；open 期间直接抛 CircuitOpenError 且不调用 fn；冷却后进入 half-open，只允许一个探测；探测成功回 closed 并清零，失败回 open 并重置冷却起点；暴露 state getter。',
      hint: 'A：for 循环到 maxAttempts - 1，base = min(maxDelayMs, baseDelayMs * 2 ** index)，delay = min(maxDelayMs, round(base * (0.5 + random())))，累计超过 budget 就 break。B：用一个 refresh() 在每次 execute 前检查冷却；half-open 用 probing 布尔值挡住并发探测。',
      starter: `class CircuitOpenError extends Error {
  constructor(message = 'circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

function planRetries({ maxAttempts = 3, baseDelayMs = 100 } = {}) {
  return Array.from({ length: Math.max(0, maxAttempts - 1) }, (_, index) => baseDelayMs * 2 ** index);
}

function createCircuitBreaker({ failureThreshold = 3 } = {}) {
  let failures = 0;
  async function execute(fn) {
    try {
      return await fn();
    } catch (error) {
      failures += 1;
      throw error;
    }
  }
  return {
    execute,
    get state() {
      return 'closed';
    },
  };
}`,
      solution: `class CircuitOpenError extends Error {
  constructor(message = 'circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

function planRetries({
  maxAttempts = 3,
  baseDelayMs = 100,
  maxDelayMs = 10000,
  budget = Infinity,
  random = Math.random,
} = {}) {
  if (!(maxAttempts >= 1)) throw new RangeError('maxAttempts must be >= 1');
  if (!(baseDelayMs >= 0)) throw new RangeError('baseDelayMs must be >= 0');

  const delays = [];
  let total = 0;
  for (let index = 0; index < maxAttempts - 1; index += 1) {
    const base = Math.min(maxDelayMs, baseDelayMs * 2 ** index);
    const jitter = 0.5 + random();
    const delay = Math.min(maxDelayMs, Math.round(base * jitter));
    if (total + delay > budget) break;
    delays.push(delay);
    total += delay;
  }
  return delays;
}

function createCircuitBreaker({ failureThreshold = 3, cooldownMs = 1000, now = Date.now } = {}) {
  if (!(failureThreshold >= 1)) throw new RangeError('failureThreshold must be >= 1');
  if (!(cooldownMs >= 0)) throw new RangeError('cooldownMs must be >= 0');

  let state = 'closed';
  let failures = 0;
  let openedAt = 0;
  let probing = false;

  function refresh() {
    if (state === 'open' && now() - openedAt >= cooldownMs) {
      state = 'half-open';
      probing = false;
    }
  }

  async function execute(fn) {
    refresh();
    if (state === 'open') throw new CircuitOpenError();
    if (state === 'half-open') {
      if (probing) throw new CircuitOpenError('probe in progress');
      probing = true;
    }
    try {
      const result = await fn();
      state = 'closed';
      failures = 0;
      probing = false;
      return result;
    } catch (error) {
      if (state === 'half-open') {
        state = 'open';
        openedAt = now();
        probing = false;
      } else {
        failures += 1;
        if (failures >= failureThreshold) {
          state = 'open';
          openedAt = now();
        }
      }
      throw error;
    }
  }

  return {
    execute,
    get state() {
      refresh();
      return state;
    },
  };
}`,
      tests: [
        {
          name: '重试延迟指数递增',
          code: `const delays = planRetries({
  maxAttempts: 4,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  budget: Infinity,
  random: () => 0.5,
});
assert.deepEqual(delays, [100, 200, 400]);`
        },
        {
          name: '抖动落在 0.5 到 1.5 倍之间',
          code: `const lower = planRetries({ maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 10000, random: () => 0 });
const upper = planRetries({ maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 10000, random: () => 1 });
assert.deepEqual(lower, [50]);
assert.deepEqual(upper, [150]);`
        },
        {
          name: '每次延迟封顶 maxDelayMs',
          code: `const delays = planRetries({ maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 300, random: () => 0.5 });
assert.deepEqual(delays, [100, 200, 300, 300]);`
        },
        {
          name: '预算不足时提前停止',
          code: `const delays = planRetries({ maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 10000, budget: 250, random: () => 0.5 });
assert.deepEqual(delays, [100]);`
        },
        {
          name: 'maxAttempts 为 1 时没有重试',
          code: `assert.deepEqual(planRetries({ maxAttempts: 1 }), []);`
        },
        {
          name: '连续失败达到阈值打开熔断',
          code: `let clock = 0;
let calls = 0;
const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: () => clock });
async function failing() {
  calls += 1;
  throw new Error('boom');
}
for (let index = 0; index < 2; index += 1) {
  try {
    await breaker.execute(failing);
  } catch (error) {}
}
assert.equal(breaker.state, 'open');
let openError = null;
try {
  await breaker.execute(failing);
} catch (error) {
  openError = error;
}
assert.equal(calls, 2);
assert.ok(openError instanceof CircuitOpenError);`
        },
        {
          name: '冷却后半开探测成功回到 closed',
          code: `let clock = 0;
const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => clock });
try {
  await breaker.execute(async () => {
    throw new Error('down');
  });
} catch (error) {}
assert.equal(breaker.state, 'open');
clock = 100;
const result = await breaker.execute(async () => 'ok');
assert.equal(result, 'ok');
assert.equal(breaker.state, 'closed');`
        },
        {
          name: '半开探测失败回到 open 且冷却重置',
          code: `let clock = 0;
const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => clock });
try {
  await breaker.execute(async () => {
    throw new Error('down');
  });
} catch (error) {}
clock = 100;
try {
  await breaker.execute(async () => {
    throw new Error('still down');
  });
} catch (error) {}
assert.equal(breaker.state, 'open');
let called = false;
try {
  await breaker.execute(async () => {
    called = true;
    return 'ok';
  });
} catch (error) {}
assert.equal(called, false);`
        },
        {
          name: '成功调用重置失败计数',
          code: `let clock = 0;
const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: () => clock });
async function failing() {
  throw new Error('boom');
}
async function ok() {
  return 'ok';
}
try {
  await breaker.execute(failing);
} catch (error) {}
await breaker.execute(ok);
try {
  await breaker.execute(failing);
} catch (error) {}
assert.equal(breaker.state, 'closed');
try {
  await breaker.execute(failing);
} catch (error) {}
assert.equal(breaker.state, 'open');`
        }
      ]
    },
    {
      id: 's3-resilience-ex-2',
      kind: 'design',
      title: 'LinkHub 韧性方案',
      brief: '跳转链路依赖统计服务，统计服务偶发超时；创建接口重复提交会产生多条短链；未来可能多实例部署。请给出超时、重试、熔断、隔离、幂等与演练方案。',
      checklist: [
        '给出超时分层与 deadline 传递',
        '定义可重试错误与重试预算',
        '给出熔断阈值、冷却与半开策略',
        '说明隔离舱：统计失败不拖垮跳转',
        '设计幂等键存储、作用域与 TTL',
        '说明锁边界与 fencing/版本号',
        '说明降级行为与用户可见结果',
        '给出故障演练步骤与验收指标'
      ],
      reference: '<ul><li><strong>超时：</strong>客户端 3s、网关 2.5s、跳转服务 2s、统计下游 800ms；deadline 向下传，剩余时间不足时直接降级。</li><li><strong>重试：</strong>只重试连接失败、超时、502/503/504；统计调用最多 1 次重试，预算 200ms；创建接口不自动重试，依赖幂等键。</li><li><strong>熔断：</strong>统计调用失败率超阈值且请求数达标才打开；冷却 30s 后半开单探测，成功逐步放量。</li><li><strong>隔离：</strong>统计失败只丢事件，不阻塞 302；统计客户端使用独立连接池与超时。</li><li><strong>幂等：</strong>创建接口要求 Idempotency-Key，作用域为租户 + 端点 + key，TTL 24 小时；同键同 body 返回首次结果，不同 body 返回 409。</li><li><strong>锁：</strong>锁只做优化；正确性靠唯一约束与版本号；过期持有者的写入被版本号拒绝（fencing 思路）。</li><li><strong>降级：</strong>跳转永远优先返回 302；统计、分析类功能可关闭；创建接口在存储不可用时快速失败。</li><li><strong>演练：</strong>注入统计延迟与 503、模拟锁过期与队列积压；验收指标为跳转成功率、P99、重复创建数、恢复时间。</li></ul>'
    }
  ]
};
