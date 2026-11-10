export const a11 = {
  "id": "a11",
  "title": "代码质量、测试与工程效能",
  "subtitle": "测试组合、契约测试与 flaky 治理：让反馈既快又可信。",
  "duration": 70,
  "status": "ready",
  "objectives": [
    "用测试金字塔/奖杯判断测试组合是否合理，而不是只堆端到端。",
    "设计契约测试与集成测试的边界，保护服务之间的接口约定。",
    "用翻转次数识别 flaky 测试并治理，而不是靠重跑掩盖。",
    "用类型、lint、review 与重构节奏管理工程质量。"
  ],
  "keywords": ["测试金字塔", "测试奖杯", "契约测试", "集成测试", "flaky", "翻转次数", "代码评审", "lint"],
  "blocks": [
    {
      "type": "analogy",
      "title": "体检项目组合",
      "html": "体检不是项目越多越好。血常规便宜、快速、覆盖广，适合作为基础筛查；影像检查针对性强但昂贵，只在有指征时做；不能因为 CT 看得清楚就每天做 CT。<br>测试也是组合问题：单元测试便宜、快、定位准，适合覆盖逻辑分支；集成测试验证模块之间的真实协作；端到端测试验证少量关键用户旅程；契约测试保护服务边界。每层的成本和收益不同，合理组合比单层堆量更重要。<br>类比的边界是：体检有相对标准的套餐，而测试组合取决于系统架构、发布频率与故障代价。单体应用和微服务的合理比例不一样，不能照搬一个固定百分比。"
    },
    {
      "type": "text",
      "title": "测试金字塔与测试奖杯",
      "html": "测试金字塔主张：底层大量单元测试，中层适量集成测试，顶层少量端到端测试。理由是成本与反馈速度：单元测试毫秒级、失败定位精确；端到端测试要启动完整环境，慢且容易受网络、数据与第三方影响，失败时往往只能看到一个模糊的超时。<br>测试奖杯（testing trophy）则强调集成测试是主体，静态类型与 lint 作为底座，端到端只保留关键路径。它更适合前端与全栈应用，因为很多缺陷出现在组件协作与真实依赖上，纯单元测试无法发现。两种模型并不矛盾，核心都是「按风险与成本分配测试」，而不是机械追求某个比例。<br>判断组合是否合理的实用标准有三条：反馈时间能否支撑每天多次发布；失败时能否快速定位到模块；关键失败模式是否都有对应的测试层。只有单元测试的系统，集成时才发现字段对不上；只有端到端测试的系统，反馈慢到没人愿意跑。两端都要避免。"
    },
    {
      "type": "code",
      "title": "测试组合审计",
      "lang": "javascript",
      "code": "function auditTestPortfolio({ unit, integration, e2e, contract, flaky }) {\n  const total = unit + integration + e2e + contract;\n  const findings = [];\n  if (total === 0) {\n    findings.push({ code: 'NO_TESTS', severity: 'high', detail: 'total=0; no tests configured' });\n    return { total, flakyRate: 0, findings };\n  }\n  if (unit === 0) findings.push({ code: 'NO_UNIT_TESTS', severity: 'high', detail: `unit=0 of total=${total}` });\n  if (integration === 0) findings.push({ code: 'NO_INTEGRATION_TESTS', severity: 'medium', detail: `integration=0 of total=${total}` });\n  if (contract === 0) findings.push({ code: 'NO_CONTRACT_TESTS', severity: 'medium', detail: `contract=0 of total=${total}` });\n  const e2eRatio = e2e / total;\n  if (e2eRatio > 0.2) findings.push({ code: 'E2E_TOO_HIGH', severity: 'medium', detail: `e2e=${e2e} of total=${total}; ratio=${e2eRatio.toFixed(3)} > 0.200` });\n  const flakyRate = flaky / total;\n  if (flakyRate > 0.01) findings.push({ code: 'FLAKY_RATE_HIGH', severity: 'high', detail: `flaky=${flaky} of total=${total}; rate=${flakyRate.toFixed(3)} > 0.010` });\n  return { total, flakyRate, findings };\n}",
      "note": "边界条件要明确：E2E 占比恰好 0.2、flaky 率恰好 0.01 都不报；total 为 0 时只报 NO_TESTS，不再计算比例，避免除零与噪声。"
    },
    {
      "type": "text",
      "title": "契约测试保护什么",
      "html": "契约测试验证消费者与提供者之间的接口约定：请求字段、类型、必填项、状态码、消息格式与错误语义。消费者写下自己依赖的契约，提供者在 CI 中验证实现是否仍满足这些契约，从而在发布前发现「提供者改了一个字段名，消费者解析失败」这类问题。<br>它和集成测试的分工是：契约测试不需要启动完整环境，速度快、定位准，适合放在提供者与消费者的流水线里；集成测试验证真实数据库、缓存、队列与网络的协作，覆盖契约之外的行为。只测一端不够：消费者自己 mock 一个理想响应，提供者按自己的理解实现，两边都绿，线上仍然会崩。<br>契约测试也有边界：它不验证业务语义是否正确，也不覆盖性能与容量。契约变更需要双方评审与版本化，不能单方面修改后让消费者自己适配。"
    },
    {
      "type": "code",
      "title": "flaky 检测：看翻转而不是失败率",
      "lang": "javascript",
      "code": "function detectFlaky(history) {\n  return history\n    .map(({ name, results }) => {\n      let flips = 0;\n      for (let i = 1; i < results.length; i += 1) {\n        if (results[i] !== results[i - 1]) flips += 1;\n      }\n      return { name, flips, flaky: flips >= 2 };\n    })\n    .sort((a, b) => b.flips - a.flips || (a.name < b.name ? -1 : 1));\n}\n\ndetectFlaky([\n  { name: 'payment-callback', results: [true, false, true, false] },\n  { name: 'login', results: [true, true, true, true] },\n]);\n// payment-callback 翻转 3 次，判为 flaky；login 翻转 0 次，稳定",
      "note": "只看失败次数会漏掉「时绿时红」的测试：一个测试失败两次但从不翻转，可能是真实缺陷；翻转多次则说明结果依赖环境或时序。顺序稳定但偶尔失败也要结合日志判断。"
    },
    {
      "type": "table",
      "title": "类型、lint、review 与测试的边界",
      "head": ["手段", "能发现什么", "发现不了什么", "实践边界"],
      "rows": [
        ["类型系统", "接口不匹配、空值、字段改名、部分调用错误", "业务语义、运行时数据、并发问题", "类型不是测试，不能替代断言"],
        ["lint", "可疑写法、未使用变量、部分缺陷模式", "逻辑错误、架构问题", "规则过多会噪声化，需要定期清理"],
        ["code review", "设计、边界条件、可维护性、知识传递", "大规模重复模式、运行时行为", "聚焦风险点，不做风格警察"],
        ["单元/集成测试", "行为回归、边界条件、模块协作", "未断言的场景、环境差异、需求错误", "覆盖率不等于断言质量"],
        ["契约测试", "消费者与提供者的接口约定被破坏", "业务正确性、性能与容量", "需要双方维护与版本化"]
      ]
    },
    {
      "type": "case",
      "title": "重跑三次才绿",
      "context": "LinkHub 的支付回调测试在 CI 中经常失败，团队约定「重跑三次，绿了就算过」。一个月内同一模块上线后出现重复发货。",
      "symptom": "测试失败时日志只显示超时；重跑后通过，没人继续排查。线上出现重复发货后回看，发现回调乱序时幂等判断存在缺陷，而测试的间歇性失败正是同一个问题的早期信号。",
      "cause": "把 flaky 当成环境噪声；没有记录每次运行结果与翻转次数；测试依赖真实时钟与共享数据；失败不做归因，重跑成为默认动作。",
      "fix": "隔离测试数据与时钟，使用可控队列与确定性时间；记录历史结果并统计翻转次数；把 flaky 测试移入隔离区，指定 owner 与修复时限；重跑只作为临时缓解，必须关联修复任务。",
      "prevention": "CI 保留失败日志与重跑记录；把 flaky 率作为质量指标而不是噪声；新测试要求可稳定重复运行；对重复发货这类高风险路径增加幂等断言。",
      "metric": "flaky 率降到 1% 以下；重复发货类缺陷在预发环境被捕获；重跑次数显著下降。"
    },
    {
      "type": "pitfall",
      "title": "只堆端到端、测试实现细节、没有重构窗口",
      "html": "现象一：所有验证都写成端到端测试，数量上百，跑一次要四十分钟。失败时只看到「按钮点不动」，定位要半天，团队开始跳过或重跑，测试逐渐失去信任。<br>现象二：测试断言内部实现细节，例如私有方法调用次数、组件内部状态、SQL 语句文本。一次无害重构就让大量测试变红，测试从安全网变成阻力。<br>现象三：功能排期永远优先，重构与技术债没有固定窗口。问题积累到只能大重写，风险与成本都成倍上升。<br>预防方式：测试行为与契约而非实现；按风险分配测试层，关键旅程保留少量端到端；给重构固定的时间预算与准入标准；把 flaky 率、反馈时间、逃逸缺陷作为工程效能指标，而不是只看覆盖率。"
    },
    {
      "type": "steps",
      "title": "为 LinkHub 设计测试组合",
      "steps": [
        { "title": "列关键用户旅程", "html": "登录、创建短链、跳转、创建订单、支付回调、AI 问答。每条旅程标注故障代价与发布频率，作为测试投入的依据。" },
        { "title": "核心逻辑写单元测试", "html": "短码编码、幂等键、订单状态机、限流计数等纯逻辑用单元测试覆盖边界与异常分支。" },
        { "title": "服务边界加契约测试", "html": "订单与支付、网关与模型供应商、前端与 API 之间的请求响应契约，双方在各自流水线验证。" },
        { "title": "集成测试覆盖真实协作", "html": "数据库、缓存、队列、对象存储的真实行为用集成测试验证，例如事务回滚、消息重复消费、缓存失效。" },
        { "title": "端到端只保留关键旅程", "html": "选择三到五条最重要、最贴近用户的路径，其余下沉到单元与集成层，控制反馈时间。" },
        { "title": "建立 flaky 治理流程", "html": "记录每次运行结果，按翻转次数识别；隔离区、owner、修复时限、重跑上限都要明确。" },
        { "title": "用指标持续校准", "html": "跟踪反馈时间、flaky 率、逃逸缺陷与覆盖率趋势；每季度复盘测试组合是否仍匹配架构与风险。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试问「你怎么设计测试策略」时，先问系统的风险与发布频率，再给组合：核心逻辑单元测试、服务边界契约测试、关键协作集成测试、少量端到端。不要背「70/20/10」这类固定比例，而是说明每一层解决什么问题、成本是多少。<br>被问到 flaky 测试，要强调看翻转次数而不是单次失败：时绿时红说明结果依赖环境或时序，重跑通过不等于修好。再补一句治理方式：记录历史、隔离、owner、时限，并把 flaky 率作为指标。被问到覆盖率时，说明覆盖率只代表执行过，不代表断言充分，关键路径要有针对性的断言与故障注入。"
    }
  ],
  "checks": [
    {
      "id": "a11-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "测试金字塔",
      "prompt": "测试金字塔的底部应该以什么为主？",
      "question": "测试金字塔的底部应该以什么为主？",
      "options": [
        { "text": "快速、稳定、定位精确的单元测试", "correct": true },
        { "text": "覆盖完整用户旅程的端到端测试", "correct": false },
        { "text": "手工回归测试", "correct": false },
        { "text": "性能压测", "correct": false }
      ],
      "explain": "金字塔底部是大量低成本、快反馈的单元测试；端到端测试位于顶层，只保留关键路径。"
    },
    {
      "id": "a11-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "flaky",
      "prompt": "flaky 测试有哪些危害？",
      "question": "flaky 测试有哪些危害？",
      "options": [
        { "text": "掩盖真实缺陷，间歇性失败可能是问题的早期信号", "correct": true },
        { "text": "降低团队对 CI 结果的信任，逐渐习惯性重跑", "correct": true },
        { "text": "浪费排查时间，拖慢发布节奏", "correct": true },
        { "text": "让测试覆盖率统计自动变高", "correct": false }
      ],
      "explain": "flaky 会掩盖缺陷、侵蚀信任、浪费时间；它与覆盖率统计没有正向关系。"
    },
    {
      "id": "a11-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "契约测试",
      "prompt": "契约测试主要防什么？",
      "question": "契约测试主要防什么？",
      "options": [
        { "text": "消费者与提供者之间的接口约定被单方面破坏，例如字段类型或必填项变化", "correct": true },
        { "text": "页面布局在移动端错位", "correct": false },
        { "text": "数据库慢查询导致的性能回归", "correct": false },
        { "text": "业务规则计算错误", "correct": false }
      ],
      "explain": "契约测试验证双方对请求响应格式的共同理解；性能、布局与业务规则分别由压测、UI 测试与业务测试覆盖。"
    }
  ],
  "exercises": [
    {
      "id": "a11-ex-1",
      "kind": "code",
      "title": "测试组合审计 + flaky 检测",
      "brief": "实现两个纯函数。<code>auditTestPortfolio({ unit, integration, e2e, contract, flaky })</code> 接收非负整数计数，返回 <code>{ total, flakyRate, findings }</code>：<code>total</code> 为前四类之和；<code>total === 0</code> 时只报 <code>NO_TESTS</code>（high）且 <code>flakyRate</code> 为 0；否则按规则报 <code>NO_UNIT_TESTS</code>（high）、<code>NO_INTEGRATION_TESTS</code>（medium）、<code>NO_CONTRACT_TESTS</code>（medium）、<code>E2E_TOO_HIGH</code>（e2e/total &gt; 0.2，medium）、<code>FLAKY_RATE_HIGH</code>（flaky/total &gt; 0.01，high）；边界值恰好为 0.2 与 0.01 不报。findings 按 severity 降序、同severity 按 code 升序。<br><code>detectFlaky(history)</code> 接收 <code>[{ name, results }]</code>，返回 <code>[{ name, flips, flaky }]</code>：flips 为相邻结果变化次数，≥2 判为 flaky；按 flips 降序、同 flips 按 name 升序。",
      "hint": "先处理 total 为 0 的分支；比例用除法后比较，展示时保留 3 位小数；排序时先比较 severity 再比较 code。",
      "starter": "function auditTestPortfolio(portfolio) {\n  return { total: 0, flakyRate: 0, findings: [] };\n}\n\nfunction detectFlaky(history) {\n  return history.map(({ name }) => ({ name, flips: 0, flaky: false }));\n}",
      "solution": "function auditTestPortfolio({ unit, integration, e2e, contract, flaky }) {\n  const counts = [unit, integration, e2e, contract, flaky];\n  if (counts.some((value) => !Number.isInteger(value) || value < 0)) {\n    throw new Error('INVALID_COUNT');\n  }\n  const total = unit + integration + e2e + contract;\n  const findings = [];\n  if (total === 0) {\n    findings.push({ code: 'NO_TESTS', severity: 'high', detail: 'total=0; no tests configured' });\n    return { total, flakyRate: 0, findings };\n  }\n  if (unit === 0) findings.push({ code: 'NO_UNIT_TESTS', severity: 'high', detail: `unit=0 of total=${total}` });\n  if (integration === 0) findings.push({ code: 'NO_INTEGRATION_TESTS', severity: 'medium', detail: `integration=0 of total=${total}` });\n  if (contract === 0) findings.push({ code: 'NO_CONTRACT_TESTS', severity: 'medium', detail: `contract=0 of total=${total}` });\n  const e2eRatio = e2e / total;\n  if (e2eRatio > 0.2) findings.push({ code: 'E2E_TOO_HIGH', severity: 'medium', detail: `e2e=${e2e} of total=${total}; ratio=${e2eRatio.toFixed(3)} > 0.200` });\n  const flakyRate = flaky / total;\n  if (flakyRate > 0.01) findings.push({ code: 'FLAKY_RATE_HIGH', severity: 'high', detail: `flaky=${flaky} of total=${total}; rate=${flakyRate.toFixed(3)} > 0.010` });\n  const rank = { high: 0, medium: 1, low: 2 };\n  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.code < b.code ? -1 : 1));\n  return { total, flakyRate, findings };\n}\n\nfunction detectFlaky(history) {\n  return history\n    .map(({ name, results }) => {\n      let flips = 0;\n      for (let i = 1; i < results.length; i += 1) {\n        if (results[i] !== results[i - 1]) flips += 1;\n      }\n      return { name, flips, flaky: flips >= 2 };\n    })\n    .sort((a, b) => b.flips - a.flips || (a.name < b.name ? -1 : 1));\n}",
      "tests": [
        {
          "name": "健康组合无发现",
          "code": "const result = auditTestPortfolio({ unit: 40, integration: 10, e2e: 2, contract: 5, flaky: 0 });\nassert.equal(result.total, 57);\nassert.equal(result.flakyRate, 0);\nassert.deepEqual(result.findings, []);"
        },
        {
          "name": "缺契约测试",
          "code": "const result = auditTestPortfolio({ unit: 20, integration: 5, e2e: 2, contract: 0, flaky: 0 });\nassert.equal(result.total, 27);\nassert.deepEqual(result.findings.map((item) => item.code), ['NO_CONTRACT_TESTS']);\nassert.equal(result.findings[0].severity, 'medium');\nassert.equal(result.findings[0].detail, 'contract=0 of total=27');"
        },
        {
          "name": "端到端占比过高",
          "code": "const result = auditTestPortfolio({ unit: 10, integration: 2, e2e: 4, contract: 2, flaky: 0 });\nassert.equal(result.total, 18);\nassert.deepEqual(result.findings.map((item) => item.code), ['E2E_TOO_HIGH']);\nassert.equal(result.findings[0].detail, 'e2e=4 of total=18; ratio=0.222 > 0.200');"
        },
        {
          "name": "flaky 率过高",
          "code": "const result = auditTestPortfolio({ unit: 100, integration: 20, e2e: 2, contract: 5, flaky: 2 });\nassert.equal(result.total, 127);\nassert.deepEqual(result.findings.map((item) => item.code), ['FLAKY_RATE_HIGH']);\nassert.equal(result.findings[0].severity, 'high');\nassert.equal(result.findings[0].detail, 'flaky=2 of total=127; rate=0.016 > 0.010');"
        },
        {
          "name": "边界值恰好不报",
          "code": "const result = auditTestPortfolio({ unit: 80, integration: 15, e2e: 2, contract: 3, flaky: 1 });\nassert.equal(result.total, 100);\nassert.equal(result.flakyRate, 0.01);\nassert.deepEqual(result.findings, []);"
        },
        {
          "name": "空组合只报 NO_TESTS",
          "code": "const result = auditTestPortfolio({ unit: 0, integration: 0, e2e: 0, contract: 0, flaky: 0 });\nassert.equal(result.total, 0);\nassert.equal(result.flakyRate, 0);\nassert.equal(result.findings.length, 1);\nassert.equal(result.findings[0].code, 'NO_TESTS');\nassert.equal(result.findings[0].severity, 'high');"
        },
        {
          "name": "发现按严重度与代码排序",
          "code": "const result = auditTestPortfolio({ unit: 0, integration: 0, e2e: 5, contract: 0, flaky: 1 });\nassert.equal(result.total, 5);\nassert.deepEqual(result.findings.map((item) => item.code), [\n  'FLAKY_RATE_HIGH',\n  'NO_UNIT_TESTS',\n  'E2E_TOO_HIGH',\n  'NO_CONTRACT_TESTS',\n  'NO_INTEGRATION_TESTS',\n]);\nassert.deepEqual(result.findings.map((item) => item.severity), ['high', 'high', 'medium', 'medium', 'medium']);"
        },
        {
          "name": "无翻转的测试稳定",
          "code": "const result = detectFlaky([\n  { name: 'stable', results: [true, true, true, true] },\n  { name: 'broken', results: [false, false, false] },\n]);\nassert.deepEqual(result.map((item) => item.name), ['broken', 'stable']);\nassert.deepEqual(result.map((item) => item.flips), [0, 0]);\nassert.deepEqual(result.map((item) => item.flaky), [false, false]);"
        },
        {
          "name": "多次翻转判定为 flaky 并按翻转排序",
          "code": "const result = detectFlaky([\n  { name: 'c', results: [true, true, false, false, true] },\n  { name: 'a', results: [true, false, true] },\n  { name: 'b', results: [true, false, true, false] },\n]);\nassert.deepEqual(result.map((item) => item.name), ['b', 'a', 'c']);\nassert.deepEqual(result.map((item) => item.flips), [3, 2, 2]);\nassert.deepEqual(result.map((item) => item.flaky), [true, true, true]);"
        },
        {
          "name": "空历史与空结果",
          "code": "assert.deepEqual(detectFlaky([]), []);\nconst result = detectFlaky([{ name: 'single', results: [true] }, { name: 'empty', results: [] }]);\nassert.deepEqual(result.map((item) => item.name), ['empty', 'single']);\nassert.deepEqual(result.map((item) => item.flips), [0, 0]);\nassert.deepEqual(result.map((item) => item.flaky), [false, false]);"
        }
      ]
    }
  ]
};
