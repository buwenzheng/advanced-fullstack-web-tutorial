export const s3L3 = {
  id: 's3-l3',
  title: '限流、配额与过载保护',
  subtitle: '令牌桶与滑动窗口、维度选择、容量算术，以及过载时先丢谁。',
  duration: 85,
  status: 'ready',
  objectives: [
    '比较令牌桶、漏桶、固定窗口与滑动窗口的精度、突发与内存成本。',
    '选择限流维度与层次（IP/用户/API Key/租户/全局），并说明 NAT、共享出口与白名单的影响。',
    '实现令牌桶与 429 响应，能从流量与成本推导容量参数。',
    '设计过载丢弃与优先级保护，写清哪些请求先失败。'
  ],
  keywords: ['限流', '令牌桶', '漏桶', '滑动窗口', '配额', '429', 'Retry-After', '过载保护', 'NAT'],
  blocks: [
    {
      type: 'analogy',
      title: '前端 debounce/throttle',
      html: '前端用 <code>debounce</code> 把连续输入合并成一次请求，用 <code>throttle</code> 限制滚动回调频率。它们保护的是浏览器体验：少发请求、少掉帧。服务端限流保护的是数据库、下游服务与自身线程池，压力来自所有用户，而且客户端可以被绕过。<br>类比失效的地方在于共享状态：前端的计数器只在一个页面里，服务端的令牌桶可能被多实例并发读写，还要处理 NAT 后的共享出口。客户端限流减少请求，服务端限流决定「超出的请求怎么失败」。'
    },
    {
      type: 'text',
      title: '速率 / 配额 / 并发',
      html: '速率（rate）是单位时间允许的请求数，例如每秒 100 次；配额（quota）是更长周期内的总量，例如每月 100 万次；并发（concurrency）是同一时刻正在处理的请求数。三者不能互换：速率限制挡瞬时洪峰，配额限制长期成本，并发限制保护线程池或连接池。<br>过载时还要决定排队还是丢弃。排队会拉高延迟并占内存，队列满后仍然拒绝；直接丢弃能保住已在处理的请求。限流参数必须和下游容量、单请求成本一起算，不能只看入口 QPS。'
    },
    {
      type: 'table',
      title: '四种算法',
      head: ['算法', '突发能力', '精度', '内存成本', '实现复杂度', '适用'],
      rows: [
        ['固定窗口', '窗口边界可双倍突发', '低', '每 key 一个计数', '低', '粗粒度配额、内部接口'],
        ['滑动日志', '精确到每次请求', '高', '每 key 保存时间戳列表', '中', '低流量、审计型限制'],
        ['滑动计数', '近似平滑', '中', '每 key 两个窗口计数', '中', '公开 API、需平滑'],
        ['令牌桶', '容量内允许突发', '高', '每 key 两个数', '低', '允许突发的入口限流'],
        ['漏桶', '输出恒定速率', '高', '每 key 一个队列/水位', '中', '需要整形下游流量']
      ],
      note: '算法没有绝对优劣：先问「是否允许突发」「内存预算多少」「是否需要跨实例精确」，再选。'
    },
    {
      type: 'code',
      title: '令牌桶：容量、补充速率与 retryAfterMs',
      lang: 'javascript',
      code: `function createTokenBucket({ capacity, refillPerSecond, now = Date.now } = {}) {
  if (!(capacity > 0)) throw new RangeError('capacity must be positive');
  if (!(refillPerSecond >= 0)) throw new RangeError('refillPerSecond must be >= 0');

  let tokens = capacity;
  let last = now();

  function refill() {
    const current = now();
    const elapsed = Math.max(0, current - last);
    if (elapsed === 0) return;
    // 补充必须封顶，否则空闲越久突发越大
    tokens = Math.min(capacity, tokens + (elapsed / 1000) * refillPerSecond);
    last = current;
  }

  function tryConsume(amount = 1) {
    if (!(amount > 0)) throw new RangeError('tokens must be positive');
    refill();
    if (tokens >= amount) {
      tokens -= amount;
      return { allowed: true, remaining: tokens, retryAfterMs: 0 };
    }
    const missing = amount - tokens;
    const retryAfterMs = refillPerSecond === 0
      ? Infinity
      : Math.ceil((missing / refillPerSecond) * 1000);
    return { allowed: false, remaining: tokens, retryAfterMs };
  }

  return { tryConsume };
}`,
      note: '真实 Redis 实现要把「读令牌、算补充、写回」放进一段 Lua 脚本，避免并发读改写；否则两个实例可能同时看到足够令牌并一起放行。'
    },
    {
      type: 'code',
      title: '429 响应：把等待时间算给客户端',
      lang: 'javascript',
      code: `function buildRateLimitResponse({ retryAfterMs, limit, remaining, requestId }) {
  // s2-l4 已定义契约；这里只实现数值与响应头
  const retryAfterSeconds = Number.isFinite(retryAfterMs)
    ? Math.max(1, Math.ceil(retryAfterMs / 1000))
    : 60;

  return {
    status: 429,
    headers: {
      'Retry-After': String(retryAfterSeconds),
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': String(Math.max(0, Math.floor(remaining))),
      'X-Request-Id': requestId,
    },
    body: {
      error: {
        code: 'rate_limited',
        message: '请求过于频繁，请稍后重试',
        requestId,
      },
    },
  };
}`,
      note: 'Retry-After 至少 1 秒，避免客户端立刻重试形成风暴；配额头名称在不同网关并不统一，团队要固定一套并写进文档。'
    },
    {
      type: 'table',
      title: '维度与层次',
      head: ['维度', '识别对象', '主要风险', '成本', '适用'],
      rows: [
        ['IP', '出口地址', 'NAT/代理后大量用户共享，易误伤', '低', '匿名入口的第一道粗限流'],
        ['用户', '认证后的用户 ID', '多账号绕过；需先认证', '中', '登录后的核心操作'],
        ['API Key', '调用方身份', 'key 泄漏或共享', '中', '第三方集成与配额'],
        ['租户', '组织/工作区', '单租户吃满共享资源', '中', '多租户 SaaS 的公平性'],
        ['全局', '整个服务', '一个维度出问题会整体拒绝', '低', '过载保护的最后一层']
      ],
      note: '通常组合使用：匿名 IP 粗限 → 认证后按用户/租户 → 全局兜底；每层都要有独立的 429 与观测。'
    },
    {
      type: 'pitfall',
      title: '固定窗口边界双倍突发',
      html: '现象：监控显示某个接口在整点前后出现两倍于配置速率的流量；用户投诉「偶尔能用、偶尔全 429」；限流器在多实例下计数明显偏低。<br>原因：固定窗口在窗口切换时允许前后两个窗口各放满配额；读计数、判断、写回不是原子操作，并发请求一起通过；先限流后认证导致匿名维度误伤；Retry-After 拍脑袋写成 0，客户端立刻重试。<br>发现方式：用边界时间压测，比较窗口交界处的放行量；审计限流存储的读改写是否有原子脚本；对照认证日志检查限流维度；统计 429 后的重试间隔。<br>修复：换滑动计数/令牌桶，或把窗口边界做成滚动；用 Lua/事务保证原子；先认证再按用户限流，匿名仅做粗限；Retry-After 按补充速率计算并加抖动。<br>预防：限流单元测试覆盖窗口边界与并发；压测包含突发与持续两种流量；429 比例与重试量进入监控。'
    },
    {
      type: 'steps',
      title: '容量算术与调参',
      steps: [
        { title: '定保护对象', html: '先写清限流保护的是数据库、下游服务还是自身线程池。观察点：每个接口有明确的瓶颈。' },
        { title: '算单请求成本', html: '一次请求的 CPU、查询数、下游调用数。观察点：成本高的接口配额更低。' },
        { title: '算入口容量', html: '下游可承受 QPS ÷ 单请求成本，得到总预算。观察点：预算与压测结果接近。' },
        { title: '定突发容量', html: '按业务允许的瞬时峰值设置桶容量。观察点：突发不会打穿下游连接池。' },
        { title: '压测验证', html: '正常、突发、持续超限三组流量；观察 429 比例、P99 与下游指标。观察点：限流生效且不误伤。' },
        { title: '留调参开关', html: '参数可热更新，保留回滚值。观察点：活动结束后能快速恢复默认。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：分布式限流',
      html: '单进程令牌桶只需一个对象；多实例共享配额时，计数必须放在共享存储里，并且「读—算—写」要原子。Redis 常用 Lua 脚本把补充与扣减合成一次操作；用普通 GET 再 SET 会让并发请求同时通过，实际放行量超过配置。共享 key 还会变成热 key：所有请求打同一个 key，延迟与可用性都受影响。<br>常见折中是 local + global 两层：每个实例本地先限一次，按比例只把一部分请求送到全局计数。这样减少全局调用，但本地层会带来误差，需要接受「总数略超」或「略少」。跨地域时还要处理时钟漂移与配额分配，不能假设所有节点看到同一个 now。',
      note: '具体网关的限流实现与响应头不同；本讲只讲机制与取舍。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「如何设计一个不误伤用户的限流」先分匿名与已认证：匿名按 IP 粗限并允许白名单，认证后按用户/租户/API Key 细限，最后有全局兜底；企业固定出口用 API Key 识别。再说明 429 的 Retry-After、监控与压测，不要只报一个 QPS。<br>「过载时丢谁」按业务优先级回答：保跳转与登录，丢分析、导出、批量任务；同时说明降级后的用户可见行为与恢复顺序。'
    }
  ],
  checks: [
    {
      id: 's3-l3-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '算法选择',
      prompt: '营销活动允许短时间突发，但希望整体不超过下游容量。更适合用哪种算法？',
      question: '营销活动允许短时间突发，但希望整体不超过下游容量。更适合用哪种算法？',
      options: [
        { text: '令牌桶：容量内允许突发，平均速率受补充速率约束', correct: true },
        { text: '漏桶：无论输入如何都按恒定速率输出', correct: false },
        { text: '固定窗口：窗口边界可以双倍突发', correct: false },
        { text: '不限流，靠扩容解决', correct: false }
      ],
      explain: '令牌桶允许在桶容量内突发，长期平均受补充速率限制，适合「允许峰值但不超总预算」。漏桶会把突发整形掉，可能影响体验；固定窗口边界会双倍突发；只扩容不能保护下游。'
    },
    {
      id: 's3-l3-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '维度选择',
      prompt: '关于限流维度与 NAT/租户，以下哪些说法正确？',
      question: '关于限流维度与 NAT/租户，以下哪些说法正确？',
      options: [
        { text: '按 IP 限流会误伤 NAT 后共享出口的大量用户', correct: true },
        { text: '认证后按用户或 API Key 限流更精确', correct: true },
        { text: '租户维度可以防止单个租户吃满共享资源', correct: true },
        { text: '全局限流越严格，用户体验越好', correct: false },
        { text: '所有接口都应该只用 IP 一个维度', correct: false }
      ],
      explain: 'IP 维度粗且受 NAT 影响；用户/API Key 能区分调用方；租户维度保障公平；全局限流是兜底，过严会整体拒绝；单一维度无法覆盖匿名与已认证两类流量。'
    },
    {
      id: 's3-l3-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '429 与 Retry-After',
      prompt: '令牌桶拒绝请求时，Retry-After 最合理的取值依据是什么？',
      question: '令牌桶拒绝请求时，Retry-After 最合理的取值依据是什么？',
      options: [
        { text: '固定写 0，让客户端立刻重试', correct: false },
        { text: '按缺口 token 数与补充速率计算等待时间，向上取整到秒', correct: true },
        { text: '固定写 3600 秒，避免所有重试', correct: false },
        { text: '不返回 Retry-After，让客户端猜', correct: false }
      ],
      explain: 'Retry-After 应指向最早可能成功的时刻：缺口 ÷ 补充速率，向上取整，并至少 1 秒；0 会引发重试风暴，3600 秒会浪费恢复时间，缺失则客户端只能盲猜。'
    }
  ],
  exercises: [
    {
      id: 's3-l3-ex-1',
      kind: 'code',
      title: '令牌桶',
      brief: '实现 createTokenBucket({ capacity, refillPerSecond, now = Date.now } = {})，返回 { tryConsume }。tryConsume(tokens = 1) 返回 { allowed, remaining, retryAfterMs }。初始满桶；按经过时间补充，补充后不超过 capacity；支持小数 token 与小数速率；允许时 retryAfterMs 为 0；拒绝时按缺口 ÷ 速率计算向上取整的毫秒；now 必须可注入。capacity 非正、refillPerSecond 为负或 token 非正时抛 RangeError。',
      hint: '每次 tryConsume 前先 refill：elapsed = max(0, now() - last)；tokens = min(capacity, tokens + elapsed / 1000 * rate)；last = now()。拒绝时 retryAfterMs = ceil(missing / rate * 1000)。',
      starter: `function createTokenBucket({ capacity, refillPerSecond, now = Date.now } = {}) {
  let tokens = capacity;

  function tryConsume(amount = 1) {
    if (tokens >= amount) {
      tokens -= amount;
      return { allowed: true, remaining: tokens, retryAfterMs: 0 };
    }
    return { allowed: false, remaining: tokens, retryAfterMs: 1 };
  }

  return { tryConsume };
}`,
      solution: `function createTokenBucket({ capacity, refillPerSecond, now = Date.now } = {}) {
  if (!(capacity > 0)) throw new RangeError('capacity must be positive');
  if (!(refillPerSecond >= 0)) throw new RangeError('refillPerSecond must be >= 0');

  let tokens = capacity;
  let last = now();

  function refill() {
    const current = now();
    const elapsed = Math.max(0, current - last);
    if (elapsed === 0) return;
    tokens = Math.min(capacity, tokens + (elapsed / 1000) * refillPerSecond);
    last = current;
  }

  function tryConsume(amount = 1) {
    if (!(amount > 0)) throw new RangeError('tokens must be positive');
    refill();
    if (tokens >= amount) {
      tokens -= amount;
      return { allowed: true, remaining: tokens, retryAfterMs: 0 };
    }
    const missing = amount - tokens;
    const retryAfterMs = refillPerSecond === 0
      ? Infinity
      : Math.ceil((missing / refillPerSecond) * 1000);
    return { allowed: false, remaining: tokens, retryAfterMs };
  }

  return { tryConsume };
}`,
      tests: [
        {
          name: '初始满桶可一次消耗完',
          code: `const bucket = createTokenBucket({ capacity: 5, refillPerSecond: 1, now: () => 0 });
const first = bucket.tryConsume(3);
assert.equal(first.allowed, true);
assert.equal(first.remaining, 2);
assert.equal(first.retryAfterMs, 0);
const second = bucket.tryConsume(3);
assert.equal(second.allowed, false);
assert.equal(second.remaining, 2);
assert.equal(second.retryAfterMs, 1000);`
        },
        {
          name: '支持小数 token 消耗',
          code: `const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 0.5, now: () => 0 });
const result = bucket.tryConsume(0.25);
assert.equal(result.allowed, true);
assert.ok(Math.abs(result.remaining - 1.75) < 1e-9);`
        },
        {
          name: '按经过时间补充 token',
          code: `let clock = 0;
const bucket = createTokenBucket({ capacity: 10, refillPerSecond: 2, now: () => clock });
bucket.tryConsume(10);
clock = 1000;
const refilled = bucket.tryConsume(2);
assert.equal(refilled.allowed, true);
assert.ok(Math.abs(refilled.remaining) < 1e-9);`
        },
        {
          name: '耗尽后拒绝并给出 retryAfterMs',
          code: `let clock = 0;
const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 2, now: () => clock });
bucket.tryConsume(2);
const denied = bucket.tryConsume(1);
assert.equal(denied.allowed, false);
assert.equal(denied.retryAfterMs, 500);
clock = 500;
const allowed = bucket.tryConsume(1);
assert.equal(allowed.allowed, true);
assert.equal(allowed.retryAfterMs, 0);`
        },
        {
          name: '补充不超过容量上限',
          code: `let clock = 0;
const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 1, now: () => clock });
bucket.tryConsume(1);
clock = 1_000_000;
const all = bucket.tryConsume(3);
assert.equal(all.allowed, true);
assert.equal(all.remaining, 0);`
        },
        {
          name: '非法参数与非正 token 抛 RangeError',
          code: `let capacityError = null;
try {
  createTokenBucket({ capacity: 0, refillPerSecond: 1, now: () => 0 });
} catch (caught) {
  capacityError = caught;
}
assert.ok(capacityError instanceof RangeError);
const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now: () => 0 });
let amountError = null;
try {
  bucket.tryConsume(0);
} catch (caught) {
  amountError = caught;
}
assert.ok(amountError instanceof RangeError);`
        },
        {
          name: '恒定速率下按秒补充并可继续消耗',
          code: `let clock = 0;
const bucket = createTokenBucket({ capacity: 4, refillPerSecond: 1, now: () => clock });
bucket.tryConsume(4);
assert.equal(bucket.tryConsume(1).allowed, false);
for (let second = 1; second <= 4; second += 1) {
  clock = second * 1000;
  assert.equal(bucket.tryConsume(1).allowed, true);
}
assert.equal(bucket.tryConsume(1).allowed, false);`
        }
      ]
    },
    {
      id: 's3-l3-ex-2',
      kind: 'design',
      title: 'LinkHub 限流策略',
      brief: '跳转、创建、登录三类接口共享数据库；营销活动会带来突发；部分企业客户走固定出口 IP。请给出限流对象、维度、算法、429 契约、白名单、过载丢弃、监控与压测方案。',
      checklist: [
        '明确限流对象与不限制对象',
        '选择维度并说明 NAT 与共享出口的误伤',
        '选择算法与突发容量',
        '定义 429、Retry-After 与配额头',
        '给出白名单与优先级',
        '说明监控、告警与压测',
        '说明过载时丢谁',
        '给出降级与回滚条件'
      ],
      reference: '<ul><li><strong>对象：</strong>创建按用户/API Key，跳转按 IP + 全局，登录按 IP + 账号；静态资源不计入业务配额。</li><li><strong>维度：</strong>匿名 IP 粗限，认证后按用户/租户/API Key；企业固定出口用 API Key 或白名单识别，避免 NAT 误伤。</li><li><strong>算法：</strong>创建与跳转用令牌桶允许短突发；登录用更严格的滑动计数；全局用粗粒度兜底。</li><li><strong>429：</strong>429 + <code>rate_limited</code> + Retry-After + 配额头；Retry-After 按补充时间计算。</li><li><strong>优先级：</strong>过载时保跳转与登录，丢分析、导出、批量任务；白名单单独审计。</li><li><strong>监控：</strong>429 比例、各维度放行量、下游 QPS/P99、误伤投诉。</li><li><strong>压测：</strong>正常、突发、持续超限三组；验证限流生效且登录不受影响。</li><li><strong>回滚：</strong>参数热更新，保留默认值；异常时降级为粗限流或关闭非核心接口。</li></ul>'
    }
  ]
};
