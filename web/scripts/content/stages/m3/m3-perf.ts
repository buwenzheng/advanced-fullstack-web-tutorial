export const m3Perf = {
  id: 'm3-perf',
  title: '性能压测与瓶颈定位',
  subtitle: '基线、吞吐与延迟、P50/P95/P99、Little 定律、profile、火焰图与瓶颈分类。',
  duration: 75,
  status: 'ready',
  objectives: [
    '设计可复现的压测基线：负载模型、并发、时长、数据量与环境。',
    '正确解读吞吐、P50/P95/P99、错误率与饱和度，而不是只看平均值。',
    '用 profile、火焰图与慢查询定位 CPU、IO、锁与下游瓶颈。',
    '用 Little 定律做容量估算，并写清假设与验证方式。'
  ],
  keywords: ['压测', '吞吐', 'P99', 'Little 定律', 'profile', '火焰图', '饱和度', '协调遗漏', '容量估算'],
  blocks: [
    {
      type: 'analogy',
      title: 'Lighthouse 与后端压测',
      html: '用 Lighthouse 给页面打分时，你在固定设备模拟、固定网络限速下跑一次，分数可复现；但真实用户可能在低端机、弱网和冷缓存下得到完全不同的体验。后端压测也一样：固定环境、固定数据量、固定负载模型，结果才能前后比较；压测数字不是生产承诺。<br>类比失效的地方在于共享与反馈：Lighthouse 只测一个页面，压测会打到一个共享的服务和数据库上，缓存状态、连接池、下游限流都会随压测进程变化；而且压测流量是合成的，真实流量的读写比与 key 分布更复杂。'
    },
    {
      type: 'text',
      title: '四个核心指标',
      html: '压测报告至少要有四类数字：吞吐（throughput，每秒完成多少请求）、延迟分位（P50/P95/P99）、错误率与饱和度（CPU、连接池、队列水位）。吞吐回答能扛多少；分位回答用户等多久；错误率回答失败了多少；饱和度回答还有多少余量、排队是否在累积。<br>四者要一起看。吞吐升高但 P99 同时暴涨，说明系统已经越过拐点；忽略错误率时，大量快速失败会刷出漂亮的吞吐；饱和度不高而延迟很高，瓶颈通常在下游、锁或外部依赖，而不是 CPU。'
    },
    {
      type: 'flow',
      title: '从问题到复测的压测流程',
      steps: [
        { name: '定义问题与场景', detail: '明确要回答「跳转接口在峰值能否维持 P99 ≤ 300ms」。失败表现：没有目标，只收集一堆数字。' },
        { name: '记录基线', detail: '固定版本、配置、数据量、缓存状态与负载模型，先跑一次。失败表现：环境或数据量变了，前后不可比。' },
        { name: '逐步加压', detail: '从低并发按阶梯升到目标，观察吞吐与 P99 的拐点。失败表现：一次拉到最高并发，只得到崩溃结果。' },
        { name: '观察饱和度', detail: '同步采集 CPU、内存、GC、连接池、队列与下游错误。失败表现：只看压测工具，不知道瓶颈在哪。' },
        { name: 'profile 定位', detail: '对热点做 CPU profile、慢查询日志或锁等待采样。失败表现：凭直觉改代码，改完没有证据。' },
        { name: '提出假设并修复', detail: '一次只改一个变量，写清预期改善哪个指标。失败表现：同时改三处，无法归因。' },
        { name: '复测与留档', detail: '同环境同场景复测，记录前后对比与剩余瓶颈。失败表现：只保留最好的一次结果。' }
      ]
    },
    {
      type: 'code',
      title: '压测结果汇总',
      lang: 'javascript',
      code: `function summarizeLoadTest(samples, { durationSec } = {}) {
  if (!(durationSec > 0)) throw new RangeError('durationSec must be positive');
  const list = samples || [];
  const okSamples = list.filter((sample) => sample.ok);
  // 分位只统计成功请求，否则快速失败会拉低延迟
  const latencies = okSamples.map((sample) => sample.latencyMs).sort((a, b) => a - b);

  function percentile(p) {
    if (latencies.length === 0) return 0;
    // 最近秩：教学与告警统一口径，避免不同库的插值差异
    const index = Math.max(0, Math.ceil((p / 100) * latencies.length) - 1);
    return latencies[index];
  }

  const failures = list.length - okSamples.length;
  const avgLatency = latencies.length
    ? latencies.reduce((total, value) => total + value, 0) / latencies.length
    : 0;

  return {
    count: list.length,
    throughput: list.length / durationSec,
    errorRate: list.length ? failures / list.length : 0,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    // Little 定律：在途请求 ≈ 完成速率 × 平均停留时间
    avgConcurrency: (okSamples.length / durationSec) * (avgLatency / 1000),
  };
}`,
      note: '把错误样本排除在分位之外，是为了让「慢」和「错」分开看；报告里仍要单独给出错误率与成功请求吞吐。Little 定律算的是平均值，只能用于容量估算，不能预测 P99。'
    },
    {
      type: 'table',
      title: '压测工具与负载模型',
      head: ['工具/方式', '负载模型', '脚本能力', '输出', '适用'],
      rows: [
        ['k6', '虚拟用户闭环为主，可编排阶段', 'JS 脚本、场景与阈值', '吞吐、分位、错误率、阈值判定', '场景化压测与 CI 门禁'],
        ['autocannon', '闭环连接池', '主要靠命令行参数', '吞吐、延迟分位', '单接口快速回归'],
        ['ab', '固定并发闭环', '只能构造简单请求', '吞吐、有限的延迟统计', '快速冒烟与老环境验证'],
        ['自研脚本', '开环或闭环自定义', '完全可控', '取决于实现', '需要精确到达率或特殊协议']
      ],
      note: '工具只影响负载模型与统计口径，结论仍取决于场景、数据与环境。开环按固定到达率发送，闭环等上一个响应再发下一个；高延迟时闭环会自动降速，容易低估真实压力。'
    },
    {
      type: 'steps',
      title: '跑一次基线压测',
      steps: [
        { title: '固定环境', html: '同一镜像、实例规格、数据库数据量与索引；记录版本与配置。观察点：两次空载基线差异在可接受范围内。' },
        { title: '固定数据与缓存', html: '预热同一批 key，明确缓存命中率；冷缓存另跑一组。观察点：命中率写进报告，而不是只写「已预热」。' },
        { title: '固定负载模型', html: '选择开环或闭环、并发或到达率、持续时长（至少几分钟）。观察点：模型与生产流量假设一致。' },
        { title: '采集四类指标', html: '压测工具、服务端、数据库、宿主机的指标放在同一时间轴。观察点：能看到吞吐拐点与饱和度变化。' },
        { title: '在拐点做 profile', html: '在吞吐不再上升或 P99 起飞的区间采样，不要压完再看。观察点：热点函数、慢查询或锁等待有数据。' },
        { title: '记录结论与限制', html: '写清可复现条件、未覆盖场景与下一步。观察点：另一位同学能按记录复现同一趋势。' }
      ]
    },
    {
      type: 'pitfall',
      title: '平均值、协调遗漏与冷缓存',
      html: '现象：报告写平均延迟 50ms，用户仍投诉偶发很慢；压测显示 5000 QPS，上线后 2000 QPS 就超时；错误率 30% 但吞吐数字很漂亮；第一次压测很好，第二次差很多。<br>原因：平均值掩盖长尾；闭环压测在高延迟时自动降低发送速率（协调遗漏），掩盖真实排队；错误响应很快返回，把吞吐刷高；冷缓存、不同数据量或后台任务让两次结果不可比。<br>发现方式：同时看 P95/P99 与最大延迟；用开环固定到达率复核；把错误率写进报告并单独看成功请求吞吐；对比两次的缓存命中率、数据量与部署版本。<br>修复：以分位与错误率作为验收；按阶梯升到目标并记录拐点；固定数据与缓存状态；必要时用开环模型验证。<br>预防：压测脚本与场景纳入仓库；CI 跑短时回归；报告模板强制包含环境、数据量、模型与限制。'
    },
    {
      type: 'text',
      title: '深挖：排队、尾延迟与容量冗余',
      html: '当利用率接近上限时，队列长度不是线性增长。服务时间稍有波动，等待时间就会被放大，P99 往往比 P50 高出数倍；这就是「平均看起来还行，尾部已经排队」。Little 定律 L = λW 描述稳定系统里在途请求数、到达率与平均停留时间的关系：知道其中两个可以估算第三个，但它只适用于长期稳定、没有大量丢弃的系统，也不能直接预测 P99。<br>因此容量估算要留冗余：把目标利用率控制在有依据的范围内，再用压测验证，而不是把理论吞吐当上限。定位尾延迟时，先分清是服务时间变长（CPU、GC、慢查询、下游）还是等待时间变长（连接池、线程池、锁、队列）；两者修复方向完全不同。排队论的完整模型与公式在附录 b-capacity，本讲只需要用指标判断「是否已经排队」。'
    },
    {
      type: 'table',
      title: '瓶颈指纹',
      head: ['信号', '常见原因', '确认方式', '处理方向'],
      rows: [
        ['CPU 接近饱和，吞吐不再上升', '计算密集、序列化、正则回溯', 'top/perf、CPU profile', '减少计算、缓存结果、水平扩容'],
        ['CPU 不高但 P99 抖动', 'GC 停顿、内存分配过多', 'GC 日志、停顿时间', '降低分配、调整堆、替换分配策略'],
        ['IO 等待高、磁盘队列长', '慢查询、全表扫描、频繁刷盘', 'iostat、慢查询日志', '加索引、批量写、读写分离'],
        ['连接池等待或超时', '池太小、下游慢、连接泄漏', '池等待时间、活跃连接数', '调整池容量、设超时、修泄漏'],
        ['下游延迟上升', '第三方 API、数据库、缓存', '下游 span、错误率与超时', '限流、降级、超时与重试预算']
      ],
      note: '同一组症状可能由多层叠加：先用时间轴对齐压测工具与服务端指标，再按「服务时间 vs 等待时间」分类。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「P99 很高但 CPU 不高，怎么查」先确认 P99 来自入口、某一跳下游还是客户端；再看等待类指标（连接池、线程池、锁、队列）与 GC 停顿；最后用 profile 和慢查询验证。回答时给出排查顺序与判据，不要直接猜「加机器」。<br>「并发数和 QPS 是什么关系」并发是在途请求数，QPS 是到达率，用 Little 定律估算：并发 ≈ QPS × 平均延迟。高延迟会让同样 QPS 需要更多并发，连接池与线程池因此先耗尽。'
    }
  ],
  checks: [
    {
      id: 'm3-perf-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '延迟分位',
      prompt: '某接口 P99 = 300ms，正确理解是什么？',
      question: '某接口 P99 = 300ms，正确理解是什么？',
      options: [
        { text: '约 99% 的请求在 300ms 内完成，约 1% 更慢', correct: true },
        { text: '所有请求的平均延迟是 300ms', correct: false },
        { text: '最慢的一条请求耗时 300ms', correct: false },
        { text: '99% 的请求恰好耗时 300ms', correct: false }
      ],
      explain: 'P99 是分位：99% 的请求不超过该值，约 1% 可能更慢。它不等于平均值，也不是最大值，更不表示大部分请求都卡在 300ms。'
    },
    {
      id: 'm3-perf-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '压测设计',
      prompt: '要让两次压测结果可比，必须固定哪些条件？',
      question: '要让两次压测结果可比，必须固定哪些条件？',
      options: [
        { text: '相同的部署版本与实例规格', correct: true },
        { text: '相同的数据量与索引', correct: true },
        { text: '相同的缓存状态与预热方式', correct: true },
        { text: '每次换不同的负载模型以覆盖更多情况', correct: false },
        { text: '只保留吞吐最高的一次结果', correct: false }
      ],
      explain: '版本、规格、数据量、索引与缓存状态都会改变结果，必须固定。换负载模型可以作为额外实验，但不能在同一组对比里混用；只保留最好结果会失去可比性与可信度。'
    },
    {
      id: 'm3-perf-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '瓶颈判断',
      prompt: 'CPU 使用率 35%，P99 从 80ms 升到 900ms，连接池等待时间上升，数据库 QPS 没有明显变化。最可能的瓶颈是什么？',
      question: 'CPU 使用率 35%，P99 从 80ms 升到 900ms，连接池等待时间上升，数据库 QPS 没有明显变化。最可能的瓶颈是什么？',
      options: [
        { text: 'CPU 算力不足，需要扩容', correct: false },
        { text: '连接池容量或连接等待，请求在等服务端连接', correct: true },
        { text: '客户端网络带宽耗尽', correct: false },
        { text: '压测工具统计错误，可以忽略', correct: false }
      ],
      explain: 'CPU 不高可以排除算力饱和；数据库 QPS 未变而连接池等待上升，说明请求在等待连接或连接被慢操作占用。应检查池容量、连接泄漏与慢查询占用连接的时间。'
    }
  ],
  exercises: [
    {
      id: 'm3-perf-ex-1',
      kind: 'code',
      title: '压测结果汇总',
      brief: '实现 summarizeLoadTest(samples, { durationSec } = {})。samples 为 { latencyMs, ok } 数组。返回 { count, throughput, errorRate, p50, p95, p99, avgConcurrency }。count 为全部样本数；throughput = count / durationSec；errorRate = 失败数 / count，空样本为 0；延迟分位只统计成功样本，用最近秩，无成功样本时为 0；avgConcurrency = (成功数 / durationSec) × (成功样本平均延迟 ms / 1000)。durationSec ≤ 0 或缺失时抛 RangeError。',
      hint: '先过滤成功样本并排序；最近秩索引 = ceil(p/100 × n) - 1，最小为 0。Little 定律只用成功请求的完成速率与平均延迟，错误请求不进入并发估算。',
      starter: `function summarizeLoadTest(samples, { durationSec } = {}) {
  const list = samples || [];
  const times = list.map((sample) => sample.latencyMs);
  const total = times.reduce((sum, value) => sum + value, 0);
  const average = times.length ? total / times.length : 0;

  return {
    count: list.length,
    throughput: list.length / durationSec,
    errorRate: 0,
    p50: average,
    p95: average,
    p99: average,
    avgConcurrency: 0,
  };
}`,
      solution: `function summarizeLoadTest(samples, { durationSec } = {}) {
  if (!(durationSec > 0)) throw new RangeError('durationSec must be positive');
  const list = samples || [];
  const okSamples = list.filter((sample) => sample.ok);
  const latencies = okSamples.map((sample) => sample.latencyMs).sort((a, b) => a - b);

  function percentile(p) {
    if (latencies.length === 0) return 0;
    const index = Math.max(0, Math.ceil((p / 100) * latencies.length) - 1);
    return latencies[index];
  }

  const failures = list.length - okSamples.length;
  const avgLatency = latencies.length
    ? latencies.reduce((total, value) => total + value, 0) / latencies.length
    : 0;

  return {
    count: list.length,
    throughput: list.length / durationSec,
    errorRate: list.length ? failures / list.length : 0,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    avgConcurrency: (okSamples.length / durationSec) * (avgLatency / 1000),
  };
}`,
      tests: [
        {
          name: '空样本返回零值且不报错',
          code: `assert.deepEqual(summarizeLoadTest([], { durationSec: 10 }), {
  count: 0,
  throughput: 0,
  errorRate: 0,
  p50: 0,
  p95: 0,
  p99: 0,
  avgConcurrency: 0,
});`
        },
        {
          name: '全成功样本按最近秩计算分位',
          code: `const samples = [10, 20, 30, 40, 50].map((latencyMs) => ({ latencyMs, ok: true }));
const result = summarizeLoadTest(samples, { durationSec: 5 });
assert.equal(result.count, 5);
assert.equal(result.throughput, 1);
assert.equal(result.errorRate, 0);
assert.equal(result.p50, 30);
assert.equal(result.p95, 50);
assert.equal(result.p99, 50);`
        },
        {
          name: '错误样本不计入延迟分位',
          code: `const samples = [
  { latencyMs: 10, ok: true },
  { latencyMs: 20, ok: true },
  { latencyMs: 30, ok: false },
  { latencyMs: 40, ok: true },
  { latencyMs: 50, ok: true },
];
const result = summarizeLoadTest(samples, { durationSec: 2 });
assert.equal(result.count, 5);
assert.equal(result.throughput, 2.5);
assert.equal(result.errorRate, 0.2);
assert.equal(result.p50, 20);
assert.equal(result.p95, 50);
assert.equal(result.p99, 50);`
        },
        {
          name: '单样本时各分位相等',
          code: `const result = summarizeLoadTest([{ latencyMs: 7, ok: true }], { durationSec: 1 });
assert.equal(result.p50, 7);
assert.equal(result.p95, 7);
assert.equal(result.p99, 7);
assert.equal(result.errorRate, 0);
assert.equal(result.avgConcurrency, 0.007);`
        },
        {
          name: '全部失败时延迟与并发为零',
          code: `const samples = [
  { latencyMs: 100, ok: false },
  { latencyMs: 50, ok: false },
];
const result = summarizeLoadTest(samples, { durationSec: 2 });
assert.equal(result.count, 2);
assert.equal(result.throughput, 1);
assert.equal(result.errorRate, 1);
assert.equal(result.p50, 0);
assert.equal(result.p95, 0);
assert.equal(result.p99, 0);
assert.equal(result.avgConcurrency, 0);`
        },
        {
          name: '按 Little 定律估算平均并发',
          code: `const samples = Array.from({ length: 10 }, () => ({ latencyMs: 200, ok: true }));
const result = summarizeLoadTest(samples, { durationSec: 2 });
assert.equal(result.throughput, 5);
assert.ok(Math.abs(result.avgConcurrency - 1) < 1e-9);`
        },
        {
          name: '非法时长抛 RangeError',
          code: `let zeroError = null;
try {
  summarizeLoadTest([], { durationSec: 0 });
} catch (caught) {
  zeroError = caught;
}
assert.ok(zeroError instanceof RangeError);
let negativeError = null;
try {
  summarizeLoadTest([], { durationSec: -1 });
} catch (caught) {
  negativeError = caught;
}
assert.ok(negativeError instanceof RangeError);
let missingError = null;
try {
  summarizeLoadTest([]);
} catch (caught) {
  missingError = caught;
}
assert.ok(missingError instanceof RangeError);`
        }
      ]
    },
    {
      id: 'm3-perf-ex-2',
      kind: 'design',
      title: 'LinkHub 容量估算',
      brief: '跳转峰值约 10 万 QPS，读写比约 100:1，缓存命中率目标 95%，单实例容量需要压测得出。请给出容量估算、冗余、增长预留、成本与验证方案，并把所有假设写成可证伪的句子。',
      checklist: [
        '给出峰值 QPS、读写比与到达模型',
        '用缓存命中率推算回源 QPS',
        '给出单实例容量与压测依据',
        '用 Little 定律说明并发与延迟假设',
        '给出 2-3 倍冗余与故障域',
        '给出增长预留与扩容触发条件',
        '估算单位成本与成本上限',
        '列出瓶颈假设与验证方式',
        '说明降级与回滚条件'
      ],
      reference: '<ul><li><strong>流量：</strong>峰值 10 万 QPS、平均 3 万；读（跳转）与写（创建）约 100:1；用生产日志的分钟级峰值而不是日平均。</li><li><strong>回源：</strong>命中率 95% 时回源约 5000 QPS；命中率跌到 90% 则翻倍，必须按更低命中率做容量预案。</li><li><strong>单实例：</strong>用 m3-perf 的基线压测得到「P99 ≤ 300ms 时的最大吞吐」，再乘安全系数，不能拿理论 CPU 核数推算。</li><li><strong>并发：</strong>用 Little 定律估算在途请求数，验证连接池与线程池上限；高延迟场景单独估算。</li><li><strong>冗余：</strong>至少 N+2 或 2-3 倍冗余，跨可用区部署；单区故障时剩余容量仍能承载峰值。</li><li><strong>增长：</strong>按季度增长预留 30%-50%，写清扩容触发指标（CPU、P99、回源 QPS）与提前量。</li><li><strong>成本：</strong>按实例数、数据库规格、缓存容量与流量计费，给出月度上限与超限处理。</li><li><strong>验证：</strong>用开环与闭环两组压测验证；记录瓶颈假设（连接池、数据库、缓存）与实测结果。</li><li><strong>降级：</strong>缓存故障时限流回源、关闭非核心统计；明确回滚条件与责任人。</li></ul>'
    }
  ]
};
