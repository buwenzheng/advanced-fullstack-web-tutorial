export const s6L4 = {
  id: 's6-l4',
  title: '边缘部署、特性开关与全栈可观测性',
  subtitle: 'CDN/边缘缓存、SWR、特性开关与灰度、RUM 与前后端 trace 串联。',
  duration: 80,
  status: 'ready',
  objectives: [
    '设计 CDN/边缘缓存策略，并说明缓存键、Vary 与个性化内容的关系。',
    '识别边缘函数的运行时、CPU、状态与日志限制。',
    '用特性开关完成灰度与即时回滚，并控制开关债。',
    '用 RUM 与服务端 trace 串联定位端到端性能问题。'
  ],
  keywords: ['CDN', '边缘缓存', 'stale-while-revalidate', '边缘函数', '特性开关', '灰度', 'kill switch', 'RUM', 'traceparent', 'LCP', 'p75'],
  blocks: [
    {
      type: 'analogy',
      title: '前置仓、店内现做与出餐单',
      html: 'CDN 缓存像前置仓：把成品提前放到离用户近的地方，取货快，但同一批货对所有用户都一样。个性化页面像店内现做，必须知道顾客是谁才出餐，不能把别人的餐直接递过去。特性开关像菜单上的「今日供应」标牌，可以让某道菜先对一部分人上线。<br>RUM 像门店的排队计时与顾客反馈，服务端 trace 像后厨的出餐单。只有把两边的时间对齐，才知道顾客等的是点单、做菜还是送餐。类比失效的地方在管理方式：前置仓可以随手补货，缓存却要按 TTL、缓存键与失效策略管理；菜单标牌可以手写，开关却必须有所有者、默认值与过期时间。'
    },
    {
      type: 'text',
      title: '边缘缓存的三个决定：键、头与个性化',
      html: '边缘缓存是否命中由缓存键决定，缓存键至少包含路径与查询串；<code>Vary</code> 再决定按哪些请求头分流，最容易被忽略的是 <code>Cookie</code> 与 <code>Authorization</code>。公共 CDN 只应缓存与用户无关的响应：营销页、文档、公开短链的跳转页可以直接缓存；个人看板、账户设置、带权限的列表必须走 <code>private</code> / <code>no-store</code>，或者在边缘按用户维度做私有缓存。<br>一旦个性化内容进入公共缓存，就会串号：用户 A 看到用户 B 的短链与计数。反过来，把所有响应都设成不可缓存，边缘层就只剩下转发，热门内容全部回源，延迟与源站成本都会上升。正确姿势是先分类：公共内容用长 TTL，个性化内容 bypass 或走私有键，写操作与带 <code>Set-Cookie</code> 的响应永不缓存。<br><code>stale-while-revalidate</code> 的语义来自 RFC 5861：在 TTL 之后的窗口内先返回旧值，同时后台刷新。落地关键是单飞与失败保留旧值，否则并发请求会把一次回源放大成几十次。边缘层解决地理距离与公共内容，应用层缓存解决重复计算，两者都不能替代一致性设计。'
    },
    {
      type: 'code',
      title: '边缘缓存决策：fresh / stale / miss / bypass',
      lang: 'javascript',
      code: `function createEdgeCache({ ttlMs, swrMs, now, load, onRefreshError }) {
  const cache = new Map();
  const refreshing = new Map();

  async function get(key, options = {}) {
    const bypass = options.bypass === true;
    const entry = cache.get(key);
    if (!bypass && entry) {
      const age = now() - entry.storedAt;
      if (age <= ttlMs) return { value: entry.value, state: 'fresh' };
      if (age <= ttlMs + swrMs) {
        if (!refreshing.has(key)) {
          const task = Promise.resolve()
            .then(() => load(key))
            .then((value) => cache.set(key, { value, storedAt: now() }))
            .catch((error) => onRefreshError && onRefreshError(error, key))
            .finally(() => refreshing.delete(key));
          refreshing.set(key, task);
        }
        return { value: entry.value, state: 'stale' };
      }
    }
    const value = await load(key);
    cache.set(key, { value, storedAt: now() });
    return { value, state: bypass ? 'bypass' : 'miss' };
  }

  async function whenIdle() {
    while (refreshing.size) {
      await Promise.all([...refreshing.values()]);
    }
  }

  return { get, whenIdle };
}`,
      note: '四种状态必须能区分：fresh 直接返回，stale 返回旧值并单飞刷新，miss 等待回源，bypass 跳过缓存。now 与 load 都可注入，测试不需要真实计时器。刷新失败只记录、不覆盖旧值，下一次 stale 还能重试。'
    },
    {
      type: 'table',
      title: '边缘函数的限制',
      head: ['维度', '典型约束', '设计对策'],
      rows: [
        ['运行时', '不同厂商的运行时与 API 支持差异大', '只用标准 Web API，平台能力封装成适配层'],
        ['执行时间', '通常毫秒级 CPU 预算，长任务会被终止', '重计算与长事务放回源站'],
        ['内存', '内存小且按实例隔离', '不在内存里做跨请求状态'],
        ['状态', '没有可靠的本地持久状态', '用 KV、对象存储或回源维护状态'],
        ['日志', '采集有延迟，调试信息可能丢失', '结构化日志 + 请求 id，关键路径回源记录'],
        ['冷启动', '实例按需拉起，首次请求更慢', '把关键逻辑放在常驻服务，边缘只做轻决策']
      ],
      note: '边缘函数适合鉴权、重写、缓存决策与轻量个性化；不适合数据库长事务、大批量计算与依赖本地状态的任务。'
    },
    {
      type: 'code',
      title: '特性开关：白名单、租户、百分比与 kill switch',
      lang: 'javascript',
      code: `function hash(input) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function isEnabled(flag, context) {
  if (!flag || flag.kill) return false;
  if ((flag.allow || []).includes(context.userId)) return true;
  if ((flag.tenants || []).includes(context.tenantId)) return true;
  const bucket = hash(\`\${flag.key}:\${context.userId}\`) % 100;
  return bucket < (flag.percent || 0);
}`,
      note: '判定顺序就是治理顺序：kill switch 最先，白名单与租户其次，百分比最后。分桶输入必须带开关 key，否则同一用户在所有开关里都落在同一个桶。percent 为 100 时全员开启，但仍受 kill switch 控制。'
    },
    {
      type: 'flow',
      title: '发布 → 灰度 → 健康度 → 扩量或回滚',
      steps: [
        { name: '内部与白名单', detail: '先对内部账号和测试租户开启。观察点：错误率、关键接口延迟与日志异常无变化。' },
        { name: '5% 灰度', detail: '按用户分桶放量，持续一个完整业务周期。观察点：新功能的成功率、CWV 与服务端 p75 与基线持平。' },
        { name: '25% 扩量', detail: '覆盖更多设备与地区，检查长尾。观察点：移动端与弱网分组无聚集性劣化。' },
        { name: '100% 全量', detail: '移除旧路径或保留开关待清理。观察点：告警安静、无新增错误分类。' },
        { name: '回滚判定', detail: '任一项超过阈值立即 kill。观察点：回滚在分钟级完成，且不依赖重新部署。' },
        { name: '开关清理', detail: '全量稳定后删除分支与配置。观察点：每个开关都有所有者与过期时间。' }
      ]
    },
    {
      type: 'text',
      title: 'RUM 与服务端 trace：两种视角拼成一条链路',
      html: 'RUM 在真实用户浏览器里采集 LCP、INP、CLS、长任务与错误，按页面、设备、地区与版本分组。它回答「用户体感如何、哪些人群最慢」，但不回答「慢在系统哪一段」。服务端 trace 记录一次请求内的 span 与耗时，回答「系统内部慢在哪」。两者靠 traceId 串联：页面请求携带或生成 <code>traceparent</code>（W3C Trace Context），响应头返回同一个 traceId，RUM 事件带上它。<br>合并时以浏览器起点为 0：先看开场等待（请求发出前的排队、DNS 与连接），再按开始时间排列服务端 span，检查相邻 span 之间的空档，最后看最后一个 span 结束到 LCP 之间的渲染等待。最大缺口就是下一步排查方向：缺口在开头查网络与排队，在中间查未打点的调用或异步等待，在结尾查资源加载与渲染阻塞。<br>采样要分层：高流量接口低采样，错误与慢请求全采样；只按比例随机采样会让 RUM 看不到最慢的用户。隐私上不要把 URL 中的敏感参数、用户输入与完整 Cookie 写进事件，采集前先脱敏。<br>这套方法是浏览器与服务器共用同一个 traceId 才成立的硬约束；只有 RUM 没有 trace，只能知道「慢」，无法知道「慢在哪」。'
    },
    {
      type: 'code',
      title: '合并 RUM 与服务端 trace（跨层：浏览器 → 服务端）',
      lang: 'javascript',
      code: `function joinTrace(rum, server) {
  const traceId = (server && server.traceId) || (rum && rum.traceId) || null;
  const spans = server && Array.isArray(server.spans) ? server.spans : [];
  if (!rum || !server || !rum.traceId || !server.traceId || rum.traceId !== server.traceId || spans.length === 0) {
    return { traceId, totalMs: null, segments: [], largestGap: null, incomplete: true };
  }

  const ordered = [...spans].sort((a, b) => a.startMs - b.startMs);
  const segments = ordered.map((span) => ({
    name: span.name,
    startMs: span.startMs,
    endMs: span.startMs + span.durationMs,
    durationMs: span.durationMs
  }));

  const lastEnd = segments[segments.length - 1].endMs;
  const end = Math.max(lastEnd, typeof rum.lcpMs === 'number' ? rum.lcpMs : 0);
  let largestGap = segments[0].startMs;
  for (let index = 1; index < segments.length; index += 1) {
    largestGap = Math.max(largestGap, Math.max(0, segments[index].startMs - segments[index - 1].endMs));
  }
  largestGap = Math.max(largestGap, Math.max(0, end - lastEnd));

  return { traceId, totalMs: end, segments, largestGap, incomplete: false };
}`,
      note: '跨层点在于两端用同一个 traceId 对齐：浏览器 LCP 与服务端 span 必须落在同一条链路上，否则宁可返回 incomplete。缺口分三类——开头等待、span 间隙、结尾渲染等待；只看总时长会掩盖具体原因。'
    },
    {
      type: 'case',
      title: 'CDN 缓存了个人看板',
      context: 'LinkHub 的个人点击看板被公共 CDN 缓存了五分钟，有用户截图看到别人的短链与点击数据，客服收到多起投诉。',
      symptom: '同一 URL 在不同地区偶尔显示他人数据；刷新有时恢复；受影响请求不是全量，而是集中在缓存命中的节点。',
      cause: '响应没有设置 private 或 no-store，缓存键只包含 URL，Vary 未包含 Cookie 与 Authorization；带 Set-Cookie 的响应也被边缘缓存。',
      fix: '个性化响应改为 private / no-store；公共页保持可缓存并把用户维度排除在外；清理受影响缓存；在边缘增加鉴权后的缓存校验。',
      prevention: '把缓存头纳入评审清单；测试覆盖「两个账号请求同一 URL」；发布前用双账号验证不串号；对缓存命中与鉴权失败建立监控。',
      metric: '串号请求降为 0，公共页缓存命中率保持 92% 不变'
    },
    {
      type: 'pitfall',
      title: '边缘与发布的五个坑',
      html: '<strong>缓存了带 Set-Cookie 的响应：</strong>会话被写进公共缓存。修复：带 Set-Cookie 的响应不缓存，个性化响应 private。<br><strong>Vary 缺失或过粗：</strong>按错误维度分流，导致串号或命中率骤降。修复：按真实差异声明 Vary，必要时自定义缓存键。<br><strong>开关嵌套且无默认值：</strong>配置缺失时行为不确定。修复：每个开关有默认值、所有者与过期时间。<br><strong>RUM 采样偏差：</strong>只采到快用户，最慢的分组永远看不见。修复：错误与慢请求全采样，按版本与地区分层观察。<br><strong>trace 断链：</strong>跨域或代理丢了 header，前后端各说各话。修复：显式透传 traceparent，CORS 暴露 traceId，缺失时标记 incomplete。'
    },
    {
      type: 'steps',
      title: 'LinkHub 发布健康度看板',
      steps: [
        { title: '定义症状指标', html: '选用户可感知的指标：错误率、关键接口 p75、LCP p75、INP p75 与实时连接成功率。观察点：指标能对应到具体故障，而不是只看 CPU。' },
        { title: '设定基线与阈值', html: '用上一版本同窗口数据做基线，阈值写成绝对数字加相对变化。观察点：每个指标都有明确的告警线。' },
        { title: '确定观察窗', html: '灰度阶段至少覆盖一个完整业务周期，移动端与弱网单独看。观察点：不因短时间安静就扩量。' },
        { title: '打通 RUM 与 trace', html: '同一 traceId 能在浏览器事件与服务端 span 之间跳转。观察点：抽查慢请求能看到最大缺口。' },
        { title: '写回滚条件', html: '错误率或 p75 超过阈值，或出现串号与越权，立即 kill 开关。观察点：回滚分钟级完成，不需要重新部署。' },
        { title: '复盘与清理', html: '发布结束后删除旧分支与过期开关，记录本次基线。观察点：开关清单里没有无主项。' }
      ]
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「用户说页面慢，你怎么定位」：先看 RUM 的 p75 与分群，确认是个例还是普遍；拿到该次会话的 traceId，再到服务端看同一链路的 span，找最大缺口；缺口在开头查网络与排队，在中间查未打点的依赖，在结尾查资源与渲染。最后给出证据与下一步实验，而不是只报一个总时长。<br>「边缘缓存与个性化如何共存」：公共内容长 TTL，个性化内容 private 或按用户维度缓存，必要时 bypass；缓存键与 Vary 要能解释「不同用户为什么看到不同内容」。'
    }
  ],
  checks: [
    {
      id: 's6-l4-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '边缘缓存',
      prompt: '个人点击看板能否放在公共 CDN 缓存里？正确做法是什么？',
      question: '个人点击看板能否放在公共 CDN 缓存里？正确做法是什么？',
      options: [
        { text: '不能进入公共缓存；应 private/no-store，或按用户维度做私有缓存与 bypass', correct: true },
        { text: '可以缓存，只要 TTL 设得足够短', correct: false },
        { text: '可以缓存，在页面加载后再用 JavaScript 覆盖成自己的数据', correct: false },
        { text: '可以缓存，只要 URL 里带上用户 id 就安全', correct: false }
      ],
      explain: '响应里包含他人数据时，任何公共缓存都是串号风险；TTL 短只是降低概率，URL 带用户 id 也不等于鉴权。个性化内容应 private 或按用户维度隔离。'
    },
    {
      id: 's6-l4-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '开关治理',
      prompt: '一个可治理的特性开关应该具备哪些要素？',
      question: '一个可治理的特性开关应该具备哪些要素？',
      options: [
        { text: '明确的所有者与过期时间', correct: true },
        { text: 'kill switch，能绕过灰度立即关闭', correct: true },
        { text: '缺省值与稳定的分桶键', correct: true },
        { text: '全量后删除旧分支的清理计划', correct: true },
        { text: '永远保留旧路径作为默认行为', correct: false }
      ],
      explain: '开关需要所有者、过期时间、kill switch、默认值与清理计划。永久保留旧路径会积累开关债，让组合状态失控。'
    },
    {
      id: 's6-l4-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '可观测性',
      prompt: '已经有 RUM，但服务端没有可关联的 trace，定位后端慢时最先补什么？',
      question: '已经有 RUM，但服务端没有可关联的 trace，定位后端慢时最先补什么？',
      options: [
        { text: '让请求携带并透传 traceId，把 RUM 事件与服务端 span 对齐', correct: true },
        { text: '先把 RUM 采样率调到 100% 再说', correct: false },
        { text: '先扩容后端实例', correct: false },
        { text: '先给 CDN 加更长的 TTL', correct: false }
      ],
      explain: 'RUM 只能说明用户侧慢，无法定位服务端哪一段慢。先打通 traceId 透传与响应头返回，才能把两端拼成一条链路；采样率和扩容都要在这个前提下才有依据。'
    }
  ],
  exercises: [
    {
      id: 's6-l4-ex-1',
      kind: 'code',
      title: '边缘缓存与 trace 合并（跨层：浏览器 → 服务端）',
      brief: '实现 createEdgeCache({ ttlMs, swrMs, now, load, onRefreshError })，返回 { get, whenIdle }。get(key, { bypass }) 按 age = now() - storedAt 判断：age <= ttlMs 返回 { value, state: \'fresh\' }；ttlMs < age <= ttlMs + swrMs 立即返回 { value, state: \'stale\' } 并触发一次后台刷新，同 key 单飞；age 超过 SWR 窗口等待 load，返回 { value, state: \'miss\' }；bypass 直接回源并更新缓存，返回 { value, state: \'bypass\' }。刷新失败保留旧值并调用 onRefreshError(error, key)，落定后允许再次触发；whenIdle() 等待所有在途刷新。再实现 joinTrace(rum, server)：traceId 缺失或不匹配、或无 span 时返回 { traceId, totalMs: null, segments: [], largestGap: null, incomplete: true }；否则按 startMs 升序生成 segments，end 取最后一个 span 结束与 rum.lcpMs 的较大值，largestGap 取开头等待、相邻间隙与结尾渲染等待的最大值。',
      hint: 'createEdgeCache 用 Map 存缓存与在途刷新；刷新 Promise 必须在 get 返回前同步登记，才能单飞。whenIdle 用 while 循环等待，防止等待期间又出现新刷新。joinTrace 先做完整性校验，再排序、算段、算三类缺口；不要修改传入的 span 数组。',
      starter: `function createEdgeCache({ load }) {
  const cache = new Map();

  async function get(key) {
    const value = await load(key);
    cache.set(key, value);
    return { value, state: 'miss' };
  }

  async function whenIdle() {}

  return { get, whenIdle };
}

function joinTrace(rum, server) {
  const spans = server.spans;
  return {
    traceId: rum.traceId,
    totalMs: spans[spans.length - 1].startMs,
    segments: spans.map((span) => ({
      name: span.name,
      startMs: span.startMs,
      endMs: span.startMs,
      durationMs: span.durationMs
    })),
    largestGap: 0,
    incomplete: false
  };
}`,
      solution: `function createEdgeCache({ ttlMs, swrMs, now, load, onRefreshError }) {
  const cache = new Map();
  const refreshing = new Map();

  async function get(key, options = {}) {
    const bypass = options.bypass === true;
    const entry = cache.get(key);
    if (!bypass && entry) {
      const age = now() - entry.storedAt;
      if (age <= ttlMs) return { value: entry.value, state: 'fresh' };
      if (age <= ttlMs + swrMs) {
        if (!refreshing.has(key)) {
          const task = Promise.resolve()
            .then(() => load(key))
            .then((value) => cache.set(key, { value, storedAt: now() }))
            .catch((error) => onRefreshError && onRefreshError(error, key))
            .finally(() => refreshing.delete(key));
          refreshing.set(key, task);
        }
        return { value: entry.value, state: 'stale' };
      }
    }
    const value = await load(key);
    cache.set(key, { value, storedAt: now() });
    return { value, state: bypass ? 'bypass' : 'miss' };
  }

  async function whenIdle() {
    while (refreshing.size) {
      await Promise.all([...refreshing.values()]);
    }
  }

  return { get, whenIdle };
}

function joinTrace(rum, server) {
  const traceId = (server && server.traceId) || (rum && rum.traceId) || null;
  const spans = server && Array.isArray(server.spans) ? server.spans : [];
  if (!rum || !server || !rum.traceId || !server.traceId || rum.traceId !== server.traceId || spans.length === 0) {
    return { traceId, totalMs: null, segments: [], largestGap: null, incomplete: true };
  }

  const ordered = [...spans].sort((a, b) => a.startMs - b.startMs);
  const segments = ordered.map((span) => ({
    name: span.name,
    startMs: span.startMs,
    endMs: span.startMs + span.durationMs,
    durationMs: span.durationMs
  }));

  const lastEnd = segments[segments.length - 1].endMs;
  const end = Math.max(lastEnd, typeof rum.lcpMs === 'number' ? rum.lcpMs : 0);
  let largestGap = segments[0].startMs;
  for (let index = 1; index < segments.length; index += 1) {
    largestGap = Math.max(largestGap, Math.max(0, segments[index].startMs - segments[index - 1].endMs));
  }
  largestGap = Math.max(largestGap, Math.max(0, end - lastEnd));

  return { traceId, totalMs: end, segments, largestGap, incomplete: false };
}`,
      tests: [
        {
          name: '新鲜命中不回源',
          code: `let clock = 0;
let calls = 0;
const cache = createEdgeCache({
  ttlMs: 100,
  swrMs: 500,
  now: () => clock,
  load: async () => {
    calls += 1;
    return 'v' + calls;
  }
});
const first = await cache.get('a');
assert.deepEqual(first, { value: 'v1', state: 'miss' });
clock = 50;
const second = await cache.get('a');
assert.deepEqual(second, { value: 'v1', state: 'fresh' });
assert.equal(calls, 1);`
        },
        {
          name: 'SWR 先返回旧值再后台刷新',
          code: `let clock = 0;
let calls = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const cache = createEdgeCache({
  ttlMs: 100,
  swrMs: 500,
  now: () => clock,
  load: () => {
    calls += 1;
    if (calls === 1) return Promise.resolve('v1');
    return gate;
  }
});
await cache.get('a');
clock = 150;
const stale = await cache.get('a');
assert.deepEqual(stale, { value: 'v1', state: 'stale' });
release('v2');
await cache.whenIdle();
assert.equal(calls, 2);
const fresh = await cache.get('a');
assert.deepEqual(fresh, { value: 'v2', state: 'fresh' });`
        },
        {
          name: '同一 key 的刷新单飞',
          code: `let clock = 0;
let calls = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const cache = createEdgeCache({
  ttlMs: 100,
  swrMs: 500,
  now: () => clock,
  load: () => {
    calls += 1;
    if (calls === 1) return Promise.resolve('v1');
    return gate;
  }
});
await cache.get('a');
clock = 150;
const first = await cache.get('a');
const second = await cache.get('a');
assert.deepEqual(first, { value: 'v1', state: 'stale' });
assert.deepEqual(second, { value: 'v1', state: 'stale' });
release('v2');
await cache.whenIdle();
assert.equal(calls, 2);
const fresh = await cache.get('a');
assert.equal(fresh.value, 'v2');`
        },
        {
          name: '超过 SWR 窗口回源 miss',
          code: `let clock = 0;
let calls = 0;
const cache = createEdgeCache({
  ttlMs: 100,
  swrMs: 200,
  now: () => clock,
  load: async () => {
    calls += 1;
    return 'v' + calls;
  }
});
const first = await cache.get('a');
assert.equal(first.state, 'miss');
clock = 301;
const second = await cache.get('a');
assert.deepEqual(second, { value: 'v2', state: 'miss' });
assert.equal(calls, 2);
const third = await cache.get('a');
assert.equal(third.state, 'fresh');`
        },
        {
          name: 'bypass 强制回源并更新缓存',
          code: `let clock = 0;
let calls = 0;
const cache = createEdgeCache({
  ttlMs: 1000,
  swrMs: 1000,
  now: () => clock,
  load: async () => {
    calls += 1;
    return 'v' + calls;
  }
});
await cache.get('a');
const bypassed = await cache.get('a', { bypass: true });
assert.deepEqual(bypassed, { value: 'v2', state: 'bypass' });
const after = await cache.get('a');
assert.deepEqual(after, { value: 'v2', state: 'fresh' });
assert.equal(calls, 2);`
        },
        {
          name: '刷新失败保留旧值且可重试',
          code: `let clock = 0;
let calls = 0;
let failing = false;
const errors = [];
const cache = createEdgeCache({
  ttlMs: 100,
  swrMs: 1000,
  now: () => clock,
  load: async () => {
    calls += 1;
    if (failing) throw new Error('refresh down');
    return 'v' + calls;
  },
  onRefreshError: (error, key) => errors.push(key + ':' + error.message)
});
await cache.get('a');
clock = 150;
failing = true;
const stale = await cache.get('a');
assert.deepEqual(stale, { value: 'v1', state: 'stale' });
await cache.whenIdle();
assert.deepEqual(errors, ['a:refresh down']);
failing = false;
const again = await cache.get('a');
assert.deepEqual(again, { value: 'v1', state: 'stale' });
await cache.whenIdle();
const fresh = await cache.get('a');
assert.deepEqual(fresh, { value: 'v3', state: 'fresh' });
assert.equal(calls, 3);`
        },
        {
          name: 'trace 正常合并与总时长（跨层）',
          code: `const result = joinTrace(
  { traceId: 't1', lcpMs: 4200, marks: { fcp: 900 } },
  {
    traceId: 't1',
    spans: [
      { name: 'db', startMs: 800, durationMs: 400 },
      { name: 'bff', startMs: 200, durationMs: 500 },
      { name: 'edge', startMs: 0, durationMs: 100 }
    ]
  }
);
assert.equal(result.incomplete, false);
assert.equal(result.traceId, 't1');
assert.equal(result.totalMs, 4200);
assert.deepEqual(result.segments.map((span) => span.name), ['edge', 'bff', 'db']);
assert.equal(result.segments[0].endMs, 100);
assert.equal(result.largestGap, 3000);`
        },
        {
          name: 'trace 缺失或不匹配标记 incomplete',
          code: `const mismatch = joinTrace(
  { traceId: 'a', lcpMs: 1200 },
  { traceId: 'b', spans: [{ name: 'bff', startMs: 0, durationMs: 100 }] }
);
assert.equal(mismatch.incomplete, true);
assert.equal(mismatch.totalMs, null);
assert.deepEqual(mismatch.segments, []);
assert.equal(mismatch.largestGap, null);
const empty = joinTrace({ traceId: 'a', lcpMs: 1200 }, { traceId: 'a', spans: [] });
assert.equal(empty.incomplete, true);
const missing = joinTrace({}, { spans: [] });
assert.equal(missing.incomplete, true);`
        },
        {
          name: 'span 乱序按开始时间排序',
          code: `const result = joinTrace(
  { traceId: 't2', lcpMs: 1800 },
  {
    traceId: 't2',
    spans: [
      { name: 'db', startMs: 600, durationMs: 300 },
      { name: 'edge', startMs: 0, durationMs: 200 },
      { name: 'bff', startMs: 300, durationMs: 250 }
    ]
  }
);
assert.deepEqual(result.segments.map((span) => span.startMs), [0, 300, 600]);
assert.deepEqual(result.segments.map((span) => span.endMs), [200, 550, 900]);
assert.equal(result.totalMs, 1800);
assert.equal(result.largestGap, 900);`
        }
      ]
    },
    {
      id: 's6-l4-ex-2',
      kind: 'design',
      title: 'LinkHub 发布健康度与边缘策略',
      brief: '为 LinkHub 设计边缘与发布方案：说明缓存键与 TTL/SWR、个性化内容处理、边缘函数职责、特性开关层级与所有者、灰度比例、健康指标、回滚阈值、RUM 采样、trace 串联和隐私脱敏。',
      checklist: [
        '缓存键与 Vary 设计',
        'TTL 与 SWR 窗口数字',
        '个性化内容不进公共缓存',
        '边缘函数职责与限制',
        '开关层级、所有者与过期时间',
        '灰度比例与观察窗',
        '健康指标与基线',
        '回滚条件与 kill switch',
        'RUM 采样策略',
        'RUM 与服务端 trace 的统一 traceId',
        '隐私脱敏与日志保留'
      ],
      reference: '<ul><li><strong>缓存键：</strong>公开短链跳转页按 URL 缓存，TTL 300 秒、SWR 60 秒；个性化看板 private 并 bypass。</li><li><strong>Vary：</strong>公共页不按 Cookie 分流；语言按 Accept-Language 单独建键。</li><li><strong>个性化：</strong>账户与统计接口永不进入公共缓存，边缘只做鉴权与重写。</li><li><strong>边缘：</strong>只做鉴权、重写、缓存决策与轻量 A/B 分桶；重计算回源站。</li><li><strong>开关：</strong>发布开关、实验开关、权限开关分层，每项有所有者与过期时间。</li><li><strong>灰度：</strong>白名单 → 5% → 25% → 100%，每档至少一个业务周期。</li><li><strong>健康度：</strong>错误率、接口 p75、LCP p75、INP p75、实时连接成功率，均与上一版本基线比较。</li><li><strong>回滚：</strong>错误率翻倍或 p75 超基线 20% 即 kill；串号与越权零容忍。</li><li><strong>RUM：</strong>错误与慢请求全采样，其余按 10% 采样，按版本与地区分组。</li><li><strong>trace：</strong>前端生成 traceparent 并透传，响应头返回 traceId，RUM 事件携带同一 id。</li><li><strong>隐私：</strong>URL 参数、用户输入与 Cookie 不入事件；日志保留 30 天并限制访问。</li></ul>'
    }
  ]
};
