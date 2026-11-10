export const s2L4 = {
  id: 's2-l4',
  title: '对外 API 的工程化',
  subtitle: '游标分页、幂等键与限流契约、webhook 签名、OpenAPI 与契约测试。',
  duration: 75,
  status: 'ready',
  objectives: [
    '设计游标分页、过滤与排序，保证稳定排序、白名单与分页上限。',
    '定义幂等键契约：作用域、TTL、同 body 重放、同键不同 body 的冲突语义。',
    '定义限流契约：429、Retry-After、配额响应头与客户端行为。',
    '设计 webhook 的签名、时间戳、重放窗口与重试策略，并用 OpenAPI 与契约测试守住文档漂移。'
  ],
  keywords: ['游标分页', '幂等键', '限流契约', 'Retry-After', 'webhook', 'HMAC', 'OpenAPI', '契约测试'],
  blocks: [
    {
      type: 'analogy',
      title: '公开 API 是产品',
      html: '你发布一个 npm 包，改一个导出函数的签名，至少还能靠 semver 与构建错误提醒调用方。公开 API 更难：调用方可能是别的公司的定时任务、移动端旧版本、你无法升级的硬件。你只能靠契约、版本文档与弃用窗口来管理升级。<br>所以对外 API 的每个细节都是产品决策：分页上限决定数据库压力，错误码决定 SDK 分支，限流响应决定客户端是否会重试风暴。类比失效的地方在于，npm 包能看到依赖图，API 看不到所有调用方。'
    },
    {
      type: 'text',
      title: '分页、过滤与排序',
      html: 'offset/limit 的问题不是「慢」，而是不稳定：翻页过程中插入或删除数据，页边界会漂移，用户看到重复项或漏项。游标分页用「上一页最后一条的排序键」定位下一页，排序键必须唯一，通常用 <code>createdAt</code> 加 <code>id</code> 做 tie-breaker。<br>过滤与排序字段要用白名单：客户端传 <code>sort=password</code> 或一个未建索引的列，不能直接拼进 SQL。limit 要有默认值与上限，例如默认 20、最大 100；上限是保护数据库与网关的契约，不是建议。'
    },
    {
      type: 'code',
      title: '游标分页：不透明游标与稳定排序',
      lang: 'javascript',
      code: `const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

class InvalidCursorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

function encodeCursor(payload) {
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const char of JSON.stringify(payload)) {
    buffer = (buffer << 8) | char.charCodeAt(0);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += ALPHABET[(buffer >> bits) & 63];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (6 - bits)) & 63];
  return out;
}

function decodeCursor(cursor) {
  let bits = 0;
  let buffer = 0;
  let text = '';
  for (const char of cursor) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new InvalidCursorError('invalid cursor');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      text += String.fromCharCode((buffer >> bits) & 255);
    }
    buffer &= (1 << bits) - 1;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidCursorError('invalid cursor');
  }
}`,
      note: '游标只放排序键，不放偏移量，也不暴露内部字段；客户端把它当不透明字符串原样回传。下面的练习会把排序、取页与下一页游标组合起来。'
    },
    {
      type: 'table',
      title: '幂等键契约（只定义契约）',
      head: ['项目', '契约', '失败的客户端行为'],
      rows: [
        ['请求头', '创建类 POST 接受 Idempotency-Key', '缺失时按普通请求处理，不承诺去重'],
        ['作用域', '租户 + 用户 + 接口', '跨租户复用同键不能命中'],
        ['TTL', '至少覆盖客户端重试窗口（例如 24 小时）', '过期后同键重放会重新执行'],
        ['同键同 body', '返回首次结果，不再创建', '客户端应把响应当成功'],
        ['同键不同 body', '返回 409，码为 idempotency_conflict', '客户端要换键或修正请求'],
        ['执行中重放', '返回 409 或 202，并提示稍后查询', '不能静默创建第二条']
      ],
      note: '本讲只定义契约；存储、并发控制与首次响应保存属于 S3 的幂等实现与韧性一讲。'
    },
    {
      type: 'table',
      title: '限流契约（只定义契约）',
      head: ['元素', '契约', '客户端应做什么'],
      rows: [
        ['状态码', '超限返回 429', '不要当 5xx 盲目重试'],
        ['Retry-After', '秒数或 HTTP 日期，表示最早可重试时间', '等待后再试，加入抖动'],
        ['错误码', 'rate_limited，可附带 scope 与配额', '按 code 分支，不解析文案'],
        ['配额头', '限流窗口、剩余额度、重置时间', '展示配额并提前降速'],
        ['作用域', '按 API Key/用户/IP/租户分别声明', '不要把 IP 限额当用户限额'],
        ['文档', '说明窗口、突发与配额来源', '按文档设计退避']
      ],
      note: '令牌桶、漏桶与容量调参在 S3 限流一讲实现；本讲只保证客户端能看到稳定、可行动的契约。'
    },
    {
      type: 'code',
      title: 'webhook 签名与重放防护',
      lang: 'javascript',
      code: `import { createHmac, timingSafeEqual } from 'node:crypto';

const WINDOW_MS = 5 * 60 * 1000;

function signWebhook(secret, timestamp, body) {
  return createHmac('sha256', secret)
    .update(timestamp + '.' + body)
    .digest('hex');
}

function verifyWebhook({ secret, timestamp, body, signature, now = Date.now() }) {
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > WINDOW_MS) {
    return { ok: false, reason: 'expired' };
  }
  const expected = signWebhook(secret, timestamp, body);
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(String(signature), 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}`,
      note: '签名覆盖「时间戳 + 原始 body」，接收方用原始字节验签，不能先反序列化再拼回去。secret 只存在服务端；时间窗限制重放，但仍建议接收方按事件 ID 去重。浏览器与边缘运行时可以换成 Web Crypto 的 HMAC，机制相同。'
    },
    {
      type: 'pitfall',
      title: '分页漂移与无界查询',
      html: '现象：第三方翻页时看到重复短链；某次请求把 limit 传到 100000，数据库 CPU 飙升；最后一页仍返回游标，客户端无限循环。<br>原因：offset 基于行号，插入/删除导致边界漂移；limit 没有服务端上限；排序不唯一，相同时间戳的顺序不稳定；游标为空时仍生成下一页。<br>发现方式：用并发写入的分页测试断言无重复、无漏项；检查接口日志里的 limit 分布；对最后一页断言 nextCursor 为 null。<br>修复：改游标分页，排序加 id 做 tie-breaker，limit 封顶并在文档写明；对旧客户端保留兼容窗口。<br>预防：契约测试覆盖第一页、中间页、最后一页与非法游标；压测包含大 limit 与深分页。'
    },
    {
      type: 'steps',
      title: 'OpenAPI 到契约测试',
      steps: [
        { title: '写公开 schema', html: '字段、类型、必填、枚举、状态码与错误码进入 OpenAPI。观察点：文档能生成可读的参考页。' },
        { title: '实现与 schema 对齐', html: '处理函数只返回 schema 声明的字段。观察点：响应里没有内部字段。' },
        { title: '写契约测试', html: '用真实请求断言状态码、字段类型与错误码。观察点：测试失败能指出哪条契约被破坏。' },
        { title: 'CI 漂移检查', html: '对比实现输出的 schema 与仓库中的 OpenAPI，有差异即失败。观察点：文档不会悄悄过期。' },
        { title: '版本与弃用', html: '破坏性变更开新版本；旧版本标记弃用并给迁移窗口。观察点：调用量下降后再移除。' }
      ]
    },
    {
      type: 'compare',
      title: 'REST vs GraphQL vs RPC',
      cols: [
        {
          title: 'REST',
          items: ['契约形态：资源 + 方法 + 状态码', '查询灵活性：由端点决定', '缓存：HTTP 缓存成熟', '版本化：URL/Header 明确', '错误模型：状态码 + 错误码', '适用：公开 API、缓存重要的读接口']
        },
        {
          title: 'GraphQL',
          items: ['契约形态：schema + 查询语言', '查询灵活性：客户端选字段，易产生复杂查询', '缓存：需要按字段/持久化查询自行设计', '版本化：倾向持续演进、弃用字段', '错误模型：data 与 errors 并存', '适用：多端字段差异大、聚合多个数据源']
        },
        {
          title: 'RPC（gRPC/JSON-RPC）',
          items: ['契约形态：方法 + 强类型消息', '查询灵活性：按方法定义，不自由组合', '缓存：HTTP 缓存不直接适用', '版本化：靠包/方法版本与兼容规则', '错误模型：状态码 + 结构化详情', '适用：内部服务、强类型、高性能调用']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：SLA、SLO 与弃用',
      html: '对外承诺要能测量。SLA 是对客户的合同承诺，SLO 是内部目标，SLI 是实际指标（可用性、P99 延迟、错误率）。没有 SLI 的 SLA 只是文案；没有错误预算的 SLO 会让团队在稳定性和发布速度之间没有共同语言。<br>弃用同样是契约：先标记旧字段或旧版本，给迁移文档与时间窗口，观察调用量，再移除。响应头可以辅助自动化客户端发现弃用，但不能替代直接通知。版本化只提供并行窗口，不解决兼容性设计；能新增就不要改，能可选就不要必填。',
      note: '具体可用性数字取决于业务与成本，正文不写死行业标准。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「游标分页与 offset 分页怎么选」先看数据是否持续变化与是否需要跳页：后台表格要跳页可以用 offset 并接受漂移；公开列表、信息流、导出用游标更稳。游标要稳定排序、不可伪造内部字段、能处理删除。<br>「第三方 API 怎么设计」按调用方旅程回答：认证、错误、分页、幂等、限流、webhook、文档与弃用，每一层都给可观察的契约与测试，而不是只列技术名词。'
    }
  ],
  checks: [
    {
      id: 's2-l4-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '分页',
      prompt: '第三方在翻页过程中不断有新链接创建，使用 offset/limit 分页时出现了重复项与漏项。最合适的修复方向是什么？',
      question: '第三方在翻页过程中不断有新链接创建，使用 offset/limit 分页时出现了重复项与漏项。最合适的修复方向是什么？',
      options: [
        { text: '把 limit 调大，减少翻页次数', correct: false },
        { text: '改用基于稳定排序键与 tie-breaker 的游标分页', correct: true },
        { text: '在每页请求前锁表，禁止写入', correct: false },
        { text: '让客户端自己去重，服务端不用改', correct: false }
      ],
      explain: 'offset 基于行号，插入/删除会让边界漂移；游标用「上一页最后一条的排序键」定位，配合唯一 tie-breaker 保证稳定。调大 limit 只减少概率；锁表代价过高；客户端去重无法找回漏项。'
    },
    {
      id: 's2-l4-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '幂等键契约',
      prompt: '关于创建接口的 Idempotency-Key 契约，以下哪些说法正确？',
      question: '关于创建接口的 Idempotency-Key 契约，以下哪些说法正确？',
      options: [
        { text: '同一个键与同一个请求体重放，应返回首次结果而不是再创建一条', correct: true },
        { text: '同一个键配不同请求体，应返回冲突而不是静默执行', correct: true },
        { text: '幂等键应绑定租户或用户作用域，不能全局共享', correct: true },
        { text: '幂等键永久保存最安全，不需要 TTL', correct: false },
        { text: '只要客户端重试，服务端就一定会去重', correct: false }
      ],
      explain: '幂等键的核心是「同键同 body 重放返回首次结果」「同键不同 body 冲突」；作用域避免跨租户碰撞；TTL 控制存储成本并定义重放窗口；没有实现与存储时，重试仍可能创建重复记录，这正是 S3 要补的。'
    },
    {
      id: 's2-l4-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '限流契约',
      prompt: '服务端对超限请求返回 429。为了让客户端能正确退避，响应至少还应包含什么？',
      question: '服务端对超限请求返回 429。为了让客户端能正确退避，响应至少还应包含什么？',
      options: [
        { text: '只返回 429，客户端自己猜', correct: false },
        { text: 'Retry-After 与稳定的限流错误码，并在文档中说明配额窗口', correct: true },
        { text: '返回 500，让客户端按服务端错误重试', correct: false },
        { text: '返回 200，把限流信息放在 body 里', correct: false }
      ],
      explain: '429 表示请求过多，客户端需要知道何时可以再试；Retry-After 给出秒数或 HTTP 日期；稳定错误码让 SDK 分支；文档说明窗口与配额。500 错误归因；200 会绕过监控与 SDK 的限流处理。具体限流算法不在本讲。'
    }
  ],
  exercises: [
    {
      id: 's2-l4-ex-1',
      kind: 'code',
      title: '游标分页',
      brief: '实现 paginate(items, { limit = 20, cursor } = {})。返回 { data, nextCursor }。排序为 createdAt 降序，相同 createdAt 按 id 降序。limit 必须是正整数，超过 100 按 100 处理。cursor 是 base64url 编码的 JSON { createdAt, id }，缺省表示第一页；nextCursor 在还有下一页时返回字符串，否则为 null。游标无法解码、结构不对或对应记录不存在时抛 InvalidCursorError。',
      hint: '先稳定排序，再按游标的 createdAt 与 id 找到位置，从下一条开始取。base64url 用手写字母表编解码，不要依赖 btoa/atob。下一页游标取本页最后一条记录。',
      starter: `class InvalidCursorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

function paginate(items, { limit = 20, cursor } = {}) {
  const sorted = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const start = cursor ? Number(cursor) : 0;
  const data = sorted.slice(start, start + limit);
  const nextCursor = start + limit < sorted.length ? String(start + limit) : null;
  return { data, nextCursor };
}`,
      solution: `class InvalidCursorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeCursor(payload) {
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const char of JSON.stringify(payload)) {
    buffer = (buffer << 8) | char.charCodeAt(0);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += ALPHABET[(buffer >> bits) & 63];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (6 - bits)) & 63];
  return out;
}

function decodeCursor(cursor) {
  let bits = 0;
  let buffer = 0;
  let text = '';
  for (const char of cursor) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new InvalidCursorError('invalid cursor');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      text += String.fromCharCode((buffer >> bits) & 255);
    }
    buffer &= (1 << bits) - 1;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidCursorError('invalid cursor');
  }
}

function paginate(items, { limit = 20, cursor } = {}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a positive integer');
  }
  const size = Math.min(limit, 100);
  const sorted = [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  let start = 0;
  if (cursor !== undefined) {
    const parsed = decodeCursor(cursor);
    if (!parsed || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      throw new InvalidCursorError('invalid cursor');
    }
    const index = sorted.findIndex(
      (item) => item.createdAt === parsed.createdAt && item.id === parsed.id
    );
    if (index === -1) throw new InvalidCursorError('cursor not found');
    start = index + 1;
  }

  const data = sorted.slice(start, start + size);
  const hasMore = start + size < sorted.length;
  const last = data[data.length - 1];
  return {
    data,
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  };
}`,
      tests: [
        {
          name: '第一页按时间与 id 稳定排序',
          code: `const items = [
  { id: 'a', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'b', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'c', createdAt: '2026-11-08T00:00:00.000Z' },
];
const first = paginate(items, { limit: 2 });
assert.deepEqual(first.data.map((item) => item.id), ['b', 'a']);
assert.ok(typeof first.nextCursor === 'string');
assert.ok(Number.isNaN(Number(first.nextCursor)));`
        },
        {
          name: '使用游标取下一页且不重复',
          code: `const items = [
  { id: 'a', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'b', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'c', createdAt: '2026-11-08T00:00:00.000Z' },
];
const first = paginate(items, { limit: 2 });
const second = paginate(items, { limit: 2, cursor: first.nextCursor });
assert.deepEqual(second.data.map((item) => item.id), ['c']);
assert.deepEqual(
  first.data.map((item) => item.id).filter((id) => second.data.some((item) => item.id === id)),
  []
);`
        },
        {
          name: '最后一页返回 null 游标',
          code: `const items = [
  { id: 'a', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'b', createdAt: '2026-11-08T00:00:00.000Z' },
];
const page = paginate(items, { limit: 2 });
assert.equal(page.data.length, 2);
assert.equal(page.nextCursor, null);`
        },
        {
          name: '非法游标抛 InvalidCursorError',
          code: `const items = [{ id: 'a', createdAt: '2026-11-09T00:00:00.000Z' }];
let error = null;
try {
  paginate(items, { cursor: '***' });
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof InvalidCursorError);
let structureError = null;
try {
  paginate(items, { cursor: 'e30' });
} catch (caught) {
  structureError = caught;
}
assert.ok(structureError instanceof InvalidCursorError);`
        },
        {
          name: '默认 limit 20 且上限 100',
          code: `const many = Array.from({ length: 120 }, (_, index) => ({
  id: String(119 - index).padStart(3, '0'),
  createdAt: '2026-11-09T00:00:00.000Z',
}));
assert.equal(paginate(many).data.length, 20);
const capped = paginate(many, { limit: 1000 });
assert.equal(capped.data.length, 100);
assert.ok(capped.nextCursor !== null);`
        },
        {
          name: '相同时间戳按 id 降序翻页不重复',
          code: `const items = [
  { id: 'a', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'b', createdAt: '2026-11-09T00:00:00.000Z' },
  { id: 'c', createdAt: '2026-11-09T00:00:00.000Z' },
];
const first = paginate(items, { limit: 1 });
const second = paginate(items, { limit: 1, cursor: first.nextCursor });
assert.equal(first.data[0].id, 'c');
assert.equal(second.data[0].id, 'b');`
        },
        {
          name: '空列表返回空数组与 null',
          code: `assert.deepEqual(paginate([]), { data: [], nextCursor: null });`
        }
      ]
    },
    {
      id: 's2-l4-ex-2',
      kind: 'design',
      title: 'LinkHub 第三方 API 契约',
      brief: 'LinkHub 要发布面向第三方的 v1 API，包含列表、创建、点击统计与 webhook 回调。当前没有分页上限、没有幂等键、限流只有一句文档、webhook 不签名。请给出对外契约与验收方案。',
      checklist: [
        '分页采用游标并定义稳定排序与上限',
        '过滤与排序字段使用白名单，非法字段返回 4xx',
        '幂等键的请求头、作用域、TTL、重放与冲突语义写清',
        '限流契约包含 429、Retry-After、配额头与客户端退避',
        'webhook 有签名、时间戳、重放窗口与幂等建议',
        'webhook 重试有上限与死信/停用策略',
        'OpenAPI 覆盖公开字段、状态码与错误码',
        '契约测试在 CI 中检查文档与实现漂移'
      ],
      reference: '<ul><li><strong>分页：</strong>游标含 createdAt 与 id，limit 默认 20、上限 100；过滤与排序字段白名单，非法字段 400/422。</li><li><strong>幂等：</strong>Idempotency-Key 作用域到租户与用户，同键同 body 返回首次结果，同键不同 body 返回 409；TTL 覆盖重试窗口。</li><li><strong>限流：</strong>超限 429 + Retry-After + rate_limited 错误码；响应头给窗口、剩余额度与重置时间；客户端加抖动退避。</li><li><strong>webhook：</strong>HMAC 签名覆盖时间戳与原始 body，时间窗限制重放，接收方按事件 ID 去重；重试指数退避，超过次数进死信并告警。</li><li><strong>OpenAPI：</strong>公开字段、状态码、错误码与示例进入文档；契约测试在 CI 中对比实现，漂移即失败。</li><li><strong>弃用：</strong>破坏性变更开新版本，旧版本标记并给迁移窗口，观察调用量后移除。</li></ul>'
    }
  ]
};
