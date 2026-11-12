export const m3Render = {
  id: 'm3-render',
  title: '渲染架构与端到端性能',
  subtitle: 'CSR/SSR/SSG/流式、水合成本、Core Web Vitals 与性能预算。',
  duration: 85,
  status: 'ready',
  objectives: [
    '区分 CSR/SSR/SSG/流式渲染的收益与成本，并按页面特征选择。',
    '解释水合成本与可交互时间，避免「首屏很快、点了没反应」。',
    '用 LCP/INP/CLS 与性能预算管理体验，而不是只看加载完成。',
    '区分实验室数据与 RUM，知道各自的盲区。'
  ],
  keywords: ['SSR', 'SSG', 'CSR', '流式渲染', '水合', 'Core Web Vitals', 'LCP', 'INP', 'CLS', '性能预算', 'RUM'],
  blocks: [
    {
      type: 'analogy',
      title: '外卖到店 vs 到桌',
      html: 'CSR 像收到一个空餐盒和一份说明书，食材与组装都在家里完成：页面先到，内容后到，交互要等脚本执行完。SSR 像到店即食：后厨把 HTML 做好，浏览器先看到完整页面，但服务员还要确认桌号、摆好餐具，才能开始服务——这段就是水合。<br>SSG 更像提前做好的便当： build 时已经装好，取餐最快，但内容不会因为你到了而现做。流式渲染则是先上凉菜、再上主菜：shell 先到，慢数据后补。类比失效的地方在成本：餐厅多做一份只是食材成本，SSR 每次请求都要服务端渲染，缓存与个性化会把账算得更复杂。'
    },
    {
      type: 'text',
      title: '四种渲染模式：按页面选，不按潮流选',
      html: 'CSR 把渲染放在浏览器：HTML 很轻，数据与视图都靠脚本。它适合登录后的工具页、交互密集但 SEO 不重要的页面；代价是首屏白屏与请求瀑布。SSR 在服务端生成 HTML，首屏内容快、SEO 友好；代价是服务端每次渲染的成本、缓存复杂，以及水合前不可交互。SSG 在构建时生成静态 HTML，最快、最便宜，适合营销页、文档与不常变的公开内容；代价是数据新鲜度受构建频率限制。<br>流式渲染先发送可缓存的 shell，再按数据到达顺序补片段：它适合个性化看板与慢数据页面，能显著改善首屏感知；代价是错误边界、超时与 SEO 语义更复杂。选择依据是页面特征：是否需要登录、个性化程度、可接受的内容陈旧时间、SEO 要求、交互密度。同一个站点不同页面可以用不同策略，不要用一个模式套全站。'
    },
    {
      type: 'flow',
      title: '从请求到可交互',
      steps: [
        { name: '请求 HTML', detail: 'CSR 返回空壳；SSR/SSG 返回带内容的 HTML。失败表现：HTML 到了但首屏空白。' },
        { name: '下载关键资源', detail: 'CSS、字体、首屏脚本阻塞渲染。失败表现：字体闪烁、样式跳变。' },
        { name: '构建 DOM 与样式', detail: '浏览器解析 HTML、应用 CSS。失败表现：图片无尺寸导致布局偏移。' },
        { name: '执行脚本与水合', detail: '框架把事件绑到服务端 HTML 上。失败表现：页面看起来好了，点击没反应。' },
        { name: '可交互', detail: '事件处理器就绪，输入有响应。失败表现：长任务把主线程占满，INP 超标。' }
      ]
    },
    {
      type: 'code',
      title: '渲染策略决策器',
      lang: 'javascript',
      code: `function chooseRenderStrategy(page = {}) {
  const personalization = page.personalization === undefined ? 'none' : page.personalization;
  const freshnessSec = page.freshnessSec === undefined ? Infinity : page.freshnessSec;

  if (personalization === 'high') return 'stream';
  if (page.seo === true && freshnessSec <= 60) return 'ssr';
  if (page.seo === true) return 'ssg';
  if (page.requiresAuth === true) return 'csr';
  return 'csr';
}`,
      note: '规则顺序就是优先级：高个性化优先流式，因为缓存与 SEO 都救不了每人不同的内容；SEO 且要求新鲜走 SSR；SEO 且可陈旧走 SSG；登录页默认 CSR。规则写成纯函数，才能用测试锁住产品决策。'
    },
    {
      type: 'table',
      title: 'Core Web Vitals：测什么、差在哪',
      head: ['指标', '衡量什么', 'good 阈值（p75）', '常见修复'],
      rows: [
        ['LCP', '最大内容绘制时间', '≤ 2.5s', '优化首屏图片、字体与阻塞资源'],
        ['INP', '交互到下一次绘制的延迟', '≤ 200ms', '拆长任务、减少主线程竞争'],
        ['CLS', '布局偏移累计分数', '≤ 0.1', '图片与广告预留尺寸，避免插入内容'],
        ['TTFB', '首字节时间（辅助）', '因场景而异', '服务端渲染、缓存与边缘'],
        ['水合时间', 'HTML 到可交互', '无统一阈值', '缩小水合范围、延迟非关键组件']
      ],
      note: 'CWV 是现场指标：按真实用户 p75 统计，不是实验室单次跑分。阈值会演进，正文以当前「good」口径讲机制；实验室数据用于定位，RUM 用于判断真实影响。'
    },
    {
      type: 'code',
      title: '性能预算检查：p75 与违规排序',
      lang: 'javascript',
      code: `function percentile75(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.75 * sorted.length) - 1];
}

function checkBudget(samples = {}, budget = {}) {
  const order = ['lcp', 'inp', 'cls'];
  const violations = [];

  for (const metric of order) {
    if (budget[metric] === undefined || budget[metric] === null) continue;
    const value = percentile75(samples[metric]);
    if (value === null) {
      violations.push({ metric, p75: null, budget: budget[metric], ratio: null, reason: 'NO_DATA' });
      continue;
    }
    if (value > budget[metric]) {
      violations.push({
        metric,
        p75: value,
        budget: budget[metric],
        ratio: (value - budget[metric]) / budget[metric]
      });
    }
  }

  const rank = { lcp: 0, inp: 1, cls: 2 };
  violations.sort((a, b) => {
    const left = a.ratio === null ? -Infinity : a.ratio;
    const right = b.ratio === null ? -Infinity : b.ratio;
    if (right !== left) return right - left;
    return rank[a.metric] - rank[b.metric];
  });

  return { pass: violations.length === 0, violations };
}`,
      note: 'p75 用最近秩，不插值也不取平均：平均会被少量极快样本拉低，掩盖尾部体验。违规按超出预算的比例排序，先修最严重的；比例相同按固定指标顺序，保证测试与看板稳定。NO_DATA 必须判失败——没有数据不能当成达标。'
    },
    {
      type: 'case',
      title: '首屏 1.2s，INP 600ms',
      context: 'LinkHub 看板改为 SSR 后，LCP 从 3.4s 降到 1.2s，但用户反馈点击筛选要等半秒以上。',
      symptom: 'LCP 已达标，INP 的 p75 为 600ms；输入筛选条件时页面卡顿，移动端更明显。',
      cause: 'SSR 只解决了首屏 HTML；水合时一次性执行整棵组件树，加上图表库同步计算，主线程长任务阻塞输入响应。',
      fix: '缩小水合范围：静态区域不水合，图表延迟到可见时再加载；把大计算移入 Worker 或服务端；对筛选输入做防抖并拆分长任务。',
      prevention: '预算同时约束 LCP 与 INP；水合成本纳入评审；RUM 分页面监控 INP，实验室只做回归定位。',
      metric: 'INP p75 从 600ms 降到 180ms，LCP 保持 1.2s'
    },
    {
      type: 'pitfall',
      title: '渲染的五个坑',
      html: '<strong>水合不一致：</strong>服务端与客户端渲染结果不同，框架丢弃整棵 DOM 重建。修复：数据与时间/随机数在两端保持一致，或显式标记仅客户端内容。<br><strong>流式被同步阻塞：</strong>在 shell 前等待慢数据，流式退化成普通 SSR。修复：先发 shell，慢片段独立超时与错误边界。<br><strong>图片无尺寸：</strong>图片加载后撑开布局，CLS 飙升。修复：用宽高比或固定尺寸预留空间。<br><strong>长任务：</strong>水合与第三方脚本占满主线程，INP 超标。修复：缩小水合范围、延迟非关键脚本、拆分任务。<br><strong>缓存个性化 HTML：</strong>把带用户信息的 HTML 放进公共缓存，造成串号。修复：个性化页面不公共缓存，或缓存键包含用户/租户维度。'
    },
    {
      type: 'compare',
      title: 'SSR、SSG、ISR 与流式',
      cols: [
        {
          title: 'SSR',
          items: [
            '每次请求服务端渲染',
            '内容新鲜，SEO 友好',
            '服务端成本与缓存复杂',
            '适合登录页与新鲜内容'
          ]
        },
        {
          title: 'SSG',
          items: [
            '构建时生成静态 HTML',
            '最快、最便宜、易缓存',
            '内容受构建频率限制',
            '适合营销页与文档'
          ]
        },
        {
          title: 'ISR',
          items: [
            '静态为主，按间隔或事件再生成',
            '兼顾速度与新鲜度',
            '需要失效与版本策略',
            '适合内容列表与商品页'
          ]
        },
        {
          title: '流式',
          items: [
            '先发 shell，再补数据片段',
            '首屏感知最好',
            '错误边界与超时复杂',
            '适合个性化看板'
          ]
        }
      ]
    },
    {
      type: 'steps',
      title: '为 LinkHub 看板选渲染策略',
      steps: [
        { title: '给页面分类', html: '营销页、公开链接页、登录后看板、设置页分别列出。观察点：每类页面的访问者与数据依赖不同。' },
        { title: '标注数据特征', html: '是否个性化、可接受多久的陈旧、是否依赖登录。观察点：个性化高的页面不能进公共缓存。' },
        { title: '匹配策略', html: '公开且稳定走 SSG；公开且新鲜走 SSR；个性化看板走流式；设置页走 CSR。观察点：策略按页面，不按全站。' },
        { title: '定义预算', html: '每类页面给出 LCP/INP/CLS 的 p75 门槛，写进 CI。观察点：预算有具体数字与统计口径。' },
        { title: '设计降级', html: '流式片段超时显示局部错误；脚本失败保留可读内容。观察点：慢接口不会拖垮整个页面。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：关键路径与资源提示',
      html: '关键路径是「从请求到用户看到主要内容」之间必须完成的资源与计算。优化顺序通常是：先减少关键资源数量，再缩短每个资源的等待，最后才做并行提示。把首屏不需要的脚本改成延迟加载，比给所有资源加 preload 更有效；字体用 font-display 与子集化，避免长时间不可见文本；首屏图片给定尺寸并优先加载，非首屏图片懒加载。<br>资源提示要克制：preload 会提高优先级并占用带宽，滥用会挤占真正关键的请求；preconnect 适合确定会用的第三方源，但每个连接都有成本；fetchpriority 用于在候选资源中排序，而不是把所有资源都设成高优先级。字体、图片与第三方脚本是 LCP 的三大常见来源，优化前先用瀑布图确认真正的瓶颈。<br>实验室工具适合复现与回归，RUM 才代表真实用户。两者结合的方式是：RUM 发现哪个页面、哪类设备、哪个指标差；实验室复现该场景；修复后再看 RUM 的 p75 是否回落。只盯实验室分数，容易优化了不痛的地方。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「LCP 好但 INP 差说明什么」说明首屏内容已经够快，但主线程在可交互后仍被长任务占用：水合范围过大、第三方脚本、同步计算或大量事件处理。回答时先区分「加载」与「响应」，再给出缩小水合、拆任务、延迟脚本的具体手段，并用 RUM 的 p75 验证。<br>「为什么不能全站 SSG」要从个性化、新鲜度与构建成本回答：登录后内容每人不同，公共缓存会串号；高频变化的内容会让构建频率失控；交互密集的页面仍要水合。策略应按页面特征组合，而不是追求单一模式。'
    }
  ],
  checks: [
    {
      id: 'm3-render-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '渲染选择',
      prompt: '登录后的个性化看板，最合适的渲染策略是什么？',
      question: '登录后的个性化看板，最合适的渲染策略是什么？',
      options: [
        { text: '流式或 SSR 加客户端补充，按用户维度处理缓存', correct: true },
        { text: '全站 SSG，构建时生成所有用户的看板', correct: false },
        { text: '完全不渲染 HTML，等脚本加载后再请求数据', correct: false },
        { text: '把看板 HTML 放进 CDN 公共缓存', correct: false }
      ],
      explain: '个性化内容不能进入公共缓存；流式或 SSR 可以先给出首屏，再按用户补数据。全站 SSG 无法覆盖每个用户，纯 CSR 会放大首屏等待。'
    },
    {
      id: 'm3-render-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '水合成本',
      prompt: '以下哪些因素会增加水合成本、推迟可交互时间？',
      question: '以下哪些因素会增加水合成本、推迟可交互时间？',
      options: [
        { text: '组件树规模大，需要绑定大量事件', correct: true },
        { text: '服务端序列化的数据体积大，客户端要重复解析', correct: true },
        { text: '客户端重复执行本可在服务端完成的计算', correct: true },
        { text: '第三方脚本占用主线程', correct: true },
        { text: 'HTML 使用了语义化标签', correct: false }
      ],
      explain: '水合成本来自组件规模、序列化数据、重复计算与主线程竞争。语义化标签不会增加水合成本，反而有利于可访问性与 SEO。'
    },
    {
      id: 'm3-render-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '指标优先级',
      prompt: 'LCP 为 2.1s（达标），INP 为 480ms（远超 200ms 阈值），应该先修什么？',
      question: 'LCP 为 2.1s（达标），INP 为 480ms（远超 200ms 阈值），应该先修什么？',
      options: [
        { text: '优先拆长任务、降低主线程竞争，改善交互响应', correct: true },
        { text: '继续压缩首屏图片，把 LCP 再降 0.1s', correct: false },
        { text: '把所有脚本都加上 preload', correct: false },
        { text: '忽略 INP，因为 LCP 已经达标', correct: false }
      ],
      explain: 'INP 已严重超标，说明交互响应是当前主要痛点；LCP 已达标，继续微调的收益远小于修复长任务。资源提示不能替代主线程优化。'
    }
  ],
  exercises: [
    {
      id: 'm3-render-ex-1',
      kind: 'code',
      title: '渲染策略决策 + 性能预算',
      brief: '实现 chooseRenderStrategy(page) 与 checkBudget(samples, budget)。chooseRenderStrategy 按固定优先级返回 stream/ssr/ssg/csr：高个性化 → stream；SEO 且 freshnessSec ≤ 60 → ssr；SEO → ssg；需要登录 → csr；默认 csr。personalization 缺省 none，freshnessSec 缺省 Infinity。checkBudget 用最近秩计算 p75（升序后 index = ceil(0.75 * n) - 1），p75 ≤ budget 通过；空或缺失样本记 p75: null、reason: NO_DATA 并判失败；ratio = (p75 - budget) / budget，按 ratio 降序，ratio 相同按 lcp → inp → cls 排序，NO_DATA 排最后。',
      hint: 'chooseRenderStrategy 直接按规则顺序 if 返回。percentile75 先过滤空数组再排序取最近秩。checkBudget 只检查 budget 中存在的指标；违规对象保留 p75 与 budget；排序时把 null ratio 当成 -Infinity，再用固定 rank 打破平局。',
      starter: `function chooseRenderStrategy(page = {}) {
  if (page.seo === true) return 'ssg';
  return 'csr';
}

function checkBudget(samples = {}, budget = {}) {
  const violations = [];
  for (const metric of ['lcp', 'inp', 'cls']) {
    const values = samples[metric] || [];
    const average = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    if (budget[metric] !== undefined && average > budget[metric]) {
      violations.push({ metric, p75: average, budget: budget[metric], ratio: 0 });
    }
  }
  return { pass: violations.length === 0, violations };
}`,
      solution: `function chooseRenderStrategy(page = {}) {
  const personalization = page.personalization === undefined ? 'none' : page.personalization;
  const freshnessSec = page.freshnessSec === undefined ? Infinity : page.freshnessSec;

  if (personalization === 'high') return 'stream';
  if (page.seo === true && freshnessSec <= 60) return 'ssr';
  if (page.seo === true) return 'ssg';
  if (page.requiresAuth === true) return 'csr';
  return 'csr';
}

function percentile75(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.75 * sorted.length) - 1];
}

function checkBudget(samples = {}, budget = {}) {
  const order = ['lcp', 'inp', 'cls'];
  const violations = [];

  for (const metric of order) {
    if (budget[metric] === undefined || budget[metric] === null) continue;
    const value = percentile75(samples[metric]);
    if (value === null) {
      violations.push({ metric, p75: null, budget: budget[metric], ratio: null, reason: 'NO_DATA' });
      continue;
    }
    if (value > budget[metric]) {
      violations.push({
        metric,
        p75: value,
        budget: budget[metric],
        ratio: (value - budget[metric]) / budget[metric]
      });
    }
  }

  const rank = { lcp: 0, inp: 1, cls: 2 };
  violations.sort((a, b) => {
    const left = a.ratio === null ? -Infinity : a.ratio;
    const right = b.ratio === null ? -Infinity : b.ratio;
    if (right !== left) return right - left;
    return rank[a.metric] - rank[b.metric];
  });

  return { pass: violations.length === 0, violations };
}`,
      tests: [
        {
          name: '营销页走 SSG',
          code: `const strategy = chooseRenderStrategy({ seo: true, personalization: 'none', freshnessSec: 86400 });
assert.equal(strategy, 'ssg');`
        },
        {
          name: '高个性化看板即使 SEO 也走流式',
          code: `const strategy = chooseRenderStrategy({ seo: true, personalization: 'high', freshnessSec: 10 });
assert.equal(strategy, 'stream');`
        },
        {
          name: '登录工具页走 CSR',
          code: `const strategy = chooseRenderStrategy({ requiresAuth: true, seo: false, interactivity: true });
assert.equal(strategy, 'csr');`
        },
        {
          name: 'SEO 且要求新鲜走 SSR',
          code: `const strategy = chooseRenderStrategy({ seo: true, freshnessSec: 30 });
assert.equal(strategy, 'ssr');
const missing = chooseRenderStrategy({});
assert.equal(missing, 'csr');`
        },
        {
          name: '全部指标达标时通过',
          code: `const result = checkBudget(
  { lcp: [2000, 2100, 2200, 2300], inp: [100, 120, 150, 180], cls: [0.05, 0.08, 0.09, 0.1] },
  { lcp: 2500, inp: 200, cls: 0.1 }
);
assert.equal(result.pass, true);
assert.deepEqual(result.violations, []);`
        },
        {
          name: 'p75 使用最近秩且等于预算时通过',
          code: `const atLimit = checkBudget({ lcp: [2000, 2500, 2500, 2500] }, { lcp: 2500 });
assert.equal(atLimit.pass, true);
const skewed = checkBudget({ lcp: [1000, 1000, 5000, 5000] }, { lcp: 4000 });
assert.equal(skewed.pass, false);
assert.equal(skewed.violations[0].p75, 5000);
assert.equal(skewed.violations[0].ratio, 0.25);`
        },
        {
          name: '空样本与缺失样本标记 NO_DATA 并失败',
          code: `const empty = checkBudget({ lcp: [] }, { lcp: 2500 });
assert.equal(empty.pass, false);
assert.deepEqual(empty.violations[0], {
  metric: 'lcp',
  p75: null,
  budget: 2500,
  ratio: null,
  reason: 'NO_DATA'
});
const missing = checkBudget({}, { inp: 200 });
assert.equal(missing.pass, false);
assert.equal(missing.violations[0].metric, 'inp');`
        },
        {
          name: '多违规按 ratio 降序且同 ratio 顺序稳定',
          code: `const result = checkBudget(
  { lcp: [3000], inp: [400], cls: [0.2] },
  { lcp: 2500, inp: 200, cls: 0.1 }
);
assert.equal(result.pass, false);
assert.deepEqual(result.violations.map((item) => item.metric), ['inp', 'cls', 'lcp']);
assert.equal(result.violations[0].ratio, 1);
assert.equal(result.violations[1].ratio, 1);
assert.equal(result.violations[2].ratio, 0.2);`
        }
      ]
    },
    {
      id: 'm3-render-ex-2',
      kind: 'design',
      title: 'LinkHub 渲染与 CWV 预算',
      brief: '为 LinkHub 设计渲染策略与性能预算：覆盖营销页、公开链接页、登录后看板与设置页。请给出每类页面的策略与理由、数据获取位置、水合边界、LCP/INP/CLS 预算、资源提示、图片与字体策略、实验室与 RUM 双数据源、降级方式，以及预算如何进入 CI。',
      checklist: [
        '页面分类与访问者特征',
        '每类页面的渲染策略与理由',
        '数据获取位置与缓存边界',
        '水合范围与可交互时间',
        'LCP/INP/CLS 的 p75 预算数字',
        '关键资源与 preload/preconnect 策略',
        '图片尺寸与字体加载',
        '实验室数据与 RUM 的分工',
        '流式片段超时与局部降级',
        '预算进入 CI 的检查方式'
      ],
      reference: '<ul><li><strong>营销页：</strong>SSG，公开且可陈旧；构建时生成，CDN 缓存。</li><li><strong>公开链接页：</strong>SSG 或短 TTL SSR，按链接维度缓存，不包含用户信息。</li><li><strong>登录看板：</strong>流式渲染；shell 先行，统计片段独立超时；个性化不进公共缓存。</li><li><strong>设置页：</strong>CSR 或 SSR 后小范围水合；交互密集但 SEO 不重要。</li><li><strong>预算：</strong>LCP p75 ≤ 2.5s、INP p75 ≤ 200ms、CLS p75 ≤ 0.1；预算写进 CI，回归超标失败。</li><li><strong>资源：</strong>首屏图片给定尺寸并高优先级；字体子集化与 font-display；preconnect 只给确定会用到的源。</li><li><strong>数据：</strong>RUM 判断真实用户 p75 与分页面差异；实验室复现问题与回归。</li><li><strong>降级：</strong>流式片段超时显示局部错误；脚本失败保留可读 HTML；图表延迟加载。</li><li><strong>验证：</strong>每次发布对比 RUM 的趋势；预算违规阻断合并或发布。</li></ul>'
    }
  ]
};
