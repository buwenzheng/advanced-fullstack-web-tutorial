# G6 门禁：附录 13 讲验收

## 1. 结论摘要

G6 通过。附录 13 讲（a1-a13）全部 ready，45 讲在 ready 模式下首次达到 `draft=0`；8 道代码题均有 Node + Python 双轨，各 10 条测试，全部通过且 starter 全部失败；7 道方案题自检清单完整，a4/a6 在代码题之外叠加方案题，a7/a9/a10/a12/a13 按课程表只设方案题。结构、边界、练习与浏览器检查均满足 `docs/implementation/07-appendix.md` 的 G6 条件。站点保持私有，未发布、未改访问策略，未改动 `functions/`。

| 项目 | 结果 |
| --- | --- |
| `audit --drafts` | lessons=45、draft=0、errors=0、warnings=0 |
| ready 模式审计 | lessons=45、draft=0、errors=0、warnings=0 |
| 附录状态 | 13/13 ready |
| JS / Python / SQL 练习 | 38 / 38 / 2 道全部通过；JS/Python 各 38 个 starter 全部失败 |
| 附录代码题 | 8 道，Node 与 Python 各 10 条测试 |
| 附录方案题 | 7 道（a4/a6 叠加，a7/a9/a10/a12/a13 独立） |
| links / duplication / facts | 0 断链 / 0 重复 / 0 未登记事实 |
| 结构 | 每讲 10-12 块、恰好 3 检查、≥200 字深挖、1 个 case、1 处面试延伸 |
| 统计 | 45 讲 3400 分钟；附录 13 讲 890 分钟（60/65/70/70/65/70/70/70/70/70/70/70/70） |
| 浏览器 | 13 页 × 1440px/390px 无横向滚动，0 控制台消息；Node/Python 各抽 3 题全部通过 |
| 搜索 | B+tree、HyperLogLog、Little 定律、ADR、KV cache 均命中附录目标课时 |
| 改动边界 | 14 个附录内容文件 + 13 份附录规格；S0-S7、p7、`functions/` 未改 |

## 2. 自动门禁

执行时间 2026-11-09，工作目录为仓库根目录：

```text
node tools/audit-content.mjs --drafts
audit mode=drafts lessons=45 draft=0 errors=0 warnings=0

node tools/audit-content.mjs
audit mode=ready lessons=45 draft=0 errors=0 warnings=0

node tools/run-js-exercises.mjs
js code exercises=38 failing=0 starterFailing=38

node tools/run-python-exercises.mjs
python exercises=38 failing=0 starterFailing=38

node tools/run-sql-exercises.mjs
sql exercises=2 failing=0

node tools/check-links.mjs
links broken=0

node tools/check-duplication.mjs
duplication lessons=45 pairs=0 failing=0

node tools/check-facts.mjs
facts unregistered=0 total=10

node tools/content-stats.mjs
s0: lessons=3 minutes=170 checks=9 code=3 sql=0 design=3
s1: lessons=4 minutes=320 checks=12 code=3 sql=2 design=4
s2: lessons=4 minutes=300 checks=12 code=4 sql=0 design=4
s3: lessons=4 minutes=340 checks=12 code=4 sql=0 design=4
s4: lessons=4 minutes=310 checks=12 code=4 sql=0 design=4
s5: lessons=4 minutes=340 checks=12 code=4 sql=0 design=4
s6: lessons=4 minutes=330 checks=12 code=4 sql=0 design=4
s7: lessons=5 minutes=400 checks=15 code=4 sql=0 design=5
appendix: lessons=13 minutes=890 checks=39 code=8 sql=0 design=7
lessons: 45 core: 32 2510 appendix: 13 890 total: 3400
```

ready 模式审计在本模块完成后首次清零；此前 M6 报告中的 13 条 draft 已全部转为 ready。

## 3. 内容规格核对

