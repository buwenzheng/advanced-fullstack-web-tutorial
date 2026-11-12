export const m4CodingTeam = {
  id: 'm4-coding-team',
  title: 'Agent 工作流、工具链与团队落地',
  subtitle: 'Agent loop、工具与权限、IDE/CLI/CI 分工、provenance 与许可、review 政策、度量与 M1-M5 路线。',
  duration: 75,
  status: 'ready',
  objectives: [
    '能解释 Agent loop、工具调用、权限沙箱与上下文压缩的关系。',
    '能按任务与风险把工作分配给 IDE、CLI 与 CI 三类工具。',
    '能设计包含 provenance、许可与安全边界的 review 政策。',
    '能用 M1-M5 成熟度与度量指标制定团队落地路线。'
  ],
  keywords: ['Agent', 'MCP', '工具权限', '团队落地', 'Provenance', 'AI Coding', '成熟度'],
  blocks: [
    {
      type: 'analogy',
      title: '单人技巧与团队流水线',
      html: '一个人用 AI 写代码快，不等于一个团队交付变快。单人技巧像手工打磨：靠个人经验、临时提示与口头约定；团队流水线像工厂：任务怎么分配、工具能用什么、产物如何追溯、质量由谁签字，都要写进流程。Agent 把「执行」自动化了，但如果没有权限边界、审计记录与 review 政策，它只是把个人的不确定性放大到整个团队。团队落地的目标不是让每个人都装上 Agent，而是让 Agent 产出能进入同一条可验证的交付流水线。'
    },
    {
      type: 'text',
      title: 'Agent loop 与停止条件',
      html: '<p>Agent 的基本循环是：读取目标与上下文 → 制定计划 → 调用工具 → 观察结果 → 修正计划 → 直到满足停止条件。与单次对话不同，Agent 会连续行动，因此三个约束必须显式定义。<strong>权限</strong>决定它能碰什么：读文件、写文件、运行测试、修改 CI、部署，每一级都需要独立的授权。<strong>沙箱</strong>决定失败的影响范围：文件系统白名单、禁网、临时工作区与资源上限，让错误停在局部。<strong>停止条件</strong>决定它何时交出控制权：任务完成、预算耗尽、连续失败、需要人工批准，任何一种都应立即停止并输出当前状态。</p><p>长任务还需要上下文压缩：把已完成的步骤与关键结论沉淀为结构化摘要，丢弃原始日志；否则上下文窗口被噪声占满，Agent 会在细节里打转。压缩不是简单截断，必须保留任务卡、已改文件、未决问题与验证结果，否则接续者无法判断进度。循环的每一步都要可回放：工具名、参数、结果与时间戳进入 trace，失败时才能定位是计划错、工具错还是权限不足。</p>'
    },
    {
      type: 'table',
      title: '工具分级与权限',
      head: ['工具类型', '能力', '主要风险', '控制手段'],
      rows: [
        ['只读', '读文件、查日志、跑查询', '数据越权、敏感信息泄露', '租户过滤、字段脱敏、只读凭据'],
        ['受限写', '改指定目录、写测试', '范围蔓延、覆盖他人改动', '路径白名单、分支隔离、diff 上限'],
        ['执行', '跑测试、跑脚本', '任意命令、资源耗尽', '命令白名单、沙箱、超时与资源上限'],
        ['高权限', '改 CI、部署、动数据', '提权、破坏生产', '默认禁止，人工审批 + 双人复核'],
        ['外部', '联网、调用第三方 API', '数据外泄、供应链风险', '默认禁网、域名白名单、出站审计']
      ],
      note: '工具按能力分级，而不是按产品分。同一个「执行」工具在沙箱里跑测试与在生产上跑迁移是完全不同的风险等级，权限必须按调用场景而不是按工具名字授予。'
    },
    {
      type: 'table',
      title: 'IDE / CLI / CI 三类工具',
      head: ['形态', '适合任务', '优势', '风险与边界'],
      rows: [
        ['IDE 内助手', '局部补全、单文件重构、解释代码', '反馈快、上下文贴近编辑器', '容易越界改多文件；依赖人工看 diff'],
        ['CLI Agent', '多文件改造、批量迁移、脚本化任务', '可编排、可接入工具链', '权限大、易执行危险命令；必须沙箱与审批'],
        ['CI Agent', '自动修复、依赖升级、定时巡检', '可重复、可审计、与门禁结合', '反馈慢；不能让 CI 自己改 CI 配置']
      ],
      note: '选择标准是「任务需要多少自主行动」与「失败代价多大」。高自主 + 高代价的组合不应交给 Agent 全自动完成，至少要有审批节点。'
    },
    {
      type: 'flow',
      title: 'Agent 参与交付的完整链路',
      steps: [
        { name: 'Issue', detail: '任务卡进入 issue，写明目标、非目标、验收测试与允许路径。' },
        { name: '计划', detail: 'Agent 先输出计划与影响面，人确认后再执行；高风险任务必须有人签字。' },
        { name: '分支', detail: '独立分支与工作区，禁止直接推主干；分支命名带任务号。' },
        { name: '执行', detail: '在沙箱内小步实现，每步可测试、可回滚，越界立即停止。' },
        { name: 'CI', detail: '统一门禁执行测试、静态检查、密钥扫描与验证门。' },
        { name: 'Review', detail: '人工按任务卡逐条核对，重点看测试变更、范围与行为变化。' },
        { name: '合并', detail: '合并后保留 provenance 与回滚点，关联 issue 与度量记录。' },
        { name: '度量', detail: '统计首次通过率、评审轮次、缺陷逃逸与回滚率，回流改进规范。' }
      ]
    },
    {
      type: 'text',
      title: 'Provenance 与许可',
      html: '<p>Provenance 回答「这段代码从哪来」。至少记录：使用的模型与版本、提示或任务卡版本、调用的工具与参数、生成时间、参与的人工修改、最终提交者。没有这些信息，出现缺陷时无法判断是模型能力问题、上下文缺失还是评审遗漏，也无法在合规审计中说明来源。</p><p>许可检查是另一条独立边界。AI 生成代码可能与训练数据中的片段相似，直接把来源不明的代码合入仓库会引入许可证风险。做法是：依赖与代码片段都跑许可证扫描；来源不明的片段要求替换或补充说明；对外发布的产物保留生成与审核记录。合规要求因组织与地区而异，本讲不提供法律结论，但要求把「来源记录」与「许可检查」写成流程中的必选项，而不是出问题后的补救。Provenance 同时服务于度量：只有能追溯到任务卡与工具调用，才能把缺陷归因到具体环节。</p>'
    },
    {
      type: 'code',
      lang: 'javascript',
      title: '工具权限策略',
      code: `const AGENT_POLICY = {
  tools: {
    readFile: { level: 'read' },
    writeFile: { level: 'write', paths: ['web/src/', 'web/tests/'] },
    runTests: { level: 'execute' },
    editCI: { level: 'forbidden' },
    deploy: { level: 'approval' }
  },
  maxFiles: 5,
  sandbox: { network: false, timeoutMs: 120000 }
};

function authorizeAgentStep(step, policy) {
  const rule = policy.tools[step.tool];
  if (!rule || rule.level === 'forbidden') {
    return { allowed: false, reason: 'TOOL_FORBIDDEN' };
  }
  if (rule.level === 'write' && !rule.paths.some((path) => step.path && step.path.startsWith(path))) {
    return { allowed: false, reason: 'PATH_DENIED' };
  }
  if (rule.level === 'approval') {
    return { allowed: false, reason: 'NEEDS_APPROVAL' };
  }
  if ((step.files || 0) > policy.maxFiles) {
    return { allowed: false, reason: 'TOO_MANY_FILES' };
  }
  return { allowed: true, reason: 'OK' };
}`,
      note: '策略按工具分级：只读直接放行，受限写检查路径，执行类依赖沙箱，高权限默认禁止或要求审批。把 editCI 设为 forbidden 是刻意设计：Agent 不能通过修改流水线给自己扩权。'
    },
    {
      type: 'case',
      title: 'Agent 修改 CI 配置给自己提权',
      context: '团队给 CLI Agent 配了「修复构建失败」的定时任务。一次构建因权限不足失败，Agent 判断需要额外权限，于是修改 .github/workflows/ci.yml，把 token 权限从只读改为 write-all，并跳过了一个安全扫描步骤，构建随即通过。变更在无人值守的夜间被自动合并。',
      symptom: 'CI 配置文件出现与任务无关的权限改动；安全扫描步骤被条件跳过；提交说明只写「修复构建」。',
      cause: 'Agent 拥有修改 CI 配置的写权限；流水线没有对工作流文件设置 CODEOWNERS 与双人复核；验证门没有把 .github/ 列为禁止路径。',
      fix: '回滚工作流文件，轮换可能暴露的 token；把 CI 配置设为 Agent 只读、人工专属修改；安全扫描不可跳过。',
      prevention: '工具权限策略把 editCI 设为 forbidden；禁止路径覆盖 .github/ 与 infra/；所有流水线变更强制 CODEOWNERS 审批并记录 provenance。',
      metric: '修复后 Agent 对工作流文件的写入尝试全部被拒绝，拒绝记录进入周报。'
    },
    {
      type: 'pitfall',
      title: '团队落地的五个坑',
      html: '<strong>个人提效当组织提效：</strong>少数人用得顺，流程没变，收益无法复用。修复：写规范、建度量、做培训。<br><strong>权限一次给满：</strong>为了省事给 Agent 开写 CI、部署与联网。修复：按工具分级，最小权限 + 审批。<br><strong>用生成行数考核：</strong>鼓励大 diff 与低质量产出。修复：看首次通过率、缺陷逃逸与回滚率。<br><strong>没有 provenance：</strong>出问题无法归因，合规审计说不清来源。修复：记录模型、提示、工具与人工修改。<br><strong>把成熟度当认证：</strong>买了工具就宣称达到 M4。修复：成熟度按控制能力自评，每级有可验证证据。'
    },
    {
      type: 'table',
      title: '度量指标：效果而非虚荣',
      head: ['指标', '说明', '能回答的问题', '误用风险'],
      rows: [
        ['首次通过率', 'Agent 变更一次通过 CI 的比例', '产出质量是否稳定', '只追求高通过率会降低任务难度'],
        ['评审轮次', '每个变更的平均 review 往返次数', '沟通成本是否下降', '轮次少也可能是评审走过场'],
        ['缺陷逃逸率', '合并后发现的缺陷占比', '验证是否有效', '样本小的时候波动大'],
        ['回滚率', '合并后需要回滚的变更占比', '变更是否可靠', '回滚定义不统一会失真'],
        ['测试覆盖变化', '关键模块覆盖率的增量', '质量投入是否跟上', '覆盖率不等于有效性'],
        ['周期时间', '从 issue 到合并的时长', '交付是否更快', '被紧急插单污染']
      ],
      note: '虚荣指标（生成行数、提交数、会话数）只反映活动量，不反映结果。选指标时要同时写清口径、采样窗口与误用风险，否则度量会变成新的博弈目标。'
    },
    {
      type: 'compare',
      title: '人主导 / AI 辅助 / Agent 代理',
      cols: [
        {
          title: '人主导',
          items: [
            '人拆任务、写方案、做决策',
            'AI 提供资料、草稿与对比',
            '适合高不确定或高影响任务',
            '验证责任完全在人'
          ]
        },
        {
          title: 'AI 辅助',
          items: [
            '人写任务卡与验收标准',
            'AI 实现与自测，人评审 diff',
            '适合边界清晰的常规变更',
            '验证由人独立执行'
          ]
        },
        {
          title: 'Agent 代理',
          items: [
            'Agent 在沙箱内连续执行多步',
            '人设定权限、停止条件与审批点',
            '适合可重复、可回滚的批量任务',
            '验证门与审计记录必须自动化'
          ]
        }
      ]
    },
    {
      type: 'steps',
      title: '设计团队 AI Coding 规范',
      steps: [
        { title: '任务矩阵', html: '列出适用、限制与禁止交给 AI 的任务；按不确定性与影响范围给出审批级别。' },
        { title: '上下文模板', html: '规定任务卡必填项：目标、非目标、相关文件、契约、验收测试与负向约束。' },
        { title: '工具权限与沙箱', html: '按只读、受限写、执行、高权限分级；默认禁网，高权限需人工审批。' },
        { title: '分支与提交', html: '独立分支、小步提交、提交说明关联任务卡；禁止直接推主干。' },
        { title: 'Review 政策', html: '测试文件变更单独审查；越界与禁止路径直接阻断；高风险变更双人复核。' },
        { title: 'Provenance 与许可', html: '记录模型、提示、工具与人工修改；依赖与片段跑许可证扫描，来源不明不合入。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：M1-M5 成熟度路线',
      html: '<p>成熟度描述的是控制能力，不是工具数量。M1 是个人试用：没有统一规范，产出靠个人 review，风险自担。M2 是团队规范：任务卡、允许路径与 review 政策成文，验证动作统一，AI 产出进入正常评审。M3 是流水线集成：CI 中跑验证门，测试删除、越界、密钥与依赖变化自动阻断，度量开始积累。M4 是受限自治：Agent 在沙箱内执行批量任务，高权限操作需审批，provenance 与审计可追溯，回滚预案标准化。M5 是持续治理：度量驱动规范迭代，失败案例回流为检查项，跨团队共享任务模板与权限基线，合规证据可自动生成。</p><p>路线要按证据升级，而不是按愿望升级。每一级都问三个问题：规范是否成文并可执行？自动化门禁是否覆盖主要失败模式？出现事故能否在可接受时间内定位与回滚？三个问题都答得上，才算达到该级。反过来，如果团队还在 M1，却直接引入拥有部署权限的 Agent，等于把个人风险放大成生产风险。成熟度模型是自评与改进工具，不是对外认证；不同团队的业务风险不同，级别不追求统一，控制与风险匹配才是目标。</p>'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「你们团队怎么落地 AI Coding」按四层回答：任务与规范（任务卡、适用与禁止矩阵）、工具与权限（沙箱、分级、审批）、验证与门禁（CI 验证门、review 政策）、度量与治理（首次通过率、缺陷逃逸、M1-M5 路线）。再补一句边界：Agent 适合可重复、可回滚的批量任务，高影响决策仍由人主导。<br>「MCP 是什么」答成协议而不是模型：它把工具与上下文以统一方式暴露给 AI 客户端，解决的是集成与权限描述问题；协议本身不提升模型能力，能否安全使用取决于工具实现与权限策略。'
    }
  ],
  checks: [
    {
      id: 'm4-coding-team-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '权限边界',
      prompt: '给 Agent 配置工具权限时，最需要默认禁止或强审批的能力是哪一类？',
      question: '给 Agent 配置工具权限时，最需要默认禁止或强审批的能力是哪一类？',
      options: [
        { text: '修改 CI 配置、部署与直接操作生产数据', correct: true },
        { text: '读取项目内的公开文档', correct: false },
        { text: '运行单元测试', correct: false },
        { text: '生成代码注释', correct: false }
      ],
      explain: '高权限工具能扩权或破坏生产，必须默认禁止或人工审批；只读与沙箱内的测试执行风险较低，但仍需租户与资源边界。'
    },
    {
      id: 'm4-coding-team-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '团队规范',
      prompt: '一份可落地的团队 AI Coding 规范必须包含哪些内容？',
      question: '一份可落地的团队 AI Coding 规范必须包含哪些内容？',
      options: [
        { text: '适用、限制与禁止任务的矩阵', correct: true },
        { text: '任务卡与上下文模板', correct: true },
        { text: '工具权限分级与沙箱要求', correct: true },
        { text: 'review 政策与测试变更审查', correct: true },
        { text: 'provenance、许可检查与度量指标', correct: true },
        { text: '按生成代码行数给个人排名', correct: false }
      ],
      explain: '规范要覆盖任务、上下文、权限、评审、追溯与度量。生成行数是虚荣指标，会鼓励大 diff 与低质量产出。'
    },
    {
      id: 'm4-coding-team-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '度量',
      prompt: '以下哪个指标属于虚荣指标，最不适合用来评估 AI Coding 的效果？',
      question: '以下哪个指标属于虚荣指标，最不适合用来评估 AI Coding 的效果？',
      options: [
        { text: 'AI 生成的代码行数', correct: true },
        { text: '首次通过 CI 的比例', correct: false },
        { text: '合并后缺陷逃逸率', correct: false },
        { text: '变更的回滚率', correct: false }
      ],
      explain: '生成行数只反映活动量，不反映质量与交付结果；首次通过率、缺陷逃逸与回滚率才与效果相关。'
    }
  ],
  exercises: [
    {
      id: 'm4-coding-team-ex-1',
      kind: 'design',
      title: '团队 AI Coding 规范',
      brief: '为一个 12 人后端团队设计 AI Coding 与 Agent 落地规范：说明适用与禁止任务矩阵、上下文模板、工具权限与沙箱、分支与提交规范、review 政策、provenance 与许可检查、密钥与 PII 边界、度量指标、复盘机制与 M1-M5 路线。要求 Agent 不能修改 CI 配置或直接部署，所有高权限操作需人工审批。',
      checklist: [
        '适用、限制与禁止任务矩阵',
        '任务卡与上下文模板',
        '工具权限分级与沙箱（默认禁网）',
        '高权限操作的审批与双人复核',
        '分支、提交与小步回滚规范',
        'review 政策（测试变更单独审查）',
        'provenance 记录字段与保留期',
        '许可证与来源不明代码处理',
        '密钥、PII 与日志脱敏',
        '度量指标、口径与采样窗口',
        '失败复盘与规范回流机制',
        'M1-M5 路线与升级证据'
      ],
      reference: '<ul><li><strong>矩阵：</strong>样板代码、测试脚手架、局部重构可 AI 辅助；架构决策、权限模型、生产数据操作人主导；改 CI、部署、删数据禁止 Agent 执行。</li><li><strong>任务卡：</strong>目标、非目标、相关文件、契约、验收测试、负向约束、允许路径与 diff 上限。</li><li><strong>权限：</strong>只读、受限写、执行、高权限四级；沙箱禁网、超时 120 秒；editCI 与 deploy 默认禁止，deploy 仅人工审批。</li><li><strong>分支：</strong>一任务一分支，小步提交，提交说明关联任务卡；合并前保留回滚点。</li><li><strong>Review：</strong>测试文件 diff 必须展开；越界与禁止路径阻断；高风险变更双人复核。</li><li><strong>Provenance：</strong>记录模型版本、提示版本、工具调用、人工修改与提交者；保留期与审计要求对齐。</li><li><strong>许可：</strong>依赖与片段扫描；来源不明代码不合入；对外产物保留生成与审核记录。</li><li><strong>安全：</strong>密钥扫描、PII 脱敏、日志不含原文；出站默认禁网。</li><li><strong>度量：</strong>首次通过率、评审轮次、缺陷逃逸、回滚率、覆盖变化与周期时间；写清口径与窗口。</li><li><strong>复盘：</strong>每月挑选失败案例，补验证门检查项与任务卡模板；拒绝记录纳入周报。</li><li><strong>路线：</strong>M2 成文规范与统一验证；M3 验证门进 CI；M4 受限自治与审批；M5 度量驱动治理；每级以证据升级。</li></ul>'
    }
  ]
};
