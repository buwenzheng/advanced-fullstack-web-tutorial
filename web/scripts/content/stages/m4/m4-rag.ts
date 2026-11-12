import { docs as ragDocs, tenantId as ragTenant, query as ragQuery, queryEmbedding, embedTable, dimMismatchDocs } from '../../fixtures/ai/rag-docs.js';
import { allowedMetrics, contextTenant, statCalls, statRows } from '../../fixtures/ai/tool-cases.js';

export const m4Rag = {
  id: 'm4-rag',
  title: 'RAG、向量检索与工具调用',
  subtitle: 'embedding、切分、pgvector、混合检索、引用、受限工具与问数边界。',
  duration: 85,
  status: 'ready',
  objectives: [
    '解释 embedding、切分、向量索引与相似度，定位召回失败发生在哪一步。',
    '设计关键词 + 向量的混合检索，并在排序前完成租户过滤。',
    '用 rerank、引用与新鲜度让答案可追溯。',
    '区分受限工具调用与 text-to-SQL，守住不直连生产库、不生成任意 SQL。'
  ],
  keywords: ['embedding', 'RAG', '切分', 'pgvector', 'HNSW', 'IVF', '混合检索', 'rerank', '引用', '租户隔离', '受限工具', 'text-to-SQL'],
  blocks: [
    {
      type: 'analogy',
      title: '图书馆找书',
      html: '找一本讲「发布回滚」的书，你有两种手段：查索引卡，按书名、编号、关键词精确定位；或者走到「运维」书架，凭内容主题相近来翻。关键词检索像索引卡，精确、可解释，但用户输入「上线失败怎么退回去」时未必能对上「回滚」两个字；向量检索像主题书架，能按意思相近找到书，但可能把「回滚」和「回滚策略的审计记录」混在一起。<br>类比失效的地方在权限：图书馆的书架是公共的，租户的数据不是。如果先按相似度取前十本、再检查借阅权限，你会看到别人的书名甚至内容摘要。正确顺序是先限定你有权访问的书架，再排序。RAG 的工程质量，很大一部分就花在「先过滤、再排序、给引用」这三步上。'
    },
    {
      type: 'text',
      title: 'embedding 与相似度',
      html: 'embedding 把一段文本映射成固定维度的向量，语义相近的文本在向量空间里距离更近。常见相似度有余弦相似度与内积：向量归一化后两者等价，所以工程上常先把向量归一化再比较。维度由模型决定，不同模型的维度与语义空间都不同，不能把 A 模型的文档向量和 B 模型的查询向量混在一起；换模型意味着重建索引，索引版本与 embedding 版本必须一起管理。<br>相似度分数不是概率，不同查询之间的分数不可直接比较；它适合在同一查询的候选集内排序。召回失败通常发生在四步之一：切分把关键上下文切断、embedding 模型不适配语言或领域、索引参数牺牲了召回、过滤条件把正确文档排除。排查时按「切分 → 模型 → 索引 → 过滤 → 排序」逐层看，而不是一上来就调 topK。混合检索的动机也在这里：关键词擅长精确编号与专有名词，向量擅长语义泛化，两者归一化后加权，能覆盖单一方法的盲区。'
    },
    {
      type: 'code',
      title: '文档切分：边界、重叠与稳定 id',
      lang: 'javascript',
      code: `function chunkDocument(text, options = {}) {
  const maxChars = options.maxChars === undefined ? 200 : options.maxChars;
  const overlap = Math.min(options.overlap === undefined ? 40 : options.overlap, maxChars - 1);
  if (typeof text !== 'string' || text.length === 0) return [];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      for (let i = end - 1; i > start; i--) {
        if ('。！？!?\\n'.includes(text[i])) { end = i + 1; break; }
      }
    }
    const piece = text.slice(start, end);
    if (piece.trim().length > 0) {
      chunks.push({ index: chunks.length, text: piece, start, end });
    }
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}`,
      note: '切分先按段落与句子边界，再受 maxChars 约束；块间保留 overlap，避免一句话被切成两半后语义断裂。index 在同一文档内稳定，引用才能精确到块。重叠必须小于 maxChars，否则起点不前进会死循环。'
    },
    {
      type: 'flow',
      title: 'RAG 链路与每步的失败现象',
      steps: [
        { name: '文档', detail: '来源、版本与租户归属。失败表现：文档过期或归属错误。' },
        { name: '切分', detail: '按段落/句子边界与重叠切块，生成稳定 chunk id。失败表现：关键上下文被切断，引用无法定位。' },
        { name: '向量', detail: '用固定版本的 embedding 模型生成向量。失败表现：模型混用，维度或语义空间不一致。' },
        { name: '索引', detail: 'pgvector 建 HNSW/IVF 索引，带上租户与版本字段。失败表现：参数牺牲召回，或索引未随文档更新。' },
        { name: '检索', detail: '先按租户与权限过滤，再做向量与关键词召回。失败表现：权限后置，跨租户内容进入上下文。' },
        { name: 'rerank', detail: '对候选集重排，融合新鲜度与业务权重。失败表现：只看向量分，精确匹配被淹没。' },
        { name: '引用', detail: '返回 docId + chunkIndex，生成答案时附带引用。失败表现：引用只到文档，无法核对原文。' }
      ]
    },
    {
      type: 'table',
      title: 'pgvector 的索引选择',
      head: ['索引', '特点', '代价', '适用'],
      rows: [
        ['精确扫描', '召回最高，无近似误差', '数据量大时延迟高', '小数据集、评估基线、离线校验'],
        ['HNSW', '图索引，查询快、召回高', '内存占用大，构建慢，参数影响召回', '在线语义检索的默认选择'],
        ['IVF', '聚类倒排，内存更省', '需要训练，召回受聚类数与探测数影响', '大规模、内存受限的场景']
      ],
      note: '索引参数没有免费的午餐：HNSW 的 ef_search 越高召回越好、延迟越大；IVF 的 probes 同理。先用固定评估集测召回，再调参数，不要凭感觉。'
    },
    {
      type: 'code',
      title: '混合检索：过滤前置、归一化与引用',
      lang: 'javascript',
      code: `async function hybridSearch(input) {
  const { query, docs, embed, keywordScore, tenantId } = input;
  const topK = input.topK === undefined ? 3 : input.topK;
  const weights = input.weights || { vector: 0.7, keyword: 0.3 };
  if (typeof query !== 'string' || query.trim() === '' || topK <= 0) return [];

  const candidates = docs.filter((doc) => doc.tenantId === tenantId);
  const embedded = [];
  for (const doc of candidates) {
    embedded.push({ ...doc, vector: doc.embedding || await embed(doc.text) });
  }
  const queryVector = await embed(query);

  const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  };

  for (const doc of embedded) {
    if (doc.vector.length !== queryVector.length) {
      const error = new Error('dimension mismatch');
      error.code = 'DIM_MISMATCH';
      throw error;
    }
  }

  const normalize = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((value) => (max === min ? 0 : (value - min) / (max - min)));
  };

  const vectorScores = embedded.map((doc) => cosine(queryVector, doc.vector));
  const keywordScores = embedded.map((doc) => keywordScore(query, doc.text));
  const vectorNorm = normalize(vectorScores);
  const keywordNorm = normalize(keywordScores);

  return embedded
    .map((doc, index) => ({
      id: doc.id,
      score: weights.vector * vectorNorm[index] + weights.keyword * keywordNorm[index],
      updatedAt: doc.updatedAt,
      citation: { docId: doc.docId, chunkIndex: doc.chunkIndex }
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, topK)
    .map((item) => ({ id: item.id, score: item.score, citation: item.citation }));
}`,
      note: '租户过滤必须发生在算分与排序之前，这是本讲最重要的顺序。向量与关键词分数量纲不同，先各自 min-max 归一化再加权；max 等于 min 时归一为 0。同分按更新时间和 id 决定稳定顺序，引用精确到 docId + chunkIndex。'
    },
    {
      type: 'case',
      title: '语义搜索召回了其他租户文档',
      context: 'LinkHub 的语义搜索先取全库 topK，再在应用层过滤租户。一次演示中，t2 租户的「回滚发布机密文档」向量分最高，被带进了 t1 租户的上下文，虽然没有直接展示原文，但生成的答案出现了对方文档里的细节。',
      symptom: 't1 用户看到只存在于 t2 文档中的术语；日志显示检索结果包含其他租户的 docId；切换 topK 后泄露内容变化。',
      cause: '权限过滤在后，排序在前；向量索引查询没有租户条件；embedding 补齐也对全库执行，扩大暴露面。',
      fix: '检索入口强制租户条件；过滤放在算分与排序之前；补齐 embedding 只对候选集执行；增加跨租户召回测试与审计日志。',
      prevention: '把「过滤前置」写进检索接口契约；测试夹具包含跨租户高相似文档；任何绕过检索入口的查询一律拒绝。',
      metric: '跨租户召回用例从 100% 泄露降到 0，检索延迟无明显变化'
    },
    {
      type: 'pitfall',
      title: 'RAG 的五个坑',
      html: '<strong>切分丢上下文：</strong>固定长度硬切，把条件与结论分开。修复：按段落/句子边界切分并保留重叠。<br><strong>只看向量：</strong>精确编号与专有名词召回差。修复：关键词 + 向量混合，归一化后加权。<br><strong>引用编造：</strong>答案给了文档名但没有块号，无法核对。修复：引用必须精确到 chunk。<br><strong>权限后置：</strong>先取 topK 再过滤，跨租户内容进入上下文。修复：过滤前置。<br><strong>索引过期：</strong>文档更新但向量未重建，检索返回旧内容。修复：索引版本与文档版本绑定，重建可重放。'
    },
    {
      type: 'compare',
      title: '受限工具 vs text-to-SQL',
      cols: [
        {
          title: '受限工具',
          items: [
            '工具名与参数白名单固定，可逐一校验',
            '权限在应用层收紧，不直连生产库',
            '表达力有限，但结果可验证、可审计',
            '适合问数、统计、固定报表'
          ]
        },
        {
          title: 'text-to-SQL',
          items: [
            '表达力强，能回答开放式问题',
            'SQL 难以验证，越权与注入面大',
            '性能不可控，可能拖垮数据库',
            '适合内部只读分析，且需强沙箱'
          ]
        }
      ]
    },
    {
      type: 'code',
      title: '受限统计工具：先校验，再查询',
      lang: 'javascript',
      code: `async function runStatTool(call, context) {
  const maxLimit = context.maxLimit === undefined ? 100 : context.maxLimit;
  const maxRangeDays = context.maxRangeDays === undefined ? 90 : context.maxRangeDays;
  const deny = (reason) => {
    const error = new Error('tool denied');
    error.code = 'TOOL_DENIED';
    error.reason = reason;
    throw error;
  };

  if (!call || call.tool !== 'topLinks') deny('UNKNOWN_TOOL');
  if (call.tenantId !== undefined && call.tenantId !== context.tenantId) deny('TENANT_MISMATCH');
  if (!Number.isInteger(call.rangeDays) || call.rangeDays < 1) deny('INVALID_ARGUMENT');
  if (!Number.isInteger(call.limit) || call.limit < 1) deny('INVALID_ARGUMENT');
  if (call.rangeDays > maxRangeDays) deny('RANGE_EXCEEDED');
  if (call.limit > maxLimit) deny('LIMIT_EXCEEDED');
  if (!context.allowedMetrics.includes(call.metric)) deny('METRIC_NOT_ALLOWED');

  const rows = await context.query({
    metric: call.metric,
    rangeDays: call.rangeDays,
    limit: call.limit,
    tenantId: context.tenantId
  });
  return { rows: rows.slice(0, call.limit), basis: call.metric, rangeDays: call.rangeDays };
}`,
      note: '校验顺序固定：工具名 → 租户 → 参数类型与范围 → 指标白名单。任何一步失败都在调用 query 之前抛出 TOOL_DENIED 并带 reason，避免「先查了再拒绝」。返回结果附上口径 basis 与时间范围，用户才知道数字代表什么。'
    },
    {
      type: 'steps',
      title: 'LinkHub 问数工具设计',
      steps: [
        { title: '问题分类', html: '区分可回答的统计问题、需要澄清的问题与越权请求。观察点：越权请求直接拒绝，不进入工具选择。' },
        { title: '工具选择', html: '从白名单选择 topLinks 等固定工具，不允许模型自由生成 SQL。观察点：工具名与参数受 schema 约束。' },
        { title: '参数校验', html: '指标白名单、时间范围、行数上限与租户一致性。观察点：任何越界在查询前被拒绝。' },
        { title: '执行查询', html: '通过受限查询接口访问只读副本，带租户条件与超时。观察点：不直连生产库。' },
        { title: '口径说明', html: '返回 basis、rangeDays 与去重规则，说明数字含义。观察点：用户能理解 UV 与 PV 的差异。' },
        { title: '降级', html: '工具不可用时返回预置报表或提示稍后再试。观察点：不会退化成任意 SQL。' }
      ]
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「RAG 答非所问，按什么顺序排查」：先看问题与文档是否真的相关，也就是召回有没有把正确块拿回来；再看切分是否把关键上下文切断；然后看 embedding 模型与语言/领域是否匹配、索引参数是否牺牲召回；最后看排序与提示是否把正确块淹没。每一步都用固定评估集验证，而不是凭单条 bad case 调参。<br>「为什么问数不让模型直接写 SQL」：SQL 表达力强，但不可验证、权限难收紧、注入面大、性能不可控。受限工具把「能问什么」变成白名单，参数校验发生在查询前，结果附口径说明；表达力换来了可审计与可测试，这在多租户产品里是划算的。'
    }
  ],
  checks: [
    {
      id: 'm4-rag-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '权限顺序',
      prompt: '混合检索中，租户与权限过滤应该放在哪个阶段？',
      question: '混合检索中，租户与权限过滤应该放在哪个阶段？',
      options: [
        { text: '在算分与排序之前，先限定候选集', correct: true },
        { text: '先取 topK，再在应用层过滤', correct: false },
        { text: '生成答案之后再检查引用', correct: false },
        { text: '只在前端隐藏其他租户的结果', correct: false }
      ],
      explain: '过滤后置会让其他租户内容进入候选集甚至上下文。必须在向量与关键词召回前限定租户与权限。'
    },
    {
      id: 'm4-rag-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '混合检索',
      prompt: '为什么需要关键词 + 向量的混合检索？',
      question: '为什么需要关键词 + 向量的混合检索？',
      options: [
        { text: '关键词擅长精确编号与专有名词', correct: true },
        { text: '向量能按语义泛化召回不同说法', correct: true },
        { text: '新鲜度与业务权重可以在排序阶段融合', correct: true },
        { text: '混合检索可以取消租户过滤', correct: false },
        { text: '向量分数在不同查询之间可以直接比较', correct: false }
      ],
      explain: '关键词与向量互补，新鲜度与权重在排序阶段融合。混合检索不能取消权限过滤，向量分数也不适合跨查询直接比较。'
    },
    {
      id: 'm4-rag-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '问数边界',
      prompt: 'LinkHub 的问数功能为什么不应该让模型生成任意 SQL？',
      question: 'LinkHub 的问数功能为什么不应该让模型生成任意 SQL？',
      options: [
        { text: 'SQL 难以验证、权限难收紧、注入面大且性能不可控', correct: true },
        { text: 'SQL 语法太简单，模型无法生成', correct: false },
        { text: '数据库不支持 SQL 查询', correct: false },
        { text: '只要加一句提示词就能安全执行', correct: false }
      ],
      explain: '任意 SQL 不可验证、可能越权与注入、性能不可控。受限工具把能力收进白名单，参数在查询前校验。'
    }
  ],
  exercises: [
    {
      id: 'm4-rag-ex-1',
      kind: 'code',
      title: '切分 + 混合检索 + 受限工具（租户过滤前置）',
      brief: '实现 chunkDocument(text, { maxChars = 200, overlap = 40 })、hybridSearch({ query, docs, embed, keywordScore, tenantId, topK = 3, weights }) 与 runStatTool(call, { allowedMetrics, query, tenantId, maxLimit = 100, maxRangeDays = 90 })。切分按段落/句子边界、块间重叠、返回 [{ index, text, start, end }] 且无空块。检索先按租户过滤，再补齐 embedding；维度不一致抛 DIM_MISMATCH；向量与关键词分别 min-max 归一化后加权，同分按 updatedAt 降序、id 升序，返回 [{ id, score, citation: { docId, chunkIndex } }]；空查询或 topK <= 0 返回空数组。工具校验顺序为工具名 → 租户 → 参数类型/范围 → 指标白名单，失败抛 code 为 TOOL_DENIED、带 reason 的错误，校验通过前不得调用 query；返回 { rows, basis, rangeDays } 并截断到 limit。所有数据来自固定夹具，断网可跑。',
      hint: '切分先找句子边界再回退，下一块起点 = 上一块 end - overlap。混合检索过滤后只对候选集补 embedding；归一化时 max === min 归 0；排序比较器依次比较分数、时间、id。工具先做完全部校验再 await query，任何拒绝都不要触碰查询函数。',
      starter: `function chunkDocument(text, options = {}) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 200) {
    chunks.push({ index: chunks.length, text: text.slice(i, i + 200), start: i, end: i + 200 });
  }
  return chunks;
}

async function hybridSearch(input) {
  const { query, docs, embed, tenantId } = input;
  const scored = [];
  for (const doc of docs) {
    const vector = doc.embedding || await embed(doc.text);
    scored.push({ id: doc.id, score: vector[0], citation: { docId: doc.docId, chunkIndex: doc.chunkIndex } });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, input.topK || 3);
}

async function runStatTool(call, context) {
  const rows = await context.query(call);
  return { rows, basis: call.metric, rangeDays: call.rangeDays };
}`,
      solution: `function chunkDocument(text, options = {}) {
  const maxChars = options.maxChars === undefined ? 200 : options.maxChars;
  const overlap = Math.min(options.overlap === undefined ? 40 : options.overlap, maxChars - 1);
  if (typeof text !== 'string' || text.length === 0) return [];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      for (let i = end - 1; i > start; i--) {
        if ('。！？!?\\n'.includes(text[i])) { end = i + 1; break; }
      }
    }
    const piece = text.slice(start, end);
    if (piece.trim().length > 0) {
      chunks.push({ index: chunks.length, text: piece, start, end });
    }
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function hybridSearch(input) {
  const { query, docs, embed, keywordScore, tenantId } = input;
  const topK = input.topK === undefined ? 3 : input.topK;
  const weights = input.weights || { vector: 0.7, keyword: 0.3 };
  if (typeof query !== 'string' || query.trim() === '' || topK <= 0) return [];

  const candidates = docs.filter((doc) => doc.tenantId === tenantId);
  const embedded = [];
  for (const doc of candidates) {
    embedded.push({ ...doc, vector: doc.embedding || await embed(doc.text) });
  }
  const queryVector = await embed(query);

  const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  };

  for (const doc of embedded) {
    if (doc.vector.length !== queryVector.length) {
      const error = new Error('dimension mismatch');
      error.code = 'DIM_MISMATCH';
      throw error;
    }
  }

  const normalize = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((value) => (max === min ? 0 : (value - min) / (max - min)));
  };

  const vectorScores = embedded.map((doc) => cosine(queryVector, doc.vector));
  const keywordScores = embedded.map((doc) => keywordScore(query, doc.text));
  const vectorNorm = normalize(vectorScores);
  const keywordNorm = normalize(keywordScores);

  return embedded
    .map((doc, index) => ({
      id: doc.id,
      score: weights.vector * vectorNorm[index] + weights.keyword * keywordNorm[index],
      updatedAt: doc.updatedAt,
      citation: { docId: doc.docId, chunkIndex: doc.chunkIndex }
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, topK)
    .map((item) => ({ id: item.id, score: item.score, citation: item.citation }));
}

async function runStatTool(call, context) {
  const maxLimit = context.maxLimit === undefined ? 100 : context.maxLimit;
  const maxRangeDays = context.maxRangeDays === undefined ? 90 : context.maxRangeDays;
  const deny = (reason) => {
    const error = new Error('tool denied');
    error.code = 'TOOL_DENIED';
    error.reason = reason;
    throw error;
  };

  if (!call || call.tool !== 'topLinks') deny('UNKNOWN_TOOL');
  if (call.tenantId !== undefined && call.tenantId !== context.tenantId) deny('TENANT_MISMATCH');
  if (!Number.isInteger(call.rangeDays) || call.rangeDays < 1) deny('INVALID_ARGUMENT');
  if (!Number.isInteger(call.limit) || call.limit < 1) deny('INVALID_ARGUMENT');
  if (call.rangeDays > maxRangeDays) deny('RANGE_EXCEEDED');
  if (call.limit > maxLimit) deny('LIMIT_EXCEEDED');
  if (!context.allowedMetrics.includes(call.metric)) deny('METRIC_NOT_ALLOWED');

  const rows = await context.query({
    metric: call.metric,
    rangeDays: call.rangeDays,
    limit: call.limit,
    tenantId: context.tenantId
  });
  return { rows: rows.slice(0, call.limit), basis: call.metric, rangeDays: call.rangeDays };
}`,
      tests: [
        {
          name: '切分不产生空块且索引连续',
          code: `const text = '第一段。第二段。\\n\\n第三段。';
const chunks = chunkDocument(text, { maxChars: 6, overlap: 1 });
assert.ok(chunks.length > 0);
assert.equal(chunks.every((chunk) => chunk.text.trim().length > 0), true);
assert.deepEqual(chunks.map((chunk) => chunk.index), chunks.map((_, index) => index));
assert.equal(chunks[chunks.length - 1].end, text.length);`
        },
        {
          name: '块间重叠与长度上限正确',
          code: `const text = '第一句话描述创建短链。第二句话描述配额检查。第三句话描述回滚步骤。第四句话描述统计口径。第五句话描述缓存策略。';
const chunks = chunkDocument(text, { maxChars: 12, overlap: 3 });
assert.ok(chunks.length > 2);
assert.equal(chunks.every((chunk) => chunk.text.length <= 12), true);
for (let i = 1; i < chunks.length; i += 1) {
  const prev = chunks[i - 1];
  const current = chunks[i];
  assert.ok(current.start < prev.end);
  assert.ok(prev.end - current.start <= 3);
  assert.equal(current.text.slice(0, prev.end - current.start), text.slice(current.start, prev.end));
}
assert.equal(chunks.every((chunk) => '。！？!?\\n'.includes(chunk.text[chunk.text.length - 1])), true);`
        },
        {
          name: '租户过滤发生在补齐 embedding 与排序之前',
          code: `const docs = ${JSON.stringify(ragDocs)};
const tenantId = ${JSON.stringify(ragTenant)};
const query = ${JSON.stringify(ragQuery)};
const queryVector = ${JSON.stringify(queryEmbedding)};
const table = ${JSON.stringify(embedTable)};
const calls = [];
const embed = async (text) => {
  calls.push(text);
  if (table[text]) return table[text];
  if (text === query) return queryVector;
  return [1, 0, 0, 0];
};
const result = await hybridSearch({
  query, docs, embed,
  keywordScore: (q, text) => (text.includes(q) ? 1 : 0),
  tenantId, topK: 1, weights: { vector: 1, keyword: 0 }
});
assert.equal(result.length, 1);
assert.equal(result[0].id, 'd2-c1');
assert.equal(result.some((item) => item.id.startsWith('x1')), false);
assert.equal(calls.some((text) => text.includes('其他租户')), false);`
        },
        {
          name: '引用精确到文档块',
          code: `const docs = ${JSON.stringify(ragDocs)};
const tenantId = ${JSON.stringify(ragTenant)};
const query = ${JSON.stringify(ragQuery)};
const queryVector = ${JSON.stringify(queryEmbedding)};
const table = ${JSON.stringify(embedTable)};
const embed = async (text) => table[text] || (text === query ? queryVector : [1, 0, 0, 0]);
const result = await hybridSearch({
  query, docs, embed,
  keywordScore: () => 0,
  tenantId, topK: 3, weights: { vector: 1, keyword: 0 }
});
const byId = Object.fromEntries(docs.map((doc) => [doc.id, doc]));
assert.equal(result.length, 3);
for (const item of result) {
  assert.deepEqual(item.citation, { docId: byId[item.id].docId, chunkIndex: byId[item.id].chunkIndex });
}
assert.equal(Object.keys(result[0].citation).sort().join(','), 'chunkIndex,docId');`
        },
        {
          name: '向量与关键词加权排序',
          code: `const docs = ${JSON.stringify(ragDocs)};
const tenantId = ${JSON.stringify(ragTenant)};
const query = ${JSON.stringify(ragQuery)};
const queryVector = ${JSON.stringify(queryEmbedding)};
const table = ${JSON.stringify(embedTable)};
const embed = async (text) => table[text] || (text === query ? queryVector : [1, 0, 0, 0]);
const result = await hybridSearch({
  query, docs, embed,
  keywordScore: (q, text) => (text.includes(q) ? 1 : (text.includes('回滚') ? 0.2 : 0)),
  tenantId, topK: 3, weights: { vector: 0.5, keyword: 0.5 }
});
assert.equal(result[0].id, 'd3-c0');
assert.ok(Math.abs(result[0].score - 1) < 1e-9);
assert.equal(result[1].id, 'd1-c1');
assert.ok(Math.abs(result[1].score - 0.99694) < 1e-3);
assert.equal(result[2].id, 'd2-c1');
assert.ok(Math.abs(result[2].score - 0.6) < 1e-9);`
        },
        {
          name: '同分按更新时间降序、再按 id 升序',
          code: `const docs = ${JSON.stringify(ragDocs)};
const tenantId = ${JSON.stringify(ragTenant)};
const query = ${JSON.stringify(ragQuery)};
const queryVector = ${JSON.stringify(queryEmbedding)};
const table = ${JSON.stringify(embedTable)};
const embed = async (text) => table[text] || (text === query ? queryVector : [1, 0, 0, 0]);
const result = await hybridSearch({
  query, docs, embed,
  keywordScore: () => 0,
  tenantId, topK: 2, weights: { vector: 1, keyword: 0 }
});
assert.equal(result[0].id, 'd2-c1');
assert.equal(result[1].id, 'd3-c0');
assert.ok(Math.abs(result[0].score - 1) < 1e-9);
assert.ok(Math.abs(result[1].score - 1) < 1e-9);`
        },
        {
          name: 'topK 在排序后截断且空查询返回空数组',
          code: `const docs = ${JSON.stringify(ragDocs)};
const tenantId = ${JSON.stringify(ragTenant)};
const query = ${JSON.stringify(ragQuery)};
const queryVector = ${JSON.stringify(queryEmbedding)};
const table = ${JSON.stringify(embedTable)};
let calls = 0;
const embed = async (text) => { calls += 1; return table[text] || (text === query ? queryVector : [1, 0, 0, 0]); };
const two = await hybridSearch({ query, docs, embed, keywordScore: () => 0, tenantId, topK: 2 });
assert.equal(two.length, 2);
const none = await hybridSearch({ query, docs, embed, keywordScore: () => 0, tenantId, topK: 0 });
assert.deepEqual(none, []);
const blank = await hybridSearch({ query: '   ', docs, embed, keywordScore: () => 0, tenantId });
assert.deepEqual(blank, []);`
        },
        {
          name: '未知指标在查询前被拒绝',
          code: `const caseData = ${JSON.stringify(statCalls.metricNotAllowed)};
let calls = 0;
let error;
try {
  await runStatTool(caseData.call, {
    allowedMetrics: ${JSON.stringify(allowedMetrics)},
    tenantId: ${JSON.stringify(contextTenant)},
    query: async () => { calls += 1; return ${JSON.stringify(statRows)}; }
  });
} catch (caught) {
  error = caught;
}
assert.equal(error.code, 'TOOL_DENIED');
assert.equal(error.reason, 'METRIC_NOT_ALLOWED');
assert.equal(calls, 0);`
        },
        {
          name: '超过时间范围被拒绝',
          code: `const caseData = ${JSON.stringify(statCalls.rangeExceeded)};
let calls = 0;
let error;
try {
  await runStatTool(caseData.call, {
    allowedMetrics: ${JSON.stringify(allowedMetrics)},
    tenantId: ${JSON.stringify(contextTenant)},
    query: async () => { calls += 1; return []; }
  });
} catch (caught) {
  error = caught;
}
assert.equal(error.reason, 'RANGE_EXCEEDED');
assert.equal(calls, 0);`
        },
        {
          name: '超过行数上限被拒绝',
          code: `const caseData = ${JSON.stringify(statCalls.limitExceeded)};
let calls = 0;
let error;
try {
  await runStatTool(caseData.call, {
    allowedMetrics: ${JSON.stringify(allowedMetrics)},
    tenantId: ${JSON.stringify(contextTenant)},
    query: async () => { calls += 1; return []; }
  });
} catch (caught) {
  error = caught;
}
assert.equal(error.reason, 'LIMIT_EXCEEDED');
assert.equal(calls, 0);`
        },
        {
          name: '跨租户调用被拒绝',
          code: `const caseData = ${JSON.stringify(statCalls.tenantMismatch)};
let calls = 0;
let error;
try {
  await runStatTool(caseData.call, {
    allowedMetrics: ${JSON.stringify(allowedMetrics)},
    tenantId: ${JSON.stringify(contextTenant)},
    query: async () => { calls += 1; return []; }
  });
} catch (caught) {
  error = caught;
}
assert.equal(error.reason, 'TENANT_MISMATCH');
assert.equal(calls, 0);`
        },
        {
          name: '正常调用返回口径并截断行数',
          code: `const caseData = ${JSON.stringify(statCalls.okTruncate)};
let seen = null;
const result = await runStatTool(caseData.call, {
  allowedMetrics: ${JSON.stringify(allowedMetrics)},
  tenantId: ${JSON.stringify(contextTenant)},
  query: async (params) => { seen = params; return ${JSON.stringify(statRows)}; }
});
assert.equal(result.basis, 'unique_visitors');
assert.equal(result.rangeDays, 30);
assert.equal(result.rows.length, 2);
assert.equal(seen.tenantId, ${JSON.stringify(contextTenant)});
assert.equal(seen.metric, 'unique_visitors');`
        },
        {
          name: '向量维度不一致抛出 DIM_MISMATCH',
          code: `const docs = ${JSON.stringify(dimMismatchDocs)};
const queryVector = ${JSON.stringify(queryEmbedding)};
let error;
try {
  await hybridSearch({
    query: '维度检查',
    docs,
    embed: async () => queryVector,
    keywordScore: () => 0,
    tenantId: 't1'
  });
} catch (caught) {
  error = caught;
}
assert.equal(error.code, 'DIM_MISMATCH');`
        }
      ]
    },
    {
      id: 'm4-rag-ex-2',
      kind: 'design',
      title: 'LinkHub 语义搜索与问数',
      brief: '为 LinkHub 设计语义搜索与问数：说明文档来源与切分、embedding 模型与版本、pgvector 索引类型与参数、混合权重、rerank、引用格式、新鲜度、权限过滤、问数工具白名单、口径说明与降级。要求复用现有 Postgres/pgvector，不新建向量库，不生成任意 SQL。',
      checklist: [
        '文档来源、版本与租户归属',
        '切分策略与稳定 chunk id',
        'embedding 模型与版本管理',
        'pgvector 索引类型与参数',
        '混合检索权重与归一化',
        'rerank 与新鲜度策略',
        '引用精确到文档块',
        '租户过滤前置与越权测试',
        '问数工具白名单与参数校验',
        '统计口径说明',
        '降级与超时'
      ],
      reference: '<ul><li><strong>来源：</strong>文档带版本与租户字段；索引版本与文档版本绑定，重建可重放。</li><li><strong>切分：</strong>按段落/句子边界，maxChars 与 overlap 可配置；chunk id 稳定。</li><li><strong>embedding：</strong>单一模型版本；换模型必须重建索引，不允许混用。</li><li><strong>索引：</strong>复用 Postgres + pgvector，在线默认 HNSW，按评估集调 ef_search。</li><li><strong>混合：</strong>向量与关键词分数量纲不同，先 min-max 归一化再加权；权重可配置并有测试。</li><li><strong>rerank：</strong>候选集重排，融合新鲜度与业务权重；同分按更新时间与 id 稳定排序。</li><li><strong>引用：</strong>返回 docId + chunkIndex，答案可逐块核对。</li><li><strong>权限：</strong>租户过滤在检索入口执行，先过滤再补齐 embedding 与排序；越权用例覆盖。</li><li><strong>问数：</strong>只调用 p-e1-stats 的受限工具，指标白名单、时间范围、行数上限与租户全部在查询前校验。</li><li><strong>口径：</strong>返回 basis 与 rangeDays，说明 UV/PV 去重规则。</li><li><strong>降级：</strong>检索超时退回关键词检索；工具不可用返回预置报表，不生成任意 SQL。</li></ul>'
    }
  ]
};
