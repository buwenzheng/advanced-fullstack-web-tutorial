# G7 门禁：毕业项目验收

## 1. 结论摘要

G7 通过。毕业项目 `p-graduation`（LinkHub 短链服务）已从一段项目简介扩展为可交付、可答辩的项目页：11 个里程碑齐全，每个里程碑都有交付物、可观察验收、证据清单、复用映射与关联阶段；6 份答辩模板均可复制；毕业项目页在 1440px 与 390px 下无横向滚动，控制台 0 消息。站点保持私有，未发布、未改访问策略，未改动 `functions/`。

| 项目 | 结果 |
| --- | --- |
| ready 模式审计 | lessons=45、draft=0、errors=0、warnings=0 |
| 毕业项目结构 | 11 个里程碑；46 条可观察验收；46 条证据项 |
| 复用映射 | m1 p2；m2 p1/p2；m3 p3/p5；m4 p3/p4；m5/m6 p4；m7/m8 p6；m9 p2/p6；m10 p7；m11 p1-p7 |
| 模板 | 6 份：ADR、容量模型、故障演练、AI 评估报告、AI 协作记录、答辩评分表 |
| links / duplication / facts | 0 断链 / 0 重复 / 0 未登记事实 |
| 练习回归 | JS 38/38、Python 38/38、SQL 2/2 通过；JS/Python starter 各 38/38 失败 |
| 浏览器 | 1440px 与 390px 无横向滚动；0 控制台消息；勾选与笔记可持久化；6 份模板复制内容与代码块一致 |
| 改动边界 | 仅毕业项目内容、项目页视图、store、样式、审计工具与 `p-graduation` 规格；S0-S7、附录 13 讲、p1-p7、`functions/` 未改 |
| 站点 | `access_mode=private`，未发布，未改访问策略 |

## 2. 自动门禁

执行时间 2026-11-09，工作目录为仓库根目录：

