export const m2Auth = {
  id: 'm2-auth',
  title: '认证、授权与多租户',
  subtitle: 'Session/JWT/API Key、RBAC 与租户隔离、token 生命周期与 IDOR 防护。',
  duration: 75,
  status: 'ready',
  objectives: [
    '区分认证与授权，为 Web、移动端与服务端调用选择 Session、JWT、Refresh Token 或 API Key。',
    '设计 RBAC/ABAC 权限模型，写清 owner、admin、租户成员与跨租户访问的判断顺序。',
    '在数据访问层实施租户隔离，识别 IDOR 与「客户端传 tenantId」的漏洞。',
    '说明 token 存储、轮换、撤销与 CSRF/XSS 的边界，知道完整防护属于哪一讲。'
  ],
  keywords: ['认证', '授权', 'JWT', 'Session', 'Refresh Token', 'API Key', 'RBAC', '多租户', 'IDOR', 'CSRF'],
  blocks: [
    {
      type: 'analogy',
      title: '前端路由守卫不是安全边界',
      html: '前端路由守卫能拦住用户点进「管理后台」页面，但它拦不住用户在终端里直接 <code>curl</code> 你的接口。守卫改善的是体验：未登录时跳转登录页，避免看到空白页。真正的授权发生在服务端：每个请求都要重新确认「你是谁」与「你能做什么」。<br>类比失效的地方在于，浏览器里的代码和请求都受用户控制；攻击者可以改前端、跳过 UI、伪造参数。服务端不能假设请求来自你的页面，只能信任自己验证过的凭证与数据。'
    },
    {
      type: 'text',
      title: '认证 vs 授权',
      html: '认证（Authentication）回答「你是谁」：验证密码、Session、JWT 签名或 API Key。授权（Authorization）回答「你能做什么」：对某个资源执行某个动作是否允许。两者失败对应不同状态码：凭证缺失或无效是 401，身份已确认但权限不足是 403。<br>多租户又多一层：即使同一个人有权限，也只能访问自己租户的数据。租户过滤不能写在页面里，必须进入数据访问条件；否则猜到一个 id 就能跨租户读取，这类漏洞叫 IDOR（对象级授权缺失）。'
    },
    {
      type: 'table',
      title: '四种常用凭证',
      head: ['凭证', '存放位置', '服务端状态', '撤销能力', '适用场景', '主要风险'],
      rows: [
        ['Session Cookie', 'HttpOnly Cookie', '有，服务端会话', '删除会话立即失效', '同源 Web 应用', 'CSRF、会话固定'],
        ['JWT access token', '内存或 Cookie', '通常无状态', '过期前默认不可撤销', '短时调用、跨服务', '泄漏后到期前有效、权限变更延迟'],
        ['Refresh token', 'HttpOnly Cookie 或安全存储', '有，需记录轮换状态', '可撤销并全家族失效', '换取新的 access token', '长期凭证泄漏、重放'],
        ['API Key', '服务端密钥管理', '有，按 key 记录', '删除或轮换即失效', '服务端到服务端集成', '硬编码、权限过大、泄漏难发现']
      ],
      note: '没有一种凭证适合所有场景；选择时先问「泄漏后能多快失效」「调用方能否安全保存」「是否需要跨域」。'
    },
    {
      type: 'flow',
      title: '一次受保护请求',
      steps: [
        { name: '登录并签发', detail: '校验凭证后签发 Session 或 token；失败返回 401。失败表现：把登录失败也返回 403，调用方无法区分。' },
        { name: '携带凭证', detail: 'Cookie 自动携带，或 Authorization: Bearer；缺失或格式错误直接 401。失败表现：token 放在 URL 查询参数，进入日志与 Referer。' },
        { name: '认证中间件', detail: '验证签名、过期时间与撤销状态，得到用户与租户上下文。失败表现：只解码 JWT 不验签，攻击者可改 payload。' },
        { name: '授权判断', detail: '按资源、动作与角色判断是否允许；拒绝返回 403。失败表现：只判断「已登录」就放行所有写操作。' },
        { name: '租户过滤', detail: '数据访问条件强制带 tenant_id；查不到即 404 或 403。失败表现：tenantId 来自请求体，攻击者可切换租户。' },
        { name: '返回响应', detail: '只返回当前租户可见字段；记录审计日志。失败表现：错误响应泄漏其他租户的 id 或数量。' }
      ]
    },
    {
      type: 'code',
      title: '授权决策函数：顺序决定漏洞',
      lang: 'javascript',
      code: `function authorize({ user, action, resource }) {
  if (!resource) return { allowed: false, reason: 'not_found' };
  if (!['read', 'write', 'delete'].includes(action)) {
    return { allowed: false, reason: 'unknown_action' };
  }

  const publicRead = action === 'read' && resource.visibility === 'public';
  if (!user) {
    return publicRead
      ? { allowed: true, reason: 'public_read' }
      : { allowed: false, reason: 'authentication_required' };
  }

  const sameTenant = user.tenantId === resource.tenantId;
  const isAdmin = user.role === 'admin';
  if (!sameTenant) {
    // 平台管理员可以跨租户读，但写操作仍要留在目标租户内
    return isAdmin && action === 'read'
      ? { allowed: true, reason: 'platform_read' }
      : { allowed: false, reason: 'tenant_mismatch' };
  }
  if (resource.ownerId === user.id) return { allowed: true, reason: 'owner' };
  if (isAdmin) return { allowed: true, reason: 'admin' };
  if (action === 'read') return { allowed: true, reason: 'member_read' };
  return { allowed: false, reason: 'not_owner' };
}`,
      note: '先租户、后角色、最后 owner，是为了让「跨租户」永远优先拒绝。判断顺序不是风格问题：先判断 owner 再判断租户，会把跨租户的资源所有者误放行。'
    },
    {
      type: 'code',
      title: '租户作用域仓储：tenantId 只来自认证上下文',
      lang: 'javascript',
      code: `function createLinkRepository(db) {
  return {
    async findById(auth, id) {
      const { rows } = await db.query(
        'SELECT id, tenant_id, owner_id, slug, target_url FROM links WHERE tenant_id = $1 AND id = $2',
        [auth.tenantId, id]
      );
      return rows[0] || null;
    },
    async update(auth, id, targetUrl) {
      const { rowCount } = await db.query(
        'UPDATE links SET target_url = $3 WHERE tenant_id = $1 AND id = $2',
        [auth.tenantId, id, targetUrl]
      );
      return rowCount === 1;
    },
    async list(auth, limit) {
      const capped = Math.min(Math.max(limit, 1), 100);
      const { rows } = await db.query(
        'SELECT id, slug, target_url FROM links WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
        [auth.tenantId, capped]
      );
      return rows;
    },
  };
}`,
      note: '仓储方法只接受 auth 上下文，不接受客户端传入的 tenantId；调用方想切换租户只能重新登录或切换已授权的工作区。所有查询、更新、删除都必须带 tenant_id。'
    },
    {
      type: 'pitfall',
      title: 'IDOR 与跨租户泄漏',
      html: '现象：某个租户发现列表里出现了别家的短链；日志里同一条 <code>GET /v1/links/:id</code> 被来自不同租户的用户成功访问；安全测试用递增 id 批量拉取数据。<br>原因：查询只按 <code>id</code> 过滤，租户条件写在前端或根本没写；创建资源时 <code>tenant_id</code> 取自请求体；管理员接口复用了普通查询。<br>发现方式：写跨租户测试，用 A 租户的 token 请求 B 租户的资源，断言 404 或 403；对列表接口检查返回的每条记录 tenant_id 都等于当前上下文；审计日志按租户维度聚合。<br>修复：所有读写强制带 tenant_id；唯一约束包含 tenant_id；管理员跨租户接口单独授权并记录审计。止血可以先关闭可疑端点或加网关规则，但根治必须改数据访问层。<br>预防：仓储层禁止暴露「只按 id」的方法；代码评审检查每个查询的 where 条件；集成测试固定跨租户用例。'
    },
    {
      type: 'steps',
      title: '认证与租户测试矩阵',
      steps: [
        { title: '列出角色', html: '匿名、普通成员、资源 owner、租户管理员、平台管理员。观察点：每个角色都有明确的权限矩阵。' },
        { title: '列出动作', html: '读、写、删除、跨租户读、跨租户写。观察点：不要把「管理」当一个大动作。' },
        { title: '准备两个租户的数据', html: 'A 租户用户与资源、B 租户用户与资源。观察点：测试数据不共享主键。' },
        { title: '跑 401/403 用例', html: '无 token 401；有效 token 但无权限 403；跨租户 404 或 403 按契约。观察点：状态码与错误码稳定。' },
        { title: '跑撤销与过期用例', html: '登出后旧 token 失效；过期 token 401；refresh 重用被检测。观察点：撤销不是只在 UI 上生效。' },
        { title: '把矩阵接入 CI', html: '每次改授权逻辑都跑；失败即阻断。观察点：矩阵成为回归门禁，而不是一次性手工测试。' }
      ]
    },
    {
      type: 'compare',
      title: 'RBAC vs ABAC vs ReBAC',
      cols: [
        {
          title: 'RBAC（角色）',
          items: ['模型：用户→角色→权限', '表达力：适合固定岗位与后台', '复杂度：角色少时简单，角色多时爆炸', '判断成本：低，查角色映射', '失败模式：角色粒度太粗，出现「超级管理员」', '适用：租户管理员、编辑、只读等稳定角色']
        },
        {
          title: 'ABAC（属性）',
          items: ['模型：按用户/资源/环境属性写策略', '表达力：能表达时间、部门、资源敏感级', '复杂度：策略多，冲突与可解释性难', '判断成本：中，每次请求评估策略', '失败模式：策略漂移，没人能说清为什么允许', '适用：合规、按字段/时间限制的场景']
        },
        {
          title: 'ReBAC（关系）',
          items: ['模型：按资源关系图判断', '表达力：适合共享、组织层级、文档继承', '复杂度：图查询与缓存成本高', '判断成本：中高，需要关系存储', '失败模式：关系过期或循环导致误判', '适用：协作空间、文件夹继承、团队共享']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：Refresh Token 轮换与重用检测',
      html: '长期有效的 refresh token 一旦泄漏，攻击者可以在很长时间内不断换取新的 access token。轮换把 refresh token 变成一次性凭证：每次刷新返回新的 refresh token，旧的立即失效。如果旧 token 再次被使用，说明它可能被复制过——服务端应判定重用，撤销同一「家族」的所有 refresh token，并要求重新登录。<br>实现要注意并发：同一客户端的两个请求可能同时拿旧 token 刷新，服务端要么用短窗口允许一次幂等重放，要么让其中一个失败并提示重试。轮换记录要带租户、设备与过期时间，撤销要能按家族批量执行；日志只记录 token 指纹，不记录明文。',
      note: '完整的 CSRF/XSS 防护在 Web 安全一讲展开；这里只说明 token 生命周期与撤销边界。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「401 与 403 怎么分」先问凭证是否有效：缺失、过期、签名错误是 401；身份有效但动作不被允许是 403。若为了隐藏资源存在性，可以把无权访问统一成 404，但要全站一致并写进契约。<br>「多租户怎么做」不要只回答「加 tenant_id」。要说明 tenantId 来自认证上下文、仓储层强制过滤、唯一约束带租户、管理员跨租户读写分开授权，以及跨租户测试与审计日志。'
    }
  ],
  checks: [
    {
      id: 'm2-auth-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '401 与 403',
      prompt: '用户 A 已登录，携带有效 token 请求删除同租户用户 B 的链接。服务端应返回什么？',
      question: '用户 A 已登录，携带有效 token 请求删除同租户用户 B 的链接。服务端应返回什么？',
      options: [
        { text: '401，因为没有权限', correct: false },
        { text: '403，因为已认证但无权执行该操作', correct: true },
        { text: '404，因为链接不属于 A', correct: false },
        { text: '200，但响应体里写 failed', correct: false }
      ],
      explain: '401 表示未认证或凭证无效；403 表示身份已确认但授权失败。404 可以用于隐藏资源存在性，但要在契约中统一；200 会破坏监控与 SDK。删除他人链接属于同租户内的权限问题，应 403。'
    },
    {
      id: 'm2-auth-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '凭证与撤销',
      prompt: '关于 Session、JWT、Refresh Token 与 API Key，以下哪些说法正确？',
      question: '关于 Session、JWT、Refresh Token 与 API Key，以下哪些说法正确？',
      options: [
        { text: '服务端 Session 可以在服务端删除，从而立即失效', correct: true },
        { text: 'JWT 默认在过期前无法撤销，需要短过期或额外的撤销机制', correct: true },
        { text: 'Refresh Token 轮换后，旧 token 再次出现可以视为泄漏信号', correct: true },
        { text: 'API Key 应该与用户密码使用同一套登录流程', correct: false },
        { text: '把 JWT 放进 localStorage 后，XSS 也无法读取', correct: false }
      ],
      explain: 'Session 的状态在服务端，删除即失效；JWT 是自包含凭证，签发后默认不可撤销；refresh token 轮换与重用检测是常见防护；API Key 是机器凭证，通常单独签发、撤销与限权；localStorage 可被同源 JS 读取，XSS 可直接窃取。'
    },
    {
      id: 'm2-auth-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '租户隔离',
      prompt: 'GET /v1/links/:id 的实现是 SELECT * FROM links WHERE id = $1，租户 ID 只用于页面展示。最可能的风险是什么？',
      question: 'GET /v1/links/:id 的实现是 SELECT * FROM links WHERE id = $1，租户 ID 只用于页面展示。最可能的风险是什么？',
      options: [
        { text: '查询变慢，因为缺少索引', correct: false },
        { text: '跨租户读取（IDOR）：猜到 id 就能读到其他租户的数据', correct: true },
        { text: '只有管理员能利用，普通用户不受影响', correct: false },
        { text: '只要前端不显示 tenantId 就不会泄漏', correct: false }
      ],
      explain: '租户隔离必须进入数据访问条件，WHERE tenant_id = $1 AND id = $2；前端隐藏字段不构成安全边界；IDOR 是对象级授权缺失，任何能构造请求的调用方都可能利用；修复后还要补跨租户测试。'
    }
  ],
  exercises: [
    {
      id: 'm2-auth-ex-1',
      kind: 'code',
      title: '授权决策函数',
      brief: '实现 authorize({ user, action, resource })，返回 { allowed, reason }。user 为 null 表示匿名；action 取 read/write/delete；resource 含 id、ownerId、tenantId、visibility。未知 action 返回 unknown_action；匿名只能读 public 资源（public_read），否则 authentication_required；租户不一致时 admin 的 read 允许（platform_read），其他情况拒绝 tenant_mismatch；同租户内 owner 可读写删（owner），admin 可读写删（admin），其他用户 read 允许（member_read），write/delete 拒绝 not_owner；资源缺失返回 not_found。',
      hint: '判断顺序：资源存在 → action 合法 → 匿名 → 租户 → owner → admin → 成员。跨租户必须优先于角色判断，否则 admin 的跨租户写会被误放行。',
      starter: `function authorize({ user, action, resource }) {
  if (!user) {
    return { allowed: false, reason: 'authentication_required' };
  }
  if (user.role === 'admin' || resource.ownerId === user.id) {
    return { allowed: true, reason: 'owner' };
  }
  return { allowed: true, reason: 'member_read' };
}`,
      solution: `function authorize({ user, action, resource }) {
  if (!resource) return { allowed: false, reason: 'not_found' };
  if (!['read', 'write', 'delete'].includes(action)) {
    return { allowed: false, reason: 'unknown_action' };
  }

  const publicRead = action === 'read' && resource.visibility === 'public';
  if (!user) {
    return publicRead
      ? { allowed: true, reason: 'public_read' }
      : { allowed: false, reason: 'authentication_required' };
  }

  const sameTenant = user.tenantId === resource.tenantId;
  const isAdmin = user.role === 'admin';
  if (!sameTenant) {
    return isAdmin && action === 'read'
      ? { allowed: true, reason: 'platform_read' }
      : { allowed: false, reason: 'tenant_mismatch' };
  }
  if (resource.ownerId === user.id) return { allowed: true, reason: 'owner' };
  if (isAdmin) return { allowed: true, reason: 'admin' };
  if (action === 'read') return { allowed: true, reason: 'member_read' };
  return { allowed: false, reason: 'not_owner' };
}`,
      tests: [
        {
          name: '匿名读公开资源允许',
          code: `const result = authorize({
  user: null,
  action: 'read',
  resource: { id: 'l1', ownerId: 'u1', tenantId: 't1', visibility: 'public' },
});
assert.deepEqual(result, { allowed: true, reason: 'public_read' });`
        },
        {
          name: '匿名读私有资源要求认证',
          code: `const result = authorize({
  user: null,
  action: 'read',
  resource: { id: 'l1', ownerId: 'u1', tenantId: 't1', visibility: 'private' },
});
assert.deepEqual(result, { allowed: false, reason: 'authentication_required' });`
        },
        {
          name: 'owner 可写自己的资源',
          code: `const user = { id: 'u1', role: 'member', tenantId: 't1' };
const resource = { id: 'l1', ownerId: 'u1', tenantId: 't1', visibility: 'private' };
assert.deepEqual(authorize({ user, action: 'write', resource }), { allowed: true, reason: 'owner' });
assert.deepEqual(authorize({ user, action: 'delete', resource }), { allowed: true, reason: 'owner' });`
        },
        {
          name: '平台管理员可跨租户读',
          code: `const user = { id: 'admin-1', role: 'admin', tenantId: 't1' };
const resource = { id: 'l9', ownerId: 'u9', tenantId: 't2', visibility: 'private' };
assert.deepEqual(authorize({ user, action: 'read', resource }), { allowed: true, reason: 'platform_read' });`
        },
        {
          name: '平台管理员不能跨租户写',
          code: `const user = { id: 'admin-1', role: 'admin', tenantId: 't1' };
const resource = { id: 'l9', ownerId: 'u9', tenantId: 't2', visibility: 'private' };
assert.deepEqual(authorize({ user, action: 'write', resource }), { allowed: false, reason: 'tenant_mismatch' });
assert.deepEqual(authorize({ user, action: 'delete', resource }), { allowed: false, reason: 'tenant_mismatch' });`
        },
        {
          name: '同租户成员可读但不可写',
          code: `const user = { id: 'u2', role: 'member', tenantId: 't1' };
const resource = { id: 'l1', ownerId: 'u1', tenantId: 't1', visibility: 'private' };
assert.deepEqual(authorize({ user, action: 'read', resource }), { allowed: true, reason: 'member_read' });
assert.deepEqual(authorize({ user, action: 'write', resource }), { allowed: false, reason: 'not_owner' });`
        },
        {
          name: '未知动作与缺失资源被拒绝',
          code: `const user = { id: 'u1', role: 'member', tenantId: 't1' };
const resource = { id: 'l1', ownerId: 'u1', tenantId: 't1', visibility: 'private' };
assert.deepEqual(authorize({ user, action: 'publish', resource }), { allowed: false, reason: 'unknown_action' });
assert.deepEqual(authorize({ user, action: 'read', resource: null }), { allowed: false, reason: 'not_found' });`
        }
      ]
    },
    {
      id: 'm2-auth-ex-2',
      kind: 'design',
      title: 'LinkHub 多租户认证与授权',
      brief: 'LinkHub 要从单租户内部工具变成多租户 SaaS。现有接口只按 id 查询，token 放在 localStorage，JWT 有效期 30 天且没有刷新机制；管理员可以查看所有数据。请给出认证、授权、租户隔离、token 生命周期与测试方案。',
      checklist: [
        '明确 Web、移动端、服务端集成分别用什么凭证',
        '写清登录、刷新、登出与撤销路径',
        '定义角色与权限矩阵，区分平台管理员与租户管理员',
        '规定 tenantId 只来自认证上下文',
        '规定数据访问层的强制过滤与唯一约束',
        '给出 token 存储位置与 CSRF/XSS 边界',
        '给出 refresh token 轮换、重用检测与全家族撤销策略',
        '给出测试矩阵：匿名、成员、owner、admin、跨租户、过期、撤销'
      ],
      reference: '<ul><li><strong>凭证：</strong>Web 用 HttpOnly + Secure + SameSite Cookie 或短 JWT + refresh；移动端用系统安全存储；服务端集成用限权的 API Key。</li><li><strong>生命周期：</strong>JWT 短过期，refresh 轮换；登出撤销当前会话；撤销用版本号或黑名单，按用户/设备批量失效。</li><li><strong>授权：</strong>平台管理员可跨租户读，跨租户写仍拒绝；租户管理员只在本租户内拥有管理权限；owner 与成员区分读写。</li><li><strong>租户隔离：</strong>tenantId 来自认证上下文，仓储层每个查询强制带 tenant_id，唯一约束包含 tenant_id。</li><li><strong>存储边界：</strong>localStorage 可被 XSS 读取；HttpOnly Cookie 降低读取风险但需要 CSRF 防护，完整实现放在 Web 安全一讲。</li><li><strong>轮换：</strong>旧 refresh token 再次使用视为重用，撤销同家族全部 token，并要求重新登录；并发刷新要有幂等窗口或明确失败。</li><li><strong>测试：</strong>匿名 401、无权限 403、跨租户 403/404、owner 可写、admin 跨租户写拒绝、过期与撤销失效；矩阵进 CI。</li></ul>'
    }
  ]
};
