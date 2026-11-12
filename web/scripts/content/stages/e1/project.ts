export const project = {
  id: 'p-e1-stats',
  stageLabel: '阶段 5',
  title: 'LinkHub 统计服务',
  brief: '从 M2 的短链域模型或等价事件源起步，交付独立统计服务：Outbox 保证不丢，幂等消费保证不重，读模型标注一致性，故障演练证明可恢复。',
  goal: '在不改变既有跳转契约的前提下，把点击统计拆成可独立部署、可重放、可观测的服务，并用演练证明统计故障不影响跳转。',
  prerequisites: [
    'M2 数据章',
    'M3 章1；E1：e1-modular、e1-consistency、e1-failures、e1-datascale'
  ],
  nonGoals: [
    '不要求此前实现 BullMQ 统计或沿用 p-m3-ship 仓库',
    '不要求 Web、AI 功能或完成 X'
  ],
  xRelation: 'Outbox、幂等消费者、读模型与故障演练可带入 X4 的分布式实现；它是路径 D 的证明物，但 X 仍为可选。',
  stack: ['PostgreSQL', 'RabbitMQ', 'Outbox', 'OpenTelemetry'],
  steps: [
    '在跳转请求的同一数据库事务里写 click_events 与 outbox，保持既有业务接口与返回结构，不增加同步调用。',
    '实现独立发布器：用 FOR UPDATE SKIP LOCKED 抢占待发记录，投递 RabbitMQ；成功标记 sentAt，失败累加 attempts 并保留重试。',
    '实现独立消费者：按 eventId 幂等，唯一索引兜底；失败指数退避，超过上限进死信；提供按 eventId 重放的工具。',
    '建立读模型：按「日期 + link_id」聚合点击量与去重访客，查询接口返回一致性级别与数据延迟上界。',
    '编写故障演练：消费者 kill -9、MQ 不可用 5 分钟、重复投递 100 条、读从库延迟 10 秒；记录现象、恢复时间与对账结果。',
    '完成验收：对比改造前后跳转 P99；验证重复投递只计一次；验证统计服务停机时跳转仍返回 302；更新 README 与运行手册。'
  ],
  milestones: [
    {
      id: 'p-e1-stats-m1',
      title: 'Outbox 同事务',
      desc: 'click_events 与 outbox 在同一数据库事务提交，既有跳转接口不变。',
      criteria: '注入进程崩溃后，业务明细与 outbox 记录数量一致，未发布事件仍可被后续发布器投递。'
    },
    {
      id: 'p-e1-stats-m2',
      title: '发布器可恢复',
      desc: '独立发布器用 SKIP LOCKED 抢占，成功才标记，失败可重试。',
      criteria: '两个发布器并行不重复投递；发布失败后 attempts 增加且记录不会被误标为已发送。'
    },
    {
      id: 'p-e1-stats-m3',
      title: '幂等消费与重放',
      desc: '消费者按 eventId 去重，唯一索引兜底，死信可重放。',
      criteria: '同一事件重复投递 100 次只累加一次；消费失败可重试；死信重放不产生重复计数。'
    },
    {
      id: 'p-e1-stats-m4',
      title: '读模型与一致性标注',
      desc: '按日期与 link_id 聚合，接口显式标注一致性级别与延迟上界。',
      criteria: '查询返回数据截止时间；重复事件不改变聚合结果；读模型可从事件重建。'
    },
    {
      id: 'p-e1-stats-m5',
      title: '故障演练与验收',
      desc: '覆盖消费者崩溃、MQ 不可用、重复投递与复制延迟。',
      criteria: '统计服务停机时跳转仍正常；恢复后在约定时间内追平积压；演练报告记录恢复时间与对账结果。'
    }
  ],
  deliverables: [
    'click_events 与 outbox 的迁移脚本',
    '基于 SKIP LOCKED 的发布器与失败重试逻辑',
    '幂等消费者、唯一索引与死信重放工具',
    '按天/按链接聚合的读模型查询接口',
    '统计延迟、outbox 积压与死信数量的监控看板',
    '四类故障的演练脚本与演练报告',
    '从 M2 域模型接入 p-e1-stats 的说明与回滚手册'
  ],
  checklist: [
    '跳转主链路只写本地事件，不同步调用统计服务',
    '业务明细与 outbox 在同一数据库事务提交',
    '发布成功后才标记 sentAt，失败保留并累加 attempts',
    '消费者按 eventId 幂等，并有唯一索引兜底',
    '读模型查询标注一致性级别与延迟上界，且可重放重建'
  ],
  stretch: [
    '读模型自动重建与影子校验',
    '按租户隔离统计与配额',
    '基于一致性哈希的统计分片与重分片演练'
  ]
};
