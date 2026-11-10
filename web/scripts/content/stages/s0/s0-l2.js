export const s0L2 = {
  "id": "s0-l2",
  "title": "Node.js/Python 运行时：事件循环与并发模型",
  "subtitle": "异步不是「不占资源」，而是把等待放到正确的队列里。",
  "duration": 60,
  "status": "ready",
  "objectives": [
    "说出 Node 事件循环的主要阶段，解释微任务、process.nextTick 与宏任务的执行顺序，并说明哪些顺序不能死记。",
    "判断一段代码是阻塞事件循环、占用 libuv 线程池，还是只排队微任务，并能用 event loop lag 与线程池证据定位。",
    "写出带并发上限的调度器：结果顺序与输入一致、拒绝可传播、非法上限有确定行为。",
    "对比 Node 与 Python 的并发模型，为 I/O 密集与 CPU 密集任务选择 asyncio、线程、多进程或队列。"
  ],
  "keywords": ["事件循环", "libuv", "线程池", "微任务", "GIL", "asyncio", "并发"],
  "blocks": [
    {
      "type": "analogy",
      "title": "同一个厨房，两套排队规则",
      "html": "把 Node 进程想成一家只有一个主厨的餐厅：主厨（主线程）一次只能做一件事；配菜台（libuv 线程池）可以同时处理几份耗时的准备工作；点菜单（就绪队列）按顺序把任务递给主厨。任何需要主厨亲自完成的同步代码，都会让所有等待中的客人一起等。<br>Python 的 asyncio 更像同一间厨房里的另一套排班：仍然只有一个主厨，但任务会在「等待烤箱」时主动让出位置。这个类比在「网络 I/O」处要修正：网络 socket 的等待通常由操作系统事件通知，不占配菜台；真正占线程池的是文件、DNS 查询、部分加密与压缩等操作。"
    },
    {
      "type": "text",
      "title": "阶段与两次清空",
      "html": "Node 事件循环按阶段推进：timers 处理定时器回调，pending 处理部分系统事件，poll 等待并处理 I/O，check 处理 setImmediate，close 处理关闭回调。每个宏任务回调结束后，运行时都会先清空 process.nextTick 队列，再清空 Promise 微任务队列，然后才进入下一个回调。<br>因此「异步就一定不阻塞」是错的：一个很长的同步循环仍然占着主线程；一个递归的 Promise 链也会让微任务队列一直有活干，饿死后面的 I/O。顶层 setTimeout(0) 与 setImmediate 的先后顺序还受启动时机与定时器精度影响，不要把它当成可以背诵的固定答案。"
    },
    {
      "type": "table",
      "title": "会阻塞、会排队、只排微任务",
      "head": ["代码形态", "占用资源", "典型现象"],
      "rows": [
        ["readFileSync、超大 JSON.parse、while(true)", "主线程", "event loop lag 上升，所有请求一起变慢"],
        ["fs.readFile、dns.lookup、crypto.pbkdf2、zlib", "libuv 线程池（默认 4 个线程）", "lag 可能不高，但任务排队，尾延迟变长"],
        ["网络 socket 的读写", "操作系统事件通知", "等待时不占线程，回调到达后进入 poll 阶段"],
        ["Promise.then、queueMicrotask", "微任务队列", "单个回调很短，但递归可饿死 I/O"],
        ["setTimeout、setInterval", "timers 阶段", "只登记定时器，不代表准时执行"]
      ]
    },
    {
      "type": "code",
      "title": "观察一次 I/O 回调前后的顺序",
      "lang": "javascript",
      "code": "import fs from 'node:fs';\n\nconsole.log('A sync');\nprocess.nextTick(() => console.log('B nextTick'));\nPromise.resolve().then(() => console.log('C promise'));\nsetTimeout(() => console.log('D timeout'), 0);\nsetImmediate(() => console.log('E immediate'));\n\nfs.readFile(import.meta.filename, () => {\n  console.log('F io callback');\n  process.nextTick(() => console.log('G nextTick in io'));\n  Promise.resolve().then(() => console.log('H promise in io'));\n  setImmediate(() => console.log('I immediate in io'));\n  setTimeout(() => console.log('J timeout in io'), 0);\n});",
      "note": "稳定的是「同步代码先执行」「I/O 回调内 nextTick 先于 Promise」「I/O 回调内 setImmediate 通常先于 setTimeout(0)」；顶层 D 与 E 的先后不要当作规范。"
    },
    {
      "type": "compare",
      "title": "Node 与 Python 的并发模型",
      "cols": [
        { "title": "Node.js", "items": ["libuv 事件循环 + 线程池", "I/O 等待不占主线程，但文件类操作占线程池", "CPU 密集任务可用 worker_threads 或拆进程", "默认线程池大小可配置，但仍是有限资源"] },
        { "title": "Python", "items": ["默认 CPython 有 GIL，线程不能并行执行字节码", "asyncio 是单线程协作式调度", "I/O 等待会释放 GIL，线程仍有价值", "CPU 密集任务通常用多进程或原生扩展"] }
      ]
    },
    {
      "type": "pitfall",
      "title": "未处理拒绝与 process.exit",
      "html": "现象：进程突然消失，最后一条日志缺失，正在处理的请求被硬切；或者只在日志里看到一句「UnhandledPromiseRejection」。<br>原因：Node 15+ 对未处理的 Promise 拒绝默认以非零码退出；<code>process.exit()</code> 不等待在途异步操作，也不会替你刷新所有输出缓冲。<br>发现方式：看退出码与最后一条日志，确认是否有异步调用没有 catch；在本地用故障注入让下游失败，观察进程行为。<br>修复：在请求边界捕获错误，给异步任务挂拒绝处理；用 server.close() 停止接收新请求，等待在途请求与日志落盘后再退出。<br>预防：把 unhandledRejection 当作缺陷而不是兜底；为优雅关闭写测试，确认进程不会在请求处理中直接消失。"
    },
    {
      "type": "steps",
      "title": "五步定位事件循环问题",
      "steps": [
        { "title": "先量化 lag", "html": "采集 event loop lag 的 P50 与 P99。lag 高通常说明主线程被长任务占住；lag 低但请求慢，要继续看线程池与下游。" },
        { "title": "看 CPU profile", "html": "找长同步函数：大对象序列化、正则回溯、同步压缩、循环里的数据库调用。profile 能指出具体调用栈。" },
        { "title": "看线程池", "html": "确认慢操作是否属于 fs、dns.lookup、crypto、zlib；如果是，线程池排队可能才是尾延迟来源，而不是主线程。" },
        { "title": "看微任务饥饿", "html": "检查是否有递归 Promise 链或大量 queueMicrotask；它们会让 I/O 回调迟迟得不到执行。" },
        { "title": "同负载复测", "html": "修复后用相同并发与数据量复测 lag、吞吐与 P99；只看单次请求变快不算验证。" }
      ]
    },
    {
      "type": "text",
      "title": "深挖：三块并发与各自天花板",
      "html": "事件循环、线程池、微任务队列是三块独立资源，各有自己的饱和点。主线程的吞吐上限取决于单个回调能占用多久：一个 200ms 的同步任务在每秒 10 个请求时就会把主线程占满。libuv 线程池默认只有 4 个线程，40 个各约 30ms 的异步读文件任务会分批执行，量级接近 300ms，而 event loop lag 可能仍然很低；这说明瓶颈在配菜台，不在主厨。微任务没有配额，递归 Promise 链可以无限占用当前轮次之后的清空时间，让 poll 阶段得不到机会。<br>再往上还有进程级扩展：worker_threads 让 CPU 密集任务拥有独立事件循环，cluster 让多个进程共享端口，外部队列把任务移出请求进程。它们都不是免费的：worker 有启动与消息传递成本，cluster 有内存复制与连接分发成本，队列有额外延迟与运维复杂度。选择扩展方式前，先确认瓶颈到底在哪一块资源。"
    },
    {
      "type": "table",
      "title": "主线程、worker、cluster 与队列",
      "head": ["方式", "适用场景", "主要成本", "典型失败模式"],
      "rows": [
        ["主线程异步", "I/O 等待、轻量计算", "仍受单回调时长限制", "同步长任务把整个进程卡住"],
        ["worker_threads", "CPU 密集、需要共享进程内状态", "启动、消息序列化、内存", "线程数过多反而增加调度开销"],
        ["cluster / 多进程", "利用多核、隔离故障", "内存复制、连接分发、进程管理", "进程间状态不一致、日志分散"],
        ["外部队列", "削峰、重试、跨服务解耦", "额外延迟、运维与一致性", "重复消费、积压、死信堆积"]
      ]
    },
    {
      "type": "note",
      "title": "Python GIL 的边界",
      "html": "GIL 限制的是同一进程内多个线程并行执行 Python 字节码，不是所有等待都不能并发。线程在 I/O 等待时会释放 GIL，所以 I/O 密集任务仍可用线程；但 CPU 密集任务用线程通常不会更快，应该用多进程或把热点移到原生扩展。asyncio 是单线程协作式调度，适合大量 I/O 等待，不适合在里面写长同步计算。<br>「自由线程」构建是否可用取决于 Python 版本与构建选项，不能把它当成默认前提。"
    },
    {
      "type": "tip",
      "title": "面试延伸",
      "html": "面试里问「为什么异步读文件也会排队」，好的回答会区分主线程、libuv 线程池与操作系统事件通知，并说明线程池默认大小可以配置但仍是有限资源。问「40 个 30ms 的读文件为什么接近 300ms」，要能先确认 lag 是否正常，再推断是线程池分批，而不是主线程阻塞。<br>问「Python 有 GIL 为什么还要用线程」，要回答 I/O 等待会释放 GIL，以及 asyncio 与线程池各自的适用边界。结论要落在任务类型与测量证据上，而不是语言优劣。"
    }
  ],
  "checks": [
    {
      "id": "s0-l2-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "阻塞事件循环",
      "prompt": "下面哪一段代码会直接阻塞 Node 事件循环，让同一进程内的其他请求一起等待？",
      "question": "下面哪一段代码会直接阻塞 Node 事件循环，让同一进程内的其他请求一起等待？",
      "options": [
        { "text": "await fs.promises.readFile(path)", "correct": false },
        { "text": "setTimeout(() => {}, 0)", "correct": false },
        { "text": "fs.readFileSync(path) 写在请求处理函数里", "correct": true },
        { "text": "Promise.resolve().then(() => {})", "correct": false }
      ],
      "explain": "readFileSync 在主线程同步等待磁盘，期间无法处理其他回调；fs.promises.readFile 把读操作交给线程池；setTimeout 只是登记定时器；空的 Promise 回调是极短的微任务。"
    },
    {
      "id": "s0-l2-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "事件循环事实",
      "prompt": "关于 Node 事件循环与未处理拒绝，以下哪些说法正确？",
      "question": "关于 Node 事件循环与未处理拒绝，以下哪些说法正确？",
      "options": [
        { "text": "Node 中 process.nextTick 回调先于 Promise 微任务执行", "correct": true },
        { "text": "每个宏任务回调结束后，运行时会清空微任务队列", "correct": true },
        { "text": "在 I/O 回调内注册的 setImmediate 通常先于 setTimeout(0) 执行", "correct": true },
        { "text": "顶层 setTimeout(0) 与 setImmediate 的顺序在所有 Node 版本中固定", "correct": false },
        { "text": "Node 15+ 未处理的 Promise 拒绝默认导致进程以非零码退出", "correct": true }
      ],
      "explain": "nextTick 队列优先于 Promise 微任务；每个宏任务回调后会清空微任务；I/O 回调内下一轮先进入 check 阶段，所以 setImmediate 通常更早；顶层顺序受启动时机与定时器精度影响；Node 15+ 的未处理拒绝默认会终止进程。"
    },
    {
      "id": "s0-l2-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "线程池排队",
      "prompt": "服务对 40 个文件各执行一次 fs.readFile，每次约 30ms，总耗时接近 300ms，但 event loop lag P99 只有 5ms。最可能的原因是什么？",
      "question": "服务对 40 个文件各执行一次 fs.readFile，每次约 30ms，总耗时接近 300ms，但 event loop lag P99 只有 5ms。最可能的原因是什么？",
      "options": [
        { "text": "主线程被同步读文件阻塞", "correct": false },
        { "text": "libuv 线程池默认 4 个线程，40 个读任务在队列中分批执行", "correct": true },
        { "text": "DNS 解析拖慢了文件读取", "correct": false },
        { "text": "微任务队列饥饿导致 I/O 无法回调", "correct": false }
      ],
      "explain": "lag 低说明主线程仍在按时调度，排除同步阻塞；异步文件读取占用线程池，默认 4 个线程，40 个任务约分 10 批，每批 30ms，量级接近 300ms；文件读取不经过 DNS；微任务饥饿会推高 lag。"
    }
  ],
  "exercises": [
    {
      "id": "s0-l2-ex-1",
      "kind": "code",
      "title": "带并发上限的任务调度器",
      "brief": "p0 探针要同时检查多个 URL，但不能无限并发打满本机线程池或下游。实现 runWithLimit(tasks, limit)：tasks 是返回 Promise 或普通值的无参函数数组；结果顺序与输入一致；任一任务拒绝时整体拒绝；limit 不是正整数时按 1 处理。",
      "hint": "维护 next 游标与 active 计数，启动时不要超过 limit；成功时按下标写回结果；失败时标记终止并拒绝；为每个已启动任务挂拒绝处理。",
      "starter": "function runWithLimit(tasks, limit) {\n  return Promise.all(tasks.map((task) => task()));\n}",
      "solution": "function runWithLimit(tasks, limit) {\n  const size = tasks.length;\n  if (size === 0) return Promise.resolve([]);\n  const max = Number.isInteger(limit) && limit > 0 ? Math.min(limit, size) : 1;\n  const results = new Array(size);\n  let next = 0;\n  let active = 0;\n  let settled = false;\n\n  return new Promise((resolve, reject) => {\n    const launch = () => {\n      if (settled) return;\n      while (active < max && next < size) {\n        const index = next;\n        next += 1;\n        active += 1;\n        Promise.resolve()\n          .then(() => tasks[index]())\n          .then(\n            (value) => {\n              results[index] = value;\n              active -= 1;\n              if (next === size && active === 0) resolve(results);\n              else launch();\n            },\n            (error) => {\n              if (settled) return;\n              settled = true;\n              reject(error);\n            },\n          );\n      }\n    };\n    launch();\n  });\n}",
      "tests": [
        {
          "name": "峰值并发不超过上限",
          "code": "const gates = [];\nlet active = 0;\nlet peak = 0;\nlet started = 0;\nconst tasks = Array.from({ length: 4 }, (_, index) => () => {\n  active += 1;\n  started += 1;\n  peak = Math.max(peak, active);\n  return new Promise((resolve) => {\n    gates[index] = () => { active -= 1; resolve(index); };\n  });\n});\nconst flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };\nconst promise = runWithLimit(tasks, 2);\nawait flush();\nassert.strictEqual(started, 2);\ngates[0]();\nawait flush();\nassert.strictEqual(started, 3);\ngates[1]();\nawait flush();\nassert.strictEqual(started, 4);\ngates[2]();\ngates[3]();\nconst result = await promise;\nassert.deepStrictEqual(result, [0, 1, 2, 3]);\nassert.strictEqual(peak, 2);"
        },
        {
          "name": "结果顺序与完成顺序解耦",
          "code": "const gates = [];\nconst tasks = ['a', 'b', 'c'].map((value, index) => () => new Promise((resolve) => {\n  gates[index] = () => resolve(value);\n}));\nconst flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };\nconst promise = runWithLimit(tasks, 3);\nawait flush();\nassert.strictEqual(gates.length, 3);\ngates[1]();\nawait flush();\ngates[2]();\nawait flush();\ngates[0]();\nassert.deepStrictEqual(await promise, ['a', 'b', 'c']);"
        },
        {
          "name": "任务拒绝时整体拒绝",
          "code": "const gates = [];\nlet started = 0;\nconst tasks = [0, 1, 2].map((index) => () => {\n  started += 1;\n  return new Promise((resolve, reject) => {\n    gates[index] = { resolve, reject };\n  });\n});\nconst flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };\nconst promise = runWithLimit(tasks, 2);\nawait flush();\nassert.strictEqual(started, 2);\ngates[1].reject(new Error('boom'));\nawait assert.rejects(promise, /boom/);\ngates[0].resolve('a');\nassert.strictEqual(started, 2);"
        },
        {
          "name": "limit=0 按 1 处理",
          "code": "const gates = [];\nlet active = 0;\nlet peak = 0;\nconst tasks = Array.from({ length: 3 }, (_, index) => () => {\n  active += 1;\n  peak = Math.max(peak, active);\n  return new Promise((resolve) => {\n    gates[index] = () => { active -= 1; resolve(index); };\n  });\n});\nconst flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };\nconst promise = runWithLimit(tasks, 0);\nawait flush();\nassert.strictEqual(active, 1);\ngates[0]();\nawait flush();\nassert.strictEqual(active, 1);\ngates[1]();\nawait flush();\nassert.strictEqual(active, 1);\ngates[2]();\nassert.deepStrictEqual(await promise, [0, 1, 2]);\nassert.strictEqual(peak, 1);"
        },
        {
          "name": "limit 大于任务数时全部启动",
          "code": "const gates = [];\nlet active = 0;\nlet peak = 0;\nconst tasks = Array.from({ length: 2 }, (_, index) => () => {\n  active += 1;\n  peak = Math.max(peak, active);\n  return new Promise((resolve) => {\n    gates[index] = () => { active -= 1; resolve(index); };\n  });\n});\nconst flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };\nconst promise = runWithLimit(tasks, 10);\nawait flush();\nassert.strictEqual(active, 2);\ngates[0]();\ngates[1]();\nassert.deepStrictEqual(await promise, [0, 1]);\nassert.strictEqual(peak, 2);"
        },
        {
          "name": "空数组立即返回空结果",
          "code": "let called = 0;\nconst result = await runWithLimit([], 2);\nassert.deepStrictEqual(result, []);\nassert.strictEqual(called, 0);"
        }
      ]
    },
    {
      "id": "s0-l2-ex-2",
      "kind": "design",
      "title": "支付回调服务代码审查",
      "brief": "下面这段代码在本机测试通过，上线后出现 P99 抖动、偶发重复扣款、进程重启时订单状态不一致。请从运行时视角审查：指出问题、对应线上现象、修复顺序与验证方式。",
      "specs": [
        { "label": "代码", "value": "<code>readFileSync</code> 在请求路径读取规则文件；<code>charge()</code> 没有 catch；没有幂等键；<code>uncaughtException</code> 后直接 <code>process.exit(1)</code>；外部调用没有超时；没有并发限制。" },
        { "label": "目标", "value": "让失败可解释、重复可避免、退出不丢在途请求。" }
      ],
      "checklist": [
        "指出 readFileSync 在请求路径中阻塞事件循环，并写出线上现象",
        "规则文件改为启动时读取一次或带失效策略的缓存，不在每请求同步解析",
        "指出 charge() 没有错误处理，异步失败会变成未处理拒绝",
        "指出没有幂等键，客户端或网关重试会重复扣款",
        "指出 process.exit(1) 会硬切在途请求、丢日志缓冲、跳过连接关闭",
        "为外部调用设置超时，并说明重试必须建立在幂等前提上",
        "入口增加并发限制或背压，避免线程池与下游被打满",
        "给出修复优先级与验证方式（故障注入、压测、日志与指标对照）"
      ],
      "reference": "<ul><li><strong>阻塞主线程</strong>：readFileSync 与每请求 JSON.parse 让 event loop lag 上升，表现为吞吐下降、P99 抖动。规则应在启动时加载，版本变更时原子替换缓存。</li><li><strong>未处理拒绝</strong>：charge() 失败没有 catch，Node 15+ 可能直接终止进程；要在请求边界捕获并返回稳定错误。</li><li><strong>重复扣款</strong>：没有幂等键，网关重试会重复执行；用订单号加唯一约束或幂等表。</li><li><strong>硬退出</strong>：uncaughtException 后 process.exit(1) 会丢在途请求与日志；应先停止接收新请求，等待在途请求与日志落盘。</li><li><strong>无超时与无背压</strong>：外部调用可能无限等待，线程池与下游会被打满；设置超时、退避与并发上限。</li><li><strong>验证</strong>：用故障注入让下游超时/失败，观察退出码、日志与订单状态；用压测对照修复前后的 lag 与 P99。</li></ul>"
    }
  ]
};
