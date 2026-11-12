export const m3Realtime = {
  id: 'm3-realtime',
  title: '实时、认证与全栈安全',
  subtitle: 'SSE/WebSocket、重连与事件归并、HttpOnly 会话、CSRF 与 CSP。',
  duration: 80,
  status: 'ready',
  objectives: [
    '在 SSE/WebSocket/长轮询之间按方向、基础设施与成本做选择。',
    '设计重连、退避、去重、断点续传与降级轮询。',
    '用 HttpOnly/SameSite/CSRF/CSP 组合建立浏览器会话的安全边界。',
    '识别 XSS/CORS/越权/租户隔离在全栈中的责任分界。'
  ],
  keywords: ['SSE', 'WebSocket', '长轮询', '重连', '指数退避', 'jitter', '去重', 'HttpOnly', 'SameSite', 'CSRF', 'CSP', 'CORS'],
  blocks: [
    {
      type: 'analogy',
      title: '刷新页面、订阅报纸与打电话',
      html: '长轮询像不停刷新页面：客户端问一次，服务端憋到有数据才回答，答完再问。SSE 像订报纸：只订阅，报社有新内容就推送，方向是单向的。WebSocket 像打电话：双方随时说话，但通话要一直占着线路，中间设备也要支持升级。<br>类比失效的地方在基础设施：报纸可以塞进任何邮箱，电话需要双方都在线。SSE 走普通 HTTP，代理与网关兼容好；WebSocket 需要协议升级与长连接管理；长轮询实现最简单，但每次都要重建请求。选择时先看方向：只需服务端推给客户端，SSE 往往够用；双向低延迟交互才需要 WebSocket。'
    },
    {
      type: 'table',
      title: '三种实时传输',
      head: ['维度', '长轮询', 'SSE', 'WebSocket'],
      rows: [
        ['方向', '客户端拉取，伪推送', '服务端 → 客户端单向', '双向'],
        ['协议', 'HTTP 请求/响应', 'HTTP 长连接', 'HTTP 升级后的独立协议'],
        ['代理兼容', '最好', '好，基于 HTTP', '需代理支持升级与长连接'],
        ['重连', '天然按请求重试', '浏览器自动重连，可配 Last-Event-ID', '需自行实现'],
        ['成本', '请求数与延迟高', '连接数与心跳管理', '连接状态与背压复杂'],
        ['适用', '低频通知、兼容性优先', '点击看板、进度、通知', '协作编辑、聊天、双向交互']
      ],
      note: '方向决定选择：单向推送优先 SSE，双向交互才上 WebSocket。长轮询适合低频与兼容性要求高的场景，不要因为它简单就用在秒级更新上。'
    },
    {
      type: 'code',
      title: '重连计划：指数退避、上限与 jitter',
      lang: 'javascript',
      code: `function planReconnect(attempt, options = {}) {
  const baseMs = options.baseMs === undefined ? 100 : options.baseMs;
  const maxMs = options.maxMs === undefined ? 1600 : options.maxMs;
  const jitter = options.jitter === undefined ? 0.2 : options.jitter;
  const maxAttempts = options.maxAttempts === undefined ? 5 : options.maxAttempts;
  const random = options.random || Math.random;

  if (attempt >= maxAttempts) {
    return { delayMs: 0, exhausted: true };
  }
  const raw = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const factor = 1 - jitter + 2 * jitter * random();
  return { delayMs: Math.round(raw * factor), exhausted: false };
}`,
      note: '指数退避让重试间隔增长，上限防止无限等待；jitter 打散同时重连的客户端，避免重连风暴。random 必须可注入，否则测试只能碰运气。attempt 从 0 开始，耗尽后交给降级轮询或人工提示。'
    },
    {
      type: 'flow',
      title: '实时链路：从建连到补拉',
      steps: [
        { name: '建连', detail: '建立 SSE/WebSocket 连接，带上身份与订阅参数。失败表现：连接被网关拒绝或超时。' },
        { name: '鉴权', detail: '在建立连接时校验会话或短期票据。失败表现：连接成功但事件接口不鉴权，造成越权。' },
        { name: '订阅', detail: '按用户、租户或看板订阅，控制扇出。失败表现：订阅粒度过粗，一个人看全站事件。' },
        { name: '接收事件', detail: '按 id 去重，按 seq 检测缺口，更新 UI 状态。失败表现：重复事件把计数加两次。' },
        { name: '断线', detail: '心跳超时或网络切换，进入重连计划。失败表现：无退避，所有客户端同时重连。' },
        { name: '重连', detail: '指数退避 + jitter，带最后事件 id 请求补拉。失败表现：只重连不补拉，缺口永远存在。' },
        { name: '补拉与降级', detail: '按缺口拉取历史事件；重试耗尽后降级轮询。失败表现：实时挂了页面完全不更新。' }
      ]
    },
    {
      type: 'text',
      title: '会话 vs Token：登录态放在哪里',
      html: '浏览器会话有两种常见形态：Cookie-Session 与前端持有的 Token。Cookie-Session 把会话标识放在 HttpOnly Cookie 里，JavaScript 读不到，XSS 难以直接窃取；浏览器自动携带，天然支持同源请求，但也意味着跨站请求会自动带上，需要 SameSite 与 CSRF token 防护。前端 Token 通常放在内存或 localStorage：内存方案刷新即丢，需要额外的刷新机制；localStorage 方案实现简单，但任何 XSS 都能读走，且无法用 HttpOnly 保护。<br>登录态不应该放在 JavaScript 可读的存储里，这是本讲的硬边界。推荐组合是：会话 Cookie 使用 HttpOnly + Secure + SameSite=Lax 或 Strict；写操作再加 CSRF token 或双重提交校验；刷新与撤销由服务端控制。Token 不是原罪，但把长期 token 放进 localStorage 等于把钥匙挂在门上。<br>会话还要考虑过期与撤销：短会话 + 滑动续期降低泄露窗口；服务端要能主动失效；多设备登录要有会话列表。这里的重点是浏览器如何安全持有凭证；「谁能调用哪个 API」属于 m2-auth 的授权模型，不在这里重复。'
    },
    {
      type: 'table',
      title: '安全头的分工',
      head: ['响应头', '主要作用', '常见误区'],
      rows: [
        ['Content-Security-Policy', '限制脚本、样式、连接等资源来源，降低 XSS 影响', '只防 inline script，不防 DOM XSS 与被允许的第三方脚本'],
        ['Strict-Transport-Security', '强制后续请求走 HTTPS', '首次请求无法保护；需要正确 max-age'],
        ['X-Frame-Options / frame-ancestors', '防点击劫持', '与 CSP frame-ancestors 重复配置时以更严格者为准'],
        ['Referrer-Policy', '控制跨站请求携带的来源信息', '不是访问控制，不能替代鉴权'],
        ['Set-Cookie 属性', 'HttpOnly/Secure/SameSite 约束会话 Cookie', 'SameSite 默认值因浏览器而异，必须显式声明']
      ],
      note: '安全头是纵深防御的一层，不是替代品：CSP 降低 XSS 影响，CSRF token 防跨站写操作，服务端鉴权防越权。任何一层缺失，其他层都不能单独兜底。'
    },
    {
      type: 'code',
      title: '实时事件归并：去重、乱序与缺口',
      lang: 'javascript',
      code: `function applyLiveEvent(state, event) {
  const next = {
    total: state.total || 0,
    perLink: { ...(state.perLink || {}) },
    seenIds: [...(state.seenIds || [])],
    lastEventId: state.lastEventId === undefined ? null : state.lastEventId,
    lastSeq: state.lastSeq === undefined ? 0 : state.lastSeq,
    gap: state.gap === true
  };

  if (!event || !event.id) return next;
  if (next.seenIds.includes(event.id)) return next;

  next.seenIds.push(event.id);
  next.total += event.delta;
  next.perLink[event.linkId] = (next.perLink[event.linkId] || 0) + event.delta;

  if (event.seq > next.lastSeq + 1) next.gap = true;
  if (event.seq >= next.lastSeq) {
    next.lastSeq = event.seq;
    next.lastEventId = event.id;
  }
  return next;
}`,
      note: '去重必须按稳定 id，不能按内容：两条内容相同的事件可能代表两次真实点击。gap 是粘性标记：一旦发现缺口就提示补拉，不会因为后续事件到达自动清除。返回新对象而不是修改入参，UI 状态更新才能可预测。'
    },
    {
      type: 'case',
      title: '重连风暴打挂网关',
      context: 'LinkHub 实时看板在网关发布后集体断线，五万客户端在同一秒重连，网关连接数瞬间打满，其他接口一起超时。',
      symptom: '断线后 10 秒内网关 CPU 与连接数飙升；重连成功率不足 30%；看板大面积空白，轮询降级也没触发。',
      cause: '客户端重连没有退避与 jitter，所有客户端按固定 1 秒间隔同时重试；没有重试上限；网关没有连接速率限制。',
      fix: '改为指数退避 + jitter，上限 30 秒；加入随机初始延迟；重试耗尽后降级轮询；网关按租户做连接速率限制。',
      prevention: '重连计划由测试锁定；发布时观察重连速率而不是只看连接总数；压测包含「全体断线」场景。',
      metric: '断线后重连峰值从 5 万/秒降到 6 千/秒，10 分钟内全部恢复'
    },
    {
      type: 'pitfall',
      title: '实时与安全的五个坑',
      html: '<strong>登录态放 localStorage：</strong>任何 XSS 都能读走长期 token。修复：HttpOnly 会话 Cookie + CSRF 防护。<br><strong>CORS 通配加 credentials：</strong>浏览器规范不允许 `*` 与 credentials 组合，配置看似生效实则被拒。修复：显式列出允许的来源。<br><strong>SSE 不鉴权：</strong>只校验了建立连接的页面，没有校验事件接口的会话与订阅范围。修复：建连时鉴权，按用户/租户限定订阅。<br><strong>重复事件重复计数：</strong>按内容去重或完全不去重，重连补拉后计数翻倍。修复：按稳定 id 去重，服务端保证 id 唯一。<br><strong>重连风暴：</strong>无退避、无 jitter、无上限，全体同时重连。修复：指数退避 + jitter + 上限 + 降级。'
    },
    {
      type: 'steps',
      title: '实时看板链路设计',
      steps: [
        { title: '确定方向与频率', html: '只需服务端推送就选 SSE；需要双向低延迟才选 WebSocket。观察点：传输选择有明确理由，不追新。' },
        { title: '定义订阅粒度', html: '按用户、租户、看板订阅，避免全站广播。观察点：一个连接只能收到有权看到的事件。' },
        { title: '设计扇出与背压', html: '事件从写入到推送的路径、缓冲与丢弃策略。观察点：慢消费者不会拖垮服务端。' },
        { title: '重连与补拉', html: '指数退避 + jitter；带最后事件 id 补拉缺口。观察点：断线十分钟后恢复，数据仍完整。' },
        { title: '降级轮询', html: '实时不可用时按较低频率轮询快照。观察点：降级可开关，恢复后自动切回。' },
        { title: '安全边界', html: 'HttpOnly 会话、CSRF、CSP、CORS 白名单与租户隔离。观察点：越权订阅被拒绝。' }
      ]
    },
    {
      type: 'compare',
      title: 'OIDC 授权码 + PKCE 与自建密码登录',
      cols: [
        {
          title: 'OIDC + PKCE',
          items: [
            '身份由独立提供方负责',
            '授权码 + PKCE 适合公共客户端',
            '接入成本与重定向流程更复杂',
            '适合多产品、企业登录与 SSO'
          ]
        },
        {
          title: '自建密码登录',
          items: [
            '实现直接、依赖少',
            '密码存储、重置、风控都要自己承担',
            '难以支持 SSO 与多产品',
            '适合早期单产品与内部系统'
          ]
        }
      ]
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「HttpOnly Cookie 为什么仍需要 CSRF 防护」：HttpOnly 防的是脚本读取，不防浏览器自动携带。攻击者不需要读 Cookie，只要诱导用户浏览器向目标站点发请求，Cookie 就会自动带上。防护靠 SameSite、CSRF token 或双重提交，以及写操作不用 GET。<br>「SSE 和 WebSocket 怎么选」先答方向与基础设施：单向推送、希望复用 HTTP 与自动重连，选 SSE；双向低延迟、需要自定义协议，选 WebSocket。再补一句代价：SSE 连接数受浏览器与代理限制，WebSocket 要自己管理重连、心跳与背压。'
    }
  ],
  checks: [
    {
      id: 'm3-realtime-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '传输选择',
      prompt: '只需要服务端向浏览器推送点击通知，优先选择 SSE 的主要理由是什么？',
      question: '只需要服务端向浏览器推送点击通知，优先选择 SSE 的主要理由是什么？',
      options: [
        { text: '单向推送足够，SSE 基于 HTTP、代理兼容好且浏览器支持自动重连', correct: true },
        { text: 'SSE 支持双向通信，可以替代 WebSocket', correct: false },
        { text: 'SSE 不需要鉴权，接入更简单', correct: false },
        { text: 'SSE 的连接数没有上限', correct: false }
      ],
      explain: 'SSE 是单向推送，走 HTTP，天然适配现有代理与鉴权，浏览器提供自动重连。它不支持双向通信，也需要鉴权。'
    },
    {
      id: 'm3-realtime-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '重连设计',
      prompt: '一个可靠的重连方案必须处理哪些事情？',
      question: '一个可靠的重连方案必须处理哪些事情？',
      options: [
        { text: '指数退避与最大间隔', correct: true },
        { text: 'jitter 打散同时重连的客户端', correct: true },
        { text: '按事件 id 去重，避免补拉重复计数', correct: true },
        { text: '重试耗尽后的补拉或降级轮询', correct: true },
        { text: '把所有客户端重连间隔固定为 1 秒', correct: false }
      ],
      explain: '退避、jitter、去重与降级是可靠重连的四件事。固定间隔会让所有客户端同步重连，形成风暴。'
    },
    {
      id: 'm3-realtime-check-3',
      kind: 'mcq',
      type: 'single',
      tag: 'CSP 边界',
      prompt: 'CSP 禁止了 inline script 后，页面仍可能被 XSS 攻击的路径是什么？',
      question: 'CSP 禁止了 inline script 后，页面仍可能被 XSS 攻击的路径是什么？',
      options: [
        { text: 'DOM XSS，或被 CSP 允许的第三方脚本被篡改', correct: true },
        { text: 'CSP 会自动修复所有 XSS', correct: false },
        { text: '只要设置了 CSP，就不需要输出转义', correct: false },
        { text: 'CSP 只能防 SQL 注入', correct: false }
      ],
      explain: 'CSP 降低 XSS 影响，但不能替代输出转义与依赖治理。DOM XSS 不经过内联脚本；被允许的第三方脚本若被攻破，仍在白名单内。'
    }
  ],
  exercises: [
    {
      id: 'm3-realtime-ex-1',
      kind: 'code',
      title: '重连计划 + 实时事件归并（跨层：传输 → UI 状态）',
      brief: '实现 planReconnect(attempt, options) 与 applyLiveEvent(state, event)。planReconnect 返回 { delayMs, exhausted }：attempt 从 0 开始；raw = min(baseMs * 2^attempt, maxMs)；delayMs = round(raw * (1 - jitter + 2 * jitter * random()))；attempt >= maxAttempts 时返回 { delayMs: 0, exhausted: true }。applyLiveEvent 接收 { total, perLink, seenIds, lastEventId, lastSeq } 与 { id, linkId, delta, seq }：重复 id 忽略；新 id 累加 total 与 perLink；seq > lastSeq + 1 时标记 gap: true；seq 更大时更新 lastEventId 与 lastSeq；不修改入参。',
      hint: 'planReconnect 先判断耗尽，再算 cap 与 jitter；random 从 options 取，缺省 Math.random。applyLiveEvent 先做浅拷贝（perLink、seenIds 也要复制），再按 id 去重、累加、检测缺口；返回新对象，gap 是粘性标记。',
      starter: `function planReconnect(attempt, options = {}) {
  return { delayMs: 100 * attempt, exhausted: false };
}

function applyLiveEvent(state, event) {
  state.total += event.delta;
  state.perLink[event.linkId] = (state.perLink[event.linkId] || 0) + event.delta;
  state.seenIds.push(event.id);
  state.lastEventId = event.id;
  state.lastSeq = event.seq;
  return state;
}`,
      solution: `function planReconnect(attempt, options = {}) {
  const baseMs = options.baseMs === undefined ? 100 : options.baseMs;
  const maxMs = options.maxMs === undefined ? 1600 : options.maxMs;
  const jitter = options.jitter === undefined ? 0.2 : options.jitter;
  const maxAttempts = options.maxAttempts === undefined ? 5 : options.maxAttempts;
  const random = options.random || Math.random;

  if (attempt >= maxAttempts) {
    return { delayMs: 0, exhausted: true };
  }
  const raw = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const factor = 1 - jitter + 2 * jitter * random();
  return { delayMs: Math.round(raw * factor), exhausted: false };
}

function applyLiveEvent(state, event) {
  const next = {
    total: state.total || 0,
    perLink: { ...(state.perLink || {}) },
    seenIds: [...(state.seenIds || [])],
    lastEventId: state.lastEventId === undefined ? null : state.lastEventId,
    lastSeq: state.lastSeq === undefined ? 0 : state.lastSeq,
    gap: state.gap === true
  };

  if (!event || !event.id) return next;
  if (next.seenIds.includes(event.id)) return next;

  next.seenIds.push(event.id);
  next.total += event.delta;
  next.perLink[event.linkId] = (next.perLink[event.linkId] || 0) + event.delta;

  if (event.seq > next.lastSeq + 1) next.gap = true;
  if (event.seq >= next.lastSeq) {
    next.lastSeq = event.seq;
    next.lastEventId = event.id;
  }
  return next;
}`,
      tests: [
        {
          name: '指数退避序列按基数增长',
          code: `const first = planReconnect(0, { jitter: 0, random: () => 0.5 });
const second = planReconnect(1, { jitter: 0, random: () => 0.5 });
const third = planReconnect(2, { jitter: 0, random: () => 0.5 });
assert.equal(first.delayMs, 100);
assert.equal(second.delayMs, 200);
assert.equal(third.delayMs, 400);
assert.equal(first.exhausted, false);`
        },
        {
          name: '退避封顶在 maxMs',
          code: `const capped = planReconnect(4, { baseMs: 100, maxMs: 400, jitter: 0 });
assert.equal(capped.delayMs, 400);
assert.equal(capped.exhausted, false);
const near = planReconnect(3, { baseMs: 100, maxMs: 1600, jitter: 0 });
assert.equal(near.delayMs, 800);`
        },
        {
          name: 'jitter 在上下界内且可复现',
          code: `const low = planReconnect(0, { jitter: 0.2, random: () => 0 });
const high = planReconnect(0, { jitter: 0.2, random: () => 1 });
assert.equal(low.delayMs, 80);
assert.equal(high.delayMs, 120);`
        },
        {
          name: '重试耗尽标记 exhausted',
          code: `const last = planReconnect(4, { jitter: 0 });
assert.equal(last.exhausted, false);
const exhausted = planReconnect(5, { jitter: 0 });
assert.deepEqual(exhausted, { delayMs: 0, exhausted: true });
const custom = planReconnect(2, { maxAttempts: 2 });
assert.deepEqual(custom, { delayMs: 0, exhausted: true });`
        },
        {
          name: '重复事件只累加一次',
          code: `const state = { total: 0, perLink: {}, seenIds: [], lastEventId: null, lastSeq: 0 };
const once = applyLiveEvent(state, { id: 'e1', linkId: 'a', delta: 2, seq: 1 });
const twice = applyLiveEvent(once, { id: 'e1', linkId: 'a', delta: 2, seq: 1 });
assert.equal(twice.total, 2);
assert.equal(twice.perLink.a, 2);
assert.equal(twice.seenIds.length, 1);`
        },
        {
          name: '两个链接独立累加',
          code: `let state = { total: 0, perLink: {}, seenIds: [], lastEventId: null, lastSeq: 0 };
state = applyLiveEvent(state, { id: 'e1', linkId: 'a', delta: 1, seq: 1 });
state = applyLiveEvent(state, { id: 'e2', linkId: 'b', delta: 5, seq: 2 });
state = applyLiveEvent(state, { id: 'e3', linkId: 'a', delta: 2, seq: 3 });
assert.equal(state.total, 8);
assert.equal(state.perLink.a, 3);
assert.equal(state.perLink.b, 5);`
        },
        {
          name: '乱序事件按 id 去重后仍只累加一次',
          code: `let state = { total: 0, perLink: {}, seenIds: [], lastEventId: null, lastSeq: 0 };
state = applyLiveEvent(state, { id: 'e2', linkId: 'a', delta: 2, seq: 2 });
state = applyLiveEvent(state, { id: 'e1', linkId: 'a', delta: 1, seq: 1 });
assert.equal(state.total, 3);
assert.equal(state.perLink.a, 3);
assert.equal(state.seenIds.length, 2);
assert.equal(state.lastEventId, 'e2');
assert.equal(state.lastSeq, 2);
assert.equal(state.gap, true);`
        },
        {
          name: 'seq 缺口标记且连续序列不标记',
          code: `const base = { total: 0, perLink: {}, seenIds: [], lastEventId: null, lastSeq: 0 };
const first = applyLiveEvent(base, { id: 'e1', linkId: 'a', delta: 1, seq: 1 });
const second = applyLiveEvent(first, { id: 'e2', linkId: 'a', delta: 1, seq: 2 });
assert.equal(second.gap, false);
const jumped = applyLiveEvent(second, { id: 'e4', linkId: 'a', delta: 1, seq: 4 });
assert.equal(jumped.gap, true);
const continued = applyLiveEvent(jumped, { id: 'e5', linkId: 'a', delta: 1, seq: 5 });
assert.equal(continued.gap, true);
assert.equal(continued.total, 4);`
        },
        {
          name: '不修改入参且更新最后事件',
          code: `const state = { total: 5, perLink: { a: 5 }, seenIds: ['x'], lastEventId: 'x', lastSeq: 2 };
const snapshot = JSON.stringify(state);
const next = applyLiveEvent(state, { id: 'y', linkId: 'a', delta: 2, seq: 3 });
assert.equal(JSON.stringify(state), snapshot);
assert.equal(next.total, 7);
assert.equal(next.perLink.a, 7);
assert.equal(next.lastEventId, 'y');
assert.equal(next.lastSeq, 3);
assert.equal(next.seenIds.length, 2);`
        }
      ]
    },
    {
      id: 'm3-realtime-ex-2',
      kind: 'design',
      title: 'LinkHub 实时与安全设计',
      brief: '为 LinkHub 点击看板设计实时链路与安全边界：说明传输选择、鉴权方式、订阅粒度、扇出与背压、重连与补拉、事件去重、降级轮询、会话存储、CSRF、CSP、CORS、租户隔离与审计日志。',
      checklist: [
        '传输选择与理由（SSE/WebSocket/长轮询）',
        '建连鉴权与会话校验',
        '订阅粒度与租户隔离',
        '扇出、背压与慢消费者策略',
        '重连退避、jitter 与补拉',
        '事件去重与缺口处理',
        '降级轮询与恢复',
        '会话存储位置与 Cookie 属性',
        'CSRF 防护方式',
        'CSP 与安全头组合',
        'CORS 白名单与 credentials',
        '越权与租户隔离的测试',
        '审计日志与异常告警'
      ],
      reference: '<ul><li><strong>传输：</strong>点击看板只需服务端推送，选 SSE；双向操作另开普通 API。</li><li><strong>鉴权：</strong>建连时校验 HttpOnly 会话与租户；事件接口按订阅再校验一次，不能只靠页面登录。</li><li><strong>订阅：</strong>按用户与看板订阅，连接只收到有权查看的事件。</li><li><strong>背压：</strong>每个连接有缓冲上限，慢消费者丢弃旧事件并标记缺口，由补拉恢复。</li><li><strong>重连：</strong>指数退避 + jitter，上限 30 秒；带最后事件 id 补拉，重试耗尽后降级轮询。</li><li><strong>去重：</strong>按稳定事件 id；gap 为粘性标记，触发补拉。</li><li><strong>会话：</strong>HttpOnly + Secure + SameSite=Lax；写操作加 CSRF token。</li><li><strong>头部：</strong>CSP 限制脚本与连接源；HSTS 强制 HTTPS；CORS 显式来源且允许 credentials。</li><li><strong>隔离：</strong>每次查询带租户条件；越权订阅返回 403 并有测试。</li><li><strong>审计：</strong>记录建连、订阅变更、越权拒绝与重连异常，按租户聚合。</li></ul>'
    }
  ]
};