| 课时 | 状态 | 时长 | 内容块 | 检查 | 深挖 text（≥200 字块数 / 最长） | case | 面试延伸 | 练习 | 测试 / 清单 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a1 复杂度与测量 | ready | 60 | 10 | 3 | 2 / 329 | 1 | 1 | code | 10 / 10 |
| a2 哈希表 | ready | 65 | 10 | 3 | 2 / 335 | 1 | 1 | code | 10 / 10 |
| a3 B+tree 与 LSM | ready | 70 | 10 | 3 | 2 / 314 | 1 | 1 | code | 10 / 10 |
| a4 堆与优先队列 | ready | 70 | 10 | 3 | 2 / 328 | 1 | 1 | code + design | 10 / 10 + 8 项 |
| a5 环形缓冲与 LRU | ready | 65 | 10 | 3 | 2 / 414 | 1 | 1 | code | 10 / 10 |
| a6 布隆过滤器与 HyperLogLog | ready | 70 | 10 | 3 | 2 / 405 | 1 | 1 | code + design | 10 / 10 + 7 项 |
| a7 性能建模与容量规划 | ready | 70 | 11 | 3 | 3 / 407 | 1 | 1 | design | 10 项 |
| a8 Linux、IO 与反向代理 | ready | 70 | 10 | 3 | 2 / 417 | 1 | 1 | code | 10 / 10 |
| a9 系统设计面试案例 | ready | 70 | 12 | 3 | 1 / 492 | 5 | 1 | design | 10 项 |
| a10 技术方案与架构决策（ADR） | ready | 70 | 10 | 3 | 1 / 353 | 1 | 1 | design | 10 项 |
| a11 代码质量、测试与工程效能 | ready | 70 | 10 | 3 | 2 / 359 | 1 | 1 | code | 10 / 10 |
| a12 故障处理、复盘与面试表达 | ready | 70 | 11 | 3 | 3 / 452 | 1 | 1 | design | 10 项 |
| a13 AI 基础设施与模型服务 | ready | 70 | 12 | 3 | 4 / 423 | 1 | 1 | design | 10 项 |

13 讲均满足：4 条目标、10-12 个内容块、恰好 3 道检查、至少一块 ≥200 字深挖、1 个 `case` 块、1 处面试延伸；a9 因案例驱动含 5 个 `case`，属于规格允许的加深。13 份规格位于 `docs/content-specs/a1.md` 至 `a13.md`。

## 4. 结构专项

- [x] **a1-a6 代码题为纯函数/纯数据结构，无数据库/OS 依赖。** 8 道附录代码题的 Node 参考实现均不含 `require(`、`import`、`fs.`、`child_process`、`process.` 或网络调用；测试注入全部数据。a3 在数组分裂中使用 `Array.splice`，属于内存数据结构操作，不是 a5 所禁止的「用数组挪动冒充 O(1) LRU」。
- [x] **a3 的 B+tree 覆盖多层。** 测试含「根分裂后树高增加」「多层分裂」「范围查询覆盖闭区间」「乱序插入后 keys 有序」「降序插入」「重复 key 被忽略」「order 过小抛错」。
- [x] **a4 的 Top-K 与双堆中位数边界正确。** 测试含「Top-K 降序」「k 大于长度时返回全部」「非法 k 返回空数组」「中位数奇数个」「中位数偶数个」「负数与乱序插入」「大量数据堆排序正确」。
- [x] **a5 的 LRU 为 O(1)，没有用数组 `splice` 冒充。** 参考实现用 `Map` 保存节点、用 `prev/next` 双向链表维护顺序；`get` 与 `put` 只做节点摘挂，无线性扫描；源码中不存在 `splice(`。
- [x] **a6 的布隆误判率与 HLL 误差在测试范围内。** 测试含「误判率随置位比例上升」「空过滤器误判率为零」「HLL 空集估算为零」「HLL 小基数估算接近实际」「HLL 大基数在误差范围内」「非法 precision 抛错」。
- [x] **a8 的加权轮询为平滑实现，不是随机。** 参考实现不含 `Math.random`；测试含「权重比例正确」「平滑顺序而非连续命中」「跳过不健康节点」「全部不健康返回 null」「多轮循环后比例仍正确」以及 fd 预算的通过/不足/恰好等于上限。
- [x] **a11 的 flaky 检测看翻转次数，不看单次失败。** 参考实现只统计相邻结果变化次数，`flips >= 2` 才判 flaky；测试含「无翻转的测试稳定」「多次翻转判定为 flaky 并按翻转排序」「空历史与空结果」。

