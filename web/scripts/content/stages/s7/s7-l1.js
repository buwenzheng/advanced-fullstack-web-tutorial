import { sseCases } from '../../fixtures/ai/sse-chunks.js';
import { pricing, requests, mockResponses, mockErrors, budgets } from '../../fixtures/ai/provider-cases.js';

export const s7L1 = {
  id: 's7-l1',
  title: 'LLM 应用基础与流式网关',
  subtitle: 'tokens/上下文窗口、消息角色、结构化输出、SSE、模型路由、预算与幂等重试。',
  duration: 80,
  status: 'ready',
  objectives: [
    '解释 tokens、上下文窗口、消息角色与截断对行为与成本的影响。',
    '用 SSE 实现可增量消费的流式输出，处理分块边界、CRLF、多行与结束标记。',
    '设计结构化输出校验、超时、重试、幂等与模型路由。',
    '用 token 计量与成本表控制单请求与单租户预算。'
  ],
  keywords: ['token', '上下文窗口', '消息角色', 'SSE', '流式输出', '结构化输出', '模型路由', '幂等', '预算', '降级', 'token 计量'],
  blocks: [
    {
      type: 'analogy',
      title: '点餐备注与上下文窗口',
      html: '向餐厅点餐时，你可以在备注里写「不要香菜、少辣、打包」，厨师会看；但备注纸只有一张，写满之后新要求就挤不进去，旧要求也可能被覆盖。上下文窗口就是这张备注纸：system 是餐厅的固定规则，user 是这一单的要求，assistant 是厨师已经做出的回应，tool 是厨房返回的半成品。<br>类比失效的地方在计费：备注纸不是免费的，写进去的每个字和厨师说出的每个字都按 token 计费；而且「写得多」不等于「做得好」，无关信息会稀释关键约束。工程上的结论是：上下文要最小充分，历史要裁剪，输出也要限长；窗口大小和最大输出是两个独立参数，不能混为一谈。'
    },
    {
      type: 'text',
      title: 'tokens、角色与窗口',
      html: 'token 是模型处理文本的计量单位，不同模型的分词方式不同，同一个中文句子在不同模型上可能对应不同数量的 token。上下文窗口是一次请求能容纳的输入与输出总量，最大输出是另一个人为设定的上限；窗口 128k 不代表一次能输出 128k。消息角色通常有 system、user、assistant、tool：system 放稳定规则与安全边界，user 放本次任务，assistant 放历史回复，tool 放工具结果。角色不是装饰，它决定了模型如何看待一段文本的权威性。<br>截断策略必须显式设计：优先保留 system 与最近一轮用户输入，历史按轮次或 token 预算裁剪，长文档先做摘要再注入。静默丢消息是最危险的做法，因为模型会在缺少约束的情况下自信作答。成本要按输入与输出分别计量：输入决定检索与上下文的规模，输出决定生成长度；只算输出 token 会系统性低估成本。定价会随厂商与版本变化，课程只教计量方法，不写死价格。'
    },
    {
      type: 'table',
      title: '结构化输出的三种做法',
      head: ['做法', '做法说明', '优点', '失败模式'],
      rows: [
        ['JSON mode', '要求模型输出合法 JSON，但不约束字段', '接入简单，兼容性好', '字段缺失、类型错误、多余字段'],
        ['Function calling', '按工具 schema 生成结构化参数', '参数受 schema 约束，可接工具', '模型选错工具、参数幻觉、并行调用混乱'],
        ['应用层 schema 校验', '输出后按 JSON Schema 校验并处理失败', '边界清晰，可重试或降级', '校验失败后没有降级路径，坏数据入库']
      ],
      note: '三种做法不是互斥的：生产路径通常是 function calling 或 JSON mode 生成，再用应用层 schema 校验兜底。校验失败的正确动作是重试一次并降级，而不是把坏 JSON 直接写库。'
    },
    {
      type: 'code',
      title: 'SSE 解析：分块、多行与结束标记',
      lang: 'javascript',
      code: `function parseSSE(chunks) {
  const events = [];
  let buffer = '';
  let dataLines = [];
  let event = 'message';
  let id;

  function dispatch() {
    if (dataLines.length === 0) {
      event = 'message';
      id = undefined;
      return;
    }
    const data = dataLines.join('\\n');
    if (data === '[DONE]') {
      events.push({ event: 'done', data: '' });
    } else {
      const item = { event, data };
      if (id !== undefined) item.id = id;
      events.push(item);
    }
    dataLines = [];
    event = 'message';
    id = undefined;
  }

  for (const chunk of chunks) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\\n')) !== -1) {
      let line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.endsWith('\\r')) line = line.slice(0, -1);
      if (line === '') { dispatch(); continue; }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') dataLines.push(value);
      else if (field === 'event') event = value;
      else if (field === 'id') id = value;
    }
  }
  return events;
}`,
      note: 'SSE 是 HTTP 上的文本协议：事件以空行分隔，data 可以多行，CRLF 与 LF 都要处理，冒号开头是注释。必须保留跨块残留的半行，否则分块边界会截断字段。收到 [DONE] 时输出独立事件，调用方据此结束流式消费。'
    },
    {
      type: 'flow',
      title: '一次模型请求的六个阶段',
      steps: [
        { name: '请求', detail: '组装 system/user 消息、输出 schema 与幂等键。失败表现：上下文超限、消息角色混乱。' },
        { name: '路由', detail: '按复杂度与风险选 cheap/strong，检查预算与租户配额。失败表现：所有请求都走最贵模型。' },
        { name: '模型', detail: '带超时调用 provider，记录模型版本。失败表现：无超时，慢请求拖住连接池。' },
        { name: '流式', detail: '按 SSE 增量读取，处理分块与结束标记。失败表现：只处理完整行，分块处丢字。' },
        { name: '校验', detail: '解析结构化输出并按 schema 校验。失败表现：坏 JSON 直接入库。' },
        { name: '计量', detail: '记录输入/输出 token、成本、延迟与 trace。失败表现：只算输出，成本长期低估。' }
      ]
    },
    {
      type: 'code',
      title: '网关路由、预算与幂等重试',
      lang: 'javascript',
      code: `function createGateway({ providers, pricing, budget, maxRetries = 1 }) {
  return async function callModel(request) {
    const route = request.task.risk === 'high' || request.task.complexity === 'high'
      ? 'strong'
      : 'cheap';
    let attempts = 0;

    while (true) {
      attempts += 1;
      try {
        const result = await providers[route](request);
        const usage = result && result.usage;
        const valid = usage
          && Number.isInteger(usage.inputTokens)
          && Number.isInteger(usage.outputTokens)
          && usage.inputTokens >= 0
          && usage.outputTokens >= 0;
        if (!valid) {
          const error = new Error('provider response invalid');
          error.code = 'INVALID_PROVIDER_RESPONSE';
          throw error;
        }
        const price = pricing[route];
        const cost = Math.ceil(
          (usage.inputTokens * price.inputPer1k + usage.outputTokens * price.outputPer1k) / 1000
        );
        if (cost > budget) {
          const error = new Error('budget exceeded');
          error.code = 'BUDGET_EXCEEDED';
          throw error;
        }
        return { text: result.text, model: result.model, usage, cost, attempts };
      } catch (error) {
        const canRetry = error && error.retryable === true
          && request.idempotencyKey !== undefined
          && attempts <= maxRetries;
        if (!canRetry) throw error;
      }
    }
  };
}`,
      note: '路由看风险与复杂度：高风险与高复杂度都升级到强模型。成本用整数分与 ceil 计算，输入和输出分别乘单价。预算拒绝不重试；只有可重试错误并且请求带幂等键才重试，避免非幂等写操作重复扣费。attempts 记录真实调用次数，便于对账。'
    },
    {
      type: 'case',
      title: '流式断开后重复扣费',
      context: 'LinkHub 的摘要接口在网络抖动时自动重试，但没有幂等键；一次用户请求因为 SSE 连接断开被重试了三次，账单出现三条完整调用记录，摘要也被覆盖了三次。',
      symptom: '同一请求 id 在账单中出现三条不同金额的调用；摘要内容在三次生成之间跳变；用户抱怨内容「自己变了」。',
      cause: '网关把所有网络错误当作可重试错误，且重试没有携带幂等键；服务端没有按幂等键去重；流式断开发生在模型已经完成生成之后，重试再次触发完整生成。',
      fix: '为每次逻辑请求生成幂等键并贯穿重试；网关只重试标记为 retryable 的错误；服务端按幂等键缓存结果，重复请求直接返回首次结果；计量按幂等键归并。',
      prevention: '幂等键列为网关契约的一部分；账单按逻辑请求而不是物理调用核对；压测包含「流中断后重连」场景。',
      metric: '同类重复扣费工单从每周 6 起降到 0，单请求成本可对账'
    },
    {
      type: 'pitfall',
      title: '网关的五个坑',
      html: '<strong>非幂等重试：</strong>写操作失败后直接重试，重复创建或重复扣费。修复：幂等键 + 服务端去重。<br><strong>忽略 usage：</strong>只记录文本不记录 token，成本无法解释。修复：输入/输出分别计量并关联 trace。<br><strong>上下文超限静默截断：</strong>悄悄丢掉 system 约束，模型行为突变。修复：显式裁剪 + 摘要 + 明确降级。<br><strong>把模型输出当可信：</strong>JSON 未校验就入库或执行。修复：schema 校验、白名单与转义。<br><strong>没有降级：</strong>模型超时或限流时整条链路失败。修复：规则提取、缓存答案或排队重试。'
    },
    {
      type: 'compare',
      title: '自建网关 / 直连 SDK / 托管网关',
      cols: [
        {
          title: '自建网关',
          items: [
            '路由、预算、幂等、计量完全可控',
            '需要自己维护多厂商适配与故障处理',
            '适合有明确成本与合规要求的团队'
          ]
        },
        {
          title: '直连 SDK',
          items: [
            '接入最快，调用链最短',
            '路由、预算与重试要散落在业务代码里',
            '适合原型或单一模型的小规模场景'
          ]
        },
        {
          title: '托管网关',
          items: [
            '开箱提供路由、观测与配额',
            '数据经过第三方，定制受平台限制',
            '适合希望快速上线且能接受托管的团队'
          ]
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：模型路由与降级',
      html: '模型路由的本质是用任务特征换成本与质量。一个实用的起点是两档：cheap 模型处理低风险、低复杂度任务，例如标签、分类、短摘要；strong 模型处理高风险或高复杂度任务，例如面向客户的文案、需要多步推理的总结。路由条件要写进契约并被测试锁定，否则线上会退化成「全部走强模型」或「全部走弱模型」。<br>降级链要按失败类型设计，而不是笼统重试。超时与限流适合短退避后重试；结构化输出校验失败适合重试一次并收紧提示或降低温度；预算拒绝与不可重试错误应直接走降级路径，例如规则提取、模板答案、缓存结果或排队稍后处理。熔断器按 provider 与模型版本统计错误率，打开后把流量切到备用模型或降级路径。缓存键要包含模型版本、提示版本与关键参数，否则模型升级后仍在返回旧答案。所有降级都要可观测：记录触发原因、影响请求数与用户可见状态，否则「系统还活着」只是假象。'
    },
    {
      type: 'steps',
      title: '设计 LinkHub 摘要网关',
      steps: [
        { title: '定义输入', html: '短链、标题、来源页面与租户；输入长度上限与截断策略。观察点：超长输入有摘要或拒绝路径，不静默丢字段。' },
        { title: '定义输出 schema', html: 'summary、tags、language、confidence；字段类型、长度与必填项。观察点：坏 JSON 不会入库。' },
        { title: '选择路由', html: '普通摘要走 cheap，面向客户或高风险内容走 strong。观察点：路由规则有测试，成本分布可解释。' },
        { title: '设置超时与重试', html: '首 token 超时与总超时分开；只重试可重试错误且必须带幂等键。观察点：断流不会重复生成。' },
        { title: '预算与配额', html: '单请求成本上限与租户日配额；超限时的排队或降级。观察点：预算拒绝有明确错误码。' },
        { title: '降级路径', html: '模型不可用时退回规则提取：标题前 120 字 + 关键词。观察点：降级结果有标记，用户可感知。' },
        { title: '计量与告警', html: '输入/输出 token、成本、延迟、重试次数进 trace；按租户聚合。观察点：账单能按请求解释。' }
      ]
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「如何把单请求成本压到可预测」：先按任务分级路由，再给单请求设成本上限，最后用缓存与批量摊薄。回答时要补计量口径：输入和输出分别按 token 计价，成本按整数分向上取整，重试与流式重连要归并到同一个逻辑请求，否则账单不可解释。<br>「流式接口怎么保证不重复扣费」：核心不是流式，而是幂等。为逻辑请求生成幂等键，重试与重连都携带同一个键，服务端按键返回首次结果；计量按键归并，而不是按物理连接计数。再补一句失败边界：非幂等请求不自动重试。'
    }
  ],
  checks: [
    {
      id: 's7-l1-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '上下文管理',
      prompt: '输入超过上下文窗口时，最安全的处理方式是什么？',
      question: '输入超过上下文窗口时，最安全的处理方式是什么？',
      options: [
        { text: '按预算裁剪历史并摘要长文档，同时明确告知降级', correct: true },
        { text: '直接丢弃最早的消息，不记录任何变化', correct: false },
        { text: '把输入截断到窗口大小后照常调用，不提示模型', correct: false },
        { text: '把窗口参数调大即可，不需要处理', correct: false }
      ],
      explain: '裁剪必须显式、可解释，并保留 system 约束与最近输入；长文档先摘要。静默丢弃会让模型在缺少约束时自信作答。'
    },
    {
      id: 's7-l1-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '幂等设计',
      prompt: '哪些操作需要幂等键来避免重复副作用？',
      question: '哪些操作需要幂等键来避免重复副作用？',
      options: [
        { text: '模型调用失败后的自动重试', correct: true },
        { text: '流式连接断开后的重连', correct: true },
        { text: '会写入或扣费的计费与订单操作', correct: true },
        { text: '带副作用的工具调用', correct: true },
        { text: '只读的模型列表查询', correct: false }
      ],
      explain: '任何可能因重试产生重复副作用的路径都需要幂等键：重试、重连、计费与有副作用的工具调用。纯只读查询不需要。'
    },
    {
      id: 's7-l1-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '结构化输出',
      prompt: '结构化输出 schema 校验失败后，正确的动作是什么？',
      question: '结构化输出 schema 校验失败后，正确的动作是什么？',
      options: [
        { text: '重试一次，仍失败则降级并记录失败原因', correct: true },
        { text: '把原始 JSON 直接写入数据库', correct: false },
        { text: '忽略校验错误，按文本继续处理', correct: false },
        { text: '无限重试直到输出合法', correct: false }
      ],
      explain: '校验失败说明模型输出不可信。重试一次并降级，同时记录失败原因用于评估；坏数据不能入库，也不能无限重试。'
    }
  ],
  exercises: [
    {
      id: 's7-l1-ex-1',
      kind: 'code',
      title: 'SSE 解析 + 流式网关（注入 mock provider，断网可跑）',
      brief: '实现 parseSSE(chunks) 与 createGateway({ providers, pricing, budget, maxRetries = 1 })。parseSSE 支持多行 data、空行派发、LF/CRLF、注释行、跨块切断与 [DONE]；输出 { id?, event, data }，默认 event 为 message，[DONE] 输出 { event: "done", data: "" }。网关按风险与复杂度路由：risk 或 complexity 为 high 走 strong，否则走 cheap；成本 = ceil((inputTokens * inputPer1k + outputTokens * outputPer1k) / 1000)，超过 budget 抛 code 为 BUDGET_EXCEEDED 的错误且不重试；仅错误 retryable 为 true 且请求带 idempotencyKey 时最多重试 maxRetries 次；provider 缺少 usage 或 token 为负抛 INVALID_PROVIDER_RESPONSE；返回 { text, model, usage, cost, attempts }。测试只使用注入的假 provider 与固定夹具，不访问网络、不读取密钥。',
      hint: 'SSE 解析要维护 buffer 与 dataLines，遇到空行派发；CRLF 先去掉行尾的 \\r。网关先算路由，再在循环里调用 provider；校验 usage、计算成本、检查预算；catch 里判断 retryable 与 idempotencyKey，attempts 统计真实调用次数。',
      starter: `function parseSSE(chunks) {
  const events = [];
  for (const chunk of chunks) {
    for (const line of chunk.split('\\n')) {
      if (line.startsWith('data: ')) {
        events.push({ event: 'message', data: line.slice(6) });
      }
    }
  }
  return events;
}

function createGateway({ providers, pricing, budget, maxRetries = 1 }) {
  return async function callModel(request) {
    const route = request.task.complexity === 'high' ? 'strong' : 'cheap';
    const result = await providers[route](request);
    return {
      text: result.text,
      model: result.model,
      usage: result.usage,
      cost: result.usage.outputTokens,
      attempts: 1
    };
  };
}`,
      solution: `function parseSSE(chunks) {
  const events = [];
  let buffer = '';
  let dataLines = [];
  let event = 'message';
  let id;

  function dispatch() {
    if (dataLines.length === 0) {
      event = 'message';
      id = undefined;
      return;
    }
    const data = dataLines.join('\\n');
    if (data === '[DONE]') {
      events.push({ event: 'done', data: '' });
    } else {
      const item = { event, data };
      if (id !== undefined) item.id = id;
      events.push(item);
    }
    dataLines = [];
    event = 'message';
    id = undefined;
  }

  for (const chunk of chunks) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\\n')) !== -1) {
      let line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.endsWith('\\r')) line = line.slice(0, -1);
      if (line === '') { dispatch(); continue; }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') dataLines.push(value);
      else if (field === 'event') event = value;
      else if (field === 'id') id = value;
    }
  }
  return events;
}

function createGateway({ providers, pricing, budget, maxRetries = 1 }) {
  return async function callModel(request) {
    const route = request.task.risk === 'high' || request.task.complexity === 'high'
      ? 'strong'
      : 'cheap';
    let attempts = 0;

    while (true) {
      attempts += 1;
      try {
        const result = await providers[route](request);
        const usage = result && result.usage;
        const valid = usage
          && Number.isInteger(usage.inputTokens)
          && Number.isInteger(usage.outputTokens)
          && usage.inputTokens >= 0
          && usage.outputTokens >= 0;
        if (!valid) {
          const error = new Error('provider response invalid');
          error.code = 'INVALID_PROVIDER_RESPONSE';
          throw error;
        }
        const price = pricing[route];
        const cost = Math.ceil(
          (usage.inputTokens * price.inputPer1k + usage.outputTokens * price.outputPer1k) / 1000
        );
        if (cost > budget) {
          const error = new Error('budget exceeded');
          error.code = 'BUDGET_EXCEEDED';
          throw error;
        }
        return { text: result.text, model: result.model, usage, cost, attempts };
      } catch (error) {
        const canRetry = error && error.retryable === true
          && request.idempotencyKey !== undefined
          && attempts <= maxRetries;
        if (!canRetry) throw error;
      }
    }
  };
}`,
      tests: [
        {
          name: '单块 SSE 派发一个事件',
          code: `const events = parseSSE(${JSON.stringify(sseCases.single.chunks)});
assert.deepEqual(events, ${JSON.stringify(sseCases.single.expected)});`
        },
        {
          name: '跨块切断仍能拼出完整 data',
          code: `const events = parseSSE(${JSON.stringify(sseCases.crossChunk.chunks)});
assert.deepEqual(events, ${JSON.stringify(sseCases.crossChunk.expected)});`
        },
        {
          name: '多行 data 以换行拼接',
          code: `const events = parseSSE(${JSON.stringify(sseCases.multiline.chunks)});
assert.deepEqual(events, ${JSON.stringify(sseCases.multiline.expected)});`
        },
        {
          name: 'CRLF、id 与注释行',
          code: `const events = parseSSE(${JSON.stringify(sseCases.crlfComment.chunks)});
assert.deepEqual(events, ${JSON.stringify(sseCases.crlfComment.expected)});`
        },
        {
          name: '[DONE] 输出 done 事件',
          code: `const events = parseSSE(${JSON.stringify(sseCases.done.chunks)});
assert.deepEqual(events, ${JSON.stringify(sseCases.done.expected)});`
        },
        {
          name: '低复杂度请求走 cheap 并按输入输出计费',
          code: `const pricing = ${JSON.stringify(pricing)};
const providers = {
  cheap: async () => (${JSON.stringify(mockResponses.cheap)}),
  strong: async () => { throw new Error('strong should not be called'); }
};
const call = createGateway({ providers, pricing, budget: ${budgets.cheapOk} });
const result = await call(${JSON.stringify(requests.low)});
assert.equal(result.model, 'cheap-mini');
assert.equal(result.cost, 2);
assert.equal(result.attempts, 1);`
        },
        {
          name: '高风险请求升级到 strong 并计算成本',
          code: `const pricing = ${JSON.stringify(pricing)};
const providers = {
  cheap: async () => { throw new Error('cheap should not be called'); },
  strong: async () => (${JSON.stringify(mockResponses.strong)})
};
const call = createGateway({ providers, pricing, budget: ${budgets.strongOk} });
const result = await call(${JSON.stringify(requests.highRisk)});
assert.equal(result.model, 'strong-pro');
assert.equal(result.cost, 24);
assert.equal(result.attempts, 1);`
        },
        {
          name: '超出预算抛出 BUDGET_EXCEEDED 且不重试',
          code: `const pricing = ${JSON.stringify(pricing)};
let calls = 0;
const providers = {
  cheap: async () => { calls += 1; return ${JSON.stringify(mockResponses.cheap)}; },
  strong: async () => (${JSON.stringify(mockResponses.strong)})
};
const call = createGateway({ providers, pricing, budget: ${budgets.tooSmall}, maxRetries: 3 });
let error;
try {
  await call({ ...${JSON.stringify(requests.low)}, idempotencyKey: 'budget-case' });
} catch (caught) {
  error = caught;
}
assert.equal(error.code, 'BUDGET_EXCEEDED');
assert.equal(calls, 1);`
        },
        {
          name: '带幂等键的可重试错误重试一次后成功',
          code: `const pricing = ${JSON.stringify(pricing)};
const retryable = ${JSON.stringify(mockErrors.rateLimited)};
const cheap = ${JSON.stringify(mockResponses.cheap)};
let calls = 0;
const providers = {
  cheap: async () => {
    calls += 1;
    if (calls === 1) throw retryable;
    return cheap;
  },
  strong: async () => cheap
};
const call = createGateway({ providers, pricing, budget: ${budgets.cheapOk}, maxRetries: 1 });
const result = await call(${JSON.stringify(requests.idempotent)});
assert.equal(result.attempts, 2);
assert.equal(result.text, cheap.text);
assert.equal(calls, 2);`
        },
        {
          name: '非幂等请求失败不重试',
          code: `const pricing = ${JSON.stringify(pricing)};
const retryable = ${JSON.stringify(mockErrors.timeout)};
let calls = 0;
const providers = {
  cheap: async () => { calls += 1; throw retryable; },
  strong: async () => (${JSON.stringify(mockResponses.strong)})
};
const call = createGateway({ providers, pricing, budget: ${budgets.cheapOk}, maxRetries: 2 });
let error;
try {
  await call(${JSON.stringify(requests.low)});
} catch (caught) {
  error = caught;
}
assert.equal(error.code, 'TIMEOUT');
assert.equal(calls, 1);`
        }
      ]
    },
    {
      id: 's7-l1-ex-2',
      kind: 'design',
      title: 'LinkHub 摘要网关设计',
      brief: '为 LinkHub 设计摘要与标签的 LLM 网关：说明输入输出 schema、模型路由、超时、重试与幂等、token 预算与租户配额、降级（规则提取）、计量与 trace、失败告警，并明确摘要走异步链路、不阻塞短链创建。',
      checklist: [
        '输入 schema 与截断策略',
        '输出 schema 与校验失败处理',
        '模型路由规则与测试',
        '首 token 与总超时',
        '重试条件与幂等键',
        '单请求 token 预算',
        '租户日配额与排队',
        '降级路径（规则提取）',
        '计量（输入/输出 token 与成本）',
        'trace 与错误率告警',
        '异步链路与重试队列'
      ],
      reference: '<ul><li><strong>异步：</strong>创建短链只写任务，摘要与标签由队列异步生成，失败不阻塞创建。</li><li><strong>输入：</strong>短链、标题、来源页面与租户；超长先截断并记录，不静默丢字段。</li><li><strong>输出：</strong>summary、tags、language、confidence；按 schema 校验，失败重试一次后降级。</li><li><strong>路由：</strong>普通摘要走 cheap，客户可见或高风险内容走 strong；路由规则有测试。</li><li><strong>超时：</strong>首 token 超时与总超时分离；流式中断可取消并释放连接。</li><li><strong>重试：</strong>只重试 retryable 错误；每次逻辑请求一个幂等键，服务端按键去重。</li><li><strong>预算：</strong>单请求成本上限 + 租户日配额；超限时排队或降级，返回明确错误码。</li><li><strong>降级：</strong>模型不可用时用标题前 120 字与关键词规则提取，结果标记为降级。</li><li><strong>计量：</strong>输入/输出 token、成本、延迟、重试次数进 trace，按租户聚合。</li><li><strong>告警：</strong>错误率、成本超限、降级比例与队列积压分别告警。</li></ul>'
    }
  ]
};
