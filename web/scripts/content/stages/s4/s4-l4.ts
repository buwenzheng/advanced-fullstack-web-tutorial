export const s4L4 = {
  id: 's4-l4',
  title: 'CI/CD 与发布策略',
  subtitle: '流水线关卡、测试分层、expand-contract、蓝绿/金丝雀/滚动与回滚。',
  duration: 75,
  status: 'ready',
  objectives: [
    '设计分层流水线：快速反馈在前，慢测试在后，失败阻断合并。',
    '选择蓝绿、金丝雀或滚动发布，并定义可执行的回滚触发条件。',
    '用 expand-contract 保证数据库变更在发布与回滚期间都兼容。',
    '用特性开关隔离发布与上线，并识别开关债务。'
  ],
  keywords: ['CI/CD', '流水线', '测试分层', '蓝绿', '金丝雀', '滚动发布', 'expand-contract', '特性开关', '回滚'],
  blocks: [
    {
      type: 'analogy',
      title: '前端 preview deploy 与后端灰度',
      html: '每个 PR 生成一个 preview 地址时，你可以在不影响生产的情况下点完整流程；不满意就关掉，爆炸半径只有一个预览环境。后端灰度看起来相似：先让一小部分流量进入新版本，观察错误率与延迟，再逐步放大。<br>类比失效的地方在状态与数据：preview 环境可以随时丢弃，后端新版本与旧版本共享数据库、缓存和消息格式；一次不兼容的迁移会让「切回旧镜像」也失效。前端回滚是换静态文件，后端回滚要同时考虑代码、schema、消息与配置。'
    },
    {
      type: 'text',
      title: '流水线关卡',
      html: '流水线的第一目标不是「全」，而是「快速给出可信信号」。lint 与类型检查在秒级发现低级错误；单元测试在分钟级覆盖纯逻辑；集成与契约测试验证数据库、消息和接口兼容；安全扫描检查依赖漏洞与密钥；构建产物必须可复现。慢测试放在后段，但不能因为慢就永远不跑。<br>每个关卡都要能阻断合并或发布，并给出可操作的失败信息。全部串行会让反馈变慢，全部并行会浪费资源；常见做法是把快检查并行在前，慢检查按依赖顺序在后。'
    },
    {
      type: 'table',
      title: '测试分层',
      head: ['层级', '运行时间', '覆盖的问题', '稳定性', '失败时说明什么'],
      rows: [
        ['单元', '秒级', '纯函数、边界、错误分支', '高', '逻辑或契约写错了'],
        ['集成', '分钟级', '数据库、队列、缓存、事务', '中', '组件之间的假设不成立'],
        ['契约', '分钟级', '消费者与提供者的接口兼容', '中高', '发布顺序或字段变更不兼容'],
        ['E2E', '十分钟级以上', '关键用户路径', '低', '整体链路或环境有问题']
      ],
      note: '金字塔不是教条：关键支付/跳转路径可以有多条 E2E，但不要用大量 E2E 替代更快的层。'
    },
    {
      type: 'flow',
      title: '一次发布的流水线',
      steps: [
        { name: 'build', detail: '生成不可变产物并记录版本/digest。失败表现：构建依赖网络或本地缓存，产物不可复现。' },
        { name: 'test', detail: '按快慢顺序跑 lint、单元、集成、契约与扫描。失败表现：红灯仍被合并，或慢测试永远被跳过。' },
        { name: 'deploy', detail: '先部署到预发或灰度环境，注入配置与密钥。失败表现：部署成功但探针失败，流量没有切过来。' },
        { name: 'verify', detail: '观察错误率、P99、业务指标与依赖饱和度。失败表现：只看 pods ready，不看真实请求。' },
        { name: 'promote/rollback', detail: '指标达标才放量；越过阈值立即回滚并冻结流水线。失败表现：没有阈值，靠人盯着看。' }
      ]
    },
    {
      type: 'code',
      title: '特性开关判定',
      lang: 'javascript',
      code: `function utf8Bytes(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619); // 32 位截断，与 Python 的 & 0xFFFFFFFF 对齐
  }
  return hash >>> 0;
}

function evaluateFlag(flag, context = {}) {
  if (flag == null) return { enabled: false, reason: 'UNKNOWN_FLAG' };
  const userId = context.userId;
  if (flag.killSwitch) return { enabled: false, reason: 'KILL_SWITCH' };
  if (userId != null && Array.isArray(flag.denylist) && flag.denylist.includes(userId)) {
    return { enabled: false, reason: 'DENY_LIST' };
  }
  if (userId != null && Array.isArray(flag.allowlist) && flag.allowlist.includes(userId)) {
    return { enabled: true, reason: 'ALLOW_LIST' };
  }
  if (flag.enabled === false) return { enabled: false, reason: 'DISABLED' };
  if (flag.percentage === 100) return { enabled: true, reason: 'FULL_ROLLOUT' };
  if (flag.percentage == null || flag.percentage === 0) return { enabled: false, reason: 'NOT_IN_ROLLOUT' };
  if (userId == null) return { enabled: false, reason: 'NO_IDENTITY' };

  // 按用户分桶，而不是按请求：同一用户每次得到相同结果
  const bucket = fnv1a(flag.key + ':' + userId) % 100;
  return bucket < flag.percentage
    ? { enabled: true, reason: 'IN_ROLLOUT' }
    : { enabled: false, reason: 'OUT_OF_ROLLOUT' };
}`,
      note: '优先级必须固定：kill switch 高于白名单，黑名单高于白名单，否则紧急关闭会被白名单绕过。百分比按用户而不是按请求，保证体验稳定；哈希算法一旦上线，JS 与 Python、不同服务都要保持同一实现，否则同一用户会看到不同结果。'
    },
    {
      type: 'compare',
      title: '蓝绿、金丝雀与滚动',
      cols: [
        {
          title: '蓝绿',
          items: [
            '两套完整环境，切换流量',
            '成本最高，需要双倍资源',
            '切换前爆炸半径为 0，切换后为全量',
            '回滚只需切回旧环境，秒级',
            '适合大版本、需要快速回退'
          ]
        },
        {
          title: '金丝雀',
          items: [
            '新旧版本共存，按比例放量',
            '成本中等，需要流量分配',
            '爆炸半径可控，逐步扩大',
            '回滚是缩小或停止放量，分钟级',
            '适合高风险业务与不确定容量'
          ]
        },
        {
          title: '滚动',
          items: [
            '逐批替换实例，新旧短暂共存',
            '成本最低，复用现有容量',
            '按批次扩散，最坏影响一批实例',
            '回滚是反向滚动，受批次大小影响',
            '适合兼容性好、实例无状态的常规发布'
          ]
        }
      ]
    },
    {
      type: 'pitfall',
      title: '没有回滚：迁移不兼容、开关债务与手工步骤',
      html: '现象：发布后错误率上升，想回滚却发现旧代码读不了新表结构；开关数量越积越多，没人知道哪些能删；回滚步骤写在某人的聊天记录里；预发只测了 happy path，异常路径上线才暴露。<br>原因：迁移先删列或改类型，旧版本无法兼容；特性开关被当成永久分支，没有清理责任人与截止时间；发布依赖手工执行脚本；测试只覆盖成功路径，没有验证回滚路径。<br>发现方式：检查迁移是否可逆、是否向后兼容；统计开关数量与最近访问时间；做一次真实回滚演练并计时；对比预发与生产的异常路径覆盖。<br>修复：采用 expand-contract，先加新列并双写，再切读，最后删旧列；给开关设负责人、过期时间与清理任务；把部署与回滚写成流水线步骤；补异常与回滚测试。<br>预防：发布检查单包含回滚演练；迁移评审检查兼容窗口；每周清理无人访问的开关。'
    },
    {
      type: 'steps',
      title: '写一份可执行的发布计划',
      steps: [
        { title: '给变更分级', html: '按影响面、数据变更与可逆性分为低/中/高风险。观察点：高风险变更有额外审批与演练。' },
        { title: '定义观察指标', html: '错误率、P99、业务成功率、依赖饱和度；写清基线与阈值。观察点：指标能在看板上实时看到。' },
        { title: '选择发布策略', html: '低风险滚动，高风险金丝雀或蓝绿；写清批次与放量节奏。观察点：每批都有停止条件。' },
        { title: '设计数据库兼容窗口', html: '先 expand 后 contract；旧代码在新 schema 上仍可运行。观察点：回滚旧版本不会报错。' },
        { title: '设置开关与回滚阈值', html: '用开关隔离未完成功能；写清自动/手动回滚的指标组合。观察点：回滚能在分钟级完成。' },
        { title: '指定负责人和沟通路径', html: '发布人、观察人、回滚决策人与通知渠道。观察点：任何时刻只有一个人做最终决定。' },
        { title: '演练并记录', html: '在预发或灰度做一次回滚，记录时间线与指标恢复时间。观察点：下一次发布能复用这份记录。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：expand-contract 与 dark launch',
      html: 'expand-contract 把一次不兼容变更拆成三步：先 expand，增加新列/新表/新消息字段，旧代码忽略它们也能运行；再迁移与双写，把存量数据补齐并验证；最后 contract，等所有实例都升级、确认没有旧读者后再删除旧结构。这样任何时刻都至少有一个版本能同时读新旧结构，回滚不再是「把数据库也回滚」。<br>dark launch 是另一种隔离：新功能已经部署并接收影子流量或后台计算，但对用户不可见；等数据与性能验证通过，再用开关放量。它把「代码上线」和「功能上线」分开，代价是需要双写、影子队列或额外计算资源。两者都要防止长期债务：expand 阶段的旧结构、dark launch 的影子链路与开关，都必须有清理负责人和截止时间，否则兼容层会变成永久架构。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「一次高风险发布怎么做」按顺序回答：变更分级、灰度策略、观察指标与回滚阈值、数据库兼容窗口、开关与负责人；最后说明演练过回滚。不要只报「用金丝雀」。<br>「回滚失败怎么办」先区分代码回滚与数据回滚：代码切回旧版本但 schema 已变，需要 expand-contract 的兼容窗口；数据写坏则需要修复脚本、补偿事务或从备份恢复，并接受部分数据不可逆。回答时给出止损顺序与用户沟通。'
    }
  ],
  checks: [
    {
      id: 's4-l4-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '发布策略',
      prompt: '一次涉及数据库迁移的高风险变更，最合适的发布策略是什么？',
      question: '一次涉及数据库迁移的高风险变更，最合适的发布策略是什么？',
      options: [
        { text: '金丝雀：先小比例放量，指标达标再扩大', correct: true },
        { text: '一次性全量替换，出问题再说', correct: false },
        { text: '只发预发环境，生产不发布', correct: false },
        { text: '关闭监控以减少告警干扰', correct: false }
      ],
      explain: '金丝雀把爆炸半径限制在小比例流量，配合 expand-contract 的兼容窗口，可以在指标恶化时停止放量或回滚。一次性全量风险最大；只发预发不解决生产验证；关闭监控会失去回滚依据。'
    },
    {
      id: 's4-l4-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '流水线关卡',
      prompt: '以下哪些关卡适合放进合并前的流水线？',
      question: '以下哪些关卡适合放进合并前的流水线？',
      options: [
        { text: 'lint 与类型检查', correct: true },
        { text: '单元测试与契约测试', correct: true },
        { text: '依赖漏洞与密钥扫描', correct: true },
        { text: '每次提交都跑两小时全量 E2E 并阻塞所有人', correct: false },
        { text: '为了速度跳过所有测试，只在生产观察', correct: false }
      ],
      explain: '快检查与契约/安全扫描适合作为合并门禁；两小时全量 E2E 应放在合并后或定时任务，避免反馈过慢；跳过测试会把风险推给生产。'
    },
    {
      id: 's4-l4-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '回滚阈值',
      prompt: '以下哪组指标最适合作为自动回滚的触发条件？',
      question: '以下哪组指标最适合作为自动回滚的触发条件？',
      options: [
        { text: 'CPU 使用率超过 50% 就回滚', correct: false },
        { text: '错误率、P99 与业务成功率连续几分钟越过基线阈值', correct: true },
        { text: '代码行数超过昨天就回滚', correct: false },
        { text: '值班同学感觉不对就回滚', correct: false }
      ],
      explain: '自动回滚要绑定用户可见症状与持续时间：错误率、P99、业务成功率连续越过基线，能过滤瞬时抖动。CPU 单指标会误判；代码行数与感觉都不是可执行判据。'
    }
  ],
  exercises: [
    {
      id: 's4-l4-ex-1',
      kind: 'code',
      title: '特性开关判定',
      brief: '实现 evaluateFlag(flag, context = {})，返回 { enabled, reason }。flag 支持 key、enabled、percentage、allowlist、denylist、killSwitch。优先级固定：未知 flag → kill switch → denylist → allowlist → enabled === false → percentage === 100 → percentage 为 0/缺省 → 无 userId → 分桶。哈希用 FNV-1a 32-bit，对 UTF-8 字节；桶 = hash(flag.key + ":" + userId) % 100，桶 < percentage 命中。匿名用户不能进入百分比灰度。',
      hint: '先写 UTF-8 编码与 FNV-1a，再按固定顺序返回。Math.imul 做 32 位乘法，最后 >>> 0 转无符号。白名单/黑名单只在有 userId 时生效；percentage 100 在 enabled false 之后判断。',
      starter: `function evaluateFlag(flag, context = {}) {
  if (!flag) return { enabled: false, reason: 'UNKNOWN_FLAG' };
  if (flag.enabled === false) return { enabled: false, reason: 'DISABLED' };
  if (typeof context.userId === 'number') {
    return {
      enabled: context.userId % 100 < (flag.percentage || 0),
      reason: 'IN_ROLLOUT',
    };
  }
  return { enabled: true, reason: 'FULL_ROLLOUT' };
}`,
      solution: `function utf8Bytes(text) {
  const bytes = [];
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function evaluateFlag(flag, context = {}) {
  if (flag == null) return { enabled: false, reason: 'UNKNOWN_FLAG' };
  const userId = context.userId;
  if (flag.killSwitch) return { enabled: false, reason: 'KILL_SWITCH' };
  if (userId != null && Array.isArray(flag.denylist) && flag.denylist.includes(userId)) {
    return { enabled: false, reason: 'DENY_LIST' };
  }
  if (userId != null && Array.isArray(flag.allowlist) && flag.allowlist.includes(userId)) {
    return { enabled: true, reason: 'ALLOW_LIST' };
  }
  if (flag.enabled === false) return { enabled: false, reason: 'DISABLED' };
  if (flag.percentage === 100) return { enabled: true, reason: 'FULL_ROLLOUT' };
  if (flag.percentage == null || flag.percentage === 0) return { enabled: false, reason: 'NOT_IN_ROLLOUT' };
  if (userId == null) return { enabled: false, reason: 'NO_IDENTITY' };
  const bucket = fnv1a(flag.key + ':' + userId) % 100;
  return bucket < flag.percentage
    ? { enabled: true, reason: 'IN_ROLLOUT' }
    : { enabled: false, reason: 'OUT_OF_ROLLOUT' };
}`,
      tests: [
        {
          name: '全开与全关',
          code: `assert.deepEqual(
  evaluateFlag({ key: 'beta', percentage: 100 }),
  { enabled: true, reason: 'FULL_ROLLOUT' },
);
assert.deepEqual(
  evaluateFlag({ key: 'beta', enabled: false, percentage: 100 }),
  { enabled: false, reason: 'DISABLED' },
);`
        },
        {
          name: '白名单优先于百分比',
          code: `const flag = { key: 'beta', allowlist: ['u1'], percentage: 0 };
assert.deepEqual(
  evaluateFlag(flag, { userId: 'u1' }),
  { enabled: true, reason: 'ALLOW_LIST' },
);
assert.deepEqual(
  evaluateFlag(flag, { userId: 'u2' }),
  { enabled: false, reason: 'NOT_IN_ROLLOUT' },
);`
        },
        {
          name: '黑名单优先于白名单',
          code: `const flag = {
  key: 'beta',
  denylist: ['u1'],
  allowlist: ['u1'],
  percentage: 100,
};
assert.deepEqual(
  evaluateFlag(flag, { userId: 'u1' }),
  { enabled: false, reason: 'DENY_LIST' },
);`
        },
        {
          name: '百分比对同一用户稳定',
          code: `const flag = { key: 'beta', percentage: 50 };
const reasons = new Set();
for (let index = 0; index < 100; index += 1) {
  const userId = 'user-' + index;
  const first = evaluateFlag(flag, { userId });
  const second = evaluateFlag(flag, { userId });
  assert.deepEqual(first, second);
  assert.ok(['IN_ROLLOUT', 'OUT_OF_ROLLOUT'].includes(first.reason));
  reasons.add(first.reason);
}
assert.equal(reasons.size, 2);`
        },
        {
          name: 'kill switch 覆盖其他规则',
          code: `const flag = {
  key: 'beta',
  killSwitch: true,
  allowlist: ['u1'],
  percentage: 100,
};
assert.deepEqual(
  evaluateFlag(flag, { userId: 'u1' }),
  { enabled: false, reason: 'KILL_SWITCH' },
);`
        },
        {
          name: '匿名用户不能进入百分比灰度',
          code: `assert.deepEqual(
  evaluateFlag({ key: 'beta', percentage: 50 }, {}),
  { enabled: false, reason: 'NO_IDENTITY' },
);
assert.deepEqual(
  evaluateFlag({ key: 'beta', percentage: 50 }),
  { enabled: false, reason: 'NO_IDENTITY' },
);`
        },
        {
          name: '未知 flag 默认关闭',
          code: `assert.deepEqual(evaluateFlag(null), { enabled: false, reason: 'UNKNOWN_FLAG' });
assert.deepEqual(
  evaluateFlag(undefined, { userId: 'u1' }),
  { enabled: false, reason: 'UNKNOWN_FLAG' },
);`
        }
      ]
    },
    {
      id: 's4-l4-ex-2',
      kind: 'design',
      title: 'LinkHub 发布与回滚预案',
      brief: '为 LinkHub 的一次高风险发布写预案：新增短链目标字段并修改跳转逻辑。请给出发布策略、灰度比例、观察指标、回滚阈值、数据库兼容、开关、负责人、沟通与演练安排。',
      checklist: [
        '发布策略与放量节奏',
        '灰度比例与批次',
        '观察指标与基线',
        '自动/手动回滚阈值',
        '数据库 expand-contract 顺序',
        '特性开关与清理责任人',
        '发布负责人和决策人',
        '用户沟通与状态页',
        '回滚演练与记录'
      ],
      reference: '<ul><li><strong>策略：</strong>金丝雀先 1%，观察 15 分钟，再 10%、50%、100%；每批有停止条件。</li><li><strong>指标：</strong>跳转错误率、P99、跳转成功率、数据库慢查询与连接池等待。</li><li><strong>回滚：</strong>错误率连续 5 分钟超过基线 2 倍或 P99 超过 300ms 连续 10 分钟，自动停止放量并告警；人工可立即回滚。</li><li><strong>数据库：</strong>先加可空新列并双写，回填历史数据，切读新列，确认无旧读者后再删旧列；每一步都可回滚。</li><li><strong>开关：</strong>新跳转逻辑放在开关后，按租户白名单先验证；开关有负责人和清理日期。</li><li><strong>角色：</strong>发布人执行，观察人看指标，回滚决策人只有一位；沟通走固定频道与状态页。</li><li><strong>演练：</strong>预发先做一次回滚，记录从决定到指标恢复的时间；生产回滚步骤可分钟级执行。</li></ul>'
    }
  ]
};
