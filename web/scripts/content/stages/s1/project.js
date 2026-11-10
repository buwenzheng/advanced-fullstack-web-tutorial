export const project = {
  "id": "p1",
  "stageLabel": "阶段 1",
  "title": "LinkHub 数据层",
  "brief": "用户、短链、点击事件落库：PostgreSQL、约束、索引、事务、迁移与集成测试。",
  "goal": "从零建立 LinkHub 的业务库，并用约束、索引、事务与迁移证明数据可信、查询可解释、演进可回滚。",
  "stack": [
    "PostgreSQL",
    "SQL",
    "Node.js/Python"
  ],
  "steps": [
    "画 ER 图：users 1-N links，links 1-N click_events；确定主键、外键、基数与软删除语义",
    "写 schema.sql：slug 唯一（部分唯一索引）、过期时间 CHECK、软删除、tenant_id 预留、外键与索引",
    "用 EXPLAIN 验证跳转、列表、统计三类查询走预期索引，并记录加索引前后的计划",
    "实现创建短链 + 审计同事务、slug 冲突有限重试；用版本列 CAS 保证并发更新不丢更新",
    "写版本化迁移（校验和、up/down、失败回滚）与 seed.sql，从空库和旧版库各跑一次",
    "写集成测试：约束拒绝非法数据、索引计划符合预期、并发冲突可重试、迁移可回滚；一条命令跑完"
  ],
  "milestones": [
    {
      "id": "p1-m1",
      "title": "表与约束",
      "desc": "users、links、click_events 三张表与外键、唯一、CHECK、软删除语义齐全。",
      "criteria": "schema.sql 可从空库执行；非法数据被约束拒绝；删除后的 slug 可复用而有效链接不能重复。"
    },
    {
      "id": "p1-m2",
      "title": "索引与查询计划",
      "desc": "跳转、列表、统计查询各有对应索引，并有 EXPLAIN 证据。",
      "criteria": "EXPLAIN 显示索引扫描而非全表扫描；README 记录查询、索引与计划的对应关系。"
    },
    {
      "id": "p1-m3",
      "title": "事务与并发",
      "desc": "创建链接与审计同事务；slug 冲突可重试；并发更新不丢更新。",
      "criteria": "并发测试无重复 slug；失败时没有半条数据；两个并发更新都生效且版本递增两次。"
    },
    {
      "id": "p1-m4",
      "title": "迁移与种子",
      "desc": "版本化迁移、校验和、可回滚 down 与可重复执行的 seed。",
      "criteria": "空库与旧版库各迁移一次成功；down 后 schema 恢复；seed 重复执行不产生重复数据且不含生产密钥。"
    },
    {
      "id": "p1-m5",
      "title": "集成测试",
      "desc": "一条命令覆盖约束、索引、事务、并发与迁移回滚。",
      "criteria": "测试全部通过；失败信息能定位到具体约束/查询/迁移；测试不依赖真实时间和外部服务。"
    }
  ],
  "deliverables": [
    "schema.sql",
    "seed.sql",
    "migrations/（版本化迁移与回滚脚本）",
    "集成测试",
    "EXPLAIN 证据（README 或 docs）",
    "README（ER 图、运行方式、迁移步骤、验收命令）"
  ],
  "checklist": [
    "slug 唯一且保留字被拒绝",
    "外键阻止孤儿点击",
    "CHECK 阻止过期时间早于创建",
    "软删除后 slug 可复用，有效链接不能重复",
    "迁移有校验和且 down 可回滚",
    "种子可重复执行，不包含生产密钥",
    "并发更新有版本列与重试上限"
  ],
  "stretch": [
    "加审计日志表并验证同事务回滚",
    "按 tenant_id 做分区或行级安全",
    "在影子库演练一次失败迁移与恢复"
  ]
};
