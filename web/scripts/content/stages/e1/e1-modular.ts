export const e1Modular = {
  id: 'e1-modular',
  title: '从单体到模块化：先把边界画对',
  subtitle: '业务边界、依赖方向与环、模块化单体、绞杀者迁移与何时不该拆。',
  duration: 85,
  status: 'ready',
  objectives: [
    '按业务能力而不是技术层划模块边界。',
    '检查依赖方向与循环依赖，并用证据画出现状依赖图。',
    '比较模块化单体、微服务与绞杀者模式，说明各自代价。',
    '判断什么时候不该拆，并给出不拆的理由。'
  ],
  keywords: ['模块化单体', '边界', '依赖方向', '循环依赖', '微服务', '绞杀者', 'Conway 定律', '分布式单体'],
  blocks: [
    {
      type: 'analogy',
      title: '前端 monorepo 与微前端',
      html: 'monorepo 里每个 package 有自己的入口、依赖和发布节奏，但共享同一套构建与版本管理；微前端把页面拆成可独立部署的应用，团队可以各自上线。两者都在处理边界：哪些代码属于同一块、谁可以依赖谁、契约放在哪里。<br>类比失效的地方在运行边界：前端拆包后仍跑在同一个浏览器里，调用是进程内的；后端服务化之后，一次业务操作变成跨网络调用，会出现超时、部分失败与数据不一致。前端拆错的代价是构建变慢，后端拆错的代价是故障半径与一致性复杂度。'
    },
    {
      type: 'text',
      title: '模块化单体：先画对边界，再谈服务化',
      html: '模块化单体是「一个部署单元 + 多个高内聚模块」：模块按业务能力划分，例如短链、账号、统计；每个模块有自己的数据访问与领域逻辑，对外只暴露明确的接口。<br>它的价值不是「比微服务落后」，而是把边界这件事先做对：依赖方向清晰、循环依赖可见、数据归属明确。等团队规模、发布频率或故障隔离真的需要时，再把某个模块沿已有边界抽成服务，成本远低于从一团泥球里硬拆。反过来，边界没画清就上微服务，通常得到的是「分布式单体」：服务分开部署，数据库、调用链和发布仍然绑在一起。'
    },
    {
      type: 'flow',
      title: '从现状到目标边界',
      steps: [
        { name: '列出现状模块', detail: '按目录、路由、数据表与任务梳理实际存在的模块，不按理想架构。失败表现：只画 PPT，不读代码与表结构。' },
        { name: '画出依赖图', detail: '记录 import、数据库访问、同步调用与消息；区分强依赖与弱依赖。失败表现：只查 import，漏掉共享表。' },
        { name: '标出环与热点', detail: '环说明职责纠缠；变更频率高的模块说明边界可能错了。失败表现：看到环却只做目录搬迁。' },
        { name: '定义目标边界', detail: '按业务能力分组，明确每个模块的数据归属与对外接口。失败表现：继续按 controller/service 分层划分。' },
        { name: '按依赖顺序重构', detail: '先抽共享内核与接口，再搬实现；每一步保持可运行。失败表现：一次性大重写，无法回滚。' }
      ]
    },
    {
      type: 'code',
      title: '依赖方向与环检测',
      lang: 'javascript',
      code: `function analyzeGraph(graph = {}, rules = []) {
  const modules = Object.keys(graph).sort();
  const names = new Set(modules);
  for (const deps of Object.values(graph)) {
    for (const dep of deps || []) names.add(dep);
  }
  const ordered = [...names].sort();
  const adjacency = new Map(ordered.map((name) => [name, []]));
  for (const name of modules) {
    adjacency.set(name, [...new Set(graph[name] || [])].sort());
  }

  const color = new Map(ordered.map((name) => [name, 0]));
  const stack = [];
  const seen = new Set();
  const cycles = [];

  function canonical(path) {
    const open = path.slice(0, -1);
    let best = '';
    for (let i = 0; i < open.length; i += 1) {
      const key = open.slice(i).concat(open.slice(0, i)).join('>');
      if (!best || key < best) best = key;
    }
    return best;
  }

  function visit(name) {
    color.set(name, 1);
    stack.push(name);
    for (const dep of adjacency.get(name) || []) {
      if (!adjacency.has(dep)) continue;
      if (color.get(dep) === 0) visit(dep);
      else if (color.get(dep) === 1) {
        const start = stack.indexOf(dep);
        const path = stack.slice(start);
        path.push(dep);
        const key = canonical(path);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(path);
        }
      }
    }
    stack.pop();
    color.set(name, 2);
  }

  for (const name of ordered) {
    if (color.get(name) === 0) visit(name);
  }
  cycles.sort((a, b) => a.join('>').localeCompare(b.join('>')));

  const violations = [];
  for (const rule of rules) {
    const from = rule.name ?? rule.from;
    const forbidden = rule.forbid || [];
    for (const dep of adjacency.get(from) || []) {
      if (forbidden.includes(dep)) {
        violations.push({ from, to: dep, rule: rule.id || from + '->' + dep });
      }
    }
  }

  return { cycles, violations };
}`,
      note: '三色标记区分「正在访问」和「访问完成」：只把灰色节点当成环，黑色节点重复到达不是环。环路径要做旋转归一，否则 a→b→a 与 b→a→b 会被报两次。规则检查只看直接依赖，间接违规由环与依赖图暴露。'
    },
    {
      type: 'table',
      title: '拆分收益与代价',
      head: ['维度', '模块化单体', '微服务', '判断信号'],
      rows: [
        ['独立部署', '否，整体发布', '是，按服务发布', '发布频率差异是否真的存在'],
        ['故障隔离', '进程内共享故障域', '可隔离，但有网络故障', '单模块故障是否拖垮全局'],
        ['数据一致性', '本地事务', '跨服务，需要消息或补偿', '能否接受最终一致'],
        ['调用成本', '函数调用，微秒级', '网络调用，毫秒级且会失败', '调用链与超时预算'],
        ['运维成本', '一套构建与部署', '服务发现、监控、网关、链路追踪', '团队是否有平台能力'],
        ['团队边界', '共享代码库', '按团队 ownership 划分', 'Conway 定律是否匹配']
      ],
      note: '收益与代价要成对看：独立部署换来网络与一致性成本；故障隔离换来运维复杂度。没有对应问题时，拆分只是把复杂度提前。'
    },
    {
      type: 'pitfall',
      title: '分布式单体：拆了服务，没拆边界',
      html: '现象：服务数量变多，但每次发版仍要同时上线三四个服务；一个服务改表，其他服务跟着改；调用链是一串同步 HTTP；共享数据库里有大量跨服务 JOIN；一个服务超时，整条链路雪崩。<br>原因：边界按技术层或团队方便划分，而不是业务能力；数据库没有按服务拆分；同步调用替代了原本的进程内调用；没有契约与版本策略。<br>发现方式：看发布记录是否总是成组上线；统计跨服务同步调用深度；检查是否共享表与跨库查询；用依赖图找环与强耦合。<br>修复：先按业务能力重画边界；把共享数据改为明确归属 + 接口或事件；同步链改为异步或本地缓存；为接口建立契约测试。<br>预防：拆分前先做模块化单体；每个服务拥有自己的数据；发布与回滚可以独立验证。'
    },
    {
      type: 'steps',
      title: '绞杀者迁移：让旧系统慢慢退场',
      steps: [
        { title: '选一个边界清晰的模块', html: '优先选依赖少、变更频繁、收益明确的模块。观察点：能用一句话说清它的职责与数据归属。' },
        { title: '在入口拦截', html: '用路由、网关、开关或适配层把该模块的流量引到新实现，旧路径保持可用。观察点：可以按比例或租户切换。' },
        { title: '并行运行', html: '新旧实现同时处理影子流量或读请求，对比结果与延迟。观察点：差异有记录，能定位到字段或规则。' },
        { title: '切换写路径', html: '先切读再切写；写路径切换前确认数据迁移与回滚方案。观察点：回滚只需关掉开关或切回旧实现。' },
        { title: '下线旧代码', html: '确认没有流量、没有后台任务、没有其他模块依赖后删除旧实现与旧表。观察点：删除后构建与测试仍通过。' }
      ]
    },
    {
      type: 'compare',
      title: '单体、模块化单体、微服务与 Serverless',
      cols: [
        {
          title: '单体',
          items: [
            '一个部署单元，模块边界靠约定',
            '本地事务简单，调试成本低',
            '适合早期产品与小团队',
            '风险是边界腐烂成泥球'
          ]
        },
        {
          title: '模块化单体',
          items: [
            '一个部署单元，模块边界可检查',
            '本地事务仍然简单',
            '可按模块演进，随时抽服务',
            '代价是需要纪律与依赖检查'
          ]
        },
        {
          title: '微服务',
          items: [
            '多个部署单元，按业务能力划分',
            '独立发布与故障隔离',
            '跨服务一致性与运维成本高',
            '适合多团队与高频发布'
          ]
        },
        {
          title: 'Serverless',
          items: [
            '按函数/事件部署，平台管理伸缩',
            '冷启动与执行时长受限',
            '状态与长连接需要外部服务',
            '适合事件驱动与突发流量'
          ]
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：Conway 定律与团队边界',
      html: 'Conway 定律说，系统设计会复制组织的沟通结构：四个团队各管一层，系统就容易长成四层；两个团队共享一个数据库，边界就会在数据库里糊掉。它不是宿命，而是提醒你：架构决策与团队拓扑要一起设计。<br>反 Conway 操作是先定义目标架构与接口，再调整团队与 ownership，让每个模块有明确的负责人；否则服务拆了，发布仍要跨团队协调，独立部署只是名义上的。判断边界是否合理，可以看变更是否局部：一个需求通常只改一个模块、一个团队、一套测试。若每次变更都要跨三四个模块，边界大概率画错了。组织细节不在本讲展开，但记住：模块边界不是目录，而是职责、数据与发布节奏的组合。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「什么时候不该拆」回答三个条件：团队小且发布不需要独立；业务边界仍在快速变化；一致性要求高、跨服务补偿成本大于收益。此时模块化单体更合适。<br>「拆了之后最大的代价是什么」不是代码量，而是网络与一致性：调用会失败、超时结果未知、数据不再有本地事务。回答时给出超时预算、幂等、Outbox 或补偿的具体防线，而不是只说「用微服务」。'
    }
  ],
  checks: [
    {
      id: 'e1-modular-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '模块边界',
      prompt: '划分后端模块边界时，最应该优先依据什么？',
      question: '划分后端模块边界时，最应该优先依据什么？',
      options: [
        { text: '业务能力与数据归属', correct: true },
        { text: 'controller、service、repository 三层目录', correct: false },
        { text: '每个开发者各自负责一个目录', correct: false },
        { text: '数据库表的数量平均分配', correct: false }
      ],
      explain: '业务能力决定职责与数据归属，模块边界应围绕它划分。技术层是实现细节；按人或按表平均分配会让一个业务变更跨多个模块。'
    },
    {
      id: 'e1-modular-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '拆分代价',
      prompt: '把模块化单体拆成微服务，通常会引入哪些真实代价？',
      question: '把模块化单体拆成微服务，通常会引入哪些真实代价？',
      options: [
        { text: '进程内调用变成网络调用，会出现超时与部分失败', correct: true },
        { text: '本地事务变成跨服务一致性，需要消息或补偿', correct: true },
        { text: '需要服务发现、链路追踪、网关等额外运维能力', correct: true },
        { text: '代码总行数一定会减少', correct: false },
        { text: '循环依赖会自动消失', correct: false }
      ],
      explain: '网络、一致性与运维是服务化的三笔固定成本。代码量通常增加；循环依赖不会因为换部署形态消失，边界没画清时会变成跨服务环。'
    },
    {
      id: 'e1-modular-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '不拆的信号',
      prompt: '以下哪种情况最支持「暂时不拆微服务」？',
      question: '以下哪种情况最支持「暂时不拆微服务」？',
      options: [
        { text: '团队规模小、发布不需要独立、业务边界仍在快速变化', correct: true },
        { text: '代码目录已经超过一百个文件', correct: false },
        { text: '竞争对手使用了微服务', correct: false },
        { text: '想用微服务作为晋升答辩的亮点', correct: false }
      ],
      explain: '拆分的驱动应是独立发布、故障隔离、团队 ownership 等真实需求。团队小、边界不稳定、发布不独立时，模块化单体更划算。'
    }
  ],
  exercises: [
    {
      id: 'e1-modular-ex-1',
      kind: 'code',
      title: '依赖方向与环检测',
      brief: '实现 analyzeGraph(graph, rules)，返回 { cycles, violations }。graph 为 { module: [dependency, ...] }，未在键中出现的依赖视为叶子。rules 为 [{ id?, name, forbid: [module] }]，表示 name 不允许直接依赖 forbid 中的模块。cycles 为环路径数组，首尾相同（自依赖为 [a, a]）；同一环只报告一次；按路径字典序排序。violations 为 [{ from, to, rule }]，按规则与依赖顺序稳定输出。环检测用 DFS 三色标记，不要把「已访问」当成「已完成」。',
      hint: '先补全节点集合与排序后的邻接表；DFS 用 0/1/2 三色，遇到灰色节点时从栈中截取环；环路径做旋转归一后放入 Set 去重；规则检查遍历邻接表的直接依赖。',
      starter: `function analyzeGraph(graph = {}, rules = []) {
  const cycles = [];
  for (const [name, deps] of Object.entries(graph)) {
    if ((deps || []).includes(name)) cycles.push([name, name]);
  }
  const violations = [];
  for (const rule of rules) {
    for (const dep of rule.forbid || []) {
      violations.push({ from: dep, to: rule.name, rule: rule.id });
    }
  }
  return { cycles, violations };
}`,
      solution: `function analyzeGraph(graph = {}, rules = []) {
  const modules = Object.keys(graph).sort();
  const names = new Set(modules);
  for (const deps of Object.values(graph)) {
    for (const dep of deps || []) names.add(dep);
  }
  const ordered = [...names].sort();
  const adjacency = new Map(ordered.map((name) => [name, []]));
  for (const name of modules) {
    adjacency.set(name, [...new Set(graph[name] || [])].sort());
  }

  const color = new Map(ordered.map((name) => [name, 0]));
  const stack = [];
  const seen = new Set();
  const cycles = [];

  function canonical(path) {
    const open = path.slice(0, -1);
    let best = '';
    for (let i = 0; i < open.length; i += 1) {
      const key = open.slice(i).concat(open.slice(0, i)).join('>');
      if (!best || key < best) best = key;
    }
    return best;
  }

  function visit(name) {
    color.set(name, 1);
    stack.push(name);
    for (const dep of adjacency.get(name) || []) {
      if (!adjacency.has(dep)) continue;
      if (color.get(dep) === 0) visit(dep);
      else if (color.get(dep) === 1) {
        const start = stack.indexOf(dep);
        const path = stack.slice(start);
        path.push(dep);
        const key = canonical(path);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(path);
        }
      }
    }
    stack.pop();
    color.set(name, 2);
  }

  for (const name of ordered) {
    if (color.get(name) === 0) visit(name);
  }
  cycles.sort((a, b) => a.join('>').localeCompare(b.join('>')));

  const violations = [];
  for (const rule of rules) {
    const from = rule.name ?? rule.from;
    const forbidden = rule.forbid || [];
    for (const dep of adjacency.get(from) || []) {
      if (forbidden.includes(dep)) {
        violations.push({ from, to: dep, rule: rule.id || from + '->' + dep });
      }
    }
  }

  return { cycles, violations };
}`,
      tests: [
        {
          name: '无环图返回空结果',
          code: `const result = analyzeGraph({
  api: ['service'],
  service: ['repo'],
  repo: [],
});
assert.deepEqual(result.cycles, []);
assert.deepEqual(result.violations, []);`
        },
        {
          name: '直接环被识别',
          code: `const result = analyzeGraph({ a: ['b'], b: ['a'] });
assert.deepEqual(result.cycles, [['a', 'b', 'a']]);`
        },
        {
          name: '间接环被识别',
          code: `const result = analyzeGraph({
  a: ['b'],
  b: ['c'],
  c: ['a'],
});
assert.deepEqual(result.cycles, [['a', 'b', 'c', 'a']]);`
        },
        {
          name: '自依赖是环',
          code: `const result = analyzeGraph({ a: ['a'], b: [] });
assert.deepEqual(result.cycles, [['a', 'a']]);`
        },
        {
          name: '分层违规按规则报告',
          code: `const rules = [{ id: 'api-no-infra', name: 'api', forbid: ['infra'] }];
const result = analyzeGraph({
  api: ['service', 'infra'],
  service: ['infra'],
  infra: [],
}, rules);
assert.deepEqual(result.violations, [
  { from: 'api', to: 'infra', rule: 'api-no-infra' },
]);`
        },
        {
          name: '未知模块与未知规则不崩溃',
          code: `const first = analyzeGraph({ api: ['external'] }, []);
assert.deepEqual(first.cycles, []);
assert.deepEqual(first.violations, []);
const second = analyzeGraph({}, [{ name: 'ghost', forbid: ['api'] }]);
assert.deepEqual(second.cycles, []);
assert.deepEqual(second.violations, []);`
        },
        {
          name: '多个环只报一次且顺序稳定',
          code: `const graph = {
  a: ['b'],
  b: ['a'],
  c: ['d'],
  d: ['c'],
};
const first = analyzeGraph(graph);
assert.deepEqual(first.cycles, [['a', 'b', 'a'], ['c', 'd', 'c']]);
const second = analyzeGraph(graph);
assert.deepEqual(second.cycles, first.cycles);`
        }
      ]
    },
    {
      id: 'e1-modular-ex-2',
      kind: 'design',
      title: 'LinkHub 模块边界',
      brief: '为 LinkHub 画一版模块边界：短链、账号、跳转、统计、通知。请说明每个模块的业务能力、数据归属、依赖方向、同步/异步关系，并给出拆分收益、代价、迁移路径与「暂不拆」的理由。',
      checklist: [
        '按业务能力划分模块',
        '每个模块的数据归属',
        '依赖方向与禁止方向',
        '同步调用与异步事件',
        '共享内核的边界',
        '拆分收益与证据',
        '拆分代价与风险',
        '绞杀者迁移路径',
        '不拆的理由与触发条件'
      ],
      reference: '<ul><li><strong>边界：</strong>短链负责创建与解析，账号负责身份与配额，跳转负责重定向，统计负责事件与看板，通知负责异步提醒。</li><li><strong>数据：</strong>短链拥有 links 表，统计拥有 click_events 与读模型；模块之间不跨库 JOIN。</li><li><strong>依赖：</strong>api 依赖各模块的应用服务；模块之间通过接口或事件，不允许 infra 反向依赖 api。</li><li><strong>同步/异步：</strong>跳转同步返回重定向，统计通过事件异步；通知走队列。</li><li><strong>收益：</strong>统计独立部署与扩容；故障隔离；统计故障不影响跳转。</li><li><strong>代价：</strong>跨服务一致性与运维；需要消息、重试、幂等与读模型延迟说明。</li><li><strong>迁移：</strong>先模块化单体，再把统计沿 outbox 边界抽成独立服务（p-e1-stats）。</li><li><strong>不拆：</strong>API 与 Web 仍在同一部署单元；团队规模与发布频率不支持更多服务。</li><li><strong>触发：</strong>统计流量或发布频率达到阈值，再考虑继续拆分。</li></ul>'
    }
  ]
};
