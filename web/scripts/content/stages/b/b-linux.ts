export const bLinux = {
  "id": "b-linux",
  "title": "Linux、IO 与反向代理",
  "subtitle": "连接就是文件描述符：从 fd 预算、IO 模型到 Nginx 的超时与负载均衡。",
  "duration": 70,
  "status": "ready",
  "objectives": [
    "解释进程、线程、文件描述符与连接数之间的关系。",
    "区分阻塞、非阻塞、多路复用与 page cache 的作用。",
    "实现平滑加权轮询与 fd 预算检查。",
    "设计反向代理的超时、重试、负载均衡与缓冲配置。"
  ],
  "keywords": ["文件描述符", "IO 多路复用", "page cache", "Nginx", "加权轮询", "TIME_WAIT", "502"],
  "blocks": [
    {
      "type": "analogy",
      "title": "餐厅服务员与文件描述符",
      "html": "餐厅里的每张桌子都要占一个桌号，服务员能同时照看的桌数有上限。Linux 里的连接也一样：每打开一个文件或 socket，内核就分配一个文件描述符；进程能持有的 fd 数量有上限，达到上限后再接新连接就会被拒绝。<br>这个类比的边界是：桌子不够时可以让客人等位，fd 不够时新连接通常直接失败；而且 fd 不只被连接占用，日志文件、管道、定时器、上游连接都会消耗。做预算时不能只数「同时在线用户」，要把每个连接背后的 fd 都算进去。"
    },
    {
      "type": "text",
      "title": "进程、线程与文件描述符",
      "html": "进程是资源分配的单位，线程是调度的单位；同一个进程内的线程共享 fd 表。每个 TCP 连接在进程里对应一个 socket fd；如果反向代理还要连上游，那么一个客户端连接可能对应两个 fd：客户端 socket 与上游 socket。除此之外，日志文件、配置文件、epoll 实例、管道也占 fd。<br>Linux 对 fd 的限制有多层：系统级上限、用户级 ulimit、进程级限制。只调大其中一层，其他层仍可能先撞线。容器环境还要注意，容器内的限制可能与宿主机不同；编排平台可能覆盖 ulimit。<br>排查 fd 耗尽的顺序是：先看当前打开数与上限，再按进程与连接状态分类，确认是长连接堆积、上游连接泄漏，还是文件句柄未关闭。调大上限只是争取时间，不解决泄漏。"
    },
    {
      "type": "text",
      "title": "IO 模型与 page cache",
      "html": "阻塞 IO 在读写未就绪时会把线程挂起；一个连接一个线程的模型在连接数上升时，线程切换与内存开销会迅速变大。非阻塞 IO 让调用立即返回，但需要应用自己轮询；IO 多路复用（select/poll/epoll）把「等待哪些 fd 就绪」交给内核，一个线程可以管理大量连接，这也是 Nginx 高并发的基础。<br>page cache 是内核用空闲内存缓存文件页的机制。读文件时如果命中 page cache，就不需要访问磁盘，延迟从毫秒级降到微秒级；写操作通常先写入 page cache，再由内核刷盘。它解释了为什么「第一次读慢、第二次读快」，也解释了为什么内存不足时缓存会失效、延迟会突然上升。<br>但 page cache 不是万能的：它对网络 socket 的缓冲是另一套机制；大文件顺序读会污染缓存，把热数据挤出去；容器内存限制下，page cache 也会参与内存核算。理解这些边界，才能判断一次「变慢」是磁盘、内存还是连接数的问题。"
    },
    {
      "type": "code",
      "title": "平滑加权轮询",
      "lang": "javascript",
      "code": "function createWeightedRoundRobin(servers) {\n  const list = servers.map((server) => ({\n    name: server.name,\n    weight: server.weight,\n    healthy: server.healthy !== false,\n    current: 0\n  }));\n  return {\n    pick() {\n      const candidates = list.filter((server) => server.healthy && server.weight > 0);\n      if (candidates.length === 0) return null;\n      let total = 0;\n      let best = null;\n      for (const server of candidates) {\n        total += server.weight;\n        server.current += server.weight;\n        if (best === null || server.current > best.current) best = server;\n      }\n      best.current -= total;\n      return best.name;\n    }\n  };\n}",
      "note": "每次给所有候选加上权重，选 current 最大者，再减去总权重；这样权重 5:1:1 会均匀分布，而不是连续五次打在同一台。"
    },
    {
      "type": "code",
      "title": "fd 预算检查",
      "lang": "javascript",
      "code": "function checkFdBudget({ systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve }) {\n  const values = { systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve };\n  for (const [name, value] of Object.entries(values)) {\n    if (!Number.isFinite(value) || value <= 0) throw new Error('INVALID_' + name.toUpperCase());\n  }\n  const required = workerProcesses * connectionsPerWorker * filesPerConnection + reserve;\n  return {\n    ok: required <= systemLimit,\n    required,\n    headroom: systemLimit - required\n  };\n}",
      "note": "filesPerConnection 要包含客户端与上游两侧；reserve 留给日志、配置、epoll 等非连接 fd，不能省略。"
    },
    {
      "type": "table",
      "title": "Nginx 关键配置",
      "head": ["配置", "作用", "常见问题"],
      "rows": [
        ["worker_connections", "每个 worker 可处理的连接数", "只调这一项，忽略系统与进程 fd 上限"],
        ["keepalive", "到上游的长连接数量", "设得过大占 fd，过小则频繁握手"],
        ["proxy_connect_timeout", "与上游建立连接的超时", "过长导致故障时请求堆积"],
        ["proxy_read_timeout", "等待上游响应的超时", "与下游重试叠加，放大故障"],
        ["proxy_next_upstream", "哪些错误切换到下一台上游", "把非幂等请求重试到其他实例"],
        ["proxy_buffering", "是否缓冲上游响应", "大响应下缓冲占内存，关闭又影响慢客户端"]
      ]
    },
    {
      "type": "case",
      "title": "压测时大量 502",
      "context": "LinkHub 在网关后面加了 Nginx 反向代理。压测从 2000 并发提升到 8000 并发时，错误率突然升高，Nginx 返回大量 502。",
      "symptom": "应用服务器 CPU 只有 40%，但 Nginx 日志显示 connect() failed 与 upstream timed out；同时系统日志出现 too many open files。",
      "cause": "Nginx worker 的 fd 上限没有随并发调整，且每个代理连接占用客户端与上游两个 fd；上游连接池过小，大量请求在建立连接阶段超时；重试策略把超时请求再次打到同一批上游，进一步挤占 fd。",
      "fix": "按并发与每连接 fd 数重算 worker_connections 与系统上限；扩大上游 keepalive 连接池；设置连接与读取超时，限制重试次数并只对幂等请求重试；把 fd 使用率纳入监控。",
      "prevention": "上线前做 fd 预算：worker 数 × 每 worker 连接数 × 每连接 fd 数 + 预留，必须小于系统上限；压测要覆盖高并发与上游故障两种场景。",
      "metric": "调整后 8000 并发下 502 降到 0，fd 使用率稳定在 60% 以下，上游连接建立时间低于 5ms。"
    },
    {
      "type": "pitfall",
      "title": "只调大 fd 上限、忽略 TIME_WAIT、超时叠加",
      "html": "现象一：遇到 too many open files 就把 ulimit 调到很大，但连接泄漏仍然存在，只是故障推迟。调大上限是缓解，不是修复；要找到未关闭的 fd 或失控的长连接。<br>现象二：大量短连接主动关闭后进入 TIME_WAIT，占用本地端口与 fd。TIME_WAIT 与主动关闭方有关；如果代理主动断开上游，TIME_WAIT 会堆积在代理侧。可以通过长连接、连接复用与合理的 keepalive 减少，而不是简单调内核参数。<br>现象三：连接超时、读取超时、重试次数、上游超时层层叠加，一次故障的恢复时间被放大数倍。每个超时都要有明确的上界，重试必须只针对幂等请求，并带退避与抖动。<br>预防方式：画一张超时链，标出每层的超时与重试；用故障注入验证最坏情况下的总耗时。"
    },
    {
      "type": "steps",
      "title": "反向代理接入 LinkHub",
      "steps": [
        { "title": "定义上游", "html": "列出应用实例与健康检查方式，明确权重与故障摘除策略。" },
        { "title": "算 fd 预算", "html": "按 worker 数、连接数、每连接 fd 数与预留计算，确认低于系统与容器上限。" },
        { "title": "设置超时链", "html": "连接、发送、读取、空闲超时分别设置，保证上游超时小于网关超时。" },
        { "title": "配置重试边界", "html": "只对幂等请求重试，限制次数，启用退避；非幂等请求失败直接返回。" },
        { "title": "验证与监控", "html": "压测高并发与上游故障；监控 fd 使用率、5xx、上游连接时间与 TIME_WAIT 数量。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试常问「Nginx 为什么用多路复用而不是一个连接一个线程」。可以回答：线程模型在连接数上升时会产生大量线程与上下文切换，每个线程还要占栈内存；多路复用让少量 worker 通过 epoll 管理大量连接，事件就绪时才处理，内存与切换成本更低。接着补充边界：多路复用适合 IO 密集型，不适合长时间 CPU 计算；如果业务处理阻塞，仍会拖住 worker，需要异步化或拆分。<br>如果被追问「fd 耗尽怎么排查」，按「当前打开数 → 上限 → 按进程/连接状态分类 → 找泄漏或长连接 → 再决定调参还是修复」的顺序回答，比直接说「调大 ulimit」更完整。"
    }
  ],
  "checks": [
    {
      "id": "b-linux-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "fd 耗尽",
      "prompt": "进程达到文件描述符上限时，最直接的现象是什么？",
      "question": "进程达到文件描述符上限时，最直接的现象是什么？",
      "options": [
        { "text": "新的 socket 或文件打开失败，可能出现 accept 失败、连接被拒绝或 502", "correct": true },
        { "text": "CPU 立即降到 0，进程自动退出", "correct": false },
        { "text": "所有已建立的连接立刻断开", "correct": false },
        { "text": "磁盘空间被写满，日志停止", "correct": false }
      ],
      "explain": "fd 是打开文件与 socket 的句柄，达到上限后新的打开操作失败；已有连接不一定断开，但新连接无法建立，代理层会表现为 accept 失败或 502。"
    },
    {
      "id": "b-linux-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "超时链",
      "prompt": "反向代理接入上游时，哪些超时必须显式设置？",
      "question": "反向代理接入上游时，哪些超时必须显式设置？",
      "options": [
        { "text": "与上游建立连接的超时", "correct": true },
        { "text": "等待上游响应的读取超时", "correct": true },
        { "text": "向客户端发送响应的超时", "correct": true },
        { "text": "空闲长连接的 keepalive 超时", "correct": true },
        { "text": "客户端用户的思考时间", "correct": false }
      ],
      "explain": "连接、读取、发送与空闲超时都属于代理层可控的时间边界；用户的思考时间不是服务端超时配置，但可以通过客户端超时与限流间接约束。"
    },
    {
      "id": "b-linux-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "page cache",
      "prompt": "为什么文件读取命中 page cache 时延迟会明显降低？",
      "question": "为什么文件读取命中 page cache 时延迟会明显降低？",
      "options": [
        { "text": "数据已经在内存中，不需要等待磁盘 IO", "correct": true },
        { "text": "page cache 会把文件压缩，减少字节数", "correct": false },
        { "text": "命中缓存后内核会跳过权限检查", "correct": false },
        { "text": "page cache 只对写操作生效，与读无关", "correct": false }
      ],
      "explain": "page cache 把文件页缓存在内存中，命中时直接拷贝内存数据，避免磁盘寻址与读取；权限检查仍然存在，也不会自动压缩文件。"
    }
  ],
  "exercises": [
    {
      "id": "b-linux-ex-1",
      "kind": "code",
      "title": "平滑加权轮询 + fd 预算",
      "brief": "实现两个纯函数。<code>createWeightedRoundRobin(servers)</code>：<code>servers</code> 为 <code>[{ name, weight, healthy }]</code>，返回 <code>{ pick }</code>；按平滑加权轮询返回服务器名，跳过不健康或权重不大于 0 的服务器，全部不可用时返回 <code>null</code>。<br><code>checkFdBudget({ systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve })</code>：返回 <code>{ ok, required, headroom }</code>，<code>required = workerProcesses × connectionsPerWorker × filesPerConnection + reserve</code>；任一参数不是正数时抛错。",
      "hint": "平滑轮询每次给候选加权重、选 current 最大者、再减总权重；fd 预算的 ok 是 required 小于等于 systemLimit。",
      "starter": "function createWeightedRoundRobin(servers) {\n  return {\n    pick() { return null; }\n  };\n}\n\nfunction checkFdBudget({ systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve }) {\n  return { ok: false, required: 0, headroom: 0 };\n}",
      "solution": "function createWeightedRoundRobin(servers) {\n  const list = servers.map((server) => ({\n    name: server.name,\n    weight: server.weight,\n    healthy: server.healthy !== false,\n    current: 0\n  }));\n  return {\n    pick() {\n      const candidates = list.filter((server) => server.healthy && server.weight > 0);\n      if (candidates.length === 0) return null;\n      let total = 0;\n      let best = null;\n      for (const server of candidates) {\n        total += server.weight;\n        server.current += server.weight;\n        if (best === null || server.current > best.current) best = server;\n      }\n      best.current -= total;\n      return best.name;\n    }\n  };\n}\n\nfunction checkFdBudget({ systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve }) {\n  const values = { systemLimit, workerProcesses, connectionsPerWorker, filesPerConnection, reserve };\n  for (const [name, value] of Object.entries(values)) {\n    if (!Number.isFinite(value) || value <= 0) throw new Error('INVALID_' + name.toUpperCase());\n  }\n  const required = workerProcesses * connectionsPerWorker * filesPerConnection + reserve;\n  return {\n    ok: required <= systemLimit,\n    required,\n    headroom: systemLimit - required\n  };\n}",
      "tests": [
        {
          "name": "权重比例正确",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 5 }, { name: 'b', weight: 1 }, { name: 'c', weight: 1 }]);\nconst counts = { a: 0, b: 0, c: 0 };\nfor (let i = 0; i < 7; i += 1) counts[rr.pick()] += 1;\nassert.deepEqual(counts, { a: 5, b: 1, c: 1 });"
        },
        {
          "name": "平滑顺序而非连续命中",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 5 }, { name: 'b', weight: 1 }, { name: 'c', weight: 1 }]);\nconst sequence = [];\nfor (let i = 0; i < 7; i += 1) sequence.push(rr.pick());\nassert.deepEqual(sequence, ['a', 'a', 'b', 'a', 'c', 'a', 'a']);"
        },
        {
          "name": "跳过不健康节点",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 5 }, { name: 'b', weight: 1, healthy: false }, { name: 'c', weight: 1 }]);\nconst sequence = [];\nfor (let i = 0; i < 6; i += 1) sequence.push(rr.pick());\nassert.deepEqual(sequence, ['a', 'a', 'a', 'c', 'a', 'a']);"
        },
        {
          "name": "全部不健康返回 null",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 1, healthy: false }, { name: 'b', weight: 1, healthy: false }]);\nassert.equal(rr.pick(), null);"
        },
        {
          "name": "权重为零的节点被跳过",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 1 }, { name: 'b', weight: 0 }]);\nassert.equal(rr.pick(), 'a');\nassert.equal(rr.pick(), 'a');"
        },
        {
          "name": "fd 预算通过",
          "code": "const result = checkFdBudget({ systemLimit: 10000, workerProcesses: 4, connectionsPerWorker: 100, filesPerConnection: 10, reserve: 500 });\nassert.equal(result.ok, true);\nassert.equal(result.required, 4500);\nassert.equal(result.headroom, 5500);"
        },
        {
          "name": "fd 预算不足",
          "code": "const result = checkFdBudget({ systemLimit: 4000, workerProcesses: 4, connectionsPerWorker: 100, filesPerConnection: 10, reserve: 500 });\nassert.equal(result.ok, false);\nassert.equal(result.required, 4500);\nassert.equal(result.headroom, -500);"
        },
        {
          "name": "预算刚好等于上限",
          "code": "const result = checkFdBudget({ systemLimit: 4500, workerProcesses: 4, connectionsPerWorker: 100, filesPerConnection: 10, reserve: 500 });\nassert.equal(result.ok, true);\nassert.equal(result.headroom, 0);"
        },
        {
          "name": "非法参数抛错",
          "code": "assert.throws(() => checkFdBudget({ systemLimit: -1, workerProcesses: 1, connectionsPerWorker: 1, filesPerConnection: 1, reserve: 1 }));\nassert.throws(() => checkFdBudget({ systemLimit: 10, workerProcesses: 0, connectionsPerWorker: 1, filesPerConnection: 1, reserve: 1 }));\nassert.throws(() => checkFdBudget({ systemLimit: 10, workerProcesses: 1, connectionsPerWorker: 1, filesPerConnection: 1, reserve: 0 }));"
        },
        {
          "name": "多轮循环后比例仍正确",
          "code": "const rr = createWeightedRoundRobin([{ name: 'a', weight: 3 }, { name: 'b', weight: 2 }, { name: 'c', weight: 1 }]);\nconst counts = { a: 0, b: 0, c: 0 };\nfor (let i = 0; i < 12; i += 1) counts[rr.pick()] += 1;\nassert.deepEqual(counts, { a: 6, b: 4, c: 2 });"
        }
      ]
    }
  ]
};