## 5. 边界矩阵核对表

| 附录 | 核心对应 | 附录只讲 | 核心已讲 | 核对结果与依据 |
| --- | --- | --- | --- | --- |
| a1 | s4-perf | 复杂度、微基准、增长拟合 | 压测、瓶颈定位 | 通过。a1 只做增长拟合与压测样本汇总；未讲压测工具、瓶颈定位与调优流程 |
| a2 | s3-l1 | 哈希表结构、冲突、扩容 | Redis 缓存策略 | 通过。a2 全文无 Redis；只讲开放寻址、墓碑、负载因子与扩容 |
| a3 | s1-l2 / s5-data-scale | B+tree/LSM 结构 | SQL 索引、EXPLAIN、分片复制 | 通过。EXPLAIN 仅在案例现象与预防句中作为外部工具出现，未教语法与执行计划；未讲分片复制 |
| a4 | s3-l2 | 堆、Top-K、调度结构 | BullMQ 队列与消费者 | 通过。a4 全文无 BullMQ；只讲堆、Top-K、双堆中位数与延迟调度结构取舍 |
| a5 | s3-l1 / s4-l1 | 环形缓冲、LRU 结构 | Redis 淘汰、日志指标 | 通过。Redis 仅作为「近似 LRU」对照出现，未讲缓存策略；主体是环形缓冲与严格 LRU 实现 |
| a6 | s3-l1 / s5-data-scale | 布隆、HLL | 缓存、分片 | 通过。a6 全文无 Redis；只讲概率结构的误判率、误差与内存预算 |
| a7 | s4-perf | 建模、容量、成本曲线 | 压测与瓶颈 | 通过。a7 方案题要求可复核的容量与成本模型；没有压测脚本、火焰图或瓶颈定位步骤 |
| a8 | s4-l3 | Linux/IO、反向代理 | 容器、信号、发布 | 通过。a8 全文无 Kubernetes；只讲 Linux/IO 底座、平滑加权轮询与 fd 预算 |
| a9 | S0-S7 | 案例与表达 | 所有机制 | 通过。五个案例只引用机制名词与取舍，不展开机制实现；新增 `auditAnswer` 只做回答完整性检查 |
| a10 | s5-l1 | ADR 与决策记录 | 模块边界 | 通过。a10 的「模块边界」只作为 ADR 影响面与备选对比的判据，不教如何划模块 |
| a11 | s4-l4 | 测试策略与工程质量 | CI/CD 流水线 | 通过。CI 仅在契约验证、flaky 案例与防重跑语境出现；未讲流水线配置与发布 |
| a12 | s5-l3 / s4-l1 | 故障流程与复盘表达 | 分布式失败机制、可观测性 | 通过。a12 全文无「分布式」；只讲分级、止损、复盘与面试表达 |
| a13 | s7-l1/l2 | 推理、索引、成本基础设施 | AI 应用集成 | 通过。a13 全文无「微调」；不重复应用集成代码，只讲 prefill/decode、路由、向量索引、成本与隐私 |

硬规则核对：

- 附录未引入核心阶段没讲过的新机制；需要机制时以边界句或案例引用，不重新教学。
- a9 不引入新机制；案例只引用已有机制。
- a13 不重复 s7 的应用集成，不教训练/微调。
- a1/a7 与 s4-perf 分工清楚：a1「怎么算与怎么测」，a7「怎么建模与估算」，s4-perf「怎么压测与定位」。
- `check-duplication` 对 45 讲做正文比对，`pairs=0`，无整段重复。

