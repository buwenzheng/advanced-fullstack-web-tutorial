export const s2L1 = {
  id: 's2-l1',
  title: '资源建模与 HTTP 语义',
  subtitle: '资源与动词、方法与状态码、版本化与弃用策略，以及 LinkHub 资源树。',
  duration: 75,
  status: 'ready',
  objectives: [
    '把 LinkHub 的业务能力拆成资源树，为每个端点写出方法、路径、成功状态码与主要错误码。',
    '判断 HTTP 方法是否安全、是否幂等，据此决定能否缓存、能否自动重试。',
    '为公开 API 选择版本化与弃用策略，区分破坏性变更与兼容性变更。',
    '实现路由匹配器，正确处理静态段、参数段、方法不匹配、URL 解码与重复参数名。'
  ],
  keywords: ['REST', '资源建模', 'HTTP 方法', '幂等', '状态码', '版本化', '弃用', '路由匹配'],
  blocks: [
    {
      type: 'analogy',
      title: '组件 props vs 公开 API',
      html: '你在维护一个组件库：内部把 props 从 <code>url</code> 改名为 <code>targetUrl</code>，只要同步改完仓库里的调用点，构建就能通过。公开 API 没有这样一个仓库：第三方可能在任何语言、任何时间调用它。你删掉一个字段，对方的生产环境才会在半夜报错。<br>所以内部实现可以重构，公开契约只能演进：先新增、再迁移、最后移除。类比失效的地方在于，组件库能看到所有调用方，API 不能；你只能靠版本、文档、弃用通知与契约测试来管理未知。'
    },
    {
      type: 'text',
      title: '资源与动作',
      html: '资源是能被稳定命名的东西：一条链接、一组链接、一条链接的点击记录。集合用复数路径 <code>/v1/links</code>，单体用 <code>/v1/links/:id</code>，子资源用 <code>/v1/links/:id/clicks</code>。方法表达动作，路径只负责定位。<br>确实没有合适名词的操作可以是动作型端点的例外，比如一次性校验一批导入文件；但只要能表达为资源状态变化，就优先用资源。动作型端点要单独设计幂等与重试，因为它通常不是幂等的。'
    },
    {
      type: 'flow',
      title: '从业务故事到端点',
      steps: [
        { name: '写出用户故事', detail: '运营要创建一条短链并拿到可分享的地址。输入：目标 URL 与可选短码；输出：可访问的短链。失败表现：只讨论技术，不写清楚谁在什么条件下成功。' },
        { name: '找稳定名词', detail: '「链接」是资源，集合是 <code>links</code>；点击记录是它的子资源。失败表现：把「创建」当成资源，得到 <code>/createLink</code>。' },
        { name: '选方法与成功码', detail: '创建用 <code>POST /v1/links</code>，成功 <code>201</code> 并返回 <code>Location</code>。失败表现：用 GET 创建，或成功也返回 200 且无资源位置。' },
        { name: '枚举失败', detail: 'URL 非法返回 400 或 422，短码冲突返回 409，未认证 401。失败表现：所有失败都 500，调用方无法区分该改请求还是该重试。' },
        { name: '写契约测试', detail: '断言状态码、响应字段与错误码，放进 CI。失败表现：只有手写文档，实现与文档逐渐分叉。' }
      ]
    },
    {
      type: 'table',
      title: 'LinkHub 资源树',
      head: ['方法', '路径', '成功状态码', '主要错误码', '说明'],
      rows: [
        ['GET', '/v1/links', '200', '401、403', '列出当前租户的链接'],
        ['POST', '/v1/links', '201', '400、409、422', '创建短链，返回 Location'],
        ['GET', '/v1/links/:id', '200', '401、403、404', '读取单条链接'],
        ['PATCH', '/v1/links/:id', '200', '400、403、404、409', '修改目标地址或状态'],
        ['DELETE', '/v1/links/:id', '204', '401、403、404', '删除链接'],
        ['GET', '/v1/links/:id/clicks', '200', '401、403、404', '点击统计子资源'],
        ['GET', '/:slug', '302', '404、410', '公开跳转，不带版本前缀']
      ],
      note: '跳转路径不带 /v1：它是面向最终用户的短链，不是管理 API；目标可修改，所以用 302 而不是可被长期缓存的 301。'
    },
    {
      type: 'table',
      title: 'HTTP 方法与语义',
      head: ['方法', '安全', '幂等', '典型用途', '缓存与自动重试'],
      rows: [
        ['GET', '是', '是', '读取资源', '可缓存；可安全重试'],
        ['HEAD', '是', '是', '只取元数据', '可缓存；可安全重试'],
        ['POST', '否', '否', '创建或提交', '默认不缓存；重试需要幂等键'],
        ['PUT', '否', '是', '整体替换资源', '可重试；结果应一致'],
        ['PATCH', '否', '取决于补丁语义', '部分更新', '「设为某值」可重试，「追加」不可'],
        ['DELETE', '否', '是', '删除资源', '可重试；第二次可能返回 404 或 204']
      ],
      note: '幂等描述的是多次执行后的资源状态，不是响应码完全相同；是否缓存还要看响应头与中间层配置。'
    },
    {
      type: 'code',
      title: '路由匹配器：命中、405 与解码',
      lang: 'javascript',
      code: `const routes = [
  { method: 'GET', path: '/v1/links/:id' },
  { method: 'GET', path: '/v1/links/:id/clicks' },
  { method: 'PATCH', path: '/v1/links/:id' },
];

function splitPath(path) {
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return normalized.split('/').slice(1);
}

function matchOne(routePath, segments) {
  const parts = routePath.split('/').slice(1);
  if (parts.length !== segments.length) return null;
  const params = {};
  const names = new Set();
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.startsWith(':')) {
      const name = part.slice(1);
      if (names.has(name)) throw new Error('duplicate param: ' + name);
      names.add(name);
      if (!segments[index]) return null;
      params[name] = decodeURIComponent(segments[index]);
    } else if (part !== segments[index]) {
      return null;
    }
  }
  return params;
}

function resolve(routes, method, path) {
  const segments = splitPath(path);
  const pathMatches = [];
  let hit = null;
  try {
    for (const route of routes) {
      const params = matchOne(route.path, segments);
      if (!params) continue;
      pathMatches.push(route);
      if (route.method === method.toUpperCase()) hit = { route, params };
    }
  } catch (error) {
    if (error instanceof URIError) return { error: 'bad_request' };
    throw error;
  }
  if (hit) return hit;
  if (pathMatches.length > 0) {
    const allowed = [...new Set(pathMatches.map((route) => route.method))].sort();
    return { error: 'method_not_allowed', allowed };
  }
  return { error: 'not_found' };
}`,
      note: '真实路由器还要处理静态段优先（/links/me 与 /links/:id 同时匹配）、通配符与大小写策略；这里保留契约所需的最小机制：先判断路径，再判断方法，最后才决定 404 还是 405。'
    },
    {
      type: 'pitfall',
      title: 'URL 动词与状态码滥用',
      html: '现象：第三方接入后大量请求返回 200，但业务实际失败；网关重试把一次创建变成三条记录；客户端收到 404 时无法判断是资源不存在还是路径写错。<br>原因：把动作写进路径（<code>POST /deleteLink</code>）导致无法用方法与资源表达语义；所有响应都 200 让监控、SDK 与重试策略失效；校验失败返回 500 把调用方错误算到服务端；405 不带 <code>Allow</code>，调用方只能猜。<br>发现方式：契约测试断言状态码与错误码；访问日志按状态码聚合；SDK 里出现大量「解析 body 才知道失败」的分支。<br>修复：先为新端点建立正确语义，再逐步弃用旧端点并双写响应；不要直接删除旧路径。<br>预防：端点表进入评审；每个端点至少有一个状态码测试；错误响应遵循统一契约（下一讲展开）。'
    },
    {
      type: 'steps',
      title: '设计一条新端点',
      steps: [
        { title: '明确调用方与目标', html: '谁调用、拿什么、成功后做什么。例如第三方要分页读取点击统计，用于自己的报表。观察点：能用一句话说清输入输出。' },
        { title: '定位资源', html: '统计属于 <code>/v1/links/:id/clicks</code>，不是 <code>/getClicks</code>。观察点：路径里只有名词。' },
        { title: '选方法', html: '只读用 GET；它安全、幂等、可缓存，失败可直接重试。观察点：方法语义与副作用一致。' },
        { title: '定成功码与响应形状', html: '成功 200，返回 <code>{ data, nextCursor }</code>；分页细节在 API 工程化一讲展开。观察点：字段名与类型能写进 OpenAPI。' },
        { title: '列失败码', html: '未认证 401、无权限 403、链接不存在 404、参数非法 400/422。观察点：每种失败都有可编程错误码。' },
        { title: '写契约测试', html: '至少覆盖成功、401、404 与一个非法参数。观察点：测试失败时能指出契约哪一条被破坏。' }
      ]
    },
    {
      type: 'compare',
      title: '版本化策略',
      cols: [
        {
          title: 'URL 前缀（/v1）',
          items: ['可见性：日志、文档、网关一眼可见', '缓存与路由：按前缀分流最直接', '实现成本：低，框架路由天然支持', '迁移：需要并行部署两套前缀', '客户端改动：显式改地址', '适用：公开 API、多版本长期并存']
        },
        {
          title: '自定义 Header',
          items: ['可见性：日志里需要额外记录', '缓存与路由：网关要读头，CDN 缓存键更复杂', '实现成本：中，需统一中间件', '迁移：地址不变，客户端改头', '客户端改动：隐蔽，容易漏配', '适用：内部服务、需要保持 URL 稳定']
        },
        {
          title: '查询参数（?version=）',
          items: ['可见性：URL 可见但容易被复制丢失', '缓存与路由：缓存键天然包含参数', '实现成本：低，但每个端点都要解析', '迁移：混在业务参数里，边界模糊', '客户端改动：小，但容易与其他参数冲突', '适用：过渡期、少量端点']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：契约稳定性',
      html: '兼容性不由你声明，而由客户端行为决定。新增响应字段通常兼容，前提是客户端忽略未知字段；新增可选请求参数通常兼容；新增错误码需要客户端有兜底分支；枚举新增值对「穷举所有值」的客户端有风险，要提前通知。<br>破坏性变更包括：删除或重命名字段、修改字段类型、修改字段含义、把可选请求字段改为必填、改变默认值、改变排序或分页语义、收紧紧格校验。版本号只给你并行维护的窗口，不替代兼容性设计。弃用要走完整流程：标记、通知、观察调用量、给迁移文档、到期移除；<code>Sunset</code> 与 <code>Deprecation</code> 响应头能让自动化客户端更早发现。',
      note: '正文只讲策略，不绑定某个网关的版本路由实现。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「REST 与 RPC 怎么选」不要背口号。先看调用方与演进方式：资源稳定、缓存与通用工具重要时，资源风格更省心；动作复杂、跨多个资源、需要强类型契约时，RPC 风格可能更直接。很多系统是混合的：管理面用资源风格，内部高频调用用 RPC。<br>「404 与 403 怎么分」先看是否愿意暴露资源存在性：已认证但无权限通常 403；为了避免枚举资源，也可以对无权访问返回 404，但要在契约中统一，不能同一接口两种行为。'
    }
  ],
  checks: [
    {
      id: 's2-l1-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '资源建模',
      prompt: '运营需要「把一批链接一次性归档」。以下哪种端点设计最符合资源建模与可演进性？',
      question: '运营需要「把一批链接一次性归档」。以下哪种端点设计最符合资源建模与可演进性？',
      options: [
        { text: 'POST /v1/archiveLinks，body 里放 id 数组', correct: false },
        { text: 'POST /v1/links/bulk-archive，把批量动作显式建模为动作端点', correct: false },
        { text: 'PATCH /v1/links，body 里放 id 数组与 status', correct: true },
        { text: 'GET /v1/links?action=archive&ids=...', correct: false }
      ],
      explain: '归档改变的是每个链接的 status 字段，PATCH /links 以资源集合为目标、幂等且可重试；A 把动词塞进路径且非幂等；B 是动作型端点的合法例外，但能表达为资源状态变更时优先用资源；D 用 GET 产生副作用，违反安全方法语义。批量操作在真实系统中还要考虑逐条结果与部分失败，这属于后续工程化内容。'
    },
    {
      id: 's2-l1-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '方法语义',
      prompt: '关于 HTTP 方法的安全性与幂等性，以下哪些说法正确？',
      question: '关于 HTTP 方法的安全性与幂等性，以下哪些说法正确？',
      options: [
        { text: 'GET 是安全方法，不应产生业务副作用', correct: true },
        { text: 'PUT 是幂等方法，重复发送同一个请求的结果与发送一次相同', correct: true },
        { text: 'POST 既不安全也不幂等，重复提交可能创建多条记录', correct: true },
        { text: 'DELETE 是幂等方法，因此重复删除必须始终返回 200', correct: false },
        { text: 'PATCH 一定是幂等的，所以可以无条件自动重试', correct: false }
      ],
      explain: '安全指不改变服务端状态；幂等指多次执行的效果与一次相同，不代表响应码相同。DELETE 第二次可能返回 404 或 204，取决于契约，但资源状态一致；PATCH 是否幂等取决于补丁语义（例如「追加」不幂等）。POST 非幂等正是创建接口需要幂等键的原因。'
    },
    {
      id: 's2-l1-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '契约变更',
      prompt: 'LinkHub 的 POST /v1/links 已在第三方使用。以下哪项最可能构成破坏性变更？',
      question: 'LinkHub 的 POST /v1/links 已在第三方使用。以下哪项最可能构成破坏性变更？',
      options: [
        { text: '在响应里新增一个 lastVisitedAt 字段', correct: false },
        { text: '新增一个可选的查询参数 fields', correct: false },
        { text: '把请求体中的 url 从可选改为必填', correct: true },
        { text: '给响应中的 status 枚举新增一个 archived 值', correct: false }
      ],
      explain: '新增响应字段与可选参数通常兼容（客户端应忽略未知字段）；枚举新增值对「穷举所有值」的客户端有风险，但通常可接受并需要通知；把可选请求字段改为必填会让现有合法请求立刻失败，是最典型的破坏性变更。删除字段、改类型、改字段含义同属破坏性变更。'
    }
  ],
  exercises: [
    {
      id: 's2-l1-ex-1',
      kind: 'code',
      title: '路由匹配器',
      brief: '实现 matchRoute(routes, method, path)。routes 是 { method, path } 数组，path 可含 :param 参数段。命中返回 { route, params }，params 的值为 decodeURIComponent 后的字符串。路径能匹配但方法不匹配时返回 { error: "method_not_allowed", allowed }，allowed 去重后按字母序排列；路径不存在返回 { error: "not_found" }。方法比较不区分大小写；忽略末尾单个斜杠（根路径除外）；段数必须相等；参数段不能为空。同一路由参数名重复时抛出 Error，消息包含 duplicate param。非法百分号编码导致解码失败时返回 { error: "bad_request" }。',
      hint: '先把路径分段并匹配出所有路径候选，再在这些候选里找方法；不要先按方法过滤，否则无法区分 404 与 405。解码用 try/catch 捕获 URIError。',
      starter: `function matchRoute(routes, method, path) {
  const segments = path.split('/').slice(1);
  for (const route of routes) {
    const parts = route.path.split('/').slice(1);
    if (parts.length !== segments.length) continue;
    if (route.method !== method) continue;
    const params = {};
    let ok = true;
    for (let index = 0; index < parts.length; index += 1) {
      if (parts[index].startsWith(':')) {
        params[parts[index].slice(1)] = segments[index];
      } else if (parts[index] !== segments[index]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return { error: 'not_found' };
}`,
      solution: `function normalizePath(path) {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function matchRoute(routes, method, path) {
  const segments = normalizePath(path).split('/').slice(1);
  const wanted = method.toUpperCase();
  const pathMatches = [];
  let hit = null;
  try {
    for (const route of routes) {
      const parts = route.path.split('/').slice(1);
      const names = new Set();
      for (const part of parts) {
        if (!part.startsWith(':')) continue;
        const name = part.slice(1);
        if (names.has(name)) throw new Error('duplicate param: ' + name);
        names.add(name);
      }
      if (parts.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (part.startsWith(':')) {
          if (!segments[index]) {
            ok = false;
            break;
          }
          params[part.slice(1)] = decodeURIComponent(segments[index]);
        } else if (part !== segments[index]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      pathMatches.push(route);
      if (route.method.toUpperCase() === wanted) hit = { route, params };
    }
  } catch (error) {
    if (error instanceof URIError) return { error: 'bad_request' };
    throw error;
  }
  if (hit) return hit;
  if (pathMatches.length > 0) {
    const allowed = [...new Set(pathMatches.map((route) => route.method.toUpperCase()))].sort();
    return { error: 'method_not_allowed', allowed };
  }
  return { error: 'not_found' };
}`,
      tests: [
        {
          name: '静态路径命中且参数为空',
          code: `const routes = [
  { method: 'GET', path: '/v1/links' },
  { method: 'POST', path: '/v1/links' },
];
const result = matchRoute(routes, 'GET', '/v1/links');
assert.equal(result.error, undefined);
assert.equal(result.route.method, 'GET');
assert.deepEqual(result.params, {});`
        },
        {
          name: '参数段被解码',
          code: `const routes = [{ method: 'GET', path: '/v1/links/:id/clicks' }];
const result = matchRoute(routes, 'GET', '/v1/links/a%20b/clicks');
assert.equal(result.error, undefined);
assert.equal(result.params.id, 'a b');`
        },
        {
          name: '方法不匹配返回 405 与允许的方法',
          code: `const routes = [
  { method: 'GET', path: '/v1/links/:id' },
  { method: 'POST', path: '/v1/links/:id' },
  { method: 'PATCH', path: '/v1/links/:id' },
];
const result = matchRoute(routes, 'PUT', '/v1/links/42');
assert.equal(result.error, 'method_not_allowed');
assert.deepEqual(result.allowed, ['GET', 'PATCH', 'POST']);`
        },
        {
          name: '路径不存在返回 404 而不是 405',
          code: `const routes = [{ method: 'GET', path: '/v1/links/:id' }];
const result = matchRoute(routes, 'DELETE', '/v1/users/42');
assert.equal(result.error, 'not_found');
assert.equal(result.allowed, undefined);`
        },
        {
          name: '尾斜杠与方法大小写可命中',
          code: `const routes = [
  { method: 'GET', path: '/v1/links' },
  { method: 'GET', path: '/v1/links/:id' },
];
const collection = matchRoute(routes, 'get', '/v1/links/');
const item = matchRoute(routes, 'get', '/v1/links/42/');
assert.deepEqual(collection.params, {});
assert.equal(item.params.id, '42');`
        },
        {
          name: '重复参数报错且非法编码返回 400',
          code: `let error = null;
try {
  matchRoute([{ method: 'GET', path: '/v1/links/:id/:id' }], 'GET', '/v1/links/1/2');
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof Error);
assert.ok(error.message.includes('duplicate param'));
const bad = matchRoute([{ method: 'GET', path: '/v1/links/:id' }], 'GET', '/v1/links/%E0%A4%A');
assert.equal(bad.error, 'bad_request');`
        }
      ]
    },
    {
      id: 's2-l1-ex-2',
      kind: 'design',
      title: 'LinkHub 资源树与版本化',
      brief: 'LinkHub 要从内部脚本升级为第三方可用的公开 API。现有端点包括创建短链、跳转、列表、编辑、删除、查看点击统计；内部实现有 POST /createLink、GET /getLinks、POST /deleteLink 这类风格。请给出资源树、方法、状态码、版本化与弃用方案。',
      checklist: [
        '列出资源树，集合与单体路径成对出现',
        '每个端点标注方法、成功状态码与至少两个错误码',
        '区分安全方法与幂等方法的缓存/重试策略',
        '跳转端点说明为什么用 302 而不是 301',
        '说明版本化位置（URL 前缀/Header）与并行维护窗口',
        '给出弃用通知方式（响应头/文档/邮件）与移除条件',
        '列出至少三项兼容变更与三项破坏性变更',
        '给出契约测试要覆盖的公开字段与错误码'
      ],
      reference: '<ul><li><strong>资源树：</strong>以 /v1/links 为中心，/v1/links/:id/clicks 作为子资源；跳转端点 /:slug 面向最终用户，不带版本前缀。</li><li><strong>状态码：</strong>创建 201 加 Location；删除 204；校验失败 400 或 422（契约内固定）；未认证 401；无权限 403；不存在 404；方法不允许 405 加 Allow。</li><li><strong>跳转：</strong>目标可修改，默认 302；301 可能被浏览器长期缓存，只在确认目标永不改变时使用。</li><li><strong>版本化：</strong>URL 前缀便于网关分流与文档呈现，代价是路径冗余；并行维护窗口由迁移进度决定，不承诺永久。</li><li><strong>弃用：</strong>先标记并通知，观察调用量，给迁移文档，到期移除；可以用 Sunset 与 Deprecation 响应头辅助自动化客户端。</li><li><strong>兼容变更：</strong>新增响应字段、新增可选参数、新增并文档化错误码。</li><li><strong>破坏变更：</strong>删除字段、改类型、改含义、新增必填请求字段、改变排序或分页语义。</li><li><strong>验证：</strong>契约测试覆盖公开字段、状态码与错误码；CI 对比 OpenAPI 与实现的漂移。</li></ul>'
    }
  ]
};
