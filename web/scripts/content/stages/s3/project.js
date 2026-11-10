export const project = {
  id: 'p3',
  stageLabel: '阶段 3',
  title: 'LinkHub 缓存与异步',
  brief: '在 p2 的 API 上扛住热点、过载与下游故障：Redis Cache-Aside、BullMQ 点击事件、幂等消费、限流与幂等键，再用两轮压测和一次故障演练证明保护生效。p3 的 BullMQ 是随 API 进程部署的应用内队列，只解决「慢活出请求链路」；入队与业务提交仍是两次写，p5 才升级为 Outbox + RabbitMQ 的独立服务。',
  goal: '让跳转在热点与下游抖动下仍然可用，让点击不丢不重，并用可复现的数据说明瓶颈、保护与恢复时间。',
  stack: [
    'Redis',
    'BullMQ',
    'k6/autocannon'
  ],
  steps: [
    '热点跳转接 Redis Cache-Aside；更新/删除时主动失效；空值缓存与 single-flight 防止穿透和击穿。',
    '点击事件写入 BullMQ；消费者用 eventId 幂等；失败按退避重试，超过次数进入死信。',
    '创建接口实现 Idempotency-Key：同键同 body 返回首次结果，不同 body 返回 409；跳转与创建分别按 API Key/IP 限流并返回 429 + Retry-After。',
    '做两轮压测：正常流量，以及下游变慢/队列积压/超限流量；记录缓存命中率、DB QPS、P99 与错误率。',
    '做一次故障演练：消费者崩溃、Redis 不可用、队列积压；记录现象、降级行为与恢复时间。',
    '写压测报告与回滚预案：指出至少一个真实瓶颈并完成一次修复。'
  ],
  milestones: [
    {
      id: 'p3-m1',
      title: '缓存命中与失效',
      desc: 'Cache-Aside、TTL、主动失效、空值缓存与 single-flight；缓存层不吞掉下游错误。',
      criteria: '命中率与 DB QPS 有前后对比；更新或删除后不返回旧值；loader 失败不被缓存。'
    },
    {
      id: 'p3-m2',
      title: '异步点击链路',
      desc: 'BullMQ 入队、幂等消费者、退避重试与死信；消费者崩溃后可恢复。',
      criteria: '重复点击只计一次；消费者崩溃后消息可重投；DLQ 有重放工具并可验证。'
    },
    {
      id: 'p3-m3',
      title: '限流与幂等',
      desc: '创建接口幂等键，跳转/创建限流；429 契约与 p2 一致。',
      criteria: '超限返回 429 + Retry-After；同幂等键只创建一条短链；登录不被误伤。'
    },
    {
      id: 'p3-m4',
      title: '压测报告',
      desc: '正常与故障两组压测，记录命中率、DB QPS、P99、错误率。',
      criteria: '两组数据可复现；瓶颈结论有依据；至少完成一个修复并复测。'
    },
    {
      id: 'p3-m5',
      title: '故障演练',
      desc: '覆盖消费者崩溃、Redis 不可用、队列积压三类故障。',
      criteria: '每类故障有现象、降级行为与恢复时间；回滚预案可执行。'
    }
  ],
  deliverables: [
    '缓存实现与失效逻辑',
    '队列、消费者与死信重放工具',
    '限流与幂等键实现',
    '压测脚本与数据',
    '两轮压测报告',
    '故障演练记录与回滚预案'
  ],
  checklist: [
    '缓存不吞错误：loader 失败向上抛且不写入缓存',
    '队列 ack 在副作用成功之后，不在处理之前',
    '死信有重放工具与操作记录',
    '限流不误伤登录与跳转主链路',
    '压测数据可复现：脚本、参数、环境与结果一起提交',
    'p3 边界写清：BullMQ 为应用内队列，p5 才升级 Outbox/RabbitMQ'
  ],
  stretch: [
    '缓存预热与热点 key 本地缓存',
    '队列积压与死信数量的自动告警'
  ]
};
