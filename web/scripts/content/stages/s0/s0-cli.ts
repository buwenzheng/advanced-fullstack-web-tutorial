export const s0Cli = {
  "id": "s0-cli",
  "title": "命令行与排障：进程、端口、日志与 curl",
  "subtitle": "服务起不来时，先问机器三个问题：进程在吗、端口开着吗、日志说了什么。",
  "duration": 55,
  "status": "ready",
  "objectives": [
    "用进程、端口与日志工具定位「服务起不来」「端口被占」「DNS 不对」三类常见故障。",
    "解释常见信号与退出码，知道什么时候不该 kill -9。",
    "写出解析监听端口的脚本，能处理 IPv4、IPv6、同一进程多行、权限不足与畸形行。",
    "用 curl 与日志复现一次故障，写出「症状、层、命令、判据、下一步」的排查顺序。"
  ],
  "keywords": ["进程", "端口", "信号", "ss", "lsof", "curl", "日志", "排障"],
  "blocks": [
    {
      "type": "analogy",
      "title": "终端是后端的 DevTools",
      "html": "前端调试时有 DevTools：Elements 看结构，Network 看请求，Console 看错误。后端没有这样一个统一面板，终端就是它的 DevTools：<code>ps</code> 像任务管理器，<code>ss</code> 像端口监视器，日志像 Console。<br>差别在于终端没有「刷新」按钮。页面状态会自己重绘，机器状态不会；你必须主动执行命令、记录输出、比较前后差异。排障能力很大一部分不是背命令，而是知道「现在该看哪一层」。"
    },
    {
      "type": "text",
      "title": "进程、PID、父子关系与退出码",
      "html": "进程是正在运行的程序实例，PID 是它在这一刻的身份证。一个进程可以启动子进程，父进程退出后子进程可能被系统托管；如果子进程已经结束但父进程没有回收，它会短暂变成僵尸进程。前台进程占着终端，后台进程用 <code>&amp;</code> 或进程管理器启动。<br>退出码是进程留给外界的结论：0 通常表示成功，非 0 表示失败。进程管理器、CI 和 shell 脚本首先看退出码，再看日志。因此一个「日志里有错误但退出码为 0」的服务，会让自动化系统误判为成功。"
    },
    {
      "type": "table",
      "title": "常见信号",
      "head": ["信号", "默认行为", "典型来源", "使用建议"],
      "rows": [
        ["SIGTERM", "终止进程，进程可以注册处理函数做清理", "kill、进程管理器、容器停止", "首选；给进程关闭连接与刷新日志的机会"],
        ["SIGINT", "终止进程，通常可被处理", "终端 Ctrl-C", "本地开发常用；同样应处理清理"],
        ["SIGKILL", "立即终止，不能被捕获或忽略", "kill -9", "最后手段；会跳过清理、可能留下锁与子进程"],
        ["SIGHUP", "默认终止，也可用于重载配置", "终端断开、显式发送", "是否重载取决于程序是否注册处理函数"]
      ]
    },
    {
      "type": "steps",
      "title": "端口被占的五步排查",
      "steps": [
        { "title": "确认监听者", "html": "Linux 用 <code>ss -ltnp</code>，macOS 常用 <code>lsof -i</code>；先找到本地地址、端口与 PID。" },
        { "title": "确认命令", "html": "用 <code>ps -p &lt;pid&gt; -o pid,ppid,command</code> 看这个 PID 到底是什么程序，避免杀错同名进程。" },
        { "title": "确认归属", "html": "判断它是本项目、旧版本、还是另一个服务；记录父进程与启动目录，防止它被进程管理器自动拉起。" },
        { "title": "优雅终止", "html": "先发 SIGTERM，等待进程退出；确认它已经释放端口与连接。不要一上来就 SIGKILL。" },
        { "title": "重启验证", "html": "重新启动服务，再用 <code>ss</code> 与一次真实请求确认监听与响应都正常。" }
      ]
    },
    {
      "type": "text",
      "title": "环境变量与配置",
      "html": "很多「代码没改却起不来」的问题，最后都落在配置上：<code>.env</code> 没加载、<code>NODE_ENV</code> 不同、端口被环境变量覆盖、数据库地址指向旧环境。启动时先把关键配置打印成脱敏摘要，能省掉大量猜测。<br>配置要有明确优先级，例如命令行参数高于环境变量，环境变量高于默认值。密钥只从环境或密钥管理系统读取，不写进仓库，也不打印完整值。"
    },
    {
      "type": "table",
      "title": "DNS 与 hosts 排查",
      "head": ["工具", "用途", "判据"],
      "rows": [
        ["dig example.com", "查 DNS 记录与响应", "看 ANSWER 是否符合预期、TTL 是否过长"],
        ["getent hosts example.com", "按系统解析顺序查", "能复现应用看到的解析结果"],
        ["/etc/hosts", "本地覆盖解析", "确认是否有旧条目抢先命中"],
        ["curl --resolve", "绕过 DNS 指定 IP", "能连上说明问题在解析，不在服务"]
      ]
    },
    {
      "type": "code",
      "title": "日志检索",
      "lang": "bash",
      "code": "# 持续观察日志，并按 requestId 过滤\ntail -f logs/app.log | grep '\"requestId\":\"req-42\"'\n\n# 只看 error 级别，并提取关键字段\njq -c 'select(.level == \"error\") | {ts, requestId, msg}' logs/app.log\n\n# 统计最近一千行里各状态码出现次数\ntail -n 1000 logs/access.log | awk '{print $9}' | sort | uniq -c | sort -nr",
      "note": "日志要能按 requestId 串起来；没有 requestId 时，至少记录时间、进程、路由与错误类型。"
    },
    {
      "type": "pitfall",
      "title": "把 kill -9 当第一选择",
      "html": "现象：端口冲突时直接 <code>kill -9</code>，进程消失了，但下次启动仍然失败，或者数据库里留下未释放的锁、临时文件、半写入的数据。<br>原因：SIGKILL 不能被捕获，进程没有机会关闭连接、刷新日志、释放锁，也可能留下子进程。<br>发现方式：查看退出方式、是否有残留子进程、数据库锁等待、日志最后一行是否完整。<br>修复：先用 SIGTERM 并等待；确认进程确实退出后再考虑 SIGKILL；同时找到它被自动拉起的原因。<br>预防：给服务写优雅关闭逻辑；用进程管理器管理重启；排障脚本禁止默认使用 <code>kill -9</code>。"
    },
    {
      "type": "steps",
      "title": "故障 runbook",
      "steps": [
        { "title": "先分类症状", "html": "连接被拒绝、连接超时、DNS 失败、HTTP 5xx 是四类不同问题；分类错了，后面的命令都会白跑。" },
        { "title": "连接被拒绝", "html": "查目标端口是否监听、服务是否启动、地址是否绑定在预期网卡；必要时用 <code>curl -v</code> 看停在哪一行。" },
        { "title": "连接超时", "html": "查网络可达性、防火墙/安全组、目标是否过载；用 <code>curl --connect-timeout</code> 区分建连与响应等待。" },
        { "title": "DNS 失败", "html": "用 <code>dig</code> 与 <code>getent</code> 对照；用 <code>curl --resolve</code> 绕过解析验证服务本身。" },
        { "title": "HTTP 5xx", "html": "这时连接与协议都通了，去看服务日志、上游依赖与请求参数；不要继续在 DNS 或端口上打转。" }
      ]
    },
    {
      "type": "text",
      "title": "深挖：文件描述符、ulimit 与 TIME_WAIT",
      "html": "每个打开的文件、socket 与管道都占用文件描述符。进程能打开多少 fd 受 <code>ulimit -n</code> 限制，系统能同时维持多少连接还受内存、临时端口范围与内核参数影响。连接关闭后，主动关闭的一方可能进入 TIME_WAIT 一段时间，以确保迟到的报文不会污染新连接；高并发短连接场景下，这会占用端口与连接表资源。<br>这些上限都取决于操作系统与配置，不能背一个固定数字。排查连接数问题时，先看进程 fd 使用量、系统级连接数、临时端口范围与 TIME_WAIT 数量，再决定是复用连接、扩大上限还是改架构。"
    },
    {
      "type": "note",
      "title": "git 基本操作",
      "html": "排障也包括回答「哪次改动引入了问题」。<code>git status</code> 看工作区，<code>git diff</code> 看未提交改动，<code>git log</code> 看提交历史，<code>git bisect</code> 用二分法定位首次出问题的提交。回滚前先确认影响范围与数据库迁移是否可逆；不要用强制覆盖把别人的改动一起抹掉。"
    },
    {
      "type": "tip",
      "title": "面试延伸",
      "html": "面试问「线上服务突然连不上，前五分钟怎么办」，好的回答会先分类：是 DNS 失败、连接拒绝、连接超时，还是服务返回 5xx？然后给出每一类的第一条命令与判据，再谈修复。直接说「重启服务」通常说明没有排查模型。<br>追问「为什么不能 kill -9」时，要能说出清理、锁、日志与子进程的代价；追问「端口被占怎么办」时，要能先找 PID 与命令，再优雅终止，而不是背一条命令。"
    }
  ],
  "checks": [
    {
      "id": "s0-cli-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "端口与 PID",
      "prompt": "在 Linux 上，哪个命令可以直接查看监听端口及其对应的 PID？",
      "question": "在 Linux 上，哪个命令可以直接查看监听端口及其对应的 PID？",
      "options": [
        { "text": "ss -ltnp", "correct": true },
        { "text": "ls -l", "correct": false },
        { "text": "curl -I", "correct": false },
        { "text": "dig", "correct": false }
      ],
      "explain": "ss -ltnp 列出 TCP 监听端口并显示进程；lsof -i 也可以，但本题只给了 ss。ls 看文件，curl 发请求，dig 查 DNS，都不能直接给出监听端口与 PID。"
    },
    {
      "id": "s0-cli-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "信号与退出码",
      "prompt": "关于信号与退出码，以下哪些说法正确？",
      "question": "关于信号与退出码，以下哪些说法正确？",
      "options": [
        { "text": "SIGTERM 默认终止进程，但进程可以注册处理函数做清理", "correct": true },
        { "text": "SIGKILL 不能被捕获或忽略，进程没有机会执行清理", "correct": true },
        { "text": "SIGINT 只能由 kill -9 发送", "correct": false },
        { "text": "退出码 0 通常表示成功，非 0 表示失败", "correct": true },
        { "text": "kill -9 会等待进程把日志刷完再退出", "correct": false }
      ],
      "explain": "TERM 可被处理，KILL 不可捕获；INT 通常来自 Ctrl-C；退出码约定 0 成功、非 0 失败；KILL 不等待清理与日志刷新。"
    },
    {
      "id": "s0-cli-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "curl 失败分类",
      "prompt": "curl 报 Connection refused，最先应该查什么？",
      "question": "curl 报 Connection refused，最先应该查什么？",
      "options": [
        { "text": "目标端口是否有进程监听、服务是否启动", "correct": true },
        { "text": "TLS 证书是否过期", "correct": false },
        { "text": "响应体里的业务错误码", "correct": false },
        { "text": "浏览器缓存是否命中", "correct": false }
      ],
      "explain": "连接被拒绝通常意味着目标机器可达但端口没有监听；TLS 与 HTTP 都发生在连接之后，连接失败时也没有响应体可看。"
    }
  ],
  "exercises": [
    {
      "id": "s0-cli-ex-1",
      "kind": "code",
      "title": "解析监听端口",
      "brief": "把 ss -ltnp 或 lsof 的文本解析成 [{ address, port, pid, process }]。处理 IPv4、IPv6、同一进程多行、权限不足（没有 users 信息）与畸形行；按端口升序稳定排序。",
      "hint": "ss 的本地地址在第 4 列，lsof 的本地地址在 TCP/TCP6 之后；IPv6 地址用最后一个冒号切端口；没有 users 时 pid 与 process 填 null。",
      "starter": "function parseListeners(output) {\n  return String(output || '')\n    .split('\\n')\n    .map((line) => {\n      const match = /(\\d+\\.\\d+\\.\\d+\\.\\d+):(\\d+).*pid=(\\d+)/.exec(line);\n      if (!match) return null;\n      return { address: match[1], port: Number(match[2]), pid: Number(match[3]), process: 'node' };\n    })\n    .filter(Boolean);\n}",
      "solution": "function parseListeners(output) {\n  const entries = [];\n  const lines = String(output || '').split(/\\r?\\n/);\n\n  for (const raw of lines) {\n    const line = raw.trim();\n    if (!line) continue;\n    let entry = null;\n\n    if (line.startsWith('LISTEN')) {\n      const parts = line.split(/\\s+/);\n      const local = parts[3];\n      const match = local ? /^(.*):(\\d+)$/.exec(local) : null;\n      if (!match) continue;\n      const address = match[1].replace(/^\\[|\\]$/g, '');\n      const port = Number(match[2]);\n      if (!Number.isInteger(port) || port <= 0) continue;\n      const user = /users:\\(\\(\"([^\"]+)\",pid=(\\d+)/.exec(line);\n      entry = {\n        address,\n        port,\n        pid: user ? Number(user[2]) : null,\n        process: user ? user[1] : null,\n      };\n    } else if (line.includes('(LISTEN)')) {\n      const parts = line.split(/\\s+/);\n      const pid = Number(parts[1]);\n      if (!Number.isInteger(pid)) continue;\n      let protocolIndex = parts.indexOf('TCP');\n      if (protocolIndex < 0) protocolIndex = parts.indexOf('TCP6');\n      if (protocolIndex < 0) continue;\n      const local = parts[protocolIndex + 1];\n      const match = local ? /^(.*):(\\d+)$/.exec(local) : null;\n      if (!match) continue;\n      const address = match[1].replace(/^\\[|\\]$/g, '');\n      entry = { address, port: Number(match[2]), pid, process: parts[0] };\n    }\n\n    if (entry) entries.push(entry);\n  }\n\n  return entries.sort((left, right) => left.port - right.port);\n}",
      "tests": [
        {
          "name": "解析 IPv4 ss 行",
          "code": "assert.deepStrictEqual(parseListeners('LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))'), [{ address: '0.0.0.0', port: 3000, pid: 1234, process: 'node' }]);"
        },
        {
          "name": "解析 IPv6 ss 行",
          "code": "assert.deepStrictEqual(parseListeners('LISTEN 0 511 [::]:3000 [::]:* users:((\"node\",pid=1234,fd=24))'), [{ address: '::', port: 3000, pid: 1234, process: 'node' }]);"
        },
        {
          "name": "同一进程的 IPv4 与 IPv6 两行都保留",
          "code": "const output = [\n  'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))',\n  'LISTEN 0 511 [::]:3000 [::]:* users:((\"node\",pid=1234,fd=24))',\n].join('\\n');\nassert.deepStrictEqual(parseListeners(output), [\n  { address: '0.0.0.0', port: 3000, pid: 1234, process: 'node' },\n  { address: '::', port: 3000, pid: 1234, process: 'node' },\n]);"
        },
        {
          "name": "两个进程的监听各自保留 PID",
          "code": "const output = [\n  'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))',\n  'LISTEN 0 511 127.0.0.1:8000 0.0.0.0:* users:((\"python3\",pid=5678,fd=5))',\n].join('\\n');\nassert.deepStrictEqual(parseListeners(output).map(({ port, pid, process }) => ({ port, pid, process })), [\n  { port: 3000, pid: 1234, process: 'node' },\n  { port: 8000, pid: 5678, process: 'python3' },\n]);"
        },
        {
          "name": "权限不足时保留端口并把 PID 置空",
          "code": "assert.deepStrictEqual(parseListeners('LISTEN 0 128 127.0.0.1:5432 0.0.0.0:*'), [{ address: '127.0.0.1', port: 5432, pid: null, process: null }]);"
        },
        {
          "name": "畸形行跳过，只返回有效监听",
          "code": "const output = [\n  '',\n  'LISTEN garbage',\n  'not a listener',\n  'LISTEN 0 511 127.0.0.1:9000 0.0.0.0:* users:((\"node\",pid=77,fd=9))',\n].join('\\n');\nassert.deepStrictEqual(parseListeners(output), [{ address: '127.0.0.1', port: 9000, pid: 77, process: 'node' }]);"
        },
        {
          "name": "端口按数字升序排列",
          "code": "const output = [\n  'LISTEN 0 511 0.0.0.0:5432 0.0.0.0:*',\n  'LISTEN 0 511 0.0.0.0:80 0.0.0.0:*',\n  'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:*',\n].join('\\n');\nassert.deepStrictEqual(parseListeners(output).map((item) => item.port), [80, 3000, 5432]);"
        },
        {
          "name": "解析 lsof 风格行",
          "code": "assert.deepStrictEqual(parseListeners('node 4321 alice 23u IPv4 0x1234 0t0 TCP 127.0.0.1:8080 (LISTEN)'), [{ address: '127.0.0.1', port: 8080, pid: 4321, process: 'node' }]);"
        }
      ]
    },
    {
      "id": "s0-cli-ex-2",
      "kind": "design",
      "title": "故障排查 runbook",
      "brief": "本地 npm run dev 报 EADDRINUSE；部署后 curl 超时；域名解析到旧 IP。请写出排查顺序、每一步的命令与判据，以及修复后的验证方式。",
      "specs": [
        { "label": "症状", "value": "本地端口冲突；部署环境请求超时；域名仍指向旧地址。" },
        { "label": "要求", "value": "先分类症状，再逐层验证；不直接 kill -9；记录时间线。" }
      ],
      "checklist": [
        "先确认现象类型（拒绝、超时、DNS、5xx），不先改代码",
        "用 ss 或 lsof 确认进程与端口",
        "确认启动命令、工作目录与环境变量",
        "用 dig、getent 或 curl --resolve 区分解析与连接",
        "每一步都有明确判据与下一步",
        "不直接 kill -9，先尝试优雅终止",
        "记录时间线与每次变更",
        "给出修复后的验证命令"
      ],
      "reference": "<ul><li><strong>端口冲突</strong>：先用 <code>ss -ltnp</code> 找 PID，再用 <code>ps</code> 确认命令；确定是旧版本或另一个服务后，先 SIGTERM，等待退出，再重启验证。</li><li><strong>部署后超时</strong>：用 <code>curl -v</code> 与 <code>--connect-timeout</code> 区分建连与响应等待；检查安全组、监听地址、服务是否绑定 0.0.0.0 或指定网卡。</li><li><strong>DNS 旧 IP</strong>：用 <code>dig</code> 与 <code>getent</code> 对照；用 <code>curl --resolve</code> 绕过解析验证服务；确认 TTL 与递归缓存，必要时等待或调整记录。</li><li><strong>验证</strong>：修复后重跑同一条 curl 命令，检查状态码与耗时；记录命令、输出与时间线，避免只留下「已重启」。</li></ul>"
    }
  ]
};
