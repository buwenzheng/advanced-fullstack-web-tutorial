export const a1 = {
  "id": "a1",
  "title": "复杂度与测量：先能算，再能测",
  "subtitle": "Big-O 只是起点：定义 n、控制微基准、用分位数判断数据是否可信。",
  "duration": 60,
  "status": "ready",
  "objectives": [
    "用 Big-O 描述增长，先定义 n 与操作，再谈结论。",
    "识别微基准的五个陷阱，并设计一次可复现的测量。",
    "用最近秩分位数与变异系数判断数据是否稳定。",
    "从操作计数拟合增长阶，区分 O(1)/O(log n)/O(n)/O(n log n)/O(n²)。"
  ],
  "keywords": ["Big-O", "微基准", "分位数", "CV", "增长拟合"],
  "blocks": [
    {
      "type": "analogy",
      "title": "打包体积与时间复杂度",
      "html": "前端优化打包体积时，你不会只看「这个包多少 KB」，而会问「它随页面数量怎么涨」。复杂度也一样：不看某一次跑了多少毫秒，而看输入规模翻倍时工作量怎么变。<br>这个类比在常数因子上会失效：一个 10KB 的库可能比 100KB 的库更慢，因为初始化成本高；同样，O(n) 的算法在 n 很小时可能输给 O(n log n) 的算法。复杂度描述的是趋势，不是某一次比赛。"
    },
    {
      "type": "text",
      "title": "Big-O 与 n 的定义",
      "html": "Big-O 是渐近上界：当 n 足够大时，工作量不超过某个常数乘以 f(n)。说「这是 O(n)」之前，必须说清 n 是什么、一次操作是什么。对哈希表，n 是元素个数，操作是一次查找；对排序，n 是元素个数，操作是一次比较；对一次 HTTP 请求，n 可能是响应体字节数，而不是请求数。<br>同一个程序可以同时有多个复杂度：插入是 O(1) 均摊，查找最坏是 O(n)，遍历是 O(n)。面试里被问「复杂度是多少」时，先反问「你关心哪个操作、n 指什么」。这不是抬杠，而是避免用一句结论覆盖不同场景。"
    },
    {
      "type": "table",
      "title": "常见增长阶",
      "head": ["增长阶", "典型操作", "n 翻倍时的工作量", "工程感受"],
      "rows": [
        ["O(1)", "数组下标、哈希表平均查找", "基本不变", "最快，但常数可能很大"],
        ["O(log n)", "有序数组二分、平衡树查找", "增加一个固定步数", "百万级数据也只有二十步左右"],
        ["O(n)", "一次遍历、求和", "约翻倍", "线性可接受，注意内存带宽"],
        ["O(n log n)", "比较排序、分治合并", "约翻倍再多一点", "排序的常见下界"],
        ["O(n²)", "双重循环、朴素最近邻", "约四倍", "数据稍大就不可用，必须换算法"]
      ]
    },
    {
      "type": "code",
      "title": "从操作计数拟合增长",
      "lang": "javascript",
      "code": "function estimateGrowth(samples) {\n  if (!Array.isArray(samples) || samples.length < 3) return 'unknown';\n  const seen = new Set();\n  for (const { n, ops } of samples) {\n    if (!Number.isFinite(n) || !Number.isFinite(ops) || n <= 0 || ops <= 0) return 'unknown';\n    seen.add(n);\n  }\n  if (seen.size < 3) return 'unknown';\n\n  const candidates = [\n    ['O(1)', () => 1],\n    ['O(log n)', (n) => Math.log2(n + 1)],\n    ['O(n)', (n) => n],\n    ['O(n log n)', (n) => n * Math.log2(n + 1)],\n    ['O(n^2)', (n) => n * n],\n  ];\n\n  for (const [label, f] of candidates) {\n    const ratios = samples.map(({ n, ops }) => ops / f(n));\n    const max = Math.max(...ratios);\n    const min = Math.min(...ratios);\n    if (max > 0 && (max - min) / max <= 0.15) return label;\n  }\n  return 'unknown';\n}",
      "note": "对每个候选函数计算 ops / f(n)，比值越稳定越像该增长阶；阈值 0.15 固定，不随数据调整。"
    },
    {
      "type": "text",
      "title": "深挖：微基准的五个陷阱",
      "html": "第一，预热不足。JIT 还没编译热路径、缓存还没填满，前几次测量会偏慢；正确做法是先跑若干轮预热，再开始计时。第二，计时精度不够。用毫秒级时钟测微秒级操作，噪声会淹没信号；要么放大工作量，要么使用更高精度的计时器。第三，忽略 GC。垃圾回收可能在某一轮突然暂停，把尾延迟拉高；要记录多轮结果，而不是只看平均值。第四，死代码消除。编译器发现结果没人使用，可能把整段计算删掉；测量时要把结果写入一个会被读取的变量。第五，环境噪声。其他进程、CPU 频率、容器配额、网络都会影响结果；固定环境、重复测量、报告分位数，比「我本地跑了一次」可信得多。<br>这五个陷阱的共同点是：它们不会让程序报错，只会让结论悄悄失真。复杂度分析给出方向，微基准验证常数；两者都不能替代对方。"
    },
    {
      "type": "code",
      "title": "压测数据汇总",
      "lang": "javascript",
      "code": "function summarizeBenchmark(samples) {\n  if (!Array.isArray(samples) || samples.length === 0) {\n    return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, cv: 0, stable: false };\n  }\n  const values = samples.map((sample) => sample.ms);\n  for (const value of values) {\n    if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_SAMPLE');\n  }\n  const sorted = [...values].sort((a, b) => a - b);\n  const n = values.length;\n  const mean = values.reduce((sum, value) => sum + value, 0) / n;\n  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;\n  const cv = mean === 0 ? 0 : Math.sqrt(variance) / mean;\n  const percentile = (p) => sorted[Math.max(0, Math.ceil((p / 100) * n) - 1)];\n  return {\n    count: n,\n    mean,\n    p50: percentile(50),\n    p95: percentile(95),\n    p99: percentile(99),\n    cv,\n    stable: cv <= 0.1,\n  };\n}",
      "note": "最近秩分位：ceil(p/100 × n) - 1；CV 使用总体标准差，阈值 0.1。"
    },
    {
      "type": "case",
      "title": "本地快 20%，线上慢 2 倍",
      "context": "一位工程师在本地把一段列表处理从 100ms 优化到 80ms，发布后线上 P95 反而从 300ms 涨到 600ms。",
      "symptom": "本地基准稳定复现 20% 提升；线上监控显示 CPU 使用率没有明显变化，但 P95 与 P99 同时恶化。",
      "cause": "本地数据规模只有 1 万条，线上平均 50 万条且分布长尾；优化引入了一个每次调用都重新分配的大数组，数据越大 GC 压力越高。本地只看平均值，没有看尾延迟与内存分配。",
      "fix": "回滚该优化，改用预分配缓冲区；把基准改成多规模梯度（1 万、10 万、100 万），并记录 P95/P99 与分配次数。",
      "prevention": "基准必须覆盖真实数据分布与规模；发布前用生产同量级数据做一次压测；把尾延迟与内存指标写进发布检查单。",
      "metric": "回滚后 P95 从 600ms 回到 310ms；100 万条规模下分配次数下降 90%。"
    },
    {
      "type": "pitfall",
      "title": "用平均值、忽略 GC、只测一次",
      "html": "现象：报告里只写「平均 50ms」，上线后用户仍抱怨卡顿。原因：平均值掩盖了长尾，少数慢请求才是体验杀手；GC 暂停与锁竞争往往只出现在 P99。<br>发现方式：把同一批请求按耗时分桶，观察 P95/P99 与最大值；同时记录 GC 次数与内存分配。<br>修复：报告分位数与稳定性指标，保留原始样本，避免只留一个汇总数字。<br>预防：基准脚本默认输出 p50/p95/p99、均值、CV 与样本数；样本不足或 CV 过高时标记为「不可结论」。"
    },
    {
      "type": "steps",
      "title": "设计一次可复现实验",
      "steps": [
        { "title": "定义问题", "html": "写清要比较的两个实现、n 的定义、关心的指标（时间、内存、分配次数），以及不关心的指标。" },
        { "title": "固定环境", "html": "同一台机器、同一 Node/Python 版本、关闭无关进程；容器环境记录 CPU 配额。" },
        { "title": "设置规模梯度", "html": "至少三个数量级，例如 1 千、1 万、10 万；每个规模独立预热。" },
        { "title": "重复测量", "html": "每个规模至少 30 次，保留原始样本；先预热 5 次再计时。" },
        { "title": "汇总与判断", "html": "输出 p50/p95/p99、均值、CV；CV 超过 0.1 时先排查噪声，不急着下结论。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「O(n log n) 一定比 O(n) 快吗」。好的回答先限定 n 的范围：在 n 很小时，常数因子与缓存局部性可能让 O(n log n) 的排序击败 O(n) 的哈希方案；在 n 很大时，增长阶才占主导。接着给出验证方式：做规模梯度、看分位数、记录内存分配，而不是背结论。<br>如果被追问「你怎么证明优化有效」，回答要包含基线、变量控制、重复次数与置信程度；只给一个「快了 20%」的数字，通常会被继续追问。"
    }
  ],
  "checks": [
    {
      "id": "a1-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "n 的定义",
      "prompt": "同事说「这个接口是 O(n)」，但没说 n 是什么。为什么这个结论无法直接使用？",
      "question": "同事说「这个接口是 O(n)」，但没说 n 是什么。为什么这个结论无法直接使用？",
      "options": [
        { "text": "n 可能指用户数、请求数或响应体字节数，不同定义对应不同的增长趋势", "correct": true },
        { "text": "Big-O 只适用于算法题，不适用于接口", "correct": false },
        { "text": "只要代码里有循环就一定是 O(n)，不需要定义 n", "correct": false },
        { "text": "O(n) 表示精确耗时，必须知道常数才能使用", "correct": false }
      ],
      "explain": "复杂度是相对于某个规模变量的增长趋势；变量定义不同，结论就不同。Big-O 也适用于接口与系统，只是要说明度量对象。"
    },
    {
      "id": "a1-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "微基准",
      "prompt": "做一次可信的微基准，必须控制哪些因素？",
      "question": "做一次可信的微基准，必须控制哪些因素？",
      "options": [
        { "text": "预热，避免把 JIT 编译时间算进结果", "correct": true },
        { "text": "固定环境，减少其他进程与频率变化的影响", "correct": true },
        { "text": "重复多轮并保留分位数，而不是只跑一次", "correct": true },
        { "text": "只保留最快的一次，因为它最接近真实性能", "correct": false },
        { "text": "忽略 GC，因为 GC 不属于业务代码", "correct": false }
      ],
      "explain": "预热、固定环境、重复测量与分位数是可信基准的基础；只取最快一次会掩盖长尾，忽略 GC 会漏掉真实的暂停成本。"
    },
    {
      "id": "a1-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "尾延迟",
      "prompt": "监控显示接口平均耗时 50ms，但 P99 是 900ms。最合理的判断是什么？",
      "question": "监控显示接口平均耗时 50ms，但 P99 是 900ms。最合理的判断是什么？",
      "options": [
        { "text": "存在长尾，可能是 GC、锁竞争或下游抖动，需要看分位数与原始样本", "correct": true },
        { "text": "平均值正常，说明系统没有问题", "correct": false },
        { "text": "P99 一定是因为网络丢包，无需排查服务端", "correct": false },
        { "text": "把平均值调低就能解决 P99", "correct": false }
      ],
      "explain": "平均值掩盖长尾；P99 高说明少数请求经历了排队、暂停或下游慢调用，应该结合分位数、GC 与依赖监控定位，而不是用平均值安慰自己。"
    }
  ],
  "exercises": [
    {
      "id": "a1-ex-1",
      "kind": "code",
      "title": "增长拟合 + 压测汇总",
      "brief": "实现两个纯函数。<code>estimateGrowth(samples)</code> 接收 <code>[{ n, ops }]</code>，返回 <code>'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'unknown'</code>：至少 3 个互异且 n、ops 均为正数的点，否则返回 unknown；对固定候选函数计算 <code>c = ops / f(n)</code>，取 <code>spread = (max(c) - min(c)) / max(c)</code>，最小 spread ≤ 0.15 即判定，并列时取更简单的增长阶。<br><code>summarizeBenchmark(samples)</code> 接收 <code>[{ ms }]</code>，返回 <code>{ count, mean, p50, p95, p99, cv, stable }</code>：最近秩分位，CV 使用总体标准差，CV ≤ 0.1 为稳定；空样本返回全 0 且 <code>stable: false</code>，非法样本抛错。",
      "hint": "先做输入校验，再按候选顺序尝试；分位下标用 Math.ceil(p/100 * n) - 1。",
      "starter": "function estimateGrowth(samples) {\n  return 'unknown';\n}\n\nfunction summarizeBenchmark(samples) {\n  return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, cv: 0, stable: false };\n}",
      "solution": "function estimateGrowth(samples) {\n  if (!Array.isArray(samples) || samples.length < 3) return 'unknown';\n  const seen = new Set();\n  for (const { n, ops } of samples) {\n    if (!Number.isFinite(n) || !Number.isFinite(ops) || n <= 0 || ops <= 0) return 'unknown';\n    seen.add(n);\n  }\n  if (seen.size < 3) return 'unknown';\n  const candidates = [\n    ['O(1)', () => 1],\n    ['O(log n)', (n) => Math.log2(n + 1)],\n    ['O(n)', (n) => n],\n    ['O(n log n)', (n) => n * Math.log2(n + 1)],\n    ['O(n^2)', (n) => n * n],\n  ];\n  for (const [label, f] of candidates) {\n    const ratios = samples.map(({ n, ops }) => ops / f(n));\n    const max = Math.max(...ratios);\n    const min = Math.min(...ratios);\n    if (max > 0 && (max - min) / max <= 0.15) return label;\n  }\n  return 'unknown';\n}\n\nfunction summarizeBenchmark(samples) {\n  if (!Array.isArray(samples) || samples.length === 0) {\n    return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, cv: 0, stable: false };\n  }\n  const values = samples.map((sample) => sample.ms);\n  for (const value of values) {\n    if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_SAMPLE');\n  }\n  const sorted = [...values].sort((a, b) => a - b);\n  const n = values.length;\n  const mean = values.reduce((sum, value) => sum + value, 0) / n;\n  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;\n  const cv = mean === 0 ? 0 : Math.sqrt(variance) / mean;\n  const percentile = (p) => sorted[Math.max(0, Math.ceil((p / 100) * n) - 1)];\n  return { count: n, mean, p50: percentile(50), p95: percentile(95), p99: percentile(99), cv, stable: cv <= 0.1 };\n}",
      "tests": [
        {
          "name": "常数增长",
          "code": "assert.equal(estimateGrowth([{ n: 100, ops: 5 }, { n: 1000, ops: 5 }, { n: 10000, ops: 5 }]), 'O(1)');"
        },
        {
          "name": "线性增长",
          "code": "assert.equal(estimateGrowth([{ n: 100, ops: 200 }, { n: 200, ops: 400 }, { n: 400, ops: 800 }]), 'O(n)');"
        },
        {
          "name": "线性对数增长",
          "code": "const f = (n) => n * Math.log2(n + 1);\nassert.equal(estimateGrowth([{ n: 100, ops: f(100) }, { n: 200, ops: f(200) }, { n: 400, ops: f(400) }]), 'O(n log n)');"
        },
        {
          "name": "平方增长",
          "code": "assert.equal(estimateGrowth([{ n: 10, ops: 100 }, { n: 20, ops: 400 }, { n: 40, ops: 1600 }]), 'O(n^2)');"
        },
        {
          "name": "点数不足返回 unknown",
          "code": "assert.equal(estimateGrowth([{ n: 10, ops: 10 }, { n: 20, ops: 20 }]), 'unknown');"
        },
        {
          "name": "噪声数据返回 unknown",
          "code": "assert.equal(estimateGrowth([{ n: 100, ops: 10 }, { n: 200, ops: 15 }, { n: 400, ops: 100 }]), 'unknown');"
        },
        {
          "name": "压测统计与分位",
          "code": "const result = summarizeBenchmark([{ ms: 10 }, { ms: 20 }, { ms: 30 }]);\nassert.equal(result.count, 3);\nassert.equal(result.mean, 20);\nassert.equal(result.p50, 20);\nassert.equal(result.p95, 30);\nassert.equal(result.p99, 30);\nassert.ok(Math.abs(result.cv - 0.408248) < 0.001);\nassert.equal(result.stable, false);"
        },
        {
          "name": "稳定样本与最近秩边界",
          "code": "const result = summarizeBenchmark([{ ms: 10 }, { ms: 20 }, { ms: 30 }, { ms: 40 }, { ms: 50 }]);\nassert.equal(result.p50, 30);\nassert.equal(result.p95, 50);\nassert.equal(result.p99, 50);\nassert.equal(summarizeBenchmark([{ ms: 100 }, { ms: 100 }, { ms: 100 }, { ms: 100 }]).stable, true);"
        },
        {
          "name": "空样本返回全零且不稳定",
          "code": "const result = summarizeBenchmark([]);\nassert.equal(result.count, 0);\nassert.equal(result.p99, 0);\nassert.equal(result.stable, false);"
        },
        {
          "name": "非法样本抛错",
          "code": "assert.throws(() => summarizeBenchmark([{ ms: 10 }, { ms: -1 }]));"
        }
      ]
    }
  ]
};
