export const m1Http = {
  "id": "m1-http",
  "title": "从 URL 到响应：请求的四段旅程",
  "subtitle": "DNS 解析、TCP 握手、TLS 协商、HTTP 交换——每一步都对应一类线上故障。",
  "duration": 55,
  "status": "ready",
  "objectives": [
    "区分 DNS、TCP、TLS、HTTP 四个阶段的职责，并能根据报错与耗时判断失败发生在哪一层。",
    "用 curl -w 把一次请求拆成五段耗时，判断慢在 DNS、连接、TLS、服务端还是传输。",
    "解释冷启动 RTT 预算、连接复用与 HTTP 版本对延迟的影响，不把「慢」笼统归因于后端代码。",
    "为 LinkHub 跳转接口选择正确的 301/302/404/410 语义，并说明缓存与暴露存在性的代价。"
  ],
  "keywords": ["DNS", "TCP", "TLS", "TTFB", "curl", "状态码", "HTTP"],
  "blocks": [
    {
      "type": "analogy",
      "title": "浏览器帮你藏起了前四段",
      "html": "把一次请求想成寄快递：先查收件地址（DNS），再建立运输通道（TCP），然后核对身份与封装（TLS），最后才把包裹交给对方（HTTP）。浏览器像一家全包物流公司，你在 DevTools 里通常只看到最后的签收时间 TTFB，前面查地址、排队、验身份的时间都被折叠了。<br>这个类比在「连接复用」处会失效：同一个连接可以连续寄很多包裹，第二次不必重新查地址和建通道。因此看到 DNS、TCP、TLS 耗时接近 0 时，不要以为它们没发生，而要先确认这次请求是不是复用了连接。"
    },
    {
      "type": "flow",
      "title": "四段旅程与典型故障",
      "steps": [
        { "name": "DNS 解析", "detail": "把域名换成 IP。失败常见于域名拼错、记录未生效、递归解析器缓存了旧值；表现是「找不到主机」。" },
        { "name": "TCP 连接", "detail": "与目标 IP 的端口建立连接。失败常见于服务未启动、端口未开放、安全组拦截；表现是连接被拒绝或超时。" },
        { "name": "TLS 协商", "detail": "在 TCP 之上协商加密与证书。失败常见于证书过期、域名不匹配、客户端不信任证书链；表现是握手失败。" },
        { "name": "HTTP 交换", "detail": "发送请求并读取响应。失败常见于路由不存在、鉴权失败、服务端异常；这时才拿得到状态码。" }
      ]
    },
    {
      "type": "text",
      "title": "后端为什么多出三个问题",
      "html": "前端写页面时，代码通常只服务一个用户、一台设备；后端要在同一进程里同时服务很多请求，还要连接数据库、缓存和外部服务。并发、持久化、失败因此缠在一起：一个慢查询会占住连接池，一个未捕获异常会让进程退出，一次下游超时会把请求堆积在内存里。<br>所以「接口慢」不一定是业务代码慢。它可能卡在 DNS、卡在连接建立、卡在 TLS 握手、卡在服务端排队，也可能只是响应体太大导致传输时间长。把链路拆开，是后端定位问题的第一动作。"
    },
    {
      "type": "code",
      "title": "最小可运行的跳转服务",
      "lang": "javascript",
      "code": "import http from 'node:http';\n\nconst routes = new Map([\n  ['go', 'https://example.com/docs?from=linkhub'],\n]);\n\nconst server = http.createServer((req, res) => {\n  if (req.url === '/health') {\n    res.writeHead(200, { 'Content-Type': 'application/json' });\n    res.end(JSON.stringify({ ok: true }));\n    return;\n  }\n\n  const code = req.url.replace(/^\\//, '');\n  const target = routes.get(code);\n  if (!target) {\n    res.writeHead(404, { 'Content-Type': 'application/json' });\n    res.end(JSON.stringify({ error: 'not_found' }));\n    return;\n  }\n\n  // 302 表示临时跳转：目标可以修改，浏览器不会像 301 那样长期缓存\n  res.writeHead(302, {\n    Location: target,\n    'Cache-Control': 'no-store',\n  });\n  res.end();\n});\n\nserver.listen(3000, () => {\n  console.log('redirect service on http://localhost:3000');\n});",
      "note": "短码到目标 URL 的映射在真实系统里来自数据库；这里用 Map 让服务可以独立运行。"
    },
    {
      "type": "table",
      "title": "状态码分工",
      "head": ["类别", "含义", "典型场景", "重试语义"],
      "rows": [
        ["2xx", "请求成功", "200 查询成功、201 创建成功、204 无响应体", "通常不重试"],
        ["3xx", "需要进一步动作", "302 临时跳转、304 命中协商缓存", "由客户端按语义跟随"],
        ["4xx", "请求本身有问题", "400 参数错误、401 未认证、403 无权限、404 不存在、409 冲突、410 已移除", "改请求后再试，盲目重试无效"],
        ["5xx", "服务端未能完成", "500 未处理异常、502 上游返回无效、503 暂时不可用、504 上游超时", "可配合退避重试，注意幂等"]
      ]
    },
    {
      "type": "pitfall",
      "title": "一切都塞进 200",
      "html": "现象：所有接口都返回 200，业务失败写在响应体的 <code>code</code> 字段里，网关、监控和前端各自维护一套错误判断。<br>原因：把「HTTP 请求到达了服务器」误当成「业务成功」，于是状态码只用来表示传输层是否通畅。<br>发现方式：查看网关的重试与熔断配置，会发现它把所有响应都当成功；查看监控面板，4xx/5xx 比例长期接近 0，但客诉不断。<br>修复：让状态码表达结果类别，业务错误码放在错误体里，两者不互相替代。<br>预防：给接口写契约测试，断言「未认证返回 401」「唯一键冲突返回 409」「依赖不可用返回 503」，而不是只断言 body 里有某个字段。"
    },
    {
      "type": "tip",
      "title": "curl -v 是显微镜",
      "html": "加 <code>-v</code> 后，curl 会打印它正在做什么。看到 <code>Could not resolve host</code> 停在 DNS；看到 <code>Connection refused</code> 停在 TCP；看到 <code>SSL certificate problem</code> 停在 TLS；只有出现 <code>HTTP/1.1 200 OK</code> 或 <code>HTTP/2 200</code> 这一行，才说明 HTTP 响应已经回来了。<br>再配 <code>-w</code> 输出分段耗时，就能把「失败在哪一层」和「慢在哪一段」分开看。"
    },
    {
      "type": "steps",
      "title": "五步拆解请求耗时",
      "steps": [
        { "title": "先看总耗时", "html": "用 time_total 判断这次请求是否值得继续拆；总耗时正常时，不必为了优化而优化。" },
        { "title": "看 DNS", "html": "time_namelookup 是拿到域名解析结果的时间；连接复用时它会接近 0，不能直接当成 DNS 服务的全部耗时。" },
        { "title": "看连接与 TLS", "html": "time_connect 减去 time_namelookup 是 TCP 建连；time_appconnect 减去 time_connect 是 TLS 协商。两者都要结合是否新建连接解释。" },
        { "title": "看服务端", "html": "time_starttransfer 减去 time_appconnect 是请求发出后到收到首字节的时间，包含服务端处理与网络单程。" },
        { "title": "看传输", "html": "time_total 减去 time_starttransfer 是接收剩余响应体的时间；响应体大或带宽小时，这一段会明显变长。" }
      ]
    },
    {
      "type": "text",
      "title": "深挖：冷启动的 RTT 预算",
      "html": "首次访问一个 HTTPS 站点，客户端通常要先做 DNS 查询，再完成 TCP 三次握手，然后做 TLS 握手，最后才发出 HTTP 请求。TLS 1.3 的完整握手是 1-RTT，TLS 1.2 通常是 2-RTT；这还没有算 DNS 递归查询与 TCP 建连本身。DNS 结果可能被操作系统、浏览器和递归解析器多层缓存，所以「第一次慢、第二次快」既可能是连接复用，也可能只是解析结果被缓存了。<br>连接复用能省掉 DNS、TCP 与 TLS 的大部分开销，但复用的连接仍要排队：HTTP/1.1 同一连接上的请求可能互相阻塞，HTTP/2 用多路复用缓解这个问题，HTTP/3 则把传输层换成基于 UDP 的 QUIC。0-RTT 能进一步减少往返，但它带来重放风险，不能用于非幂等操作。理解这些预算，才能判断一次「慢」是协议设计导致，还是服务端代码导致。"
    },
    {
      "type": "table",
      "title": "DNS 记录与 TTL",
      "head": ["记录", "作用", "迁移时的常见问题"],
      "rows": [
        ["A", "域名到 IPv4 地址", "旧记录仍被递归解析器缓存，部分用户打到旧机器"],
        ["AAAA", "域名到 IPv6 地址", "只改 A 记录而 AAAA 仍指向旧地址，IPv6 优先的用户失败"],
        ["CNAME", "域名别名", "别名链过长或指向未配置的目标"],
        ["TXT", "文本校验与策略", "SPF、域名验证等配置遗漏，不影响解析但影响业务"],
        ["NS", "授权 DNS 服务器", "迁移 DNS 服务商时未同步全部记录"],
        ["SOA", "区域权威信息", "序列号未递增，从属服务器不刷新"]
      ]
    },
    {
      "type": "compare",
      "title": "HTTP/1.1、HTTP/2 与 HTTP/3",
      "cols": [
        { "title": "HTTP/1.1", "items": ["文本协议，连接上按序处理请求", "浏览器用多个连接缓解队头阻塞", "每个连接仍有请求排队成本"] },
        { "title": "HTTP/2", "items": ["二进制分帧，一条连接多路复用", "头部压缩减少重复传输", "TCP 层丢包仍可能影响整条连接"] },
        { "title": "HTTP/3", "items": ["基于 QUIC，运行在 UDP 之上", "减少建连与队头阻塞，支持 0-RTT", "0-RTT 有重放风险，非幂等请求要谨慎"] }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「为什么第一次访问慢，第二次快」。好的回答会先问：是同一个连接吗？DNS 是否被缓存？TLS 是否完整握手？有没有 CDN 或反向代理？然后再给出可验证的测量方式，例如用 <code>curl -w</code> 分别看五次请求的 time_namelookup、time_connect、time_appconnect 与 time_starttransfer。<br>另一个常见问题是「301 和 302 怎么选」。回答要落到产品约束：目标是否可能变化、浏览器缓存是否可控、统计与回滚是否方便。只背「301 永久、302 临时」不够。"
    }
  ],
  "checks": [
    {
      "id": "m1-http-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "TLS 与部分失败",
      "prompt": "TLS 证书已过期，但只有部分用户访问失败，最可能的原因是什么？",
      "question": "TLS 证书已过期，但只有部分用户访问失败，最可能的原因是什么？",
      "options": [
        { "text": "所有用户的 DNS 缓存同时过期", "correct": false },
        { "text": "不同边缘节点或实例加载了不同版本的证书，部分节点证书已过期", "correct": true },
        { "text": "HTTP/2 多路复用让部分请求绕过了 TLS", "correct": false },
        { "text": "301 缓存让浏览器跳过了 TLS 握手", "correct": false }
      ],
      "explain": "证书由具体节点提供；部署不一致会让部分节点仍在使用旧证书，于是只有命中这些节点的用户失败。DNS 缓存过期不会让证书过期，HTTP/2 仍然运行在 TLS 之上，301 也不会跳过 TLS。"
    },
    {
      "id": "m1-http-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "状态码语义",
      "prompt": "关于 HTTP 状态码语义，以下哪些说法正确？",
      "question": "关于 HTTP 状态码语义，以下哪些说法正确？",
      "options": [
        { "text": "401 表示未认证，响应应说明如何认证", "correct": true },
        { "text": "403 表示已认证但无权访问该资源", "correct": true },
        { "text": "409 表示请求与资源当前状态冲突，例如唯一键重复", "correct": true },
        { "text": "503 表示资源永久不存在", "correct": false },
        { "text": "404 与 410 的语义完全相同", "correct": false }
      ],
      "explain": "401 和 403 的区别在认证状态，不在权限大小；409 常用于唯一键冲突或版本冲突；503 是暂时不可用，通常可以配合 Retry-After；404 是找不到，410 是曾经存在但已永久移除。"
    },
    {
      "id": "m1-http-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "IPv6 与解析",
      "prompt": "切换 A 记录后，部分移动用户访问失败；time_namelookup 与 time_connect 都正常。下一步最该查什么？",
      "question": "切换 A 记录后，部分移动用户访问失败；time_namelookup 与 time_connect 都正常。下一步最该查什么？",
      "options": [
        { "text": "AAAA 记录与 IPv6 连通性", "correct": true },
        { "text": "TLS 证书链是否完整", "correct": false },
        { "text": "HTTP 响应体是否包含错误码", "correct": false },
        { "text": "TCP 拥塞窗口是否过小", "correct": false }
      ],
      "explain": "A 记录已能解析且 TCP 已连上，说明 IPv4 路径基本正常；移动网络常优先使用 IPv6，AAAA 记录缺失或 IPv6 不可达会造成部分用户失败。TLS 与 HTTP 都发生在连接之后，拥塞窗口也不会只影响特定移动用户。"
    }
  ],
  "exercises": [
    {
      "id": "m1-http-ex-1",
      "kind": "code",
      "title": "请求分段计时与归因",
      "brief": "p-m1-probe 探针要读取 curl -w 的五段耗时，转换成统一的毫秒结构，并指出最慢的一段。输入单位是秒；任何缺失、非有限数、负数或破坏单调性的输入都必须拒绝。",
      "hint": "先校验 0 <= namelookup <= connect <= appconnect <= starttransfer <= total，再分别做差；并列最大值按 dns → tcp → tls → server → transfer 的顺序取第一个。",
      "starter": "function analyzeTimings(timings) {\n  const { namelookup, connect, appconnect, starttransfer, total } = timings;\n  return {\n    dns: namelookup * 1000,\n    tcp: (connect - namelookup) * 1000,\n    tls: (appconnect - connect) * 1000,\n    server: (starttransfer - appconnect) * 1000,\n    transfer: (total - starttransfer) * 1000,\n    total: total * 1000,\n    slowest: 'server',\n  };\n}",
      "solution": "function analyzeTimings(timings) {\n  const keys = ['namelookup', 'connect', 'appconnect', 'starttransfer', 'total'];\n  const values = keys.map((key) => (timings ? timings[key] : undefined));\n\n  const valid = values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);\n  if (!valid) throw new Error('invalid timings');\n  for (let index = 1; index < values.length; index += 1) {\n    if (values[index] < values[index - 1]) throw new Error('invalid timings');\n  }\n\n  const round = (value) => Math.round((value + Number.EPSILON) * 10) / 10;\n  const [namelookup, connect, appconnect, starttransfer, total] = values;\n  const result = {\n    dns: round(namelookup * 1000),\n    tcp: round((connect - namelookup) * 1000),\n    tls: round((appconnect - connect) * 1000),\n    server: round((starttransfer - appconnect) * 1000),\n    transfer: round((total - starttransfer) * 1000),\n    total: round(total * 1000),\n  };\n\n  const order = ['dns', 'tcp', 'tls', 'server', 'transfer'];\n  let slowest = order[0];\n  for (const key of order) {\n    if (result[key] > result[slowest]) slowest = key;\n  }\n  return { ...result, slowest };\n}",
      "tests": [
        {
          "name": "正常 HTTPS 冷请求拆成五段",
          "code": "assert.deepStrictEqual(analyzeTimings({ namelookup: 0.02, connect: 0.05, appconnect: 0.12, starttransfer: 0.4, total: 0.5 }), { dns: 20, tcp: 30, tls: 70, server: 280, transfer: 100, total: 500, slowest: 'server' });"
        },
        {
          "name": "连接复用时前三段为 0",
          "code": "assert.deepStrictEqual(analyzeTimings({ namelookup: 0, connect: 0, appconnect: 0, starttransfer: 0.08, total: 0.09 }), { dns: 0, tcp: 0, tls: 0, server: 80, transfer: 10, total: 90, slowest: 'server' });"
        },
        {
          "name": "TLS 最慢时归因到 tls",
          "code": "assert.deepStrictEqual(analyzeTimings({ namelookup: 0.01, connect: 0.03, appconnect: 0.25, starttransfer: 0.28, total: 0.3 }), { dns: 10, tcp: 20, tls: 220, server: 30, transfer: 20, total: 300, slowest: 'tls' });"
        },
        {
          "name": "非单调输入抛出 invalid timings",
          "code": "assert.throws(() => analyzeTimings({ namelookup: 0.05, connect: 0.03, appconnect: 0.12, starttransfer: 0.4, total: 0.5 }), /invalid timings/);"
        },
        {
          "name": "耗时四舍五入到 1 位小数",
          "code": "assert.deepStrictEqual(analyzeTimings({ namelookup: 0.0001, connect: 0.0003, appconnect: 0.0006, starttransfer: 0.001, total: 0.0015 }), { dns: 0.1, tcp: 0.2, tls: 0.3, server: 0.4, transfer: 0.5, total: 1.5, slowest: 'transfer' });"
        },
        {
          "name": "并列最大值按固定顺序取 dns",
          "code": "assert.deepStrictEqual(analyzeTimings({ namelookup: 0.01, connect: 0.02, appconnect: 0.03, starttransfer: 0.04, total: 0.05 }), { dns: 10, tcp: 10, tls: 10, server: 10, transfer: 10, total: 50, slowest: 'dns' });"
        }
      ]
    },
    {
      "id": "m1-http-ex-2",
      "kind": "design",
      "title": "LinkHub 跳转契约",
      "brief": "LinkHub 的 GET /:code 负责把短码跳转到目标 URL。短码可能有效、已过期、被封禁、不存在，或在创建时与保留字冲突。请给出状态码、缓存策略、错误体与统计边界，并解释每个选择的代价。",
      "checklist": [
        "说明 301 被浏览器长期缓存的风险，并给出默认选择",
        "过期与不存在使用不同语义，或明确说明为什么不区分",
        "封禁策略说明是否暴露「存在但被封」",
        "保留字在创建阶段拒绝，不等到跳转时才发现",
        "Location 做了编码与目标校验，拒绝开放重定向",
        "跳转不被统计写入阻塞，说明与异步链路的边界",
        "错误体包含稳定错误码与可读消息，不返回 200",
        "给出关键响应的缓存策略与理由"
      ],
      "reference": "<ul><li><strong>默认用 302</strong>：短码目标可能修改；301 会被浏览器长期缓存，回滚成本高。</li><li><strong>过期用 410，普通不存在用 404</strong>：410 语义更准确，但会暴露「曾经存在」；如果产品不愿暴露，可统一用 404 并在日志中区分。</li><li><strong>封禁可返回 404 或 410</strong>：取决于是否愿意让外界推断短码存在性；无论选哪个，都要在服务端日志保留真实原因。</li><li><strong>保留字在创建时拒绝</strong>：例如 health、api、admin 等路径，避免运行时才冲突。</li><li><strong>Location 必须编码并校验目标协议与主机</strong>：只允许 http/https，拒绝 javascript: 等伪协议以及未授权域名，防止开放重定向。</li><li><strong>统计与跳转解耦</strong>：跳转请求只负责返回 Location；点击事件写入队列或异步链路，统计故障不能阻断跳转。</li><li><strong>错误体稳定</strong>：返回 JSON，包含固定错误码与可读消息；不要把所有失败都包成 200。</li><li><strong>缓存策略</strong>：跳转响应默认 no-store 或短缓存；错误响应不要被 CDN 长期缓存。</li></ul>"
    }
  ]
};
