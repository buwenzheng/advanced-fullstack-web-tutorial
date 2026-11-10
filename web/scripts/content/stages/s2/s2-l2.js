export const s2L2 = {
  id: 's2-l2',
  title: '输入校验与错误契约',
  subtitle: 'schema 校验、错误信封、可枚举错误码、4xx/5xx 边界与信息泄漏。',
  duration: 75,
  status: 'ready',
  objectives: [
    '区分语法、语义与业务三层校验，并把失败稳定映射到 4xx。',
    '实现零依赖的创建短链校验器，返回字段顺序稳定的错误列表。',
    '设计统一错误信封与可枚举错误码表，保证客户端可编程处理。',
    '区分 4xx 与 5xx，避免泄漏堆栈、SQL 与内部标识，并为校验写测试。'
  ],
  keywords: ['输入校验', 'schema', '错误信封', '错误码', '4xx', '5xx', 'requestId', '未知字段'],
  blocks: [
    {
      type: 'analogy',
      title: 'TypeScript 类型在运行时消失',
      html: '前端表单上，你把 <code>url</code> 标成 <code>string</code>，编辑器会提示类型错误；但用户按 F12 改一下请求，或者用 <code>curl</code> 直接发 JSON，类型系统完全不知情。TypeScript 只在编译期存在，HTTP 请求体到了服务端仍然是任意 JSON。<br>所以服务端必须再校验一次，而且要把失败变成调用方能处理的契约。类比失效的地方在于：前端校验是为了体验，能立刻提示；服务端校验是为了正确性与安全，面对的是不可信的任意客户端。'
    },
    {
      type: 'text',
      title: '三层校验',
      html: '语法层检查形状：字段是否存在、类型是否正确、字符串是否符合格式。语义层检查含义：结束时间必须晚于开始时间、分页上限不能超过 100、两个字段不能同时出现。业务层检查状态：短码是否已被占用、租户是否有权限、资源是否已删除。<br>三层失败通常都映射到 4xx，但错误码要区分：<code>invalid_type</code>、<code>invalid_format</code>、<code>invalid_length</code> 属于输入问题；<code>conflict</code> 属于业务状态冲突。真正的服务端异常才用 5xx，例如数据库连接失败、依赖超时。'
    },
    {
      type: 'table',
      title: '创建短链的校验规则',
      head: ['字段', '规则', '失败错误码', '说明'],
      rows: [
        ['url', '必填、字符串、可解析', 'required、invalid_type、invalid_url', '语法层'],
        ['url', '协议只能是 http 或 https', 'invalid_protocol', '安全边界'],
        ['slug', '可选、4-32 位小写字母数字连字符', 'invalid_format', '语法层'],
        ['slug', '不能是 api/admin/login/static/health', 'reserved', '路由与业务保留'],
        ['title', '可选、trim 后 1-120 字符', 'invalid_length', '语义层'],
        ['expiresAt', '可选、ISO 时间、严格晚于当前', 'invalid_datetime、expired', '语义层'],
        ['未知字段', '显式拒绝', 'unknown_field', '契约策略']
      ]
    },
    {
      type: 'code',
      title: '零依赖校验器：返回错误，不抛异常',
      lang: 'javascript',
      code: `const RESERVED = new Set(['api', 'admin', 'login', 'static', 'health']);
const KNOWN = ['url', 'slug', 'title', 'expiresAt'];

function validateCreateLink(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'invalid_type' }] };
  }
  const errors = [];
  const value = {};

  if (input.url === undefined) {
    errors.push({ field: 'url', code: 'required' });
  } else if (typeof input.url !== 'string') {
    errors.push({ field: 'url', code: 'invalid_type' });
  } else {
    const scheme = /^([a-z][a-z0-9+.-]*):\\/\\//i.exec(input.url);
    if (!scheme) {
      errors.push({ field: 'url', code: 'invalid_url' });
    } else if (!['http', 'https'].includes(scheme[1].toLowerCase())) {
      errors.push({ field: 'url', code: 'invalid_protocol' });
    } else if (!/^https?:\\/\\/[^\\s/?#]+/i.test(input.url)) {
      errors.push({ field: 'url', code: 'invalid_url' });
    } else {
      value.url = input.url;
    }
  }

  if (input.slug !== undefined) {
    if (typeof input.slug !== 'string') {
      errors.push({ field: 'slug', code: 'invalid_type' });
    } else if (RESERVED.has(input.slug)) {
      errors.push({ field: 'slug', code: 'reserved' });
    } else if (!/^[a-z0-9-]{4,32}$/.test(input.slug)) {
      errors.push({ field: 'slug', code: 'invalid_format' });
    } else {
      value.slug = input.slug;
    }
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string') {
      errors.push({ field: 'title', code: 'invalid_type' });
    } else {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 120) {
        errors.push({ field: 'title', code: 'invalid_length' });
      } else {
        value.title = title;
      }
    }
  }

  if (input.expiresAt !== undefined) {
    if (typeof input.expiresAt !== 'string') {
      errors.push({ field: 'expiresAt', code: 'invalid_type' });
    } else {
      const timestamp = Date.parse(input.expiresAt);
      if (Number.isNaN(timestamp)) {
        errors.push({ field: 'expiresAt', code: 'invalid_datetime' });
      } else if (timestamp <= now) {
        errors.push({ field: 'expiresAt', code: 'expired' });
      } else {
        value.expiresAt = input.expiresAt;
      }
    }
  }

  for (const field of Object.keys(input).filter((key) => !KNOWN.includes(key)).sort()) {
    errors.push({ field, code: 'unknown_field' });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}`,
      note: '校验器只做纯函数判断：不抛异常、不访问数据库、不读真实时间（now 注入），这样测试才稳定，错误映射也能单独测试。'
    },
    {
      type: 'code',
      title: '统一错误信封',
      lang: 'javascript',
      code: `// 入口中间件为每个请求生成并透传 requestId
function sendError(res, status, code, message, details) {
  const body = {
    error: {
      code,
      message,
      requestId: res.locals.requestId,
    },
  };
  if (details) body.error.details = details;
  res.status(status).json(body);
}

function sendValidationError(res, errors) {
  sendError(res, 422, 'validation_error', '请求参数不合法', errors);
}

function handleCreateLink(req, res) {
  const result = validateCreateLink(req.body, { now: Date.now() });
  if (!result.ok) return sendValidationError(res, result.errors);

  const created = repository.create(result.value);
  if (!created) {
    return sendError(res, 409, 'slug_conflict', '短码已被占用', [
      { field: 'slug', code: 'conflict' },
    ]);
  }
  res.status(201).location('/v1/links/' + created.id).json({ data: created });
}

// 兜底错误处理：对外只给稳定文案，内部细节进日志
function handleUnexpected(error, req, res, next) {
  logger.error({ requestId: res.locals.requestId, error });
  sendError(res, 500, 'internal_error', '服务暂时不可用，请稍后重试');
}`,
      note: '客户端按 code 编程，message 可以本地化与改文案；details 只放字段与原因，绝不放堆栈、SQL、连接串或内部异常对象。'
    },
    {
      type: 'table',
      title: '错误码到 HTTP 状态码',
      head: ['错误码', 'HTTP', '可重试', '典型场景'],
      rows: [
        ['validation_error', '400 或 422', '否', '字段缺失、格式错误、语义不满足'],
        ['unauthorized', '401', '否', '缺少或过期的凭证'],
        ['forbidden', '403', '否', '已认证但无权限'],
        ['not_found', '404', '否', '资源不存在或无权可见'],
        ['slug_conflict', '409', '否（换 slug）', '唯一约束冲突'],
        ['rate_limited', '429', '是', '超过配额，按 Retry-After 等待'],
        ['internal_error', '500', '是（有上限）', '未预期异常'],
        ['service_unavailable', '503', '是', '依赖不可用或维护']
      ],
      note: '400 与 422 的取舍要在全站契约中固定；同一 API 里混用会让 SDK 分支不可预测。'
    },
    {
      type: 'pitfall',
      title: '错误边界失控',
      html: '现象：前端只能显示「请求失败」；支持团队拿不到 requestId；同一份非法请求有时返回 400，有时返回 500；安全扫描发现响应里带 SQL 片段。<br>原因：把校验异常直接抛到兜底处理器变成 500；把 <code>error.message</code> 或 ORM 异常原样序列化；未知字段被静默丢弃，调用方以为字段生效；错误列表按对象键遍历，顺序随输入漂移。<br>发现方式：契约测试断言状态码与错误码；日志搜索 <code>error.stack</code> 是否进入响应；用同一请求重复发送，比较错误顺序。<br>修复：先加错误映射层，把已知校验错误转成 4xx；再关闭对外堆栈输出；补契约测试。<br>预防：错误码表进入评审；统一错误中间件；测试覆盖「无泄漏」断言。'
    },
    {
      type: 'steps',
      title: '请求处理流水线',
      steps: [
        { title: '解析请求体', html: '限制 body 大小与 Content-Type；JSON 解析失败返回 400。观察点：解析错误与业务校验错误可区分。' },
        { title: '执行校验', html: '运行纯函数校验器，得到结构化错误列表。观察点：错误包含 field 与 code，不包含内部异常。' },
        { title: '映射错误', html: '把校验错误映射为 422，把业务冲突映射为 409。观察点：同一错误在第一层就被归类，不落到 500。' },
        { title: '记录日志', html: '记录 requestId、错误码、字段路径与耗时；不记录敏感值。观察点：能用 requestId 找回完整链路。' },
        { title: '返回响应', html: '按错误信封输出；成功时只返回公开字段。观察点：响应体与 OpenAPI 一致。' }
      ]
    },
    {
      type: 'compare',
      title: '手写校验 vs schema 库',
      cols: [
        {
          title: '手写校验',
          items: ['依赖：零依赖，完全可控', '错误信息：需要自己设计字段与顺序', '性能：通常更轻，但差异取决于实现', '可组合性：重复规则容易复制粘贴', '学习成本：低，机制透明', '适用：规则少、需要精细控制错误码']
        },
        {
          title: 'schema 库（zod/Joi 等）',
          items: ['依赖：引入第三方包与版本升级成本', '错误信息：需要把库的错误结构映射成契约', '性能：有解析与构建开销，需实测', '可组合性：复用 schema 与类型推导方便', '学习成本：中，团队要统一写法', '适用：端点多、规则复杂、需要类型联动']
        }
      ],
      note: '课程用手写实现讲机制，不代表生产必须手写；选库时同样要固定错误码与顺序，不能让库的默认文案成为公开契约。'
    },
    {
      type: 'text',
      title: '深挖：错误契约的演进',
      html: '错误码也是公开 API。新增错误码通常兼容，但客户端必须有兜底分支；删除或重命名错误码是破坏性变更。给错误加 <code>retryable</code> 标记能让 SDK 统一决定是否重试，但服务端要保证这个标记可信：校验错误标成可重试会制造无效流量。<code>details</code> 的形状也要固定，例如数组项只含 <code>field</code> 与 <code>code</code>，否则每个接口各写一套，客户端仍然要解析文案。<br>国际化把 <code>message</code> 本地化，<code>code</code> 保持不变；日志记录内部细节，响应只给可行动信息。版本升级时，先并行输出旧码与新码并观察调用方，再移除旧码，最后把迁移写进变更记录。',
      note: '正文不绑定某个错误格式标准；重点是把错误当契约维护，而不是当调试信息透传。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「400 与 422 怎么选」没有唯一答案，关键是全站一致：有的团队把所有输入问题都归 400；有的团队把语法错误归 400、语义错误归 422。回答时要说明选择依据、客户端如何分支、如何避免同一错误在不同接口漂移。<br>「错误信息给多细」按调用方分层：公开 API 给字段路径与稳定 code；内部服务可以多给上下文，但仍要脱敏。任何时候都不要把堆栈、SQL、连接串、密钥或内部 ID 返回给不可信调用方。'
    }
  ],
  checks: [
    {
      id: 's2-l2-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '状态码边界',
      prompt: '创建短链时 expiresAt 是一个格式正确、但早于当前时间的 ISO 字符串。最合适的响应是什么？',
      question: '创建短链时 expiresAt 是一个格式正确、但早于当前时间的 ISO 字符串。最合适的响应是什么？',
      options: [
        { text: '200，响应体 { success: false, message: "过期时间不能早于当前时间" }', correct: false },
        { text: '400 或 422，错误码 validation_error，details 指出 expiresAt 字段', correct: true },
        { text: '500，因为服务端无法处理这个时间', correct: false },
        { text: '201，先创建再让定时任务清理', correct: false }
      ],
      explain: '格式正确但语义不满足要求，属于调用方输入错误，应是 4xx；用 200 会让监控与重试策略失效；500 把责任推给服务端并触发误告警；先创建再清理会产生不可见脏数据。400 与 422 的选择要在契约中固定，不能同一 API 内混用。'
    },
    {
      id: 's2-l2-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '错误信封',
      prompt: '一个可供第三方编程处理的错误响应，应该满足哪些要求？',
      question: '一个可供第三方编程处理的错误响应，应该满足哪些要求？',
      options: [
        { text: '有稳定的机器可读错误码', correct: true },
        { text: '有贯穿日志与响应的 requestId', correct: true },
        { text: '把数据库堆栈与 SQL 放进 message 便于排查', correct: false },
        { text: '校验错误能指出出错字段', correct: true },
        { text: '所有错误都返回 HTTP 200，靠 body 区分', correct: false }
      ],
      explain: '错误码让客户端分支稳定；requestId 把用户报障与服务端日志串起来；堆栈与 SQL 泄漏内部结构；字段级 details 让表单能定位；HTTP 状态码是网关、监控与 SDK 的共同语言，不能被 body 替代。'
    },
    {
      id: 's2-l2-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '未知字段策略',
      prompt: '公开 API 的创建接口收到一个未定义的字段 color。以下哪种处理最符合「契约可验证」？',
      question: '公开 API 的创建接口收到一个未定义的字段 color。以下哪种处理最符合「契约可验证」？',
      options: [
        { text: '静默忽略，保证向后兼容', correct: false },
        { text: '写入数据库的扩展字段，避免报错', correct: false },
        { text: '返回 4xx validation_error，details 指出 color 为未知字段，并在文档中写明该策略', correct: true },
        { text: '返回 500，因为这属于服务端未实现的字段', correct: false }
      ],
      explain: '静默忽略会让调用方误以为字段生效，是隐蔽的契约破坏；写入扩展字段绕过校验并污染数据；500 错误归因；显式拒绝并文档化，能让调用方在集成阶段就发现问题，也让契约测试可断言。若产品确实需要宽松策略，必须统一声明并测试，不能逐接口漂移。'
    }
  ],
  exercises: [
    {
      id: 's2-l2-ex-1',
      kind: 'code',
      title: '创建短链的校验器',
      brief: '实现 validateCreateLink(input, { now = Date.now() } = {})。成功返回 { ok: true, value }，value 只包含已知字段 url、slug、title、expiresAt。失败返回 { ok: false, errors }，每项 { field, code }；顺序固定：先按 url、slug、title、expiresAt 的规则顺序，再按字段名字典序追加未知字段错误。url 必填、字符串、可被 new URL 解析、协议只能是 http 或 https；slug 可选、4-32 位小写字母数字连字符、保留字 api/admin/login/static/health 不允许；title 可选、trim 后 1-120 字符；expiresAt 可选、可解析的 ISO 字符串且严格晚于注入的 now；未知字段产生 unknown_field，不得进入 value。不做 trim 之外的隐式转换。',
      hint: '先收集已知字段错误，再统一处理未知字段并排序。URL 用 new URL 并检查 protocol；时间用 Date.parse 与注入的 now 比较；只有合法字段才写入 value。',
      starter: `function validateCreateLink(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: [{ field: 'body', code: 'invalid_type' }] };
  }
  if (!input.url) {
    return { ok: false, errors: [{ field: 'url', code: 'required' }] };
  }
  return { ok: true, value: input };
}`,
      solution: `const RESERVED = new Set(['api', 'admin', 'login', 'static', 'health']);
const KNOWN = ['url', 'slug', 'title', 'expiresAt'];

function validateCreateLink(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [{ field: 'body', code: 'invalid_type' }] };
  }
  const errors = [];
  const value = {};

  if (input.url === undefined) {
    errors.push({ field: 'url', code: 'required' });
  } else if (typeof input.url !== 'string') {
    errors.push({ field: 'url', code: 'invalid_type' });
  } else {
    const scheme = /^([a-z][a-z0-9+.-]*):\\/\\//i.exec(input.url);
    if (!scheme) {
      errors.push({ field: 'url', code: 'invalid_url' });
    } else if (!['http', 'https'].includes(scheme[1].toLowerCase())) {
      errors.push({ field: 'url', code: 'invalid_protocol' });
    } else if (!/^https?:\\/\\/[^\\s/?#]+/i.test(input.url)) {
      errors.push({ field: 'url', code: 'invalid_url' });
    } else {
      value.url = input.url;
    }
  }

  if (input.slug !== undefined) {
    if (typeof input.slug !== 'string') {
      errors.push({ field: 'slug', code: 'invalid_type' });
    } else if (RESERVED.has(input.slug)) {
      errors.push({ field: 'slug', code: 'reserved' });
    } else if (!/^[a-z0-9-]{4,32}$/.test(input.slug)) {
      errors.push({ field: 'slug', code: 'invalid_format' });
    } else {
      value.slug = input.slug;
    }
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string') {
      errors.push({ field: 'title', code: 'invalid_type' });
    } else {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 120) {
        errors.push({ field: 'title', code: 'invalid_length' });
      } else {
        value.title = title;
      }
    }
  }

  if (input.expiresAt !== undefined) {
    if (typeof input.expiresAt !== 'string') {
      errors.push({ field: 'expiresAt', code: 'invalid_type' });
    } else {
      const timestamp = Date.parse(input.expiresAt);
      if (Number.isNaN(timestamp)) {
        errors.push({ field: 'expiresAt', code: 'invalid_datetime' });
      } else if (timestamp <= now) {
        errors.push({ field: 'expiresAt', code: 'expired' });
      } else {
        value.expiresAt = input.expiresAt;
      }
    }
  }

  for (const field of Object.keys(input).filter((key) => !KNOWN.includes(key)).sort()) {
    errors.push({ field, code: 'unknown_field' });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}`,
      tests: [
        {
          name: '合法输入通过并 trim 标题',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const result = validateCreateLink({
  url: 'https://example.com/a',
  slug: 'promo-2026',
  title: '  Spring Sale  ',
  expiresAt: '2026-11-10T00:00:00.000Z',
}, { now });
assert.equal(result.ok, true);
assert.equal(result.value.title, 'Spring Sale');
assert.deepEqual(Object.keys(result.value).sort(), ['expiresAt', 'slug', 'title', 'url']);`
        },
        {
          name: '缺少 url 返回 required',
          code: `const result = validateCreateLink({ slug: 'promo-2026' }, { now: 0 });
assert.equal(result.ok, false);
assert.deepEqual(result.errors, [{ field: 'url', code: 'required' }]);`
        },
        {
          name: '非法协议与不可解析 URL 区分错误码',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const protocol = validateCreateLink({ url: 'ftp://example.com/x' }, { now });
assert.equal(protocol.errors[0].code, 'invalid_protocol');
const malformed = validateCreateLink({ url: 'not a url' }, { now });
assert.equal(malformed.errors[0].code, 'invalid_url');`
        },
        {
          name: '保留字与格式错误的 slug 被拒绝',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const reserved = validateCreateLink({ url: 'https://example.com', slug: 'admin' }, { now });
assert.equal(reserved.errors[0].code, 'reserved');
const short = validateCreateLink({ url: 'https://example.com', slug: 'ab' }, { now });
assert.equal(short.errors[0].code, 'invalid_format');
const upper = validateCreateLink({ url: 'https://example.com', slug: 'Bad_Slug' }, { now });
assert.equal(upper.errors[0].code, 'invalid_format');`
        },
        {
          name: '过期时间等于或早于注入的 now 被拒绝',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const equal = validateCreateLink({ url: 'https://example.com', expiresAt: '2026-11-09T00:00:00.000Z' }, { now });
assert.equal(equal.errors[0].code, 'expired');
const earlier = validateCreateLink({ url: 'https://example.com', expiresAt: '2026-11-08T23:59:59.000Z' }, { now });
assert.equal(earlier.errors[0].code, 'expired');
const bad = validateCreateLink({ url: 'https://example.com', expiresAt: 'tomorrow' }, { now });
assert.equal(bad.errors[0].code, 'invalid_datetime');`
        },
        {
          name: '未知字段被拒绝且不进入 value',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const result = validateCreateLink({ url: 'https://example.com', zeta: 1, alpha: 2 }, { now });
assert.equal(result.ok, false);
assert.deepEqual(result.errors.map((item) => item.field), ['alpha', 'zeta']);
assert.deepEqual(result.errors.map((item) => item.code), ['unknown_field', 'unknown_field']);
assert.equal(result.value, undefined);`
        },
        {
          name: '多个字段非法时错误顺序稳定',
          code: `const now = Date.parse('2026-11-09T00:00:00.000Z');
const result = validateCreateLink({
  slug: 'x',
  title: 'x'.repeat(121),
  expiresAt: '2026-11-08T00:00:00.000Z',
  zeta: 1,
  alpha: 2,
}, { now });
assert.deepEqual(
  result.errors.map((item) => item.field),
  ['url', 'slug', 'title', 'expiresAt', 'alpha', 'zeta']
);`
        }
      ]
    },
    {
      id: 's2-l2-ex-2',
      kind: 'design',
      title: 'LinkHub 错误码表',
      brief: 'LinkHub 要发布第一版错误码表，供 Web、移动端与第三方 SDK 共用。当前每个接口各自返回 { message }，有的接口校验失败返回 500，有的返回 200。请给出错误信封、错误码表、状态码映射、日志与测试方案。',
      checklist: [
        '定义统一错误信封，字段含义与可选性写清',
        '错误码可枚举、命名稳定，不把 message 当判断依据',
        '为每个错误码标注 HTTP 状态码与是否可重试',
        '区分配置/校验/认证/权限/冲突/限流/内部错误',
        '规定未知字段、错误顺序与 details 形状',
        '规定 requestId 的生成、回传与日志关联方式',
        '规定对外 message 的信息边界，禁止堆栈/SQL/内部 ID',
        '给出契约测试：状态码、code、字段路径、无泄漏'
      ],
      reference: '<ul><li><strong>信封：</strong>error 对象固定 code、message、requestId，details 可选；details 只放字段与原因。</li><li><strong>错误码：</strong>按域前缀或固定枚举，保持稳定；message 允许本地化，code 不允许随文案变化。</li><li><strong>状态码：</strong>校验 400 或 422（全站固定其一）；401/403/404/409/429/500/503 各归其位；429 与 503 标注可重试。</li><li><strong>未知字段：</strong>显式拒绝并文档化；错误顺序固定，测试可断言。</li><li><strong>requestId：</strong>入口生成或透传上游 ID，响应与日志都带；日志不记录敏感值。</li><li><strong>信息边界：</strong>对外只给稳定、可行动的文案；堆栈、SQL、连接串、内部 ID 只进内部日志。</li><li><strong>测试：</strong>契约测试断言状态码、code、字段路径，并扫描响应体确保不含堆栈与 SQL 片段。</li></ul>'
    }
  ]
};
