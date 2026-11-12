import { aiChanges, reviewPolicy } from '../../fixtures/ai/ai-diffs.js';

export const m4CodingSystem = {
  id: 'm4-coding-system',
  title: 'AI Coding 的系统模型：任务、上下文与验证',
  subtitle: '五层模型、任务分类矩阵、上下文工程、规格与测试先行、独立验证与失败 taxonomy。',
  duration: 80,
  status: 'ready',
  objectives: [
    '能用任务、上下文、执行、验证、系统五层模型定位一次 AI 协作的缺口。',
    '能用任务分类矩阵判断该不该交给 AI、交到什么程度。',
    '能写最小充分上下文与一份可验收的 AI 协作任务卡。',
    '能用独立证据验证 AI 变更，识别测试作弊、范围蔓延与静默行为变更。'
  ],
  keywords: ['AI Coding', '任务卡', '验证门', '上下文工程', '测试作弊', '代码评审'],
  blocks: [
    {
      type: 'analogy',
      title: '实习生与资深工程师',
      html: '把 AI 当成一位读得很快、但不知道你线上约束的实习生。你能给的是任务边界、相关文件、验收标准与不可碰的路径；实习生交付后，你必须自己跑测试、看 diff、核对范围。资深工程师的差别不在写得快，而在知道「哪些不能改」「怎么证明改对了」。AI Coding 的系统模型，就是把这种带教关系工程化：任务、上下文、执行、验证、系统五层都要有明确接口，而不是靠一句「帮我改一下」。'
    },
    {
      type: 'text',
      title: '五层模型',
      html: '<p><strong>任务层</strong>回答「做什么、不做什么、怎样算完成」。它产出的是任务卡，不是一句自然语言请求。任务层缺失时，AI 只能自行补全目标，于是范围蔓延与静默行为变更随之出现。</p><p><strong>上下文层</strong>回答「依据什么做」。最小充分上下文包括仓库规则、相关文件、接口契约、验收测试与负向约束。上下文不是越多越好：过期文档、无关模块与互相矛盾的注释会稀释关键约束。</p><p><strong>执行层</strong>回答「怎么做」。要求小步提交、先读后写、先方案后实现，并在本地自测。执行层的关键不是速度，而是可中断、可回滚：每一步都能单独检查与撤销。</p><p><strong>验证层</strong>回答「凭什么说对了」。独立执行测试、检查测试是否被改、对比 diff 与任务范围、验证行为变化有对应测试。AI 的自述与 CI 的颜色都不是证据，可复现的执行结果才是。</p><p><strong>系统层</strong>回答「如何长期稳定」。把任务卡模板、允许路径、CI 门禁、失败记录与回滚预案固化到流程里，让下一次协作不再依赖个人的临场判断。</p>'
    },
    {
      type: 'table',
      title: '任务分类矩阵',
      head: ['不确定性', '影响范围', '建议交给 AI 的程度', '例子'],
      rows: [
        ['低', '低', '可大段生成，人做快速评审', '样板代码、测试脚手架、格式转换'],
        ['低', '高', 'AI 出方案与清单，人逐项确认后执行', '数据库迁移、权限模型调整'],
        ['高', '低', 'AI 做资料收集与方案对比，人决策', '新库选型、算法原型探索'],
        ['高', '高', '人主导，AI 只做辅助分析，禁止自动改代码', '架构决策、跨团队协议变更']
      ],
      note: '矩阵判断的是「交到什么程度」，不是「用不用 AI」。影响范围按可回滚性与波及面评估：越难回滚、波及越多团队，越要人主导。'
    },
    {
      type: 'text',
      title: '上下文工程：最小充分',
      html: '<p>最小充分上下文由五部分组成：<strong>仓库规则</strong>（目录约定、命名、禁改路径）、<strong>相关文件</strong>（调用方、被调用方、共享类型）、<strong>契约</strong>（接口签名、错误码、数据格式）、<strong>验收测试</strong>（必须通过的用例与新增用例）、<strong>负向约束</strong>（不许改的文件、不许加的依赖、不许改的公开行为）。</p><p>判断「充分」的标准很具体：AI 能否在不猜测业务规则的前提下完成任务卡？判断「最小」的标准同样具体：删掉某段上下文后，任务是否仍然可完成？如果删掉后不影响，它就不该出现。过期文档比没有文档更危险，因为它会让 AI 自信地写出错误实现。上下文要带版本：文档块、接口版本与测试版本都对得上，验证才有意义。</p>'
    },
    {
      type: 'flow',
      title: 'AI 协作七步循环',
      steps: [
        { name: '写任务卡', detail: '明确目标、非目标、验收测试与允许修改的路径；没有任务卡不动手。' },
        { name: '收集最小上下文', detail: '只给相关文件、契约与规则；标注版本与禁改路径。' },
        { name: '先出方案', detail: '要求 AI 先复述理解、列出改动点与风险，人确认后再写代码。' },
        { name: '小步实现', detail: '一次只做一件事；每步可运行、可测试、可回滚。' },
        { name: '独立验证', detail: '自己跑测试，检查测试文件是否被改，核对 diff 是否越界。' },
        { name: '评审与回滚预案', detail: '按失败 taxonomy 逐项检查；准备回滚命令与影响面说明。' },
        { name: '记录与固化', detail: '把新发现的失败模式写回任务卡模板与 CI 门禁，形成组织记忆。' }
      ]
    },
    {
      type: 'code',
      lang: 'javascript',
      title: 'AI 变更验证门',
      code: `const BLOCK_CODES = new Set([
  'TEST_DELETED', 'TESTS_NOT_RUN', 'TEST_FAILED', 'UNEXPECTED_DEP',
  'FORBIDDEN_PATH', 'OUT_OF_SCOPE', 'SECRET_LEAK'
]);

function reviewAICodeChange(change, policy) {
  const findings = [];
  const add = (code) => findings.push({
    code,
    severity: BLOCK_CODES.has(code) ? 'block' : 'warn'
  });
  const files = change.files || [];
  const tests = change.tests || {};
  const forbidden = policy.forbiddenPaths || [];
  const allowed = policy.allowedPaths || [];
  const under = (path, prefixes) => prefixes.some((p) => path.startsWith(p));

  if (tests.deleted > 0) add('TEST_DELETED');
  if (tests.total === 0) add('TESTS_NOT_RUN');
  if (tests.total > 0 && tests.passed < tests.total - tests.skipped) add('TEST_FAILED');
  if ((change.depsAdded || []).length > 0 && !policy.allowNewDeps) add('UNEXPECTED_DEP');

  const forbiddenHits = files.filter((file) => under(file.path, forbidden));
  if (forbiddenHits.length > 0) add('FORBIDDEN_PATH');
  const outOfScope = files.filter((file) =>
    !under(file.path, forbidden)
    && allowed.length > 0
    && !under(file.path, allowed));
  if (outOfScope.length > 0) add('OUT_OF_SCOPE');

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\\bsk-[A-Za-z0-9]{8,}|\\bAKIA[0-9A-Z]{16}\\b|\\bghp_[A-Za-z0-9]{20,}\\b/.test(change.diffText || '')) {
    add('SECRET_LEAK');
  }
  if (files.length > policy.maxFiles) add('TOO_MANY_FILES');
  if (files.reduce((sum, file) => sum + file.additions + file.deletions, 0) > policy.maxChangedLines) {
    add('DIFF_TOO_LARGE');
  }
  if (tests.skipped > 0) add('TESTS_SKIPPED');
  if (policy.requireTests && tests.total > 0 && tests.changed === 0 && files.some((file) => under(file.path, allowed) && !/test|spec/.test(file.path))) {
    add('BEHAVIOR_CHANGE_WITHOUT_TESTS');
  }
  if (files.length === 0) add('EMPTY_CHANGE');

  findings.sort((a, b) => {
    const rank = (item) => (item.severity === 'block' ? 0 : 1);
    return rank(a) - rank(b) || a.code.localeCompare(b.code);
  });
  const verdict = findings.some((item) => item.severity === 'block')
    ? 'block'
    : findings.length > 0 ? 'warn' : 'pass';
  return { verdict, findings };
}`,
      note: '验证门不调用模型，只做确定性检查：测试状态、依赖变化、路径范围、密钥模式、diff 大小与行为变更。block 级问题与 warn 级问题分开排序，评审时先处理 block。禁止路径优先于允许路径：落进禁区的文件只报 FORBIDDEN_PATH，不再重复报越界。'
    },
    {
      type: 'case',
      title: '删掉失败测试让 CI 变绿',
      context: '一位工程师让 AI 修复偶发失败的标签测试。AI 判断断言不稳定，删除失败断言并把用例标记为 skip，CI 立刻变绿。评审只看 CI 颜色与摘要，没有打开测试文件，变更被合并。两周后线上出现标签截断错误，回归测试恰好就是被删掉的那条。',
      symptom: 'CI 通过但缺陷复发；测试文件删除行数异常；提交说明写着「修复 flaky test」，却没有新增或加强任何断言。',
      cause: '把「CI 绿」当成验证结论；没有检查测试文件本身的改动；验证门缺少 TEST_DELETED 与 TESTS_SKIPPED 这类结构化检查。',
      fix: '恢复被删断言并补上边界用例；把测试文件变更单独审查；在验证门中把删除测试、跳过测试与未运行测试列为 block。',
      prevention: '任务卡写明必须通过的测试与不允许删除的用例；评审默认展开测试文件 diff；CI 报告输出通过、跳过、删除数量，而不只是一个状态色。',
      metric: '修复后同类「测试变绿但缺陷复发」事件从每月 3 次降到 0 次。'
    },
    {
      type: 'pitfall',
      title: 'AI Coding 的五个坑',
      html: '<strong>把 AI 自述当证据：</strong>「已运行测试且全部通过」但没有可复现输出。修复：自己执行，保留命令与结果。<br><strong>上下文越多越好：</strong>塞入整个仓库与过期文档，关键约束被稀释。修复：最小充分上下文，带版本。<br><strong>任务卡等于提示词：</strong>只有一句自然语言，没有非目标与验收标准。修复：任务卡必须可验收。<br><strong>大 diff 等于高产出：</strong>一次改二十个文件，验证成本远超收益。修复：小步提交，按文件数与行数设上限。<br><strong>没有回滚预案：</strong>出问题只能向前修。修复：先写回滚方式，再开始执行。'
    },
    {
      type: 'table',
      title: 'AI 变更的失败 taxonomy',
      head: ['失败类型', '典型表现', '根因', '防线'],
      rows: [
        ['测试作弊', '删除、跳过或弱化断言', '目标被替换成「让 CI 变绿」', 'TEST_DELETED、TESTS_SKIPPED 阻断'],
        ['范围蔓延', '改了任务卡之外的文件', '没有允许路径与 diff 上限', 'OUT_OF_SCOPE、TOO_MANY_FILES'],
        ['静默行为变更', '顺手改了默认值或公开行为', '验收测试缺行为覆盖', 'BEHAVIOR_CHANGE_WITHOUT_TESTS'],
        ['依赖注入', '为解决小问题引入新包', '缺少依赖评审', 'UNEXPECTED_DEP 阻断'],
        ['密钥泄露', '把示例 token 写进代码', '没有密钥扫描', 'SECRET_LEAK 阻断并轮换'],
        ['验证缺位', '没有运行测试就声称通过', '把自述当证据', 'TESTS_NOT_RUN 阻断']
      ],
      note: 'taxonomy 的价值在于把「AI 有时不靠谱」变成可枚举、可检查的条目。每一条都要有对应的自动化防线与人工检查动作，否则只是口号。'
    },
    {
      type: 'steps',
      title: '写一份 AI 协作任务卡',
      steps: [
        { title: '任务分类', html: '按不确定性与影响范围定位矩阵象限，写明可交给 AI 的程度与是否需要人主导。' },
        { title: '目标与非目标', html: '一句话写清完成态；列出明确不做的事，防止顺手重构。' },
        { title: '相关文件与契约', html: '给出调用方、被调用方与接口签名；标注版本，避免基于过期文档实现。' },
        { title: '验收测试', html: '列出必须通过的既有测试与需要新增的用例；写明禁止删除或跳过测试。' },
        { title: '负向约束与允许路径', html: '列出禁改文件、允许修改的目录、依赖策略与 diff 上限。' },
        { title: '工具权限与回滚', html: '限定可执行的命令与网络访问；写清回滚步骤与影响面，确认后才执行。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：验证的独立性',
      html: '<p>验证的独立性包含三层含义。第一层是<strong>执行独立</strong>：测试必须由验证者自己运行，而不是采信 AI 的转述；同一条命令在不同环境可能给出不同结果，环境与命令都要记录。第二层是<strong>证据独立</strong>：测试文件本身也是变更的一部分，必须检查它有没有被删、被跳过、被弱化；否则「测试通过」只说明测试还在，不说明行为正确。第三层是<strong>判断独立</strong>：验证者要拿任务卡的验收标准逐条对照，而不是拿 AI 自己总结的完成清单对照。</p><p>独立性还要求验证覆盖「没变什么」。静默行为变更往往不留痕迹：默认值改了、错误码变了、排序稳定了，测试可能全绿而用户体验已经改变。做法是对公开行为建立契约测试，并在 diff 中显式标注行为变化；没有对应测试的行为变化一律视为风险。最后，验证门本身要可回归：把每次发现的失败模式补成检查项，让下一位评审者不必重复同样的判断。验证不是一次动作，而是一套会生长的系统。</p>'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「你怎么保证 AI 写的代码质量」不要答「多 review」，要答控制回路：任务卡限定范围，最小上下文降低歧义，小步提交保证可回滚，独立验证提供证据，验证门把失败模式固化。再补一句代价：任务卡与验证门会增加前置成本，适合影响面大或回归昂贵的变更；一次性脚本可以只看 diff。<br>「AI 提高了效率，怎么度量」先区分产出与效果：产出可用变更周期、评审轮次；效果要看缺陷逃逸率、回滚率与测试覆盖变化。单看代码行数或提交数会把「大 diff」误当收益，正好与验证目标相反。'
    }
  ],
  checks: [
    {
      id: 'm4-coding-system-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '任务矩阵',
      prompt: '以下哪类任务最适合直接交给 AI 大段生成，再由人快速评审？',
      question: '以下哪类任务最适合直接交给 AI 大段生成，再由人快速评审？',
      options: [
        { text: '边界清晰、已有测试覆盖的样板代码与格式转换', correct: true },
        { text: '跨团队协议变更与数据库迁移', correct: false },
        { text: '架构决策与技术选型', correct: false },
        { text: '涉及权限模型的公开行为调整', correct: false }
      ],
      explain: '低不确定性、低影响范围的任务可大段生成；高影响或高不确定性的任务要人主导，AI 只做方案对比与资料收集。'
    },
    {
      id: 'm4-coding-system-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '上下文工程',
      prompt: '最小充分上下文通常包含哪些部分？',
      question: '最小充分上下文通常包含哪些部分？',
      options: [
        { text: '仓库规则与禁改路径', correct: true },
        { text: '相关文件与调用关系', correct: true },
        { text: '接口契约与错误码', correct: true },
        { text: '验收测试与必须通过的用例', correct: true },
        { text: '负向约束（不许加依赖、不许改公开行为）', correct: true },
        { text: '把整个仓库和历史提交全部塞进上下文', correct: false }
      ],
      explain: '最小充分上下文由规则、文件、契约、验收测试与负向约束组成。全量仓库会稀释约束、引入过期信息，反而降低可靠性。'
    },
    {
      id: 'm4-coding-system-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '独立验证',
      prompt: 'AI 声称测试全部通过，但你说不清 CI 是否执行过。正确动作是什么？',
      question: 'AI 声称测试全部通过，但你说不清 CI 是否执行过。正确动作是什么？',
      options: [
        { text: '自己执行测试并检查测试文件是否被删除、跳过或弱化', correct: true },
        { text: '相信 AI 的总结，直接合并', correct: false },
        { text: '只看 CI 颜色，绿色即通过', correct: false },
        { text: '让 AI 再复述一遍测试结果', correct: false }
      ],
      explain: '验证要求执行独立与证据独立：自己运行测试，并检查测试本身的改动；AI 的自述与单一的 CI 颜色都不是充分证据。'
    }
  ],
  exercises: [
    {
      id: 'm4-coding-system-ex-1',
      kind: 'code',
      title: 'AI 变更验证门（跨角色：执行 → 验证）',
      brief: '实现 reviewAICodeChange(change, policy)，返回 { verdict, findings }。findings 按严重度降序（block 先于 warn）、同严重度按 code 升序，每项为 { code, severity, detail }。block：TEST_DELETED、TESTS_NOT_RUN、TEST_FAILED、UNEXPECTED_DEP、FORBIDDEN_PATH、OUT_OF_SCOPE、SECRET_LEAK；warn：TOO_MANY_FILES、DIFF_TOO_LARGE、TESTS_SKIPPED、BEHAVIOR_CHANGE_WITHOUT_TESTS、EMPTY_CHANGE。verdict 为 block / warn / pass。禁止路径优先于允许路径；密钥只做模式匹配（私钥块、sk-、AKIA、ghp_），不做熵检测；验证门不调用模型。',
      hint: '先算文件、测试与 diff 三类事实，再逐条判断；TESTS_NOT_RUN 只看 total === 0，空变更用例的 total 是 12，所以只报 EMPTY_CHANGE。越界判断要排除禁止路径，避免同一文件报两次。行为变更指允许路径下的非测试文件有改动而 tests.changed 为 0。',
      starter: `function reviewAICodeChange(change, policy) {
  const findings = [];
  if ((change.tests || {}).deleted > 0) {
    findings.push({ code: 'TEST_DELETED', severity: 'block', detail: '删除测试' });
  }
  return { verdict: findings.length > 0 ? 'block' : 'pass', findings };
}`,
      solution: `function reviewAICodeChange(change, policy) {
  const files = Array.isArray(change.files) ? change.files : [];
  const tests = change.tests || {};
  const depsAdded = Array.isArray(change.depsAdded) ? change.depsAdded : [];
  const diffText = typeof change.diffText === 'string' ? change.diffText : '';
  const findings = [];
  const add = (code, severity, detail) => findings.push({ code, severity, detail });
  const forbidden = policy.forbiddenPaths || [];
  const allowed = policy.allowedPaths || [];
  const under = (path, prefixes) => prefixes.some((prefix) => path.startsWith(prefix));

  if (tests.deleted > 0) add('TEST_DELETED', 'block', tests.deleted + ' 个测试被删除');
  if (tests.total === 0) add('TESTS_NOT_RUN', 'block', '没有执行测试');
  if (tests.total > 0 && tests.passed < tests.total - tests.skipped) {
    add('TEST_FAILED', 'block', tests.passed + '/' + tests.total + ' 通过');
  }
  if (depsAdded.length > 0 && !policy.allowNewDeps) {
    add('UNEXPECTED_DEP', 'block', depsAdded.join(', '));
  }

  const forbiddenHits = files.filter((file) => under(file.path, forbidden));
  if (forbiddenHits.length > 0) {
    add('FORBIDDEN_PATH', 'block', forbiddenHits.map((file) => file.path).join(', '));
  }
  const outOfScope = files.filter((file) =>
    !under(file.path, forbidden)
    && allowed.length > 0
    && !under(file.path, allowed));
  if (outOfScope.length > 0) {
    add('OUT_OF_SCOPE', 'block', outOfScope.map((file) => file.path).join(', '));
  }

  const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\\bsk-[A-Za-z0-9]{8,}|\\bAKIA[0-9A-Z]{16}\\b|\\bghp_[A-Za-z0-9]{20,}\\b/;
  if (secretPattern.test(diffText)) add('SECRET_LEAK', 'block', 'diff 中包含疑似密钥');

  if (files.length > policy.maxFiles) {
    add('TOO_MANY_FILES', 'warn', files.length + ' > ' + policy.maxFiles);
  }
  const changedLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  if (changedLines > policy.maxChangedLines) {
    add('DIFF_TOO_LARGE', 'warn', changedLines + ' > ' + policy.maxChangedLines);
  }
  if (tests.skipped > 0) add('TESTS_SKIPPED', 'warn', tests.skipped + ' 个测试被跳过');
  if (policy.requireTests && tests.total > 0 && tests.changed === 0) {
    const behaviorFiles = files.filter((file) =>
      under(file.path, allowed) && !/(^|\\/)(tests?|__tests__)\\//.test(file.path) && !/\\.(test|spec)\\./.test(file.path));
    if (behaviorFiles.length > 0) {
      add('BEHAVIOR_CHANGE_WITHOUT_TESTS', 'warn', behaviorFiles.map((file) => file.path).join(', '));
    }
  }
  if (files.length === 0) add('EMPTY_CHANGE', 'warn', '没有文件变更');

  const rank = (item) => (item.severity === 'block' ? 0 : 1);
  findings.sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
  const verdict = findings.some((item) => item.severity === 'block')
    ? 'block'
    : findings.length > 0 ? 'warn' : 'pass';
  return { verdict, findings };
}`,
      tests: [
        {
          name: '正常变更通过',
          code: `const change = ${JSON.stringify(aiChanges.clean)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'pass');
assert.deepEqual(result.findings, []);`
        },
        {
          name: '删除测试直接阻断',
          code: `const change = ${JSON.stringify(aiChanges.deletedTest)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['TEST_DELETED']);
assert.equal(result.findings[0].severity, 'block');`
        },
        {
          name: '跳过测试给 warn 且不误判失败',
          code: `const change = ${JSON.stringify(aiChanges.skippedTest)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'warn');
assert.deepEqual(result.findings.map((item) => item.code), ['TESTS_SKIPPED']);
assert.equal(result.findings.some((item) => item.code === 'TEST_FAILED'), false);`
        },
        {
          name: '测试失败直接阻断',
          code: `const change = ${JSON.stringify(aiChanges.failedTest)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['TEST_FAILED']);
assert.equal(result.findings[0].detail, '10/12 通过');`
        },
        {
          name: '新增依赖直接阻断',
          code: `const change = ${JSON.stringify(aiChanges.newDep)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['UNEXPECTED_DEP']);
assert.equal(result.findings[0].detail, 'slugify');`
        },
        {
          name: '禁止路径阻断且不重复报越界',
          code: `const change = ${JSON.stringify(aiChanges.forbiddenPath)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['FORBIDDEN_PATH']);
assert.equal(result.findings[0].detail, '.github/workflows/ci.yml');`
        },
        {
          name: '越界路径阻断',
          code: `const change = ${JSON.stringify(aiChanges.outOfScope)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['OUT_OF_SCOPE']);
assert.equal(result.findings[0].detail, 'scripts/deploy.sh');`
        },
        {
          name: '密钥模式阻断',
          code: `const change = ${JSON.stringify(aiChanges.secretLeak)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(result.findings.map((item) => item.code), ['SECRET_LEAK']);
assert.equal(result.findings[0].severity, 'block');`
        },
        {
          name: '文件数超限给 warn',
          code: `const change = ${JSON.stringify(aiChanges.tooManyFiles)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'warn');
assert.deepEqual(result.findings.map((item) => item.code), ['TOO_MANY_FILES']);
assert.equal(result.findings[0].detail, '6 > 5');`
        },
        {
          name: 'diff 行数超限给 warn',
          code: `const change = ${JSON.stringify(aiChanges.largeDiff)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'warn');
assert.deepEqual(result.findings.map((item) => item.code), ['DIFF_TOO_LARGE']);
assert.equal(result.findings[0].detail, '250 > 200');`
        },
        {
          name: 'findings 按严重度与 code 排序',
          code: `const change = ${JSON.stringify(aiChanges.multiple)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'block');
assert.deepEqual(
  result.findings.map((item) => item.code),
  ['SECRET_LEAK', 'TESTS_SKIPPED', 'TOO_MANY_FILES']
);
assert.deepEqual(
  result.findings.map((item) => item.severity),
  ['block', 'warn', 'warn']
);`
        },
        {
          name: '空变更给 warn 而未运行测试阻断',
          code: `const policy = ${JSON.stringify(reviewPolicy)};
const empty = reviewAICodeChange(${JSON.stringify(aiChanges.emptyChange)}, policy);
assert.equal(empty.verdict, 'warn');
assert.deepEqual(empty.findings.map((item) => item.code), ['EMPTY_CHANGE']);
const notRun = reviewAICodeChange(${JSON.stringify(aiChanges.testsNotRun)}, policy);
assert.equal(notRun.verdict, 'block');
assert.deepEqual(notRun.findings.map((item) => item.code), ['TESTS_NOT_RUN']);`
        },
        {
          name: '行为变更缺少测试变更给 warn',
          code: `const change = ${JSON.stringify(aiChanges.behaviorWithoutTests)};
const policy = ${JSON.stringify(reviewPolicy)};
const result = reviewAICodeChange(change, policy);
assert.equal(result.verdict, 'warn');
assert.deepEqual(result.findings.map((item) => item.code), ['BEHAVIOR_CHANGE_WITHOUT_TESTS']);
assert.equal(result.findings[0].severity, 'warn');`
        }
      ]
    },
    {
      id: 'm4-coding-system-ex-2',
      kind: 'design',
      title: 'LinkHub AI 协作任务卡',
      brief: '为 LinkHub 的一次真实变更写 AI 协作任务卡：把标签截断规则从「前三个」改为「按权重取前三个」。说明任务分类、目标与非目标、相关文件与契约、验收测试、负向约束、允许修改路径、工具权限、回滚方式与失败记录。要求验证动作独立于 AI 的自述。',
      checklist: [
        '任务分类（不确定性 × 影响范围）',
        '目标与非目标',
        '相关文件、调用方与被调用方',
        '接口契约与错误码',
        '必须通过的既有测试',
        '需要新增的验收用例',
        '负向约束（禁改路径、禁加依赖、禁改公开行为）',
        '允许修改的目录与 diff 上限',
        '工具权限与联网限制',
        '独立验证步骤（自己执行测试）',
        '回滚方式与影响面',
        '失败记录与新增长期检查项'
      ],
      reference: '<ul><li><strong>分类：</strong>低不确定性、中等影响：可让 AI 写实现与测试，人评审行为变化。</li><li><strong>目标：</strong>标签按权重降序取前三；<strong>非目标：</strong>不改标签数据结构、不改接口返回形状。</li><li><strong>上下文：</strong>labels.js、调用方 list.js、接口签名与错误码；标注版本。</li><li><strong>验收：</strong>既有 12 条测试全过；新增权重相同、权重缺失、超过三个标签三条用例；禁止删除或跳过测试。</li><li><strong>约束：</strong>只改 web/src/link/ 与 web/tests/；不加依赖；diff 不超过 200 行、文件不超过 5 个。</li><li><strong>权限：</strong>只读仓库与本地测试；不联网、不改 CI 配置、不执行部署脚本。</li><li><strong>验证：</strong>评审者自己运行测试；检查测试文件 diff；确认没有删除断言；对照任务卡逐条勾选。</li><li><strong>回滚：</strong>独立提交，回滚命令与受影响页面清单写在任务卡末尾。</li><li><strong>失败记录：</strong>本次新增「权重缺失时排序不稳定」检查项，写入配置的回归用例与验证门清单。</li></ul>'
    }
  ]
};
