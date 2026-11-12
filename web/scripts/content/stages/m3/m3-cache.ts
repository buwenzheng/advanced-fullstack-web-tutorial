export const m3Cache = {
  id: 'm3-cache',
  title: '缓存分层与失效策略',
  subtitle: 'Cache-Aside、TTL、主动失效、空值缓存与 single-flight，以及穿透/击穿/雪崩的防护。',
  duration: 85,
  status: 'ready',
  objectives: [
    '为一条读路径指出浏览器、边缘、应用与数据库各层缓存的分工，并说明本讲只对应用层负责。',
    '实现 Cache-Aside、TTL、主动失效、空值缓存与 single-flight，并解释每个防护对应的失败模式。',
    '区分穿透、击穿、雪崩的成因，选择对应防护而不是只把 TTL 调大。',
    '用命中率、回源 QPS 与 P99 证明缓存收益，并给出降级与回滚条件。'
  ],
  keywords: ['缓存', 'Cache-Aside', 'TTL', '失效', '穿透', '击穿', '雪崩', 'single-flight', '命中率'],
  blocks: [
    {
      type: 'analogy',
      title: '前端 memo 与共享缓存',
      html: '你在组件里用 <code>useMemo</code> 缓存一次昂贵计算，依赖不变就复用结果；组件卸载，缓存随之消失。服务端缓存看起来一样：命中就返回，未命中就回源。但真正的难点在失效：<code>useMemo</code> 的失效由 React 的依赖比较自动完成，而共享缓存没有统一的「重渲染信号」，你必须自己决定数据库变了以后谁去删哪一层。<br>类比失效的地方在于：memo 只存在于一个组件的生命周期里，共享缓存被多个实例、多个请求并发读写，还会在网络故障时部分不可用。一致性与失效从此变成业务问题，而不是一个库的配置项。'
    },
    {
      type: 'flow',
      title: '一次跳转的缓存路径',
      steps: [
        { name: '浏览器缓存', detail: '命中则不发请求；短链跳转通常用 302 并允许缓存策略。失败表现：把可变的短链目标缓存成永久 301。' },
        { name: '边缘缓存', detail: '在离用户更近的位置返回；失效范围与部署方式相关。失败表现：把边缘 TTL 当成应用缓存 TTL。边界：本讲不展开，m3-edge 讲 CDN 与 SWR。' },
        { name: '应用缓存', detail: '以短码为 key 读取跳转目标；未命中回源数据库并回填。失败表现：缓存故障直接报错，或并发 miss 一起打库。' },
        { name: '数据库', detail: '作为事实来源；回源查询必须带租户条件与索引。失败表现：回源没有上限，热点过期时把连接池打满。' }
      ]
    },
    {
      type: 'table',
      title: '四种缓存模式',
      head: ['模式', '谁负责加载', '写路径', '失败表现', '适用'],
      rows: [
        ['Cache-Aside', '应用：miss 时回源并回填', '先写库，再删缓存', '回填并发、删除失败留下旧值', '读多写少、可容忍短暂旧值'],
        ['Read-Through', '缓存层代理加载', '写库后由缓存层失效', '缓存层故障影响读；加载逻辑耦合在缓存层', '统一缓存 SDK、读路径固定'],
        ['Write-Through', '应用写缓存，缓存同步写库', '写缓存即写库', '写延迟增加；缓存不可用时写失败', '写少、要求读后立即一致'],
        ['Write-Behind', '应用只写缓存，异步刷库', '异步批量落库', '缓存宕机丢写；顺序与重试复杂', '可容忍丢失的计数、日志类数据']
      ],
      note: '模式没有绝对优劣；先写清「允许多久旧值」「缓存故障时读还是写失败」，再选模式。'
    },
    {
      type: 'code',
      title: 'Cache-Aside 最小实现：TTL 与容量上限',
      lang: 'javascript',
      code: `function createTtlCache({ ttl = 60_000, max = 500, now = Date.now } = {}) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      store.delete(key); // 过期条目读时删除，避免返回旧值
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, lifetime = ttl) {
    if (!store.has(key) && store.size >= max) {
      // 教学实现按插入顺序淘汰；生产可用 LRU
      store.delete(store.keys().next().value);
    }
    store.set(key, { value, expiresAt: now() + lifetime });
  }

  function remove(key) {
    store.delete(key);
  }

  return { get, set, delete: remove };
}`,
      note: '注入 now 是为了让过期行为可测试；容量上限是为了防止一个失控的 key 空间吃光内存。这个最小实现只解决「读与过期」，并发回源与空值防护在下一块。'
    },
    {
      type: 'code',
      title: '防护：single-flight 与空值缓存',
      lang: 'javascript',
      code: `function createLoaderCache({ ttl = 60_000, negativeTtl = 5_000, now = Date.now } = {}) {
  const values = new Map();
  const inflight = new Map();

  async function get(key, loader) {
    const entry = values.get(key);
    if (entry && entry.expiresAt > now()) return entry.value;
    if (inflight.has(key)) return inflight.get(key); // 并发 miss 复用同一个任务

    const task = (async () => {
      try {
        const value = await loader();
        // 空结果用更短 TTL，既挡住穿透，又不会长期掩盖新建数据
        const lifetime = value == null ? negativeTtl : ttl;
        values.set(key, { value, expiresAt: now() + lifetime });
        return value;
      } catch (error) {
        values.delete(key); // 失败不缓存，下一请求可以重试
        throw error;
      } finally {
        inflight.delete(key); // 成功或失败都必须清理
      }
    })();

    inflight.set(key, task);
    return task;
  }

  return { get };
}`,
      note: 'TTL 抖动可在写入时加一个小的随机偏移，避免同一批 key 同时过期；本块为聚焦并发与空值，没有混入随机数。'
    },
    {
      type: 'table',
      title: '穿透 / 击穿 / 雪崩',
      head: ['问题', '原因', '现象', '正确防护'],
      rows: [
        ['穿透', '查询不存在的数据，缓存永远不命中', '大量请求绕过缓存打库；可能是攻击', '空值短 TTL、参数校验、布隆过滤'],
        ['击穿', '单个热点 key 过期瞬间并发回源', '某个 key 过期时数据库 QPS 尖峰', 'single-flight、逻辑过期、热点永不过期'],
        ['雪崩', '大量 key 同时过期或缓存整体不可用', '数据库 QPS 整体抬升，延迟雪崩', 'TTL 抖动、多级缓存、降级与限流']
      ],
      note: '三者可以同时发生。先定位是单 key、批量 key 还是整层缓存故障，再选药；把所有 TTL 调大只是把问题推后。'
    },
    {
      type: 'pitfall',
      title: '缓存错误与脏数据',
      html: '现象：更新短链目标后，部分用户仍被跳到旧地址；缓存服务抖动时接口 500；晚高峰数据库 QPS 突然翻倍。<br>原因：先删缓存再提交事务，并发读在事务提交前回填了旧值；更新后删除缓存失败但没有重试；所有 key 使用同一个 TTL，整点一起过期；缓存客户端把连接错误直接抛出，没有降级。<br>发现方式：对比缓存与数据库的抽样值；看缓存删除失败日志与重试队列；按 key 前缀统计过期时间分布；用命中率与回源 QPS 对照发布记录。<br>修复：先提交数据库事务，再删除缓存；删除失败进入重试并告警，接受 TTL 兜底；缓存读失败降级回源，但要限制回源并发；热点 key 单独加 TTL 抖动或逻辑过期。<br>预防：缓存操作纳入监控；写入路径有统一的失效封装；压测覆盖缓存不可用与热点过期。'
    },
    {
      type: 'steps',
      title: '度量与失效流程',
      steps: [
        { title: '先定验收指标', html: '命中率、回源 QPS、P99、数据库连接占用。观察点：改动前后能用同一口径对比。' },
        { title: '记录基线', html: '关闭缓存或在预发环境压测，得到回源 QPS 与 P99。观察点：没有基线就无法证明收益。' },
        { title: '接入 Cache-Aside', html: '读路径先查缓存，miss 回源并回填；key 带租户与短码。观察点：命中率上升，回源下降。' },
        { title: '接主动失效', html: '更新/删除事务提交后删除缓存；失败进重试队列。观察点：修改后最迟 TTL 内生效，且删除失败可见。' },
        { title: '加防护', html: '空值短 TTL、single-flight、TTL 抖动、回源限流。观察点：热点过期与缓存抖动时数据库不尖峰。' },
        { title: '留回滚开关', html: '一键关闭缓存或切回源；写清触发条件。观察点：缓存成为可选加速层，而不是单点依赖。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：一致性与热 key',
      html: '缓存一致性没有免费方案，只有最坏窗口的取舍。TTL 决定「不主动失效时最多旧多久」；主动失效把窗口压到删除完成，但删除可能失败，且「先写库后删缓存」在并发读回填时仍有短暂旧值。延迟双删试图用第二次删除覆盖并发回填，但它依赖延时估计，不能当成强一致；更稳的做法是删除失败重试、版本号或逻辑过期。<br>热 key 是另一个维度：单个 key 的 QPS 超过缓存实例或数据库单点承受能力时，扩容整体缓存帮助有限。可以拆分 key（如按租户或随机后缀）、在进程内加一层极短 TTL 缓存、或对热点内容做只读副本。每种做法都要写清多实例旧值窗口与失效路径；进程内缓存尤其要接受「实例之间不同步」。',
      note: 'CDN 与边缘缓存的失效模型在 m3-edge；本讲只讨论应用层。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「先更新数据库还是先删缓存」先问一致性目标与失败模型：常见选择是先提交事务再删缓存，删除失败重试并用 TTL 兜底；先删缓存会让并发读在事务提交前回填旧值，除非配合延迟双删或版本控制。<br>「缓存能解决什么」只能回答减少回源次数与降低读延迟；它不修复慢查询、不保证强一致、也不替代容量规划。回答时给出命中率、回源 QPS 与最坏旧值窗口，比背模式名更有说服力。'
    }
  ],
  checks: [
    {
      id: 'm3-cache-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '缓存模式',
      prompt: 'LinkHub 的跳转接口读多写少，短链目标偶尔修改，业务允许最多 30 秒旧值。最合适的缓存模式是什么？',
      question: 'LinkHub 的跳转接口读多写少，短链目标偶尔修改，业务允许最多 30 秒旧值。最合适的缓存模式是什么？',
      options: [
        { text: 'Cache-Aside：读时回源回填，写后主动失效，TTL 兜底', correct: true },
        { text: 'Write-Behind：只写缓存，异步刷库', correct: false },
        { text: 'Write-Through：每次写都同步写缓存与数据库', correct: false },
        { text: '不加缓存，直接查数据库最一致', correct: false }
      ],
      explain: 'Cache-Aside 适合读多写少，写后失效把旧值窗口压到删除完成，TTL 提供兜底。Write-Behind 有丢写风险；Write-Through 增加写路径依赖且收益有限；完全不加缓存会把读压力全留给数据库。'
    },
    {
      id: 'm3-cache-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '穿透/击穿/雪崩',
      prompt: '关于缓存穿透、击穿与雪崩的防护，以下哪些说法正确？',
      question: '关于缓存穿透、击穿与雪崩的防护，以下哪些说法正确？',
      options: [
        { text: '空值缓存或布隆过滤可以减少不存在数据反复回源', correct: true },
        { text: 'single-flight 能让同一 key 的并发 miss 只回源一次', correct: true },
        { text: '给 TTL 加抖动可以降低大量 key 同时过期的概率', correct: true },
        { text: '把 TTL 统一调大可以同时解决穿透、击穿与雪崩', correct: false },
        { text: '缓存不可用时一律直接报错，回源没有风险', correct: false }
      ],
      explain: '空值缓存/布隆过滤针对穿透；single-flight 针对击穿；TTL 抖动针对雪崩。统一调大 TTL 只是推迟问题，并放大旧值窗口；缓存不可用时直接报错会影响可用性，而无保护回源可能打垮数据库，需要显式降级与限流。'
    },
    {
      id: 'm3-cache-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '失效顺序',
      prompt: '更新短链目标时，数据库事务已提交，删除缓存失败。接下来最合理的处理是什么？',
      question: '更新短链目标时，数据库事务已提交，删除缓存失败。接下来最合理的处理是什么？',
      options: [
        { text: '回滚数据库事务，保证缓存与数据库一致', correct: false },
        { text: '进入重试并告警，同时依靠 TTL 兜底，接受最坏窗口', correct: true },
        { text: '忽略失败，等下次更新再说', correct: false },
        { text: '直接删除整个缓存集群', correct: false }
      ],
      explain: '数据库已提交，回滚会丢失已确认的写；忽略失败会扩大旧值窗口；删整个集群代价过大且会造成雪崩。正确做法是删除失败重试与告警，并用 TTL 定义最坏旧值窗口。'
    }
  ],
  exercises: [
    {
      id: 'm3-cache-ex-1',
      kind: 'code',
      title: '带防护的缓存',
      brief: '实现 createCache({ ttl = 60000, negativeTtl = 5000, max = 500, now = Date.now } = {})，提供 get(key, loader)、set(key, value, { ttl } = {}) 与 delete(key)。get 命中直接返回；未命中调用 loader 并缓存；同一 key 并发 miss 只调用一次 loader；loader 抛错不缓存；loader 返回 null 或 undefined 时按 negativeTtl 缓存。过期条目在读取时删除；容量超过 max 时淘汰最早写入的 key。',
      hint: '用 values 存值、inflight 存进行中的 Promise。Promise 的 finally 里清理 inflight；catch 里删除 values，避免失败被缓存。空值用 `value == null` 判断，并用较短的 negativeTtl。',
      starter: `function createCache({ ttl = 60_000, max = 500, now = Date.now } = {}) {
  const store = new Map();

  async function get(key, loader) {
    const hit = store.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;
    const value = await loader();
    store.set(key, { value, expiresAt: now() + ttl });
    return value;
  }

  function set(key, value) {
    store.set(key, { value, expiresAt: now() + ttl });
  }

  function remove(key) {
    store.delete(key);
  }

  return { get, set, delete: remove };
}`,
      solution: `function createCache({ ttl = 60_000, negativeTtl = 5_000, max = 500, now = Date.now } = {}) {
  const values = new Map();
  const inflight = new Map();

  function read(key) {
    const entry = values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      values.delete(key);
      return undefined;
    }
    return entry;
  }

  function write(key, value, lifetime) {
    if (!values.has(key) && values.size >= max) {
      values.delete(values.keys().next().value);
    }
    values.set(key, { value, expiresAt: now() + lifetime });
  }

  async function get(key, loader) {
    const cached = read(key);
    if (cached) return cached.value;
    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
      try {
        const value = await loader();
        write(key, value, value == null ? negativeTtl : ttl);
        return value;
      } catch (error) {
        values.delete(key);
        throw error;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, task);
    return task;
  }

  function set(key, value, options = {}) {
    const lifetime = typeof options.ttl === 'number'
      ? options.ttl
      : value == null
        ? negativeTtl
        : ttl;
    write(key, value, lifetime);
  }

  function remove(key) {
    values.delete(key);
  }

  return { get, set, delete: remove };
}`,
      tests: [
        {
          name: '命中后不再调用 loader',
          code: `let clock = 0;
let calls = 0;
const cache = createCache({ ttl: 1000, now: () => clock });
const first = await cache.get('link:1', async () => { calls += 1; return 'v1'; });
clock = 500;
const second = await cache.get('link:1', async () => { calls += 1; return 'v2'; });
assert.equal(first, 'v1');
assert.equal(second, 'v1');
assert.equal(calls, 1);`
        },
        {
          name: '过期后重新调用 loader',
          code: `let clock = 0;
let calls = 0;
const cache = createCache({ ttl: 100, now: () => clock });
const loader = async () => { calls += 1; return 'v' + calls; };
assert.equal(await cache.get('k', loader), 'v1');
clock = 100;
assert.equal(await cache.get('k', loader), 'v2');
assert.equal(calls, 2);`
        },
        {
          name: '并发 miss 只调用一次 loader',
          code: `let release;
let calls = 0;
const cache = createCache({ ttl: 1000, now: () => 0 });
const loader = () => {
  calls += 1;
  return new Promise((resolve) => { release = resolve; });
};
const first = cache.get('hot', loader);
const second = cache.get('hot', loader);
release('shared');
assert.deepEqual(await Promise.all([first, second]), ['shared', 'shared']);
assert.equal(calls, 1);`
        },
        {
          name: 'loader 失败不缓存且可重试',
          code: `let clock = 0;
let attempts = 0;
const cache = createCache({ ttl: 100, now: () => clock });
let error = null;
try {
  await cache.get('k', async () => { attempts += 1; throw new Error('boom'); });
} catch (caught) {
  error = caught;
}
assert.equal(error.message, 'boom');
assert.equal(attempts, 1);
const value = await cache.get('k', async () => { attempts += 1; return 'ok'; });
assert.equal(value, 'ok');
assert.equal(attempts, 2);`
        },
        {
          name: '空结果按 negativeTtl 缓存',
          code: `let clock = 0;
let calls = 0;
const cache = createCache({ ttl: 1000, negativeTtl: 50, now: () => clock });
const missing = async () => { calls += 1; return null; };
assert.equal(await cache.get('missing', missing), null);
clock = 25;
assert.equal(await cache.get('missing', missing), null);
assert.equal(calls, 1);
clock = 60;
assert.equal(await cache.get('missing', async () => { calls += 1; return 'found'; }), 'found');
assert.equal(calls, 2);`
        },
        {
          name: 'delete 后下一次回源',
          code: `let calls = 0;
const cache = createCache({ ttl: 1000, now: () => 0 });
const loader = async () => { calls += 1; return 'v' + calls; };
assert.equal(await cache.get('k', loader), 'v1');
cache.delete('k');
assert.equal(await cache.get('k', loader), 'v2');
assert.equal(calls, 2);`
        },
        {
          name: '容量上限触发淘汰后回源',
          code: `let calls = 0;
const cache = createCache({ ttl: 10_000, max: 2, now: () => 0 });
const loader = (name) => async () => { calls += 1; return name; };
await cache.get('a', loader('a'));
await cache.get('b', loader('b'));
await cache.get('c', loader('c'));
await cache.get('a', loader('a'));
assert.equal(calls, 4);`
        }
      ]
    },
    {
      id: 'm3-cache-ex-2',
      kind: 'design',
      title: 'LinkHub 缓存方案',
      brief: '跳转接口 QPS 是创建接口的 100 倍，数据库在晚高峰出现慢查询；短链目标可修改，业务要求修改后最迟 30 秒生效。请给出缓存对象、key、TTL、主动失效、穿透/击穿/雪崩防护、监控与回滚方案。',
      checklist: [
        '明确缓存对象与不缓存对象',
        '给出 key 结构与租户/短码隔离方式',
        '给出 TTL、负缓存 TTL 与抖动范围',
        '说明更新/删除后的主动失效路径与失败处理',
        '覆盖穿透、击穿、雪崩与热点 key',
        '说明缓存故障时的降级行为与回源保护',
        '给出命中率、回源 QPS、P99 的验收口径',
        '给出回滚条件与开关'
      ],
      reference: '<ul><li><strong>对象：</strong>只缓存跳转所需的短码→目标 URL 与过期时间；列表、统计不进入同一缓存。</li><li><strong>key：</strong><code>link:{tenantId}:{slug}</code>，避免跨租户碰撞；不把目标 URL 拼进 key。</li><li><strong>TTL：</strong>与 30 秒业务容忍对齐，加几十秒量级的抖动；空值用更短 TTL。</li><li><strong>失效：</strong>数据库事务提交后删除缓存；失败重试并告警，TTL 兜底；删除接口与更新接口共用失效封装。</li><li><strong>防护：</strong>空值缓存、参数校验、single-flight、TTL 抖动、热点 key 拆分或进程内极短缓存。</li><li><strong>降级：</strong>缓存读失败回源，但限制回源并发；缓存整体不可用时保留核心跳转并降级非核心接口。</li><li><strong>度量：</strong>命中率、回源 QPS、P99、数据库连接占用；改动前后同口径对比。</li><li><strong>回滚：</strong>开关关闭缓存或切回源；触发条件写清，例如回源 QPS 超阈值或旧值投诉。</li></ul>'
    }
  ]
};
