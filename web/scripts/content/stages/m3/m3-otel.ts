export const m3Otel = {
  id: 'm3-otel',
  title: '日志、指标与追踪',
  subtitle: '结构化日志、requestId、RED/USE、OpenTelemetry、采样与告警设计。',
  duration: 80,
  status: 'ready',
  objectives: [
    '用结构化日志与 requestId 还原一次请求经过的服务、数据库与队列。',
    '用 RED/USE 指标体系回答「系统现在怎么样」，而不是堆指标。',
    '用 trace/span 串起跨服务调用，并说明采样带来的取舍。',
    '设计低噪声、可执行的告警与 runbook。'
  ],
  keywords: ['结构化日志', 'requestId', 'RED', 'USE', 'OpenTelemetry', 'trace', 'span', '采样', '告警'],
  blocks: [
    {
      type: 'analogy',
      title: 'console.log 与生产可观测性',
      html: '前端出问题时，你打开控制台看报错，再看 Network 面板里哪条请求慢。后端也可以 <code>console.log</code>，但生产环境同时有几百个请求在跑，日志会交错成一片；服务还可能有多实例、队列消费者和定时任务。<br>类比失效的地方在于共享与成本：浏览器控制台只属于你这一台机器，生产日志属于所有用户，还要考虑存储费用、脱敏与检索。可观测性不是「多打日志」，而是让一次失败请求在日志、指标与追踪之间能被串起来。'
    },
    {
      type: 'text',
      title: '三支柱各答什么问题',
      html: '日志（log）记录离散事件，回答「发生了什么、带什么业务字段」；指标（metric）是聚合数值，回答「现在整体怎么样、是否越过阈值」；追踪（trace）记录一次请求经过的 span，回答「时间花在哪一跳」。三者不是替代关系：指标先发现异常，追踪定位慢在哪一跳，日志补上当时的上下文。<br>成本也不同。日志按条计费且可能含敏感信息；指标按时间序列计费，标签基数一高就膨胀；追踪按 span 采样，采样率决定你能否看到长尾。先把问题定义清楚，再决定采什么，不要三套都全量开。'
    },
    {
      type: 'code',
      title: '结构化日志与 requestId',
      lang: 'javascript',
      code: `function createRequestLogger({ sink = console.log, now = Date.now } = {}) {
  const SENSITIVE = new Set(['password', 'token', 'authorization', 'email']);

  function redact(fields) {
    const safe = {};
    for (const [key, value] of Object.entries(fields)) {
      safe[key] = SENSITIVE.has(key) ? '[redacted]' : value;
    }
    return safe;
  }

  function child(context) {
    const base = { ...context, ts: new Date(now()).toISOString() };
    function write(level, event, fields = {}) {
      // 固定字段在前，业务字段在后；JSON 一行一条，便于检索
      sink(JSON.stringify({ level, event, ...base, ...redact(fields) }));
    }
    return {
      info: (event, fields) => write('info', event, fields),
      error: (event, fields) => write('error', event, fields),
    };
  }

  return { child };
}

const logger = createRequestLogger();
const requestLog = logger.child({ requestId: 'req-1', route: '/jump' });
requestLog.error('db_timeout', { slug: 'abc', password: 'secret' });`,
      note: 'requestId 在入口生成，调用下游与写队列时继续传递；日志里出现 token、密码或邮箱时必须脱敏。JSON 行日志比「中文句子 + 字符串拼接」更容易按字段检索。'
    },
    {
      type: 'table',
      title: 'RED 与 USE',
      head: ['体系', '指标', '回答的问题', '适用'],
      rows: [
        ['RED', 'Rate 请求速率', '流量是否异常升高或骤降', '面向请求的服务'],
        ['RED', 'Errors 错误率', '失败比例是否越过阈值', '面向请求的服务'],
        ['RED', 'Duration 延迟分位', '用户感知的慢与长尾', '面向请求的服务'],
        ['USE', 'Utilization 使用率', '资源有多少时间在忙', 'CPU、内存、连接池、磁盘'],
        ['USE', 'Saturation 饱和度', '排队与等待是否在累积', '队列、线程池、连接池'],
        ['USE', 'Errors 错误数', '资源层是否开始报错', '磁盘、网卡、下游']
      ],
      note: 'RED 看「用户请求」，USE 看「资源」。延迟必须看分位数，平均值会把长尾掩盖掉。'
    },
    {
      type: 'code',
      title: '指标注册表与分位数',
      lang: 'javascript',
      code: `function createMetrics() {
  const registry = new Map();

  function normalize(labels = {}) {
    return Object.keys(labels).sort().map((key) => key + '=' + labels[key]).join(',');
  }

  function metricOf(name, type) {
    const existing = registry.get(name);
    if (existing && existing.type !== type) {
      throw new Error('metric ' + name + ' already registered as ' + existing.type);
    }
    if (!existing) {
      const created = { type, series: new Map() };
      if (type === 'histogram') created.series.set('', []);
      registry.set(name, created);
    }
    return registry.get(name);
  }

  function counter(name, labels) {
    const metric = metricOf(name, 'counter');
    const key = normalize(labels);
    const value = (metric.series.get(key) || 0) + 1;
    metric.series.set(key, value);
    return value;
  }

  function histogram(name, value) {
    const metric = metricOf(name, 'histogram');
    const samples = metric.series.get('') || [];
    samples.push(value);
    metric.series.set('', samples);
    return samples.length;
  }

  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    // 最近秩：教学与告警统一口径，避免不同库的插值差异
    const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[index];
  }

  function snapshot() {
    // 快照必须与内部状态隔离，调用方修改不会污染指标
    return JSON.parse(JSON.stringify({ ...registryToObject() }));
  }

  function registryToObject() {
    const out = {};
    for (const [name, metric] of registry) {
      out[name] = { type: metric.type, series: [] };
      for (const [labels, value] of metric.series) {
        if (metric.type !== 'histogram') {
          out[name].series.push({ labels, value });
          continue;
        }
        const sorted = [...value].sort((left, right) => left - right);
        const sum = sorted.reduce((total, item) => total + item, 0);
        out[name].series.push({
          labels,
          count: sorted.length,
          sum,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        });
      }
    }
    return out;
  }

  return { counter, histogram, snapshot };
}`,
      note: '标签 key 必须排序，否则 {a,b} 与 {b,a} 会变成两条序列；高基数标签（userId、URL）会让序列数量爆炸。快照用 JSON 深拷贝只是教学选择，生产要考虑数值精度与分配成本。'
    },
    {
      type: 'flow',
      title: '一次请求的三支柱关联',
      steps: [
        { name: '入口生成 requestId', detail: '网关或服务入口生成 traceId/requestId，写入请求上下文。失败表现：每层各自生成，日志无法串联。' },
        { name: '创建根 span', detail: '记录路由、方法、状态码与总耗时。失败表现：只有总耗时，没有下游子 span，无法定位慢在哪一跳。' },
        { name: '下游与队列子 span', detail: '数据库、Redis、HTTP、队列各自一个 span，携带父子关系。失败表现：异步任务丢失上下文，消费者日志没有 traceId。' },
        { name: '日志带上下文', detail: '每条日志写 requestId/traceId 与业务字段。失败表现：日志只有时间与文本，无法关联到具体请求。' },
        { name: '指标聚合', detail: '按路由与状态码计 rate/errors/duration。失败表现：标签里放 userId，序列爆炸；只有总量，无法按接口看。' }
      ]
    },
    {
      type: 'pitfall',
      title: '高基数、PII 与告警疲劳',
      html: '现象：指标系统在发布后内存持续上涨；日志平台出现用户邮箱与 token；告警群每天几十条但没人处理；P99 升高时团队先看平均延迟，误判为「还好」。<br>原因：把 userId、完整 URL、错误消息作为指标标签，时间序列数量随用户增长；日志直接打印请求体；告警绑定每个内部指标而不是用户可见症状；平均值掩盖长尾。<br>发现方式：按标签基数排序找增长最快的指标；用敏感字段扫描日志样本；统计告警数量、确认率与恢复时间；对比平均值与 P99 的差距。<br>修复：标签只保留低基数维度（路由模板、状态码、租户等级）；日志字段白名单与脱敏；告警改为症状指标 + 持续时间 + runbook；延迟统一看分位。<br>预防：指标注册时审查标签；日志 schema 纳入评审；每季度清理无人处理的告警。'
    },
    {
      type: 'steps',
      title: '为跳转接口设计告警',
      steps: [
        { title: '选症状指标', html: '错误率、P99 延迟、跳转成功率；不要给每个内部计数器都配告警。观察点：告警能对应到用户可见影响。' },
        { title: '定阈值与持续时间', html: '例如错误率连续 5 分钟超过 1%，避免瞬时抖动触发。观察点：阈值来自基线，不是拍脑袋。' },
        { title: '写 runbook', html: '第一步看哪个看板、哪些日志、如何回滚、谁负责。观察点：值班同学不看代码也能执行。' },
        { title: '分级与路由', html: 'P1 打电话，P2 进群，P3 进日报；不同级别不同响应时间。观察点：告警量与实际故障匹配。' },
        { title: '演练与复盘', html: '注入慢下游或错误，确认告警按时触发、runbook 可用。观察点：演练后修正阈值与步骤。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：采样与关联',
      html: '全量追踪的成本随 QPS 线性增长，采样是必须的取舍。头部采样（head sampling）在入口按比例决定是否记录，实现简单，但会随机丢掉长尾请求；尾部采样（tail sampling）先缓冲完整 trace，再按错误、慢请求或特定租户保留，能保住最有价值的样本，代价是缓冲内存与决策延迟。<br>采样还会影响指标：从采样 trace 里数请求量会失真，请求量与错误率应以指标为准，trace 只用于定位。日志与 trace 的关联靠 traceId；异步消费者要在消息里携带上下文，否则链路在入队处断掉。保留期也要分层：错误与慢 trace 留久一点，正常 trace 短保留；日志同理，审计字段与调试字段分开。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「线上 P99 升高，先看哪三个信号」先看入口延迟分位与错误率，确认影响范围；再看下游 span 与饱和度（连接池、队列、CPU/IO）；最后对照发布与流量变化。不要先翻某一条日志。<br>「日志、指标、追踪怎么选」按问题回答：指标发现异常，追踪定位链路，日志补上下文；三者靠 traceId 关联。再说明成本、采样与 PII 边界，比背工具名更有说服力。'
    }
  ],
  checks: [
    {
      id: 'm3-otel-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '延迟分位',
      prompt: '跳转接口平均延迟 20ms，但用户投诉偶发很慢。最应该先看哪个信号？',
      question: '跳转接口平均延迟 20ms，但用户投诉偶发很慢。最应该先看哪个信号？',
      options: [
        { text: 'P99 延迟与下游 span 的耗时分布', correct: true },
        { text: '平均延迟，因为平均值代表整体', correct: false },
        { text: '日志总条数，条数越多说明越慢', correct: false },
        { text: 'CPU 使用率，CPU 不高就没有问题', correct: false }
      ],
      explain: '平均值会掩盖长尾，P99 才能反映偶发慢请求；下游 span 能定位慢在哪一跳。日志条数与慢没有直接关系；CPU 不高也可能是 IO、锁或下游慢。'
    },
    {
      id: 'm3-otel-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '指标与日志陷阱',
      prompt: '关于指标标签、日志与采样，以下哪些说法正确？',
      question: '关于指标标签、日志与采样，以下哪些说法正确？',
      options: [
        { text: 'userId、完整 URL 作为标签会导致高基数', correct: true },
        { text: '日志中的 token、密码与邮箱需要脱敏', correct: true },
        { text: '尾部采样可以优先保留错误与慢请求', correct: true },
        { text: '平均值可以替代 P99 判断长尾', correct: false },
        { text: '全量追踪没有成本，应该始终开启', correct: false }
      ],
      explain: '高基数标签会让时间序列爆炸；日志含敏感字段必须脱敏；尾部采样按错误/延迟保留更有价值。平均值掩盖长尾；全量追踪的成本随流量线性增长。'
    },
    {
      id: 'm3-otel-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '告警设计',
      prompt: '哪个告警更符合「低噪声、可执行」？',
      question: '哪个告警更符合「低噪声、可执行」？',
      options: [
        { text: '每个内部计数器超过 0 就告警', correct: false },
        { text: '跳转错误率连续 5 分钟超过 1%，附看板与 runbook', correct: true },
        { text: '每天固定发一条「系统正常」', correct: false },
        { text: '只告警 CPU 使用率，不看用户指标', correct: false }
      ],
      explain: '症状指标加持续时间能过滤抖动，runbook 让值班可执行。每个计数器都告警会制造疲劳；固定正常消息没有信息量；只看 CPU 会漏掉下游与业务失败。'
    }
  ],
  exercises: [
    {
      id: 'm3-otel-ex-1',
      kind: 'code',
      title: '指标注册表与分位数',
      brief: '实现 createMetrics()，返回 { counter, gauge, histogram, snapshot }。counter(name, labels) 每次加 1 并返回当前值；gauge(name, value) 覆盖并返回值；histogram(name, value) 记录样本并返回样本数。同 name 注册不同类型必须抛错。标签 key 排序后相同即同一条序列。snapshot() 返回隔离快照：counter/gauge 为 { labels, value }，histogram 为 { labels, count, sum, p50, p95, p99 }，空直方图为 0；分位数用最近秩。',
      hint: '用 Map 存 name → { type, series }；标签 normalize 时对 key 排序。百分位索引 = ceil(p/100 × n) - 1，注意 0 基与空数组。snapshot 用深拷贝，避免调用方改到内部数组。',
      starter: `function createMetrics() {
  const data = {};

  function counter(name) {
    data[name] = (data[name] || 0) + 1;
    return data[name];
  }

  function gauge(name, value) {
    data[name] = value;
    return value;
  }

  function histogram(name, value) {
    data[name] = data[name] || [];
    data[name].push(value);
    return data[name].length;
  }

  function snapshot() {
    return data;
  }

  return { counter, gauge, histogram, snapshot };
}`,
      solution: `function createMetrics() {
  const registry = new Map();

  function normalize(labels = {}) {
    return Object.keys(labels).sort().map((key) => key + '=' + labels[key]).join(',');
  }

  function metricOf(name, type) {
    const existing = registry.get(name);
    if (existing && existing.type !== type) {
      throw new Error('metric ' + name + ' already registered as ' + existing.type);
    }
    if (!existing) {
      const created = { type, series: new Map() };
      if (type === 'histogram') created.series.set('', []);
      registry.set(name, created);
    }
    return registry.get(name);
  }

  function counter(name, labels) {
    const metric = metricOf(name, 'counter');
    const key = normalize(labels);
    const value = (metric.series.get(key) || 0) + 1;
    metric.series.set(key, value);
    return value;
  }

  function gauge(name, value) {
    const metric = metricOf(name, 'gauge');
    metric.series.set('', value);
    return value;
  }

  function histogram(name, value) {
    const metric = metricOf(name, 'histogram');
    const samples = metric.series.get('') || [];
    samples.push(value);
    metric.series.set('', samples);
    return samples.length;
  }

  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[index];
  }

  function snapshot() {
    const out = {};
    for (const [name, metric] of registry) {
      out[name] = { type: metric.type, series: [] };
      for (const [labels, value] of metric.series) {
        if (metric.type !== 'histogram') {
          out[name].series.push({ labels, value });
          continue;
        }
        const sorted = [...value].sort((left, right) => left - right);
        out[name].series.push({
          labels,
          count: sorted.length,
          sum: sorted.reduce((total, item) => total + item, 0),
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        });
      }
    }
    return JSON.parse(JSON.stringify(out));
  }

  return { counter, gauge, histogram, snapshot };
}`,
      tests: [
        {
          name: '计数按标签区分',
          code: `const metrics = createMetrics();
assert.equal(metrics.counter('http_requests', { route: '/jump' }), 1);
assert.equal(metrics.counter('http_requests', { route: '/jump' }), 2);
assert.equal(metrics.counter('http_requests', { route: '/create' }), 1);
const snapshot = metrics.snapshot();
assert.equal(snapshot.http_requests.series.length, 2);`
        },
        {
          name: 'gauge 覆盖旧值',
          code: `const metrics = createMetrics();
metrics.gauge('queue_depth', 3);
metrics.gauge('queue_depth', 7);
const series = metrics.snapshot().queue_depth.series;
assert.equal(series.length, 1);
assert.equal(series[0].value, 7);`
        },
        {
          name: '直方图返回分位数',
          code: `const metrics = createMetrics();
[10, 20, 30, 40, 50].forEach((value) => metrics.histogram('latency', value));
const stats = metrics.snapshot().latency.series[0];
assert.equal(stats.count, 5);
assert.equal(stats.sum, 150);
assert.equal(stats.p50, 30);
assert.equal(stats.p95, 50);
assert.equal(stats.p99, 50);`
        },
        {
          name: '单样本分位与未注册指标',
          code: `const metrics = createMetrics();
metrics.histogram('latency', 10);
const stats = metrics.snapshot().latency.series[0];
assert.equal(stats.p50, 10);
const empty = createMetrics();
const missing = empty.snapshot().latency;
assert.equal(missing, undefined);`
        },
        {
          name: '同名字段类型冲突抛错',
          code: `const metrics = createMetrics();
metrics.counter('requests');
let error = null;
try {
  metrics.gauge('requests', 1);
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof Error);
assert.ok(error.message.includes('requests'));`
        },
        {
          name: '快照与内部状态隔离',
          code: `const metrics = createMetrics();
metrics.counter('requests');
const snapshot = metrics.snapshot();
snapshot.requests.series[0].value = 999;
snapshot.requests.series.push({ labels: 'fake', value: 1 });
assert.equal(metrics.snapshot().requests.series.length, 1);
assert.equal(metrics.snapshot().requests.series[0].value, 1);`
        },
        {
          name: '标签顺序不同仍是同一条序列',
          code: `const metrics = createMetrics();
metrics.counter('requests', { b: 2, a: 1 });
metrics.counter('requests', { a: 1, b: 2 });
const series = metrics.snapshot().requests.series;
assert.equal(series.length, 1);
assert.equal(series[0].value, 2);
assert.equal(series[0].labels, 'a=1,b=2');`
        }
      ]
    },
    {
      id: 'm3-otel-ex-2',
      kind: 'design',
      title: 'LinkHub 可观测性方案',
      brief: '跳转接口依赖缓存与数据库，点击事件进入队列，统计服务偶发延迟。请给出日志字段、requestId 贯穿、RED 指标、关键 span、采样、告警、看板与保留期方案。',
      checklist: [
        '定义结构化日志字段与脱敏规则',
        '说明 requestId 在 API、数据库与队列中的传递',
        '给出跳转与创建的 RED 指标',
        '列出关键 span 与父子关系',
        '选择采样策略并说明取舍',
        '给出症状告警、阈值与 runbook',
        '说明看板要回答的问题',
        '给出保留期与成本控制'
      ],
      reference: '<ul><li><strong>日志：</strong>固定字段 requestId、route、status、durationMs、slugHash；不记录目标 URL 全文与用户邮箱；错误日志带 errorCode。</li><li><strong>requestId：</strong>入口生成，HTTP header 与队列消息都携带；消费者从消息恢复上下文。</li><li><strong>RED：</strong>跳转按 route/status 计 rate、errors、duration；创建单独看错误码分布。</li><li><strong>span：</strong>入口 span → 缓存 span → 数据库 span → 队列入队 span；统计消费者独立 trace 但沿用事件 ID。</li><li><strong>采样：</strong>头部采样保留 10% 正常请求，尾部采样保留全部错误与 P99 以上慢请求。</li><li><strong>告警：</strong>错误率连续 5 分钟 > 1%、P99 连续 10 分钟 > 300ms；附看板、日志查询与回滚步骤。</li><li><strong>看板：</strong>第一屏回答「跳转是否可用、慢在哪、统计是否积压」。</li><li><strong>保留：</strong>正常 trace 7 天、错误 30 天；日志 14 天，审计字段单独延长。</li></ul>'
    }
  ]
};
