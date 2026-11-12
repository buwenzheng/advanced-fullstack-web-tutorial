# 课时规格：m2-index 索引与查询计划：为什么查询会突然变慢

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m2-index` |
| 标题 | 索引与查询计划：为什么查询会突然变慢 |
| 所属阶段 | 阶段 1 · 数据与持久化：从对象到可信任的数据 |
| 时长 | 85 分钟 |
| 先修 | `m2-sql`（表、JOIN 与聚合） |
| 对应项目里程碑 | `p-m2-data-m2` 索引与查询计划 |
| 本讲在能力模型中的层级 | L2 诊断 |
| 规格状态 | 已评审，待 M2 正文 |

## 1. 出口能力

1. 解释 B+tree、复合索引最左前缀与覆盖索引，能判断一条查询能否使用某个索引。
2. 读懂 `EXPLAIN (ANALYZE, BUFFERS)` 的扫描类型、估计/实际行数、loops 与 buffers。
3. 为 LinkHub 的访问模式设计索引，并说明写入放大、冗余索引与迁移代价。
4. 识别 N+1 与索引失效，能用查询计划或测试证明修复有效。

## 2. 学习者起点与常见误解

- 已经知道：`WHERE`、`ORDER BY`、`LIMIT`、JOIN；前端项目里偶尔加过数据库索引；听说过「加索引会变快」。
- 常见误解：
  - 「给每个经常出现的列都加索引，查询一定更快。」——索引有写入与存储成本，低选择性列上的索引常常不会被使用。
  - 「复合索引 `(a, b)` 也能高效支持只查 `b` 的查询。」——B+tree 按最左前缀排序，单独查 `b` 通常无法直接定位。
  - 「`EXPLAIN` 的 rows 就是实际返回行数。」——rows 是优化器估计值，来自统计信息，可能过期或偏差很大。
  - 「出现 Index Scan 就一定比 Seq Scan 快。」——回表、随机 I/O 与低选择性会让全表扫描更划算。
  - 「N+1 只是代码风格问题。」——它把 1 次查询放大成 N+1 次网络往返，数据量一大就会拖垮连接池。
  - 「索引建好就一劳永逸。」——数据分布变化、函数包裹列、隐式类型转换都会让索引失效。

## 3. 范围边界

- 本讲只讲：
  - B+tree 的查找路径与最左前缀；
  - B-tree、hash、GIN、partial、covering 的适用场景；
  - `EXPLAIN (ANALYZE, BUFFERS)` 的读法与常见信号；
  - 估计行数、实际行数、loops、buffers 与执行时间；
  - 索引失效、冗余索引、写入放大与 N+1；
  - LinkHub 的访问模式与索引设计。
- 本讲不讲：
  - B+tree/LSM 的页结构、分裂合并与存储引擎实现（b-btree）；
  - 事务、隔离级别与锁（m2-tx）；
  - 迁移执行与回滚（m2-schema）；
  - 分布式索引、分片与复制（S5）；
  - 具体数据库的调优参数与硬件选型（b-capacity/b-linux）。
- 与相邻讲的分工：
  - m2-sql 保证查询结果正确；本讲解释查询为什么慢、如何用计划证明；
  - b-btree 讲索引的数据结构内部；本讲只讲使用与取舍；
  - 本讲不把 `EXPLAIN` 输出当成唯一真相，要求结合数据量与统计信息判断。

## 4. 内容块大纲

| # | type | 标题 | 核心论点 | 素材要点 |
| --- | --- | --- | --- | --- |
| 1 | analogy | 书末索引 vs 逐页翻 | 索引是额外结构，不是免费加速器 | 查关键词先翻索引再定位页码；写入时要维护索引；指出类比在「多列组合、回表、写入放大」处失效 |
| 2 | flow | 一次 B+tree 查找 | 树高决定页读取次数，叶子页决定范围扫描成本 | 根页 → 分支页 → 叶子页 → 回表；每步的输入、职责与失败表现；页大小/扇出取决于实现 |
| 3 | table | 索引类型 | 不同索引服务不同查询形状 | B-tree、hash、GIN、partial、covering 的适用与限制 |
| 4 | code | EXPLAIN 前后对比 | 同一条查询，加索引后计划与 buffers 会变化 | `EXPLAIN (ANALYZE, BUFFERS)` 两条命令与输出注释；强调 ANALYZE 会真实执行 |
| 5 | steps | 五步读 EXPLAIN | 先看节点类型，再看行数与循环，最后看 buffers 与时间 | 节点类型 → 估计/实际行 → loops → buffers → 实际时间 |
| 6 | pitfall | 索引失效与 N+1 | 索引没被用上，往往不是「数据库坏了」 | 函数包裹列、隐式转换、低选择性、冗余索引、N+1 五类现象与修复 |
| 7 | compare | 复合索引顺序 vs 多个单列索引 | 顺序服务查询形状，单列索引无法替代最左前缀 | 查询覆盖、回表、写入成本、维护复杂度 |
| 8 | text（深挖） | 选择性、基数与 index-only scan | 优化器的选择基于成本，不基于「有没有索引」 | 选择性/基数、统计信息、可见性地图、回表、索引膨胀；数字取决于实现与数据分布 |
| 9 | table | LinkHub 访问模式 → 索引 | 索引服务查询，不服务列 | slug 唯一、`(user_id, created_at)`、`(link_id, clicked_at)` 与写入代价 |
| 10 | note | 面试延伸 | 为什么加了索引还是慢；什么时候全表扫描更快 | 1-2 个问题，要求给出验证方式与边界 |

必含检查：

- [x] 至少 1 个前端类比（块 1）；
- [x] 至少 1 个最小可运行实现或可执行片段（块 4，EXPLAIN 命令）；
- [x] 至少 1 个坑/边界（块 6）；
- [x] 至少 1 个流程/表格/对比（块 2、3、5、7、9）；
- [x] 1 个深挖层（块 8，≥200 字符）；
- [x] 1 个面试延伸（块 10）。

## 5. 概念检查（3 题）

### C1

- ID：`m2-index-check-1`
- 类型：single
- 题干：复合索引 `(user_id, created_at)` 最能直接服务哪条查询？
- 选项：
  - A. `WHERE user_id = ? ORDER BY created_at DESC`（正确）
  - B. `WHERE created_at > ?`，不带 user_id（错误）
  - C. `WHERE slug = ?`（错误）
  - D. `ORDER BY slug`，不带过滤（错误）
- 解析要点：B+tree 先按 `user_id` 排序，再按 `created_at` 排序；等值过滤 `user_id` 后可以按第二列有序扫描。只查第二列通常无法利用最左前缀；slug 与索引列无关。
- 对应 objective：O1/O2。

### C2

- ID：`m2-index-check-2`
- 类型：multi
- 题干：哪些信号说明索引没有达到预期效果？
- 选项：
  - A. WHERE 列上有可用索引，但计划顶部仍是 Seq Scan（正确）
  - B. 估计 10 行、实际返回 10000 行，偏差巨大（正确）
  - C. Index Only Scan 的 Heap Fetches 接近返回行数（正确）
  - D. 只要出现 Index Scan，就说明计划一定最优（错误）
  - E. Seq Scan 一定比 Index Scan 慢（错误）
- 解析要点：Seq Scan 说明优化器认为全表扫描更便宜，可能因为低选择性或统计信息过期；估计/实际偏差大提示统计信息不可靠；Heap Fetches 高说明可见性地图没有覆盖，index-only 退化为频繁回表；Index Scan 也可能因随机 I/O 或回表而更慢；Seq Scan 在小表或高比例匹配时可能更快。
- 对应 objective：O2/O3。

### C3

- ID：`m2-index-check-3`
- 类型：single
- 题干：列表页展示 20 条链接，每条都要显示点击总数，当前实现是循环里逐条查询。最优修复是什么？
- 选项：
  - A. 在循环里加一层内存缓存（错误）
  - B. 用 `WHERE link_id IN (...)` 一次聚合查询取回 20 条链接的统计，再在应用层合并（正确）
  - C. 给 `click_events.link_id` 加索引，N+1 就会消失（错误）
  - D. 把列表页改成每次只显示 1 条链接（错误）
- 解析要点：N+1 的根因是查询次数随行数增长；加索引只能让每条查询更快，不能减少往返；批量聚合把 N+1 降为 1 次查询。缓存能缓解但引入失效问题，不是结构性修复；减少展示条数是产品妥协，不是查询修复。
- 对应 objective：O3/O4。

## 6. 代码题：解析 EXPLAIN（Node/Python 双轨）

- 题号：`m2-index-ex-1`
- 标题：汇总 EXPLAIN 计划
- 业务场景：`p-m2-data` 的验证脚本需要把不同数据库导出的简化计划树汇总成固定结构，用于在 README 中对比「加索引前后」的扫描类型、行数偏差与耗时。
- 函数/接口契约：

```js
summarizeExplain(plan)
```

输入节点形状：

```js
{
  node: 'Seq Scan on click_events',
  rows: 1000,        // 优化器估计行数
  actualRows: 20000, // 实际行数
  actualTime: 120.5, // 节点自身耗时（毫秒）
  children: []
}
```

返回：

- `seqScans`：节点名包含 `Seq Scan` 的数量；
- `indexScans`：节点名包含 `Index Scan` 或 `Index Only Scan` 的数量；
- `maxRowMisestimate`：所有满足 `rows > 0 && actualRows > 0` 的节点中，`max(actualRows/rows, rows/actualRows)` 的最大值，保留 2 位小数；没有有效节点时为 0；
- `totalActualTime`：所有节点 `actualTime` 之和，保留 2 位小数；缺失按 0 处理；
- `warnings`：偏差大于 10 的节点，按先序遍历生成字符串 `${node}: 估计 ${rows} 行，实际 ${actualRows} 行，偏差 ${ratio.toFixed(1)}x`；
- 空计划（`null` / `undefined`）返回全 0 与空数组。
- 教学口径：真实 `EXPLAIN ANALYZE` 的节点时间是包含子节点的累计值，不能直接相加得到墙钟时间；本题为了练习遍历与汇总，把 `actualTime` 定义为节点自身耗时。

- Node starter 要点：只看根节点，不递归；只识别 `Seq Scan` 与 `Index Scan`，不识别 `Index Only Scan`；不生成 warning；不做舍入。
- Node solution 要点：递归遍历 `children`；用 `String(node.node || '')` 防缺失；比值与耗时分别取最大值/求和；最后统一舍入。
- 测试用例（6 条）：

| # | 场景 | 输入要点 | 期望 |
| --- | --- | --- | --- |
| 1 | 纯索引计划 | `Index Scan using links_slug_key on links`，rows=1，actualRows=1，time=0.12 | seq 0、index 1、偏差 1、总耗时 0.12、无 warning |
| 2 | Seq Scan 低估 20 倍 | rows=1000，actualRows=20000，time=120.5 | seq 1、偏差 20、总耗时 120.5、1 条 warning |
| 3 | 嵌套循环递归统计 | 根 Nested Loop + Index Scan 子节点 + Seq Scan 子节点 | seq 1、index 1、偏差 1、总耗时 7.5、无 warning |
| 4 | Index Scan 高估 50 倍 | rows=5000，actualRows=100 | 偏差 50、1 条 warning 以节点名开头 |
| 5 | Index Only Scan 计入索引扫描 | 父节点 Index Only Scan + 子节点 Seq Scan（偏差 20） | seq 1、index 1、总耗时 8.5、1 条 warning |
| 6 | 空计划 | `null` | 全 0 与空数组 |

- 测试设计说明：用例 2 区分「只看扫描类型、不生成 warning」；用例 3 区分「只统计根节点」；用例 5 区分「不识别 Index Only Scan」；用例 4 区分漏掉高估方向。
- Python 差异：`summarize_explain(plan)` 接收 `dict`；用 `plan.get(...)`；递归遍历 `children`；`round(value, 2)`；测试用 `assert_eq`。
- 常见错误：只遍历根节点；把 `Index Only Scan` 漏掉；只算低估不算高估；把节点耗时相加当成墙钟时间；warning 不按先序输出。

## 7. SQL 题

- 题号：`m2-index-ex-2`
- 标题：用户 1 的链接列表第一页
- 业务场景：LinkHub 的「我的链接」列表按创建时间倒序分页；同一时间创建的链接必须有稳定顺序，否则翻页会重复或漏行。
- 数据：`links` 表 6 行，用户 1 有 5 条链接，其中两条时间戳相同。
- 目标：取用户 1 的第 1 页，每页 3 条，输出 `id, slug, created_at`，按 `created_at` 降序、`id` 降序。
- 判定：结果集精确匹配；相同时间戳按 `id` 降序；分页边界由 `LIMIT 3 OFFSET 0` 固定。
- 正确解要点：`WHERE user_id = 1` 对应索引最左列；`ORDER BY created_at DESC, id DESC` 让并列时间有确定顺序，也让 `(user_id, created_at)` 索引可以服务排序。
- 常见错误：只按 `created_at` 排序，并列行顺序由存储顺序决定；用 `OFFSET` 但不加稳定的第二排序键；忘记 `WHERE user_id` 导致扫描整表。

## 8. 方案题

- 题号：`m2-index-ex-3`
- 场景：LinkHub 有 5 条高频查询：按 slug 跳转、用户链接列表、按链接统计点击、按时间统计全站点击、按标签筛选链接。写入量约为每秒 20 次点击、每分钟 10 条新链接，数据量按 12 个月增长。请给出索引方案与验证方式。
- 自检清单（7 条）：
  1. 每条高频查询都能对应到至少一个索引，并说明索引列顺序；
  2. 说明最左前缀如何匹配查询的过滤与排序；
  3. 至少指出一个覆盖索引或 index-only scan 的机会；
  4. 说明每个索引带来的写入放大与存储成本；
  5. 找出并删除至少一个冗余索引；
  6. 说明索引迁移如何在不长时间锁表的情况下完成；
  7. 给出 EXPLAIN 证据与可接受的计划判据。
- 参考要点：slug 唯一索引；`links(user_id, created_at)` 服务列表；`click_events(link_id, clicked_at)` 服务按链接统计；全站时间统计可能需要 `click_events(clicked_at)`，但要评估写入成本；标签反查 `link_tags(tag_id, link_id)`。索引服务查询形状，不为每一列建索引；用真实数据量测试，不以小数据集结论外推。
- 常见浅答案：列出所有字段并每个都建索引；只说「加索引会变快」不给证据；忽略写入放大与迁移锁表；不区分等值过滤与范围/排序。

## 9. 事实清单

| 声明 | 来源 | 版本/日期 | 状态 |
| --- | --- | --- | --- |
| PostgreSQL 默认索引类型是 B-tree | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| `EXPLAIN ANALYZE` 会真实执行语句并给出实际行数与时间 | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| `BUFFERS` 选项用于显示缓冲区使用情况 | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| Index Only Scan 依赖可见性信息，Heap Fetches 反映回表次数 | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| B-tree 支持等值与范围查询，并按最左前缀匹配复合索引 | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| 行数估计来自统计信息，可能因数据变化而过期 | PostgreSQL 文档 | 2026-11-09 | 已核对 |
| 页大小、扇出与树高取决于具体实现 | 数据库实现说明 | 2026-11-09 | 取决于实现 |
| 低选择性查询可能选择 Seq Scan，因为全表扫描更便宜 | 查询优化器通用机制 | 2026-11-09 | 已核对 |

要求：正文不写死 PostgreSQL 版本号、页大小与扇出数字；涉及具体数据库时标注「取决于实现」。

## 10. 练习与项目联动

- EXPLAIN 解析题直接服务 `p-m2-data-m2` 的验证脚本：把计划树转成可写入 README 的摘要。
- SQL 题为 `p-m2-data-m2` 的列表查询提供语义验收；索引方案题提供 `p-m2-data-m2` 的设计输入。
- 项目证据：加索引前后的 `EXPLAIN (ANALYZE, BUFFERS)` 输出、解析后的摘要、索引迁移记录。

## 11. 自检

- [x] objectives 与检查/练习对应：O1→C1+EX3，O2→C2+EX1，O3→C2+EX3，O4→C3+EX2；
- [x] 每个块服务一个 objective；
- [x] 未展开存储引擎、事务与迁移执行；
- [x] EXPLAIN 题覆盖 Seq Scan、Index Scan、Index Only Scan 与行数偏差；
- [x] Node/Python 测试数量一致（6 条）；
- [x] 事实已登记；
- [x] 10 块与 85 分钟匹配；
- [x] 「不讲什么」已写清。
