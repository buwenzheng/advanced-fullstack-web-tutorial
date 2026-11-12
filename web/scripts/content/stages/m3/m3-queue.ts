export const m3Queue = {
  id: 'm3-queue',
  title: '消息队列与异步任务',
  subtitle: 'ack、可见性超时、至少一次投递、幂等消费、重试与死信，把慢活移出请求链路。',
  duration: 85,
  status: 'ready',
  objectives: [
    '解释 at-most-once、at-least-once 与「精确一次」的工程含义，判断一条链路需要哪种保证。',
    '实现 ack、可见性超时、重试退避、死信与幂等消费，并说明每个机制的失败表现。',
    '诊断积压、毒消息与消费者不足，给出扩容、限流与重放的处理顺序。',
    '为 LinkHub 点击事件设计可恢复的异步链路，并写清 p-m3-ship 应用内队列与 p-e1-stats Outbox/RabbitMQ 的边界。'
  ],
  keywords: ['消息队列', 'ack', '可见性超时', '至少一次', '幂等消费', '死信', '重试', 'BullMQ', 'Outbox'],
  blocks: [
    {
      type: 'analogy',
      title: '前端事件队列与服务器队列',
      html: '浏览器里的事件回调也会排队：点击处理函数没执行完，后续事件只能等着；处理函数抛错，事件不会自动重放。服务器队列看起来相似，但它是跨进程的持久化状态：消费者崩溃、网络超时、部署重启都不会让消息凭空消失，除非你错误地提前确认。<br>关键差异在重试与重复：前端事件通常只触发一次，服务器队列为了保证不丢，会在未确认时重新投递，于是同一个事件可能被处理多次。前端经验能帮你理解「排队」，但不能把「只触发一次」的假设带到服务端。'
    },
    {
      type: 'text',
      title: '生产者 / 队列 / 消费者',
      html: '生产者把消息写入队列后就可以返回，不必等副作用完成。队列保存消息，给消费者投递，并记录「谁领走了、是否确认」。消费者处理成功后调用 ack，队列删除或标记消息；处理失败或超时未 ack，消息重新可见，再投给某个消费者。这段等待确认的时间叫可见性超时（visibility timeout）。<br>投递语义由此产生：最多一次（at-most-once）可能丢、不会重复；至少一次（at-least-once）不丢、可能重复；所谓「精确一次」不是队列单独能给的属性，而是生产、消费与副作用共同达成的端到端效果。'
    },
    {
      type: 'flow',
      title: '入队 → 投递 → 处理 → ack',
      steps: [
        { name: '入队', detail: 'API 写入消息并返回；此时副作用尚未发生。失败表现：把入队当业务提交成功，消息却写失败。' },
        { name: '投递', detail: '消费者 reserve 到一条消息，进入可见性超时窗口。失败表现：消费者已领走但进程崩溃，消息在超时前不可见。' },
        { name: '处理', detail: '执行副作用，例如写入点击记录。失败表现：副作用不幂等，重投时重复计数。' },
        { name: '确认', detail: '成功后 ack，队列移除消息。失败表现：先 ack 后处理，处理失败后消息不再回来。' },
        { name: '失败重投', detail: 'nack 或超时使消息重新可见，attempt 递增。失败表现：attempt 不递增，毒消息无限重试。' },
        { name: '死信', detail: '超过最大次数进入 DLQ，等待告警、排查与重放。失败表现：DLQ 只写不读，问题被永久掩埋。' }
      ]
    },
    {
      type: 'code',
      title: '可见性超时队列：reserve/ack/nack',
      lang: 'javascript',
      code: `function createQueue({ visibilityTimeout = 1000, maxAttempts = 3, now = () => Date.now() } = {}) {
  let sequence = 0;
  const pending = [];
  const inflight = new Map();
  const dead = [];

  function enqueue(payload) {
    const id = 'msg-' + (++sequence);
    pending.push({ id, payload, attempt: 0, visibleAt: now() });
    return id;
  }

  function requeueExpired() {
    for (const [id, message] of inflight) {
      if (message.visibleAt > now()) continue;
      inflight.delete(id);
      if (message.attempt >= maxAttempts) {
        dead.push({ ...message });
      } else {
        pending.push({ ...message, visibleAt: now() });
      }
    }
  }

  function reserve() {
    requeueExpired();
    const index = pending.findIndex((message) => message.visibleAt <= now());
    if (index === -1) return null;
    const message = pending.splice(index, 1)[0];
    const attempt = message.attempt + 1;
    inflight.set(message.id, { ...message, attempt, visibleAt: now() + visibilityTimeout });
    return { id: message.id, payload: message.payload, attempt };
  }

  function ack(id) {
    inflight.delete(id);
  }

  function nack(id) {
    requeueExpired();
    const message = inflight.get(id);
    if (!message) return;
    inflight.delete(id);
    if (message.attempt >= maxAttempts) {
      dead.push({ ...message });
    } else {
      pending.push({ ...message, visibleAt: now() });
    }
  }

  return { enqueue, reserve, ack, nack, deadLetters: () => dead.map((item) => ({ ...item })) };
}`,
      note: 'attempt 在 reserve 时递增，而不是在 nack 时；这样超时重投也能计数。真实队列还有锁、批量预取与优先级，这里只保留理解可靠性所需的状态。'
    },
    {
      type: 'code',
      title: '幂等消费者：成功后才 ack',
      lang: 'javascript',
      code: `async function consume(queue, handler, processed) {
  const message = queue.reserve();
  if (!message) return null;

  const eventId = message.payload && message.payload.eventId;
  if (eventId && processed.has(eventId)) {
    queue.ack(message.id); // 重复投递：跳过副作用，但也要确认
    return { id: message.id, duplicate: true };
  }

  try {
    await handler(message);
    if (eventId) processed.add(eventId);
    queue.ack(message.id);
    return { id: message.id, duplicate: false };
  } catch (error) {
    queue.nack(message.id); // 失败不写去重表，允许重试
    return { id: message.id, duplicate: false, error };
  }
}`,
      note: 'processed 在生产环境应是持久化存储或数据库唯一约束，内存 Set 只适合单进程演示。eventId 必须由生产者在入队前生成并保持稳定，不能对 payload 做哈希来替代。'
    },
    {
      type: 'table',
      title: '重试 / 退避 / 死信',
      head: ['参数', '作用', '常见错误', '判断标准'],
      rows: [
        ['最大次数', '限制毒消息占用消费者', '设为无限或过大', '超过后进入 DLQ 并告警'],
        ['退避', '给下游恢复时间，避免重试风暴', '固定间隔狂重试', '指数退避 + 上限'],
        ['抖动', '打散同时重试的消费者', '所有实例同一时刻重试', '在退避上叠加随机比例'],
        ['最大年龄', '旧消息不再有业务价值', '无限期重放历史消息', '超过时效直接进 DLQ'],
        ['DLQ', '隔离无法处理的消息', '只写不看、没有重放工具', '有告警、查询与重放记录']
      ],
      note: '参数是可靠性预算：次数越多、退避越长，恢复越慢但下游压力越小；要按业务时效与下游容量一起定。'
    },
    {
      type: 'pitfall',
      title: '先 ack 后处理',
      html: '现象：点击统计偶发少记；消费者日志显示处理报错，但队列里已经没有这条消息；重放时找不到原始事件。<br>原因：代码先 ack 再执行副作用，ack 后进程崩溃或处理失败，队列认为任务完成；另一种变体是处理成功但副作用不幂等，超时重投后重复计数。<br>发现方式：对比入队数与落库数；统计「ack 后处理失败」的日志；注入崩溃测试，观察消息是否还能重投；检查去重表是否存在。<br>修复：把 ack 移到副作用成功之后；失败调用 nack；为副作用加幂等键或数据库唯一约束；已经丢失的数据用日志或备份补齐，不能只重放队列。<br>预防：代码评审把 ack 时机列为检查项；测试覆盖「处理抛错」「处理成功后进程崩溃」两类场景；DLQ 有告警与重放工具。'
    },
    {
      type: 'steps',
      title: '积压排查',
      steps: [
        { title: '量化入队与出队', html: '看每秒入队数、出队数、积压总量与增长斜率。观察点：确认是突发流量还是持续消费不足。' },
        { title: '看单条处理耗时', html: '分位数而不是平均值；区分下游慢、锁等待与重试。观察点：找到耗时最长的处理阶段。' },
        { title: '找毒消息', html: '筛选重试次数高、始终失败的消息；检查是否卡住并发。观察点：隔离毒消息后消费速率是否恢复。' },
        { title: '保护下游再扩容', html: '先限流或降低预取，避免扩容把数据库打垮。观察点：下游 P99 与错误率保持可控。' },
        { title: '扩容消费者', html: '按单条耗时与目标积压清空时间估算并发。观察点：出队速率上升且下游不变慢。' },
        { title: '重放与复盘', html: '从 DLQ 或历史存储重放；记录根因与容量缺口。观察点：积压清零，重放有幂等保护。' }
      ]
    },
    {
      type: 'compare',
      title: 'BullMQ vs RabbitMQ vs Kafka',
      cols: [
        {
          title: 'BullMQ（p-m3-ship）',
          items: ['模型：Redis 中的应用内任务队列', '投递：至少一次，stalled job 会重处理', '部署：随 API 进程或独立 worker', '优势：接入快，适合点击、邮件等后台任务', '代价：与 Redis 可用性绑定；入队与业务提交仍是两次写', '升级：p-e1-stats 用 Outbox + RabbitMQ 替代双写窗口']
        },
        {
          title: 'RabbitMQ（p-e1-stats）',
          items: ['模型：AMQP broker + 队列 + 交换器', '投递：ack 与重投，路由灵活', '部署：独立 broker，多服务共享', '优势：路由、优先级、死信交换成熟', '代价：运维与连接管理成本更高', '适用：跨服务事件与任务分发']
        },
        {
          title: 'Kafka',
          items: ['模型：分区日志 + 消费组 + offset', '投递：常见 at-least-once，可配事务', '部署：独立集群，按分区扩展', '优势：高吞吐、可回放、保留历史', '代价：分区与消费组语义复杂，延迟调优成本高', '适用：事件流、日志、分析管道']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：投递语义与端到端幂等',
      html: '队列只能承诺「消息至少被投递一次」或「最多一次」，无法单独承诺业务副作用只发生一次。生产者可能在收到确认前重试，导致重复入队；消费者可能在副作用提交后、ack 前崩溃，导致重复处理；下游服务也可能在超时后重试。每一段都可能重复，端到端就只能靠幂等来收敛。<br>工程做法是给事件一个稳定 ID，在副作用写入的同一事务里记录「已处理」，或用数据库唯一约束兜底。去重记录要有保留窗口：太短会放过旧重复，太长会占存储。顺序也不是免费的：并发消费者会打乱处理顺序，需要顺序时要缩小并发或按业务键分区，并接受吞吐下降。',
      note: 'Outbox、Saga 与跨服务最终一致在 e1-consistency；本讲只讲单服务内的异步链路与 p-m3-ship 的 BullMQ 应用。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「重复消息怎么处理」先承认至少一次投递，再给稳定事件 ID、持久化去重、数据库唯一约束与保留窗口；不要回答「队列会去重」。<br>「消息顺序重要吗」先问业务：同一短链的点击计数可以乱序累加，状态机流转通常不能。需要顺序时说明分区键、单消费者或版本号，以及吞吐与阻塞的代价；不需要时明确说不需要，避免过度设计。'
    }
  ],
  checks: [
    {
      id: 'm3-queue-check-1',
      kind: 'mcq',
      type: 'single',
      tag: 'ack 与重投',
      prompt: '消费者处理消息成功，但在调用 ack 前进程崩溃。消息会怎样？',
      question: '消费者处理消息成功，但在调用 ack 前进程崩溃。消息会怎样？',
      options: [
        { text: '消息已被删除，副作用只执行一次', correct: false },
        { text: '可见性超时后消息重新投递，副作用可能再次执行', correct: true },
        { text: '队列会识别业务成功并自动跳过重投', correct: false },
        { text: '消息永久卡在队列中，任何消费者都看不到', correct: false }
      ],
      explain: 'ack 是队列判断处理完成的依据；未 ack 的消息在可见性超时后重新可见并被再次投递。队列不知道业务副作用是否成功，所以消费端必须幂等。ack 后崩溃才会丢失消息。'
    },
    {
      id: 'm3-queue-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '幂等消费',
      prompt: '要让至少一次投递下的消费端幂等，以下哪些做法有效？',
      question: '要让至少一次投递下的消费端幂等，以下哪些做法有效？',
      options: [
        { text: '为事件生成稳定 ID，并在处理前检查持久化去重表', correct: true },
        { text: '把副作用与去重记录放在同一数据库事务里', correct: true },
        { text: '用数据库唯一约束兜底重复写入', correct: true },
        { text: '只在进程内用 Set 去重，重启后清空也没关系', correct: false },
        { text: '先 ack 再处理，减少重复窗口', correct: false }
      ],
      explain: '幂等依赖稳定事件 ID 与持久化去重，最好与副作用同事务，唯一约束兜底并发。内存 Set 在重启或多实例下失效；先 ack 后处理会丢失消息。'
    },
    {
      id: 'm3-queue-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '积压排查',
      prompt: '队列积压持续增长，消费速率低于入队速率。第一步最应该做什么？',
      question: '队列积压持续增长，消费速率低于入队速率。第一步最应该做什么？',
      options: [
        { text: '立刻把消费者数量扩大十倍', correct: false },
        { text: '量化入队/出队速率、处理耗时与重试，确认瓶颈在消费者、下游还是毒消息', correct: true },
        { text: '删除积压消息，先让监控恢复', correct: false },
        { text: '把所有消息的可见性超时调成 0', correct: false }
      ],
      explain: '盲目扩容可能把下游数据库打垮；删除消息会丢业务数据；可见性超时为 0 会制造重复投递。先量化速率、耗时、重试与毒消息，再决定限流、扩容或隔离。'
    }
  ],
  exercises: [
    {
      id: 'm3-queue-ex-1',
      kind: 'code',
      title: '可见性超时队列与幂等消费者',
      brief: '实现 createQueue({ visibilityTimeout = 1000, maxAttempts = 3, now = () => Date.now() } = {})，提供 enqueue(payload)、reserve()、ack(id)、nack(id) 与 deadLetters()。reserve 只返回可见消息，返回 { id, payload, attempt } 或 null；未 ack 的消息在可见性超时后重投且 attempt 递增；nack 立即重投；attempt 达到 maxAttempts 时进入死信。再实现 async consume(queue, handler, processed)：以 payload.eventId 去重，重复事件直接 ack 并返回 { duplicate: true }；handler 成功后写入 processed 并 ack；失败 nack 且不写入 processed。',
      hint: 'reserve 与 nack 前都先处理超时的 inflight 消息。attempt 在 reserve 时递增，超时重投也会计数。consume 中 ack 必须放在 handler 成功之后，finally 里不要提前确认。',
      starter: `function createQueue({ maxAttempts = 3, now = () => Date.now() } = {}) {
  const items = [];
  let sequence = 0;

  function enqueue(payload) {
    const id = 'msg-' + (++sequence);
    items.push({ id, payload });
    return id;
  }

  function reserve() {
    const message = items.shift();
    return message ? { ...message, attempt: 1 } : null;
  }

  function ack() {}

  function nack(id) {
    const message = items.find((item) => item.id === id);
    if (message) items.push(message);
  }

  return { enqueue, reserve, ack, nack, deadLetters: () => [] };
}

async function consume(queue, handler, processed) {
  const message = queue.reserve();
  if (!message) return null;
  queue.ack(message.id);
  await handler(message);
  return { id: message.id, duplicate: false };
}`,
      solution: `function createQueue({ visibilityTimeout = 1000, maxAttempts = 3, now = () => Date.now() } = {}) {
  let sequence = 0;
  const pending = [];
  const inflight = new Map();
  const dead = [];

  function enqueue(payload) {
    const id = 'msg-' + (++sequence);
    pending.push({ id, payload, attempt: 0, visibleAt: now() });
    return id;
  }

  function requeueExpired() {
    for (const [id, message] of inflight) {
      if (message.visibleAt > now()) continue;
      inflight.delete(id);
      if (message.attempt >= maxAttempts) {
        dead.push({ id: message.id, payload: message.payload, attempt: message.attempt });
      } else {
        pending.push({ ...message, visibleAt: now() });
      }
    }
  }

  function reserve() {
    requeueExpired();
    const index = pending.findIndex((message) => message.visibleAt <= now());
    if (index === -1) return null;
    const message = pending.splice(index, 1)[0];
    const attempt = message.attempt + 1;
    inflight.set(message.id, { ...message, attempt, visibleAt: now() + visibilityTimeout });
    return { id: message.id, payload: message.payload, attempt };
  }

  function ack(id) {
    inflight.delete(id);
  }

  function nack(id) {
    requeueExpired();
    const message = inflight.get(id);
    if (!message) return;
    inflight.delete(id);
    if (message.attempt >= maxAttempts) {
      dead.push({ id: message.id, payload: message.payload, attempt: message.attempt });
    } else {
      pending.push({ ...message, visibleAt: now() });
    }
  }

  function deadLetters() {
    return dead.map((message) => ({ ...message }));
  }

  return { enqueue, reserve, ack, nack, deadLetters };
}

async function consume(queue, handler, processed) {
  const message = queue.reserve();
  if (!message) return null;
  const eventId = message.payload && message.payload.eventId;
  if (eventId && processed.has(eventId)) {
    queue.ack(message.id);
    return { id: message.id, duplicate: true };
  }
  try {
    await handler(message);
    if (eventId) processed.add(eventId);
    queue.ack(message.id);
    return { id: message.id, duplicate: false };
  } catch (error) {
    queue.nack(message.id);
    return { id: message.id, duplicate: false, error };
  }
}`,
      tests: [
        {
          name: '正常 ack 后不再投递',
          code: `const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 3, now: () => 0 });
const id = queue.enqueue({ eventId: 'evt-1', linkId: 'l1' });
const message = queue.reserve();
assert.equal(message.id, id);
assert.equal(message.attempt, 1);
queue.ack(id);
assert.equal(queue.reserve(), null);`
        },
        {
          name: '未 ack 超时后重投且 attempt 递增',
          code: `let clock = 0;
const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 3, now: () => clock });
const id = queue.enqueue({ eventId: 'evt-1' });
const first = queue.reserve();
clock = 50;
assert.equal(queue.reserve(), null);
clock = 101;
const second = queue.reserve();
assert.equal(second.id, id);
assert.equal(second.attempt, 2);`
        },
        {
          name: 'nack 后立即重投',
          code: `let clock = 0;
const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 3, now: () => clock });
const id = queue.enqueue({ eventId: 'evt-1' });
const first = queue.reserve();
queue.nack(id);
const second = queue.reserve();
assert.equal(second.id, id);
assert.equal(second.attempt, 2);`
        },
        {
          name: '达到最大次数进入死信',
          code: `let clock = 0;
const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 2, now: () => clock });
const id = queue.enqueue({ eventId: 'evt-1' });
const first = queue.reserve();
queue.nack(id);
const second = queue.reserve();
queue.nack(id);
assert.equal(queue.reserve(), null);
const dead = queue.deadLetters();
assert.equal(dead.length, 1);
assert.equal(dead[0].id, id);`
        },
        {
          name: '相同 eventId 只执行一次副作用',
          code: `let calls = 0;
const processed = new Set();
const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 3, now: () => 0 });
queue.enqueue({ eventId: 'evt-1', linkId: 'l1' });
queue.enqueue({ eventId: 'evt-1', linkId: 'l1' });
const handler = async () => { calls += 1; };
const first = await consume(queue, handler, processed);
const second = await consume(queue, handler, processed);
assert.equal(calls, 1);
assert.equal(first.duplicate, false);
assert.equal(second.duplicate, true);`
        },
        {
          name: '空队列 reserve 返回 null',
          code: `const queue = createQueue({ now: () => 0 });
assert.equal(queue.reserve(), null);`
        },
        {
          name: 'handler 失败不 ack 且消息可重投',
          code: `let calls = 0;
const processed = new Set();
const queue = createQueue({ visibilityTimeout: 100, maxAttempts: 3, now: () => 0 });
const id = queue.enqueue({ eventId: 'evt-1' });
const handler = async () => { calls += 1; throw new Error('boom'); };
const result = await consume(queue, handler, processed);
assert.equal(result.error.message, 'boom');
assert.equal(processed.size, 0);
const retry = queue.reserve();
assert.equal(retry.id, id);
assert.equal(retry.attempt, 2);`
        }
      ]
    },
    {
      id: 'm3-queue-ex-2',
      kind: 'design',
      title: 'LinkHub 点击事件链路',
      brief: '跳转接口要在 50ms 内返回重定向；点击统计允许秒级延迟，但不能丢；消费者随 API 进程部署，后续可能独立扩容。请给出事件 ID、幂等、ack 时机、重试、死信、重放、监控与 p-e1-stats 升级边界的方案。',
      checklist: [
        '说明事件 ID 的生成位置与稳定性',
        '给出幂等键与去重存储方案',
        '说明 ack 时机与失败处理',
        '给出重试次数、退避与抖动',
        '给出死信、告警与重放工具',
        '说明顺序要求与适用范围',
        '说明消费者扩容与下游保护',
        '给出积压、处理耗时、失败率与 DLQ 监控',
        '写清与 p-e1-stats Outbox/RabbitMQ 的升级边界'
      ],
      reference: '<ul><li><strong>事件 ID：</strong>API 在入队前生成稳定 eventId，随消息与落库记录一起保存。</li><li><strong>幂等：</strong>消费者以 eventId 去重，去重记录与点击写入同事务；数据库唯一约束兜底。</li><li><strong>ack：</strong>副作用提交成功后再 ack；失败 nack；不允许先 ack 后处理。</li><li><strong>重试：</strong>指数退避 + 抖动，限制最大次数与最大年龄；毒消息进 DLQ。</li><li><strong>死信与重放：</strong>DLQ 告警、可查询、可重放；重放同样经过幂等保护。</li><li><strong>顺序：</strong>点击计数可乱序累加；若需要状态流转，按短链分区并降低并发。</li><li><strong>扩容：</strong>先保护下游再增加消费者；限制预取与并发，观察数据库 P99。</li><li><strong>监控：</strong>积压总量、入队/出队速率、处理耗时、失败率、DLQ 数量。</li><li><strong>与 p-e1-stats：</strong>p-m3-ship 的 BullMQ 解决慢活出请求链路；入队与业务提交仍是两次写，p-e1-stats 用 Outbox + RabbitMQ 消除双写窗口，不重复实现。</li></ul>'
    }
  ]
};