```text
node tools/audit-content.mjs
audit mode=ready lessons=45 draft=0 errors=0 warnings=0

node tools/audit-content.mjs --drafts
audit mode=drafts lessons=45 draft=0 errors=0 warnings=0

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

`audit-content.mjs` 的毕业项目检查为本模块新增：校验 11 个里程碑的 id 连续性、交付字段、验收/证据条数、关联链接、精确复用映射，以及 6 份模板的数量、唯一 id、字段完整性与必需关键词；任一不满足即失败。

## 3. 项目内容专项

| 检查项 | 结果 |
| --- | --- |
| 11 个里程碑与 `docs/curriculum-plan.md` 一致 | 通过。标题与交付逐项对应，验收在原表基础上展开为可观察条目 |
| 每个验收可观察 | 通过。46 条验收均给出条件、阈值、状态码、计数或可复现动作，没有「做完了」类表述 |
| 复用映射 | 通过。m1 p2；m2 p1/p2；m3 p3/p5；m4 p3/p4；m5/m6 p4；m7/m8 p6；m9 p2/p6；m10 p7；m11 p1-p7；M1-M4 合计覆盖 p1-p4，M3 额外复用 p5 |
| 不重写服务 | 通过。开篇写明「沿用 p1-p7 的同一代码库，不新建第二套 API、缓存、队列或统计服务」，里程碑只写增量与验收 |
| M11 三个取舍、两个失败模式、一次回滚、一次恢复 | 通过。M11 验收与证据逐项覆盖，并指向 ADR、容量模型、故障复盘、AI 协作记录 |
| AI 五项门槛有证据位置 | 通过。M10 验收 5 条、证据 5 条；M11 要求 AI 评估报告、注入报告、成本看板、模型故障演练与协作记录 |

| 里程碑 | 验收条数 | 证据条数 | 复用 | 关联链接数 |
| --- | --- | --- | --- | --- |
| M1 契约与认证 | 4 | 4 | p2 | 3 |
| M2 核心链路 | 4 | 4 | p1/p2 | 5 |
| M3 异步统计 | 4 | 4 | p3/p5 | 5 |
| M4 缓存与保护 | 4 | 4 | p3/p4 | 4 |
| M5 可观测性 | 4 | 4 | p4 | 3 |
| M6 交付 | 4 | 4 | p4 | 3 |
| M7 Web 与 BFF | 4 | 4 | p6 | 3 |
| M8 全栈质量门槛 | 4 | 4 | p6 | 4 |
| M9 管理后台与多租户 | 4 | 4 | p2/p6 | 5 |
| M10 AI 功能与评估 | 5 | 5 | p7 | 4 |
| M11 故障演练与答辩 | 5 | 5 | p1-p7 | 6 |

页面另有 8 条实施路线、8 项交付物、9 条验收自评与 3 项进阶挑战。

## 4. 模板专项

6 份模板均以 `<pre><code>` 原地呈现，不依赖文件下载；每张卡片带「复制模板」按钮，复制内容为代码块全文。

| 模板 | 正文字符数 | 必需内容 | 核对 |
| --- | --- | --- | --- |
| ADR 模板 | 545 | 备选、后果、反悔条件 | 通过。含 ≥2 个备选、后果与可逆性、反悔条件 |
| 容量模型模板 | 802 | 三场景、冗余、成本、压测验证 | 通过。平均/峰值/故障三场景，N+1 与扩容触发，成本表，k6 压测 |
| 故障演练模板 | 539 | 时间线、影响、根因、行动项 | 通过。时间线表、影响面、直接/系统性根因、owner 与可验证结果 |
| AI 评估报告模板 | 693 | 四类用例、阈值、失败样例、成本 | 通过。事实/拒答/直接注入/间接注入四类，阈值表、失败样例表、成本与降级 |
| AI 协作记录模板 | 491 | 五层、≥3 失败案例、一次回滚/重做 | 通过。任务/上下文/执行/验证/系统五层，3 个案例槽位，回滚记录 |
| 答辩评分表 | 888 | 7 维、硬门槛、必问问题、扣分项 | 通过。7 维 1-5 分、7 条硬门槛、6 个必问问题、5 条扣分项 |

## 5. 浏览器检查

本地静态服务器（`python dev_server.py 8124 web`）加载毕业项目页；同源 iframe 分别以 1440px 与 390px 宽度加载，以 `documentElement.scrollWidth <= clientWidth` 判定无横向滚动。

| 检查 | 1440px | 390px |
| --- | --- | --- |
| 视口 / client / scroll | 1440 / 1430 / 1430 | 390 / 380 / 380 |
| 横向滚动 | 无 | 无 |
| 主体分栏 | 556px + 300px | 348px 单栏 |
| 模板网格 | 3 列（约 271px/列） | 1 列 310px |
| 里程碑 / 模板 | 11 / 6 | 11 / 6 |
| 验收条目 / 证据 chips | 46 / 46 | 46 / 46 |
| 控制台 | 0 消息 | 0 消息 |

交互检查：

- **可勾选**：点击 M1 复选框后徽标变为「里程碑进度 1/11」，`localStorage` 写入 `p["p-graduation"].m.m1=true`；取消后恢复。
- **可写笔记**：在 M1 笔记框输入后，`localStorage` 写入 `notes.m1`；刷新后回填。检查完成后已清空测试状态，当前为 0/11、无笔记、`localStorage=null`。
- **模板可复制**：逐份点击 6 个复制按钮，写入内容与各自代码块完全一致（545/802/539/693/491/888 字符），按钮显示「已复制」并出现 toast；真实点击同样触发「已复制」。`navigator.clipboard.writeText` 在本机同源页面直接写入成功。

## 6. 文档评审

毕业项目页按项目文档评审，10 个维度各 2 分：

| 维度 | 得分 | 依据 |
| --- | --- | --- |
| 范围纪律 | 2 | 只写增量、验收与证据；明确不新建第二套服务，不重写 p1-p7 |
| 问题先行 | 2 | 开篇讲清「答辩不演示 happy path」；每个里程碑先写交付与验收，再给证据 |
| 复用映射 | 2 | 11 个里程碑的复用与计划逐项一致；关联链接全部可达 |
| 事实 | 2 | 0 未登记事实；模板不含未登记版本号与性能数字 |
| 实现与证据 | 2 | 46 条证据项覆盖契约、压测、trace、回滚、评估、成本与协作记录 |
| 失败模式 | 2 | M11 要求两个失败模式的现象、根因、发现方式与预防；模板含根因与行动项 |
| 验收可观察 | 2 | 验收含状态码、阈值、计数、并发与两条越权路径等可复现条件 |
| 全栈 / AI / AI Coding 覆盖 | 2 | M7-M9 全栈与租户；M10 AI 五项门槛；M11 与 s7-l4 约束 AI 协作五层与失败案例 |
| 答辩可筛伪 | 2 | 评分表含硬门槛、必问问题与「只演示 happy path」「数字不一致」「以 AI 说法代替验证」等扣分项 |
| 结构 | 2 | 11 个里程碑 + 6 份模板 + 8 项交付物 + 9 条自评，层次清晰 |
| **总分** | **20/20** | |

毕业项目额外检查：

- [x] 没有把「项目」写成「教程」。页面不提供实现步骤与代码，只提供验收、证据位置与模板；真实系统要求在学员仓库中增量完成。
- [x] 有可观察验收。46 条验收均可通过测试、压测报告、trace、看板或演练记录判定。
- [x] 覆盖全栈、AI、AI Coding 三条目标线。M7-M9 覆盖全栈与多租户，M10 覆盖 AI 功能与评估，M11 与 AI 协作模板覆盖 AI Coding 系统。
- [x] 能筛出「只会演示」的学员。评分表硬门槛要求三个取舍、两次演练、AI 五项证据与失败模式；扣分项直接针对 happy path 演示与数字不一致。

## 7. 发现的问题

| # | 严重度 | 位置 | 问题 | 修复 | 复验 |
| --- | --- | --- | --- | --- | --- |
| 1 | 次要 | 浏览器复制检查 | 无头浏览器首次点击时文档未获得焦点，剪贴板写入被拒，按钮显示「复制失败」 | 非产品缺陷；页面已有 textarea + `execCommand` 兜底。聚焦后真实点击与直接 `writeText` 均成功 | 6 份模板逐份复验通过 |

无阻塞或重要问题。

## 8. 残余风险

- 页面定义的是「交什么、怎么验」，学员系统与证据在站点之外；评审时仍需抽查其仓库、报告与看板，不能只看勾选进度。
- 容量目标由学员在容量模型中自定；答辩时需核对 M2/M4/M6 的压测数字与该模型一致。
- 剪贴板行为受浏览器权限与安全上下文影响；本地同源已验证，部署后如被策略禁用，textarea 兜底仍可用。

## 9. 变更边界与站点状态

- 快照：`tmp/content-snapshot-m8-before.tgz`（540,799 字节，2026-11-09 21:44:49 +0800）。
- 变更文件：`web/scripts/content/graduation.js`、`web/scripts/views/project.js`、`web/scripts/store.js`、`web/styles/components.css`、`tools/audit-content.mjs`、新增 `docs/content-specs/p-graduation.md` 与本报告。
- 未变更：S0-S7 与附录 13 讲内容、p1-p7 项目文案、`docs/content-manifest.json`、`docs/facts/registry.md`、`functions/`（快照 diff 与 mtime 检查均无改动）。
- 站点 `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2` 保持 `access_mode=private`；本次未执行发布，未改访问策略。

## 10. 门禁结论

- 是否允许进入 M9：**允许**。G7 的自动检查、项目内容专项、模板专项、浏览器检查与文档评审全部通过。
- 需要用户确认的事项：M9 发布仍复用既有 projectId/siteId，保持私有；内容变更使用新的 actionId，不新建站点。
- 备份位置：`tmp/content-snapshot-m8-before.tgz`。
