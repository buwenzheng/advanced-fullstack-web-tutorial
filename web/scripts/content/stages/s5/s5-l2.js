export const s5L2 = {
  id: 's5-l2',
  title: '分布式一致性：双写、补偿与最终一致',
  subtitle: '双写窗口、Outbox、幂等消费、Saga/CQRS 与读模型的一致性级别。',
  duration: 85,
  status: 'ready',
  objectives: [
    '解释双写失败窗口与 2PC 的代价。',
    '实现 Outbox + 幂等消费，保证事件不丢不重。',
    '比较 Saga、CQRS/读模型与一致性级别。',
    '为 LinkHub 统计选择一致性方案，并标注延迟上界。'
  ],
  keywords: ['双写', 'Outbox', '幂等消费', '最终一致', 'Saga', 'CQRS', 'SKIP LOCKED', '至少一次', '读模型'],
  blocks: [
    {
      type: 'analogy',
      title: '前端乐观更新与最终一致',
      html: '点赞时页面先把红心点亮、计数加一，再发请求；网络失败就回滚并提示。用户看到的是「立即生效」，后台对齐是异步的。最终一致也是这个思路：先接受一个暂时状态，再通过重试、补偿或事件让副本收敛。<br>类比失效的地方在失败可见性：前端可以立刻回滚 UI，后端的事件可能已经写进 outbox、投递到 MQ、被消费者处理了一半。系统必须能承受重复、乱序与延迟，并让用户知道数据「可能晚几秒」。乐观更新可以骗用户几百毫秒，统计看板不能永远骗自己。'
    },
    {
      type: 'text',
      title: '双写问题：两次写，只有一个能保证',
      html: '业务提交和消息发送是两次独立的写：先写数据库再发消息，如果进程在两步之间崩溃，数据库有记录但事件永久丢失；先发消息再写数据库，消费者可能读到还不存在的业务数据。把发消息放进数据库事务也不行——消息代理不参与数据库事务，事务回滚不了已经发出的消息。<br>2PC 可以让多个资源一起提交，但需要协调者、锁与阻塞恢复，跨组织系统很难落地。工程上更常见的是 Outbox：把事件和业务数据写在同一个数据库事务里，再由独立发布器把 outbox 记录投递出去。它把「原子性」限制在数据库内，把「投递」变成可重试的异步步骤。'
    },
    {
      type: 'flow',
      title: 'Outbox 的完整链路',
      steps: [
        { name: '业务事务', detail: '业务表与 outbox 在同一事务提交。失败表现：只写业务不写 outbox，事件丢失。' },
        { name: '发布器抢占', detail: '用 FOR UPDATE SKIP LOCKED 取待发记录，避免多个实例重复处理同一行。失败表现：普通 SELECT 让两个发布器拿到同一批。' },
        { name: '投递 MQ', detail: '发布成功后才标记 sentAt；失败累加 attempts 并保留待重试。失败表现：先标记后发布，崩溃即丢事件。' },
        { name: '消费者处理', detail: '按 eventId 幂等，业务写入与去重记录在同一事务或唯一索引兜底。失败表现：先记 eventId 后写业务，失败后无法重试。' },
        { name: '读模型更新', detail: '聚合结果写入读模型，标注延迟上界。失败表现：读模型落后却没有监控。' },
        { name: '重放与清理', detail: '死信可重放；已发送的 outbox 记录定期归档。失败表现：表无限增长，重放没有幂等保护。' }
      ]
    },
    {
      type: 'code',
      title: 'Outbox 发布器',
      lang: 'javascript',
      code: `async function publishBatch(limit = 10) {
  // 相当于在同一个数据库事务里：
  // SELECT * FROM outbox WHERE sent_at IS NULL
  // ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED;
  const batch = await store.claimPending(limit);
  const results = [];

  for (const record of batch) {
    try {
      await publisher.publish(record);
      await store.markSent(record.eventId, now());
      results.push({ eventId: record.eventId, ok: true });
    } catch (error) {
      await store.markFailed(record.eventId, error.message, maxAttempts);
      results.push({ eventId: record.eventId, ok: false, error: error.message });
    }
  }

  return results;
}`,
      note: '顺序不能反：先发布成功再标记 sentAt，否则标记后崩溃会永久丢事件。SKIP LOCKED 让多个发布器并行而不重复；失败保留记录并累加 attempts，达到上限进入死信，等待人工重放。'
    },
    {
      type: 'code',
      title: '幂等消费',
      lang: 'javascript',
      code: `async function consume(event) {
  const seen = await processedStore.find(event.eventId);
  if (seen) return { duplicate: true };

  await database.transaction(async (tx) => {
    // 业务写入与去重记录同一事务；event_id 上有唯一索引兜底
    await applyEvent(tx, event);
    await tx.insert('processed_events', { event_id: event.eventId });
  });

  return { duplicate: false };
}`,
      note: '去重记录必须和业务写入同事务；如果先记 eventId 再写业务，业务失败后消息会被误判为已处理。跨实例并发时，唯一索引是最后一道防线，捕获冲突后按重复处理。'
    },
    {
      type: 'table',
      title: '一致性方案对比',
      head: ['方案', '一致性', '复杂度', '延迟', '适用场景'],
      rows: [
        ['2PC', '强一致（阻塞）', '高，需要协调者与恢复', '同步等待', '少量跨库事务、可控环境'],
        ['Outbox', '最终一致', '中，需要发布器与重试', '秒级', '业务与事件同库、要求不丢'],
        ['Saga', '最终一致（补偿）', '高，需要补偿与状态机', '取决于步骤', '跨服务长事务'],
        ['CQRS/读模型', '读写分离，最终一致', '中高，需要投影与重放', '可配置', '读多写少、看板与统计']
      ],
      note: '方案可以组合：Outbox 负责把事件可靠送出，Saga 负责跨服务补偿，CQRS 负责读模型。不要把「最终一致」当成「不用管一致性」，延迟上界与重放能力都要写清楚。'
    },
    {
      type: 'pitfall',
      title: '事务内发消息与先标记后确认',
      html: '现象：数据库有订单但统计没有；消费者偶尔重复计数；发布器重启后消息丢失；读模型落后几分钟却没人知道；死信表堆满无法重放。<br>原因：在事务提交前调用消息发送；先标记 sent 再发布；消费者先记 eventId 再写业务；没有唯一索引，重复投递被当成两次业务；读模型没有延迟指标与重放工具。<br>发现方式：对比业务表与事件表数量；注入发布失败与重复投递；检查消费者去重记录与业务写入是否同事务；监控 outbox 积压与读模型延迟。<br>修复：改为 Outbox；发布成功后再标记；消费成功后再记 eventId，并用唯一索引兜底；为读模型加延迟指标与重放脚本。<br>预防：故障演练覆盖崩溃、重复投递与 MQ 不可用；把「不丢不重」写进验收标准。'
    },
    {
      type: 'steps',
      title: '从 p3 BullMQ 升级到 Outbox + RabbitMQ',
      steps: [
        { title: '保留 p3 业务路径', html: '跳转接口仍然只做重定向与写点击明细，不因为统计改造增加同步调用。观察点：改造前后跳转 P99 不变。' },
        { title: '同一事务写明细与 outbox', html: 'click_events 与 outbox 在同一数据库事务提交。观察点：崩溃后两者数量一致。' },
        { title: '独立发布器', html: '用 FOR UPDATE SKIP LOCKED 抢占并投递 RabbitMQ；成功标记，失败累加 attempts。观察点：两个发布器并行不重复。' },
        { title: '独立消费者', html: '按 eventId 幂等，唯一索引兜底；失败指数退避，超限进死信。观察点：重复投递只累加一次。' },
        { title: '读模型与查询', html: '按天、按链接聚合；接口返回一致性级别与延迟上界。观察点：看板能显示数据截止时间。' },
        { title: '故障演练', html: '消费者 kill -9、MQ 不可用、重复投递；记录恢复时间。观察点：统计故障不影响跳转。' }
      ]
    },
    {
      type: 'text',
      title: '深挖：exactly-once 是端到端效果',
      html: '消息系统常宣称 exactly-once，但端到端语义取决于「业务效果」：生产者可能重复发送，消费者可能重复处理，网络可能重复投递。工程上通常选择至少一次投递 + 幂等消费，让重复不产生副作用，从而在业务层得到「效果恰好一次」。<br>幂等的关键不是把 eventId 存起来就完事，而是去重记录与业务写入必须原子：同一事务提交，或业务表上有唯一约束。否则会出现「记了 eventId 但业务没写成」或「业务写成但 eventId 没记」的窗口。读模型则要接受延迟：查询接口应返回数据截止时间或一致性级别，让调用方知道「刚写入的点击可能还没出现在看板」。重放是最后的安全网：死信可重放、投影可重建，但重放必须幂等。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「为什么不用 2PC」回答：需要协调者与阻塞恢复，跨服务/跨组织可用性差；多数业务可以接受秒级最终一致，用 Outbox + 幂等更便宜。<br>「如何保证消息不丢」分三段：业务与 outbox 同事务；发布成功才标记，失败重试；消费者成功后才确认，死信可重放。再补一句「重复投递用 eventId 与唯一索引兜底」。'
    }
  ],
  checks: [
    {
      id: 's5-l2-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '双写',
      prompt: '业务数据库提交成功，但随后发送消息时进程崩溃，会发生什么？',
      question: '业务数据库提交成功，但随后发送消息时进程崩溃，会发生什么？',
      options: [
        { text: '业务数据存在，但事件永久丢失，下游永远收不到', correct: true },
        { text: '数据库会自动回滚已提交的业务数据', correct: false },
        { text: '消息代理会自动补发这条从未发送的消息', correct: false },
        { text: '没有任何影响，下次请求会顺带补发', correct: false }
      ],
      explain: '两次写不是原子的：数据库已提交，消息还没发出，崩溃后没有任何机制知道这条事件应该存在。Outbox 把事件先写进同一事务，才消除这个窗口。'
    },
    {
      id: 's5-l2-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: 'Outbox',
      prompt: '一个可靠的 Outbox 实现通常包含哪些关键步骤？',
      question: '一个可靠的 Outbox 实现通常包含哪些关键步骤？',
      options: [
        { text: '业务数据与 outbox 事件在同一数据库事务提交', correct: true },
        { text: '发布器用 SKIP LOCKED 抢占待发记录，避免重复处理', correct: true },
        { text: '发布成功后才标记 sentAt，失败保留并累加 attempts', correct: true },
        { text: '先把记录标记为已发送，再调用消息代理', correct: false },
        { text: '消费者先记录 eventId，再写业务数据', correct: false }
      ],
      explain: '同事务、抢占、成功后再标记是 Outbox 的核心。先标记后发布会丢事件；先记 eventId 再写业务会让失败消息无法重试。'
    },
    {
      id: 's5-l2-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '读模型',
      prompt: '统计看板采用异步读模型时，查询接口最应该额外标注什么？',
      question: '统计看板采用异步读模型时，查询接口最应该额外标注什么？',
      options: [
        { text: '一致性级别与数据延迟上界', correct: true },
        { text: '数据库连接池大小', correct: false },
        { text: '前端框架版本', correct: false },
        { text: '不需要标注，最终一致等于实时', correct: false }
      ],
      explain: '异步读模型会落后于写入，调用方需要知道「数据截止到什么时候」以及能接受多大的延迟。一致性级别与延迟上界是接口契约的一部分。'
    }
  ],
  exercises: [
    {
      id: 's5-l2-ex-1',
      kind: 'code',
      title: 'Outbox 发布器与幂等消费',
      brief: '实现 createOutbox({ store, publisher, now, maxAttempts }) 与 createConsumer({ apply })。createOutbox 返回 { add, publishBatch }：add(businessWrite, event) 在 store.transaction 中执行 businessWrite(store) 并写入 outbox 事件（eventId、type、payload、attempts=0、sentAt=null、failedAt=null）；publishBatch(limit) 用 store.claimPending(limit) 抢占（模拟 FOR UPDATE SKIP LOCKED），逐个 await publisher.publish(record)，成功 markSent(eventId, now())，失败 markFailed(eventId, message, maxAttempts) 并累加 attempts，达到上限后标记 failedAt。createConsumer 返回 { consume, processed }：eventId 已处理返回 { duplicate: true } 且不调用 apply；否则先 await apply(event)，成功后才记入 processed。',
      hint: '发布顺序必须是「先 publish，成功后再 markSent」；失败也要释放 claim 锁并累加 attempts。消费者在 apply 抛错时不要写入 processed。',
      starter: `function createMemoryStore() {
  const events = new Map();
  const business = [];
  const locked = new Set();
  return {
    events,
    business,
    transaction(run) { return run(this); },
    insertBusiness(row) { business.push({ ...row }); },
    insertEvent(event) { events.set(event.eventId, { ...event }); return { ...event }; },
    claimPending(limit) {
      const claimed = [];
      for (const event of events.values()) {
        if (claimed.length >= limit) break;
        if (event.sentAt !== null || event.failedAt !== null || locked.has(event.eventId)) continue;
        locked.add(event.eventId);
        claimed.push({ ...event });
      }
      return claimed;
    },
    markSent(eventId, sentAt) {
      const event = events.get(eventId);
      event.sentAt = sentAt;
      locked.delete(eventId);
    },
    markFailed(eventId, message, maxAttempts) {
      const event = events.get(eventId);
      event.attempts += 1;
      event.lastError = message;
      if (event.attempts >= maxAttempts) event.failedAt = true;
      locked.delete(eventId);
    },
  };
}

function createOutbox({ store, publisher, now = () => Date.now(), maxAttempts = 5 }) {
  function add(businessWrite, event) {
    businessWrite(store);
    store.insertEvent({ ...event, attempts: 0, sentAt: null, failedAt: null });
    return event;
  }
  async function publishBatch(limit = 10) {
    const batch = store.claimPending(limit);
    for (const record of batch) {
      store.markSent(record.eventId, now());
      await publisher.publish(record);
    }
    return batch.map((record) => ({ eventId: record.eventId, ok: true }));
  }
  return { add, publishBatch };
}

function createConsumer({ apply }) {
  const processed = new Set();
  async function consume(event) {
    processed.add(event.eventId);
    await apply(event);
    return { duplicate: false };
  }
  return { consume, processed };
}`,
      solution: `function createMemoryStore() {
  const events = new Map();
  const business = [];
  const locked = new Set();
  return {
    events,
    business,
    transaction(run) { return run(this); },
    insertBusiness(row) { business.push({ ...row }); },
    insertEvent(event) { events.set(event.eventId, { ...event }); return { ...event }; },
    claimPending(limit) {
      const claimed = [];
      for (const event of events.values()) {
        if (claimed.length >= limit) break;
        if (event.sentAt !== null || event.failedAt !== null || locked.has(event.eventId)) continue;
        locked.add(event.eventId);
        claimed.push({ ...event });
      }
      return claimed;
    },
    markSent(eventId, sentAt) {
      const event = events.get(eventId);
      event.sentAt = sentAt;
      locked.delete(eventId);
    },
    markFailed(eventId, message, maxAttempts) {
      const event = events.get(eventId);
      event.attempts += 1;
      event.lastError = message;
      if (event.attempts >= maxAttempts) event.failedAt = true;
      locked.delete(eventId);
    },
  };
}

function createOutbox({ store, publisher, now = () => Date.now(), maxAttempts = 5 }) {
  function add(businessWrite, event) {
    return store.transaction(() => {
      businessWrite(store);
      return store.insertEvent({
        eventId: event.eventId,
        type: event.type,
        payload: event.payload,
        attempts: 0,
        sentAt: null,
        failedAt: null,
        createdAt: now(),
      });
    });
  }

  async function publishBatch(limit = 10) {
    const batch = store.claimPending(limit);
    const results = [];
    for (const record of batch) {
      try {
        await publisher.publish(record);
        store.markSent(record.eventId, now());
        results.push({ eventId: record.eventId, ok: true });
      } catch (error) {
        store.markFailed(record.eventId, error.message, maxAttempts);
        results.push({ eventId: record.eventId, ok: false, error: error.message });
      }
    }
    return results;
  }

  return { add, publishBatch };
}

function createConsumer({ apply }) {
  const processed = new Set();
  async function consume(event) {
    if (processed.has(event.eventId)) return { duplicate: true };
    await apply(event);
    processed.add(event.eventId);
    return { duplicate: false };
  }
  return { consume, processed };
}`,
      tests: [
        {
          name: '同事务写入业务与事件',
          code: `const store = createMemoryStore();
const outbox = createOutbox({ store, publisher: { publish() {} }, now: () => 100 });
const record = outbox.add(
  (tx) => tx.insertBusiness({ id: 'link-1' }),
  { eventId: 'e1', type: 'click', payload: { linkId: 'link-1' } },
);
assert.equal(store.business.length, 1);
assert.equal(record.eventId, 'e1');
assert.equal(store.events.get('e1').attempts, 0);
assert.equal(store.events.get('e1').sentAt, null);
let failed = false;
try {
  outbox.add(() => { throw new Error('business failed'); }, { eventId: 'e2', type: 'click', payload: {} });
} catch (error) {
  failed = true;
}
assert.equal(failed, true);
assert.equal(store.events.has('e2'), false);`
        },
        {
          name: '两个发布器抢占互斥',
          code: `const store = createMemoryStore();
let release = null;
const publisher = {
  publish(record) {
    return new Promise((resolve) => { release = () => resolve(record); });
  },
};
const outbox = createOutbox({ store, publisher, now: () => 1 });
outbox.add(() => {}, { eventId: 'e1', type: 'click', payload: {} });
const first = outbox.publishBatch(10);
const second = await outbox.publishBatch(10);
assert.equal(second.length, 0);
release();
const results = await first;
assert.equal(results.length, 1);
assert.equal(results[0].ok, true);`
        },
        {
          name: '发布成功标记 sentAt',
          code: `const store = createMemoryStore();
const published = [];
const outbox = createOutbox({
  store,
  publisher: { async publish(record) { published.push(record.eventId); } },
  now: () => 500,
});
outbox.add(() => {}, { eventId: 'e1', type: 'click', payload: {} });
const results = await outbox.publishBatch(5);
assert.deepEqual(published, ['e1']);
assert.equal(results[0].ok, true);
assert.equal(store.events.get('e1').sentAt, 500);`
        },
        {
          name: '发布失败累加 attempts',
          code: `const store = createMemoryStore();
const outbox = createOutbox({
  store,
  publisher: { publish() { throw new Error('broker down'); } },
  now: () => 1,
  maxAttempts: 3,
});
outbox.add(() => {}, { eventId: 'e1', type: 'click', payload: {} });
const results = await outbox.publishBatch(5);
assert.equal(results[0].ok, false);
assert.equal(results[0].error, 'broker down');
assert.equal(store.events.get('e1').attempts, 1);
assert.equal(store.events.get('e1').sentAt, null);`
        },
        {
          name: '达到上限后不再抢占',
          code: `const store = createMemoryStore();
let calls = 0;
const outbox = createOutbox({
  store,
  publisher: { publish() { calls += 1; throw new Error('nope'); } },
  maxAttempts: 2,
});
outbox.add(() => {}, { eventId: 'e1', type: 'click', payload: {} });
await outbox.publishBatch(5);
await outbox.publishBatch(5);
const third = await outbox.publishBatch(5);
assert.equal(calls, 2);
assert.deepEqual(third, []);
assert.equal(store.events.get('e1').attempts, 2);
assert.ok(store.events.get('e1').failedAt);`
        },
        {
          name: '重复投递只消费一次',
          code: `let applied = 0;
const consumer = createConsumer({ apply: async () => { applied += 1; } });
const event = { eventId: 'e1', payload: {} };
const first = await consumer.consume(event);
const second = await consumer.consume(event);
assert.equal(applied, 1);
assert.equal(first.duplicate, false);
assert.equal(second.duplicate, true);`
        },
        {
          name: '消费失败可重试',
          code: `let attempts = 0;
const consumer = createConsumer({
  apply: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('db down');
  },
});
const event = { eventId: 'e1' };
let failed = false;
try {
  await consumer.consume(event);
} catch (error) {
  failed = true;
}
assert.equal(failed, true);
assert.equal(consumer.processed.has('e1'), false);
const retry = await consumer.consume(event);
assert.equal(retry.duplicate, false);
assert.equal(attempts, 2);
assert.equal(consumer.processed.has('e1'), true);`
        },
        {
          name: '空批次返回空数组',
          code: `const store = createMemoryStore();
const outbox = createOutbox({
  store,
  publisher: { publish() { throw new Error('should not publish'); } },
});
const results = await outbox.publishBatch(10);
assert.deepEqual(results, []);`
        }
      ]
    },
    {
      id: 's5-l2-ex-2',
      kind: 'design',
      title: 'LinkHub 统计一致性',
      brief: '为 LinkHub 的点击统计设计一致性与部署方案：事件如何产生、outbox 如何写入、发布器与 MQ 如何部署、消费者如何幂等、读模型如何查询、看板如何标注一致性级别，以及统计故障时跳转如何降级。',
      checklist: [
        '事件产生与主链路隔离',
        '业务与 outbox 同事务',
        '发布器抢占与重试',
        'MQ 投递语义与顺序',
        '消费者 eventId 幂等',
        '唯一索引兜底',
        '读模型与延迟上界',
        '死信、重放与清理',
        '监控与告警',
        '统计故障时的降级'
      ],
      reference: '<ul><li><strong>主链路：</strong>跳转只写点击明细与 outbox，不做同步统计调用；统计失败不影响 302。</li><li><strong>Outbox：</strong>click_events 与 outbox 同事务；outbox 记录 eventId、type、payload、attempts、sentAt。</li><li><strong>发布器：</strong>独立进程，FOR UPDATE SKIP LOCKED 抢占；发布成功标记，失败累加 attempts，超限进死信。</li><li><strong>MQ：</strong>至少一次投递；不依赖全局顺序，按 linkId 分区保证同一链接有序即可。</li><li><strong>消费者：</strong>eventId 去重，业务写入与 processed_events 同事务，唯一索引兜底。</li><li><strong>读模型：</strong>按天、按链接聚合；接口返回「最终一致，延迟 ≤ N 秒」与数据截止时间。</li><li><strong>重放：</strong>死信表可查询、可重放；投影可重建；重放保持幂等。</li><li><strong>监控：</strong>outbox 积压、发布失败率、消费延迟、读模型延迟与死信数量。</li><li><strong>降级：</strong>统计服务不可用时跳转照常；看板显示数据延迟或暂停更新。</li><li><strong>验收：</strong>重复投递只累加一次；消费者 kill -9 后可恢复；关掉统计不影响跳转。</li></ul>'
    }
  ]
};