## 6. 练习检查

- [x] **8 道代码题均有 Node + Python 双轨，测试各 10 条（≥8）。** a1、a2、a3、a4、a5、a6、a8、a11；`run-js-exercises` 与 `run-python-exercises` 均 38/38 通过，starter 各 38/38 失败。
- [x] **7 道方案题的自检清单可逐项判定。** a4 延迟任务调度器 8 项、a6 短链去重与 UV 统计 7 项、a7 LinkHub 容量与成本模型 10 项、a9 两个案例的完整回答 10 项、a10 LinkHub 三份 ADR 10 项、a12 故障复盘 + 面试表达 10 项、a13 推理容量与成本模型 10 项；清单均为可观察、可验证的条件，参考要点覆盖取舍与边界。
- [x] **a7/a9/a10/a12/a13 没有强行加代码题。** 五讲只有 design 练习，与 `content-stats` 的 `design=7`（含 a4/a6）一致；代码展示块只作示范，不进入判题。
- [x] **fixture 可审查、无真实密钥、无个人信息。** 本批未新增 fixture；既有 fixture 未改。演示用户为虚构数据，无真实个人信息。

## 7. 浏览器检查记录

本地静态服务器加载 `web/`，同源 iframe 分别以 1440px 与 390px 宽度逐路由加载；以 `documentElement.scrollWidth <= clientWidth` 判定无横向滚动。

### 7.1 页面、宽度与块渲染

| 页面 | H1 | 1440px | 390px | 渲染块（case / table / steps / pitfall） |
| --- | --- | --- | --- | --- |
| a1 | 复杂度与测量：先能算，再能测 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a2 | 哈希表：平均 O(1) 的代价与边界 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a3 | B+tree 与 LSM：索引为什么长这样 | 1430/1430 | 380/380 | 1 / 2 / 0 / 1 |
| a4 | 堆与优先队列：Top-K、延迟任务与中位数 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a5 | 环形缓冲与 LRU：固定内存下的秩序 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a6 | 概率结构：布隆过滤器与 HyperLogLog | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a7 | 性能建模与容量规划 | 1430/1430 | 380/380 | 1 / 2 / 1 / 1 |
| a8 | Linux、IO 与反向代理 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a9 | 系统设计面试案例 | 1430/1430 | 380/380 | 5 / 1 / 1 / 1 |
| a10 | 技术方案与架构决策（ADR） | 1430/1430 | 380/380 | 1 / 2 / 2 / 1 |
| a11 | 代码质量、测试与工程效能 | 1430/1430 | 380/380 | 1 / 1 / 1 / 1 |
| a12 | 故障处理、复盘与面试表达 | 1430/1430 | 380/380 | 1 / 1 / 2 / 1 |
| a13 | AI 基础设施与模型服务 | 1430/1430 | 380/380 | 1 / 2 / 1 / 1 |

26 次加载全部 `overflow=false`。a3 的内容结构使用表格与 flow 表达流程，不含 steps 块，因此 steps 计数为 0；其余页面的 table/case/pitfall/steps 均正常渲染。控制台检查为 0 条消息、0 错误。

### 7.2 练习抽题

通过页面「查看参考答案」取当前轨道参考实现，填入练习编辑器后点击「运行测试」，读取 `.test-item` 的 `is-pass` / `is-fail`：

| 轨道 | 课时 | 练习 | 结果 |
| --- | --- | --- | --- |
| Node.js | a1 | 增长拟合 + 压测汇总 | 10/10 通过，0 失败 |
| Node.js | a3 | 简化 B+tree | 10/10 通过，0 失败 |
| Node.js | a11 | 测试组合审计 + flaky 检测 | 10/10 通过，0 失败 |
| Python | a2 | 开放寻址哈希表 | 10/10 通过，0 失败 |
| Python | a6 | 布隆过滤器 + HyperLogLog | 10/10 通过，0 失败 |
| Python | a8 | 平滑加权轮询 + fd 预算 | 10/10 通过，0 失败 |

