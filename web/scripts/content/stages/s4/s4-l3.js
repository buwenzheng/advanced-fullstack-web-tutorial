export const s4L3 = {
  id: 's4-l3',
  title: '进程、容器与配置',
  subtitle: '信号与优雅退出、Docker 多阶段/非 root、配置与密钥、健康检查。',
  duration: 80,
  status: 'ready',
  objectives: [
    '处理 SIGTERM/SIGINT，做到优雅退出与在途请求排空。',
    '写多阶段、非 root、带健康检查的 Dockerfile。',
    '按环境管理配置与密钥，理解来源与优先级。',
    '解释容器生命周期、探针与重启策略，定位 OOMKilled 与信号未送达。'
  ],
  keywords: ['SIGTERM', '优雅退出', 'Docker', '多阶段构建', '非 root', '健康检查', 'liveness', 'readiness', 'cgroups', '配置', '密钥'],
  blocks: [
    {
      type: 'analogy',
      title: '关闭浏览器标签与服务 SIGTERM',
      html: '关闭一个还有未保存内容的标签页时，浏览器先弹出确认，让你保存或离开，再销毁页面。服务收到 SIGTERM 也一样：先停止接受新请求，把在途请求处理完，再关闭数据库连接并退出。<br>类比失效的地方在于强制终止：浏览器可以让你确认，服务如果直接收到 SIGKILL 就没有机会清理——正在写的事务会回滚，已经接下的请求会断开，队列消息可能重复。容器编排默认先发可捕获的 SIGTERM，等待一段宽限期，再发 SIGKILL；你要做的是在这个窗口内完成排空。'
    },
    {
      type: 'text',
      title: '进程生命周期与信号',
      html: 'SIGTERM 是「请你退出」的请求，进程可以捕获并执行清理；SIGKILL 是内核直接终止，无法捕获，也没有清理机会。SIGINT 通常来自 <code>Ctrl-C</code>，语义接近 SIGTERM。退出码 0 表示正常退出，非 0 表示异常；容器退出码 137 常见于 SIGKILL 或 OOMKilled，143 对应 SIGTERM。<br>优雅退出的顺序是固定的：停止接受新连接 → 等待在途请求完成或超时 → 关闭数据库、队列与文件句柄 → 以明确退出码结束。顺序反了，就会出现请求还在处理、依赖已经关闭的错误；没有超时，进程可能永远退不出去。'
    },
    {
      type: 'code',
      title: '优雅退出协调器',
      lang: 'javascript',
      code: `function createShutdown({
  server,
  timeoutMs = 10_000,
  onDrain = async () => {},
  scheduler = { setTimeout, clearTimeout },
} = {}) {
  let state = 'running';
  let pending = null;
  let result = null;
  let timer = null;

  function finalize(payload) {
    result = payload;
    state = 'closed';
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    return payload;
  }

  function begin() {
    return new Promise((resolve) => {
      state = 'draining';
      // 先挂超时，再 close：即使 close 回合同步触发，也能正确清理
      timer = scheduler.setTimeout(() => {
        if (state === 'closed') return;
        resolve(finalize({ forced: true, reason: 'TIMEOUT' }));
      }, timeoutMs);

      server.close(async (error) => {
        if (state === 'closed') return; // 超时后迟到的回调不能再排空
        if (error) {
          resolve(finalize({ forced: false, error }));
          return;
        }
        try {
          await onDrain();
          resolve(finalize({ forced: false }));
        } catch (drainError) {
          // 排空失败也要释放进程，但把错误交给调用方记录
          resolve(finalize({ forced: false, error: drainError }));
        }
      });
    });
  }

  function shutdown() {
    if (pending) return pending;
    if (state === 'closed') return Promise.resolve(result);
    pending = begin();
    return pending;
  }

  return {
    shutdown,
    state: () => state,
    isAccepting: () => state === 'running',
  };
}`,
      note: 'shutdown 必须幂等：重复信号、健康检查失败与编排重试都可能再次调用。超时后 close 回调仍可能到达，所以状态判断要放在回调最前面；排空失败与强制超时要能区分，便于告警与复盘。'
    },
    {
      type: 'flow',
      title: '从构建到重启的生命周期',
      steps: [
        { name: '构建镜像', detail: '多阶段构建只把运行所需文件放进最终层。失败表现：镜像包含源码、测试依赖或密钥。' },
        { name: '启动容器', detail: '以 exec form 启动主进程，PID 1 直接接收信号。失败表现：shell 包了一层，SIGTERM 停在 shell。' },
        { name: 'readiness 通过', detail: '依赖可用后才把实例加入负载均衡。失败表现：端口通了但数据库没连上，流量打进来就 500。' },
        { name: 'liveness 检查', detail: '只判断进程是否卡死，失败才重启。失败表现：把依赖检查放进 liveness，数据库抖动导致全量重启。' },
        { name: '收到 SIGTERM', detail: 'readiness 失败摘流量，应用排空在途请求。失败表现：进程立刻退出，客户端看到 502。' },
        { name: '超时后 SIGKILL', detail: '宽限期结束仍未退出则强制终止。失败表现：宽限期短于排空时间，长请求被截断。' }
      ]
    },
    {
      type: 'code',
      title: '多阶段、非 root 的 Dockerfile',
      lang: 'dockerfile',
      code: `# 构建阶段只负责安装依赖，最终镜像不保留 npm 缓存
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# 固定 UID/GID，避免不同环境权限漂移
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src

USER 10001:10001
EXPOSE 3000

# 用应用自带的 HTTP 客户端探活，不依赖镜像里是否有 curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec form：node 直接成为 PID 1，能收到 SIGTERM
CMD ["node", "src/server.js"]`,
      note: '构建上下文用 .dockerignore 排除 node_modules、.git 与本地密钥；基础镜像在真实项目里应固定到 digest 或明确版本。健康检查只证明进程能响应，不替代 readiness 对依赖的判断。'
    },
    {
      type: 'table',
      title: '配置来源与优先级',
      head: ['来源', '示例', '优先级', '风险'],
      rows: [
        ['命令行参数', '--port=3000', '最高', '容器里不易审计，可能覆盖平台注入值'],
        ['环境变量', 'DATABASE_URL', '高', '可能进入进程列表、日志或崩溃转储'],
        ['配置文件', '/etc/linkhub/config.json', '中', '镜像内文件易过期，通常需要挂载'],
        ['默认值', '代码内常量', '最低', '适合非敏感项，绝不能放密钥'],
        ['密钥管理', 'Secret Manager 或挂载文件', '按注入方式', '轮换、权限与审计要单独设计']
      ],
      note: '优先级不是绝对，取决于框架；关键是启动时一次性合并并校验，不要在请求路径上多次读取不同来源。'
    },
    {
      type: 'pitfall',
      title: 'PID 1 不转发信号与密钥进镜像',
      html: '现象：发布时实例被停止，客户端出现 502/504；日志里没有收到 SIGTERM 的记录；镜像层里能解出数据库密码；健康检查通过但流量一进来就 500；容器偶尔以 137 退出。<br>原因：用 shell 形式启动，PID 1 是 shell 而不转发信号；主进程直接 <code>process.exit</code>，没有排空；密钥在 build 时复制进镜像；探针只检查端口，不检查依赖；内存 limit 过低触发 OOMKilled。<br>发现方式：<code>docker stop</code> 后观察日志与在途请求；检查镜像的 Entrypoint/Cmd；扫描镜像层中的密钥；对照 readiness 与真实请求；看退出码是否 137。<br>修复：改用 exec form 或加 init 进程；注册 SIGTERM，先摘流量再排空；readiness 检查依赖，liveness 只检查进程；密钥运行时注入；按压测结果设置内存与 CPU limit。<br>预防：部署模板与 CI 镜像扫描；优雅退出纳入集成测试；每季度演练一次探针与回滚。'
    },
    {
      type: 'steps',
      title: '容器化 LinkHub API',
      steps: [
        { title: '写 .dockerignore', html: '排除 node_modules、.git、日志、本地 .env 与测试产物。观察点：构建上下文大小明显下降，镜像里没有本地密钥。' },
        { title: '多阶段构建', html: '依赖安装与运行分阶段，最终镜像只保留生产依赖和源码。观察点：镜像体积与层数可解释。' },
        { title: '非 root 与只读文件系统', html: '固定 UID/GID，关闭不需要的写权限。观察点：容器内进程不是 root，写文件按预期失败。' },
        { title: '启动并验证探针', html: 'readiness 检查数据库与缓存，liveness 只检查进程。观察点：依赖断开时 readiness 失败但容器不重启。' },
        { title: '验证优雅退出', html: '发 SIGTERM，保持一个慢请求，观察它完成后进程才退出。观察点：客户端无 502，日志有排空记录。' },
        { title: '注入配置与密钥', html: '非敏感配置用环境变量，密钥用挂载文件或 Secret Manager。观察点：镜像层扫描不到密钥。' },
        { title: '记录镜像摘要', html: '发布记录写镜像 digest、配置版本与回滚方式。观察点：能凭记录回到上一个可运行版本。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：cgroups、内存上限与 CPU 节流',
      html: '容器不是轻量虚拟机：namespace 隔离视图，cgroups 限制资源。内存 limit 是硬上限，超过会触发 OOM killer，进程收到 SIGKILL，退出码常见 137；这不是应用自己崩了，日志里可能什么都没有。CPU limit 用配额实现，超限时被节流，表现为延迟升高，但 CPU 使用率看起来并不高；requests 影响调度，limits 影响运行时上限。<br>所以资源限制要和压测及运行时指标一起定：内存 limit 至少要覆盖峰值堆、运行时与页缓存开销；CPU limit 过低会把 GC 和事件循环一起拖慢。探针也要分清：liveness 失败会重启容器，readiness 失败只摘流量；把依赖检查放进 liveness，会让数据库抖动引发全量重启。内核与 cgroups 细节在 a8，本讲只到「限制如何影响进程行为」。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「容器里为什么收不到 SIGTERM」先看 PID 1 是谁：shell 形式启动时信号发给 shell，应用收不到；用 exec form、tini 或应用内转发。再看编排的宽限期是否短于应用排空时间。<br>「如何做到零中断发布」回答三件事：readiness 先摘流量、连接排空与 keep-alive 处理、旧实例排空完成后再退出；再加滚动/蓝绿策略与回滚阈值。'
    }
  ],
  checks: [
    {
      id: 's4-l3-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '信号',
      prompt: 'SIGTERM 与 SIGKILL 的核心区别是什么？',
      question: 'SIGTERM 与 SIGKILL 的核心区别是什么？',
      options: [
        { text: 'SIGTERM 可被捕获并执行清理，SIGKILL 不能被捕获', correct: true },
        { text: 'SIGTERM 只能由 root 发送，SIGKILL 任何用户都能发送', correct: false },
        { text: 'SIGTERM 会立即终止进程，SIGKILL 会等待超时', correct: false },
        { text: '两者完全等价，只是名称不同', correct: false }
      ],
      explain: 'SIGTERM 是请求退出，应用可以捕获并排空；SIGKILL 由内核直接终止，无法捕获。编排先用 SIGTERM，超过宽限期才用 SIGKILL。'
    },
    {
      id: 's4-l3-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: 'Dockerfile',
      prompt: '以下哪些属于合理的 Dockerfile 实践？',
      question: '以下哪些属于合理的 Dockerfile 实践？',
      options: [
        { text: '用多阶段构建，只把运行所需文件放进最终镜像', correct: true },
        { text: '使用非 root 用户运行应用进程', correct: true },
        { text: '把数据库密码写在 ENV 指令里随镜像分发', correct: false },
        { text: '用 exec form 启动主进程，确保信号能送达', correct: true },
        { text: '每次都使用 latest 标签，保证拿到最新版本', correct: false }
      ],
      explain: '多阶段、非 root、exec form 都是可验证的良好实践。密钥写入 ENV 会留在镜像层；latest 标签不可复现，也无法精确回滚。'
    },
    {
      id: 's4-l3-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '配置与密钥',
      prompt: '生产环境的数据库密码最不应该怎么管理？',
      question: '生产环境的数据库密码最不应该怎么管理？',
      options: [
        { text: '由 Secret Manager 在运行时注入', correct: false },
        { text: '挂载为只读文件并限制权限', correct: false },
        { text: '在构建镜像时 COPY 进镜像层', correct: true },
        { text: '由编排平台从密钥存储注入环境变量', correct: false }
      ],
      explain: '镜像层会被推送、缓存与扫描，COPY 进去的密钥等同于公开。运行时注入、只读挂载与 Secret Manager 都需要配合权限和轮换，但至少不会把密钥固化在镜像里。'
    }
  ],
  exercises: [
    {
      id: 's4-l3-ex-1',
      kind: 'code',
      title: '优雅退出协调器',
      brief: '实现 createShutdown({ server, timeoutMs = 10000, onDrain = async () => {}, scheduler = { setTimeout, clearTimeout } } = {})。返回 { shutdown, state, isAccepting }。shutdown() 返回 Promise：调用后立即进入 draining 并拒绝新请求；server.close 回调后执行 onDrain；成功返回 { forced: false }，onDrain 抛错返回 { forced: false, error }；超过 timeoutMs 返回 { forced: true, reason: "TIMEOUT" }，迟到的 close 回调不得再执行排空。重复调用返回同一 Promise；closed 后再次调用返回同一结果。',
      hint: '用 pending 保存进行中的 Promise，state 用字符串表示。先注册超时再调用 server.close；close 回调入口先判断 state === "closed"。finalize 负责设置 closed、清理定时器并保存结果。',
      starter: `function createShutdown({ server, timeoutMs = 10_000, onDrain = async () => {}, scheduler = { setTimeout, clearTimeout } } = {}) {
  let closed = false;

  function shutdown() {
    server.close();
    return Promise.resolve({ forced: false });
  }

  return {
    shutdown,
    state: () => (closed ? 'closed' : 'running'),
    isAccepting: () => !closed,
  };
}`,
      solution: `function createShutdown({
  server,
  timeoutMs = 10_000,
  onDrain = async () => {},
  scheduler = { setTimeout, clearTimeout },
} = {}) {
  let state = 'running';
  let pending = null;
  let result = null;
  let timer = null;

  function finalize(payload) {
    result = payload;
    state = 'closed';
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    return payload;
  }

  function begin() {
    return new Promise((resolve) => {
      state = 'draining';
      timer = scheduler.setTimeout(() => {
        if (state === 'closed') return;
        resolve(finalize({ forced: true, reason: 'TIMEOUT' }));
      }, timeoutMs);

      server.close(async (error) => {
        if (state === 'closed') return;
        if (error) {
          resolve(finalize({ forced: false, error }));
          return;
        }
        try {
          await onDrain();
          resolve(finalize({ forced: false }));
        } catch (drainError) {
          resolve(finalize({ forced: false, error: drainError }));
        }
      });
    });
  }

  function shutdown() {
    if (pending) return pending;
    if (state === 'closed') return Promise.resolve(result);
    pending = begin();
    return pending;
  }

  return {
    shutdown,
    state: () => state,
    isAccepting: () => state === 'running',
  };
}`,
      tests: [
        {
          name: '正常排空后进入 closed',
          code: `function createScheduler() {
  let id = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { id += 1; timers.set(id, { fn, ms }); return id; },
    clearTimeout(handle) { timers.delete(handle); },
    advance(ms) {
      for (const [handle, timer] of [...timers]) {
        if (timer.ms <= ms) { timers.delete(handle); timer.fn(); }
      }
    },
  };
}
let closeCallback = null;
let closeCalls = 0;
const server = { close(callback) { closeCalls += 1; closeCallback = callback; } };
let drained = 0;
const scheduler = createScheduler();
const shutdown = createShutdown({
  server,
  timeoutMs: 1000,
  onDrain: async () => { drained += 1; },
  scheduler,
});
const pending = shutdown.shutdown();
assert.equal(shutdown.state(), 'draining');
closeCallback();
const result = await pending;
assert.equal(result.forced, false);
assert.equal(shutdown.state(), 'closed');
assert.equal(drained, 1);
assert.equal(closeCalls, 1);`
        },
        {
          name: '重复调用返回同一 Promise',
          code: `let closeCallback = null;
const server = { close(callback) { closeCallback = callback; } };
const scheduler = { setTimeout: () => 1, clearTimeout: () => {} };
const shutdown = createShutdown({ server, timeoutMs: 1000, scheduler });
const first = shutdown.shutdown();
const second = shutdown.shutdown();
assert.equal(first, second);
closeCallback();
await first;`
        },
        {
          name: '超时强制关闭并标记 TIMEOUT',
          code: `function createScheduler() {
  let id = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { id += 1; timers.set(id, { fn, ms }); return id; },
    clearTimeout(handle) { timers.delete(handle); },
    advance(ms) {
      for (const [handle, timer] of [...timers]) {
        if (timer.ms <= ms) { timers.delete(handle); timer.fn(); }
      }
    },
  };
}
const server = { close() {} };
const scheduler = createScheduler();
const shutdown = createShutdown({ server, timeoutMs: 500, scheduler });
const pending = shutdown.shutdown();
scheduler.advance(500);
const result = await pending;
assert.equal(result.forced, true);
assert.equal(result.reason, 'TIMEOUT');
assert.equal(shutdown.state(), 'closed');`
        },
        {
          name: '排空抛错仍进入 closed 并暴露错误',
          code: `let closeCallback = null;
const server = { close(callback) { closeCallback = callback; } };
const scheduler = { setTimeout: () => 1, clearTimeout: () => {} };
const shutdown = createShutdown({
  server,
  timeoutMs: 1000,
  onDrain: async () => { throw new Error('drain failed'); },
  scheduler,
});
const pending = shutdown.shutdown();
closeCallback();
const result = await pending;
assert.equal(result.forced, false);
assert.equal(result.error.message, 'drain failed');
assert.equal(shutdown.state(), 'closed');`
        },
        {
          name: 'draining 阶段拒绝新请求',
          code: `let closeCallback = null;
const server = { close(callback) { closeCallback = callback; } };
const scheduler = { setTimeout: () => 1, clearTimeout: () => {} };
const shutdown = createShutdown({ server, timeoutMs: 1000, scheduler });
const pending = shutdown.shutdown();
assert.equal(shutdown.isAccepting(), false);
assert.equal(shutdown.state(), 'draining');
closeCallback();
await pending;`
        },
        {
          name: '状态不可逆且不重复关闭',
          code: `let closeCallback = null;
let closeCalls = 0;
const server = { close(callback) { closeCalls += 1; closeCallback = callback; } };
const scheduler = { setTimeout: () => 1, clearTimeout: () => {} };
const shutdown = createShutdown({ server, timeoutMs: 1000, scheduler });
const pending = shutdown.shutdown();
closeCallback();
const result = await pending;
const again = await shutdown.shutdown();
assert.deepEqual(again, result);
assert.equal(shutdown.state(), 'closed');
assert.equal(closeCalls, 1);`
        },
        {
          name: '超时后忽略迟到的 close 回调',
          code: `function createScheduler() {
  let id = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { id += 1; timers.set(id, { fn, ms }); return id; },
    clearTimeout(handle) { timers.delete(handle); },
    advance(ms) {
      for (const [handle, timer] of [...timers]) {
        if (timer.ms <= ms) { timers.delete(handle); timer.fn(); }
      }
    },
  };
}
let closeCallback = null;
let drained = 0;
const server = { close(callback) { closeCallback = callback; } };
const scheduler = createScheduler();
const shutdown = createShutdown({
  server,
  timeoutMs: 500,
  onDrain: async () => { drained += 1; },
  scheduler,
});
const pending = shutdown.shutdown();
scheduler.advance(500);
await pending;
closeCallback();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(drained, 0);
assert.equal(shutdown.state(), 'closed');`
        }
      ]
    },
    {
      id: 's4-l3-ex-2',
      kind: 'design',
      title: '部署配置审查',
      brief: '给 LinkHub API 做一次部署配置审查：镜像构建、运行用户、文件系统、健康检查、资源限制、配置来源、密钥、日志、退出码与回滚。请逐项给出当前做法、风险和修正动作。',
      checklist: [
        '多阶段构建与最小运行镜像',
        '非 root 用户与只读文件系统',
        '健康检查区分 liveness/readiness',
        '资源限制与 OOMKilled 处理',
        '配置来源与优先级',
        '密钥注入与轮换',
        '日志输出到 stdout/stderr',
        '退出码与优雅退出',
        '滚动更新与回滚方式',
        '镜像扫描与部署门禁'
      ],
      reference: '<ul><li><strong>构建：</strong>依赖安装与运行分阶段，最终镜像只含生产依赖；基础镜像固定版本或 digest。</li><li><strong>用户：</strong>固定非 root UID/GID；根文件系统只读，临时目录显式挂载。</li><li><strong>探针：</strong>readiness 检查数据库与缓存；liveness 只检查进程；探针超时与阈值有依据。</li><li><strong>资源：</strong>limit 覆盖压测峰值；关注 137 与 CPU 节流指标。</li><li><strong>配置：</strong>启动时合并命令行、环境变量、文件与默认值，并校验必填项。</li><li><strong>密钥：</strong>运行时注入，不入镜像；有轮换与访问审计。</li><li><strong>日志：</strong>写 stdout/stderr，由平台采集；不写本地滚动文件。</li><li><strong>退出：</strong>SIGTERM 后先摘流量再排空；宽限期覆盖最长请求；退出码可区分正常与超时。</li><li><strong>回滚：</strong>镜像 digest 与配置版本可追溯；回滚步骤在分钟级完成。</li><li><strong>门禁：</strong>CI 扫描镜像漏洞与密钥；部署前检查探针与资源限制。</li></ul>'
    }
  ]
};