Python 轨道在页面内由 Pyodide 运行，界面标注 Python 3.13，首轮加载后 3 道 Python 题均无超时或异常。

### 7.3 搜索

| 查询 | 命中数 | 附录命中 |
| --- | --- | --- |
| B+tree | 6 | a3（另命中 s1、s5-data-scale 等） |
| HyperLogLog | 2 | a6 |
| Little 定律 | 3 | a7（另命中 s4-perf） |
| ADR | 4 | a10（另命中 a7、a8） |
| KV cache | 2 | a13 |

搜索覆盖标题与正文索引；五个关键词均命中对应附录课时。

## 8. 改动边界与私有状态

- **开始前快照**：`tmp/content-snapshot-m7-before.tgz`（覆盖 `web/scripts/content/`）。
- **实际改动**：`web/scripts/content/stages/appendix/a1.js` 至 `a13.js` 共 13 个课时文件，加 `appendix/python.js`，共 14 个内容文件；`docs/content-specs/a1.md` 至 `a13.md` 共 13 份规格（a13 为新建，其余为更新）。
- **快照对比**：非附录内容与快照 `diff` 无差异；`web/scripts/content` 下除附录外的文件在快照后无修改。
- **未改动**：S0-S7 内容、p7、`web/scripts/content/fixtures/`、`functions/`、`docs/facts/registry.md`、工具与样式文件；`find` 按修改时间核对，`functions/` 无新修改，docs 仅 13 份附录规格变更。
- **站点**：`list_sites` 显示站点 `access_mode=private`、`lifecycle=active`；本批未调用发布操作，未修改访问策略。
- **密钥**：本批未新增或写入任何密钥；正文与前端未包含演示密钥。

## 9. 10 维评分

评分标准沿用 `docs/reviews/g5-s7.md` 的 10 维表（每维 0-2 分，合计 20）：

| 课时 | 范围纪律 | 问题先行 | 前端类比 | 事实准确 | 最小实现 | 坑与边界 | 练习对齐 | Python 等价 | 深度 | 结构与可读性 | 合计 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a5 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a6 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a7 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| a8 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a9 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| a10 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| a11 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
| a12 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| a13 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |

全部 ≥18/20，无 0 分项。五个 1 分项都是同一结构性原因：a7/a9/a10/a12/a13 按课程表只设方案题，没有代码题与 Python 轨道，因此「Python 等价」记 1；这不是内容缺陷，五讲的方案题由 10 项自检清单与参考要点承担可验证性，与 `g5-s7.md` 对 s7-l5 的处理一致。

## 10. 未决问题

1. **演示密钥的既有暴露（非 G6 阻塞项）**：`functions/handler.ts` 中存在硬编码 `DEMO_SECRET`，`docs/implementation/09-qa-release.md` 也写有该值，与该文档「不写入任何文档/前端」的约定不一致。该问题在 M7 开始前已存在；M7 约束禁止修改 `functions/` 与计划文档，因此本批未改动。站点为私有，风险受限；建议在 M8/M9 改为平台 Secret 注入并从文档删除明文，或明确把它登记为「非敏感演示值」并同步修订约定。
2. **方案题仍为自检**：7 道方案题没有自动判分，依赖清单与参考要点人工核对；这是课程设计选择，不是遗漏，M9 可通过抽样评审检查评分一致性。
3. **发布与线上浏览器验证未执行**：按发布策略，站点保持私有，G6 只在本地静态预览完成浏览器检查；线上版本仍是 M6 的发布内容，需在 M9/G8 全量回归后统一发布并复验。

## 11. G6 结论

G6 通过。附录 13 讲全部 ready，45 讲 ready 模式清零；结构、边界、练习、事实与浏览器检查均有可复核证据。M8 的前置 a10（ADR）与 a12（故障复盘）已就绪，可进入毕业项目阶段。
