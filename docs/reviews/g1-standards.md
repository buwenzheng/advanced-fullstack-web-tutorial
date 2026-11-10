# G1 内容规范（M1）评审报告

- 日期：2026-11-09
- 评审范围：`docs/content-style.md`、`docs/content-specs/s0-l1.md`、`docs/content-specs/s0-l2.md`、`docs/facts/registry.md`、`docs/implementation/templates/*`；45 讲骨架只读检查
- 执行人：Qoder（AI 执行）；用户为最终确认人
- 结论：通过（有条件：M2 正文必须按规格落地，并按同一评分表复评）

> 命名说明：本报告是 M1 的「内容规范门」。M2 的 S0-S1 内容门仍是 `docs/reviews/g1-s0-s1.md`，两者不能互相替代。

## 1. 自动检查

| 检查 | 命令 | 结果 | 证据位置 |
| --- | --- | --- | --- |
| 结构审计（draft 模式） | `node tools/audit-content.mjs --drafts` | `audit mode=drafts lessons=45 draft=45 errors=0 warnings=0` | 本报告 §1 |
| 结构审计（正式模式） | `node tools/audit-content.mjs` | `errors=45`，全部为「仍为 draft」，符合 M1 约束 | 本报告 §1 |
| JS 练习 | `node tools/run-js-exercises.mjs` | `js code exercises=0 failing=0 starterFailing=0` | M1 不写正文，0 题符合预期 |
| Python 练习 | `node tools/run-python-exercises.mjs` | `python exercises=0 failing=0 starterFailing=0` | 同上 |
| SQL 练习 | `node tools/run-sql-exercises.mjs` | `sql exercises=0 failing=0` | 同上 |
| 断链 | `node tools/check-links.mjs` | `links broken=0` | 本报告 §1 |
| 重复段落 | `node tools/check-duplication.mjs` | `duplication lessons=0 pairs=0 failing=0` | 本报告 §1 |
| 事实登记 | `node tools/check-facts.mjs` | `facts unregistered=0 total=4`；registry 共 20 条 | `docs/facts/registry.md` |
| 内容统计 | `node tools/content-stats.mjs` | `lessons: 45 core: 32 2510 appendix: 13 890 total: 3400` | 与清单一致 |
| 进度迁移 | `node tools/test-progress-migration.mjs` | `progress migration ok: q/l/drafts mapped, graduation preserved, idempotent` | 本报告 §1 |
| 站点访问范围 | `get_site`（只读） | `access_mode=private`、`lifecycle=active`；M1 无新发布 | 本报告 §7 |
| s0-l1 参考实现（Node） | 临时脚本，6 条用例 | `analyzeTimings: 6/6 pass` | 评审时本地执行，未提交 |
| s0-l1 参考实现（Python） | 临时脚本，6 条用例 | `analyze_timings: 6/6 pass` | 评审时本地执行，未提交 |
| s0-l2 参考实现（Node） | 临时脚本，6 条用例 | `node runWithLimit: 6/6 pass` | 评审时本地执行，未提交 |
| s0-l2 参考实现（Python） | 临时脚本，6 条用例 | `python run_with_limit: 6/6 pass` | 评审时本地执行，未提交 |
| s0-l2 starter 区分度 | 临时脚本 | `starter failures=3`，至少 1 条失败 | 评审时本地执行，未提交 |

补充状态检查：

```text
lessons 45 draft 45 ready 0
blocks 0 checks 0 exercises 0
```

结论：M1 只新增规范与规格，没有写入正文、没有新增课程；`functions/` 未被修改（文件时间仍为 2026-10-29）。正式审计的 45 条 draft 错误是 M1 的预期状态，不是回归。

## 2. 规范覆盖检查（T1.1-T1.7）

### 2.1 T1.1 内容风格指南

| # | 必须覆盖 | 证据 | 结果 |
| --- | --- | --- | --- |
| 1 | 语气：对读者说「你」、问题先行、不写营销话术与「众所周知」 | `docs/content-style.md` §1.2、§1.3 | 通过 |
| 2 | 段落：单个 `html` 块 ≤900 字符，超长拆分 | §2 | 通过 |
| 3 | HTML：只允许 `<code>/<strong>/<em>/<br>/<ul>/<ol>/<li>/<pre>`，禁止内联样式、脚本、外链图片、iframe | §3 | 通过 |
| 4 | 代码：20-60 行、零第三方依赖、可运行、关键行注释、不写伪代码 | §5.1 | 通过 |
| 5 | 表格：4-6 列、4-8 行、每列语义明确、不塞长段落 | §4.5 | 通过 |
| 6 | 坑块：现象、原因、发现方式、修复、预防至少四要素 | §4.3 | 通过 |
| 7 | 深挖块：机制、数字、边界、失败模式，不重复正文 | §4.2 | 通过 |
| 8 | 面试延伸：每讲最后 1-2 个问题，给参考要点不给标准答案 | §4.4 | 通过 |
| 9 | AI 内容：不写模型名与价格作为事实；写机制、可替换接口、评估、降级；版本/价格标日期 | §9.1 | 通过 |
| 10 | AI Coding：按任务/上下文/执行/验证/系统五层组织；不写提示词大全与工具评测 | §9.2 | 通过 |

### 2.2 T1.2-T1.7

| 任务 | 要求 | 证据 | 结果 |
| --- | --- | --- | --- |
| T1.2 课时规格模板 | 每讲先写规格；规格含 8-14 块、3 道检查、代码/方案题、事实、边界；规格自检后才写正文 | §10；`docs/implementation/templates/lesson-spec.md`；`docs/content-specs/s0-l1.md`、`s0-l2.md` | 通过 |
| T1.3 题型与测试 | 3 题/讲、至少 1 道多选；单选题 1 个正确项、多选题 ≥2；解析解释错误项；代码题 ≥4 条测试、覆盖正常/边界/失败、starter 至少失败 1 条、solution 全过、测试确定性；方案题清单 6-8 条、参考含约束/备选/代价/反悔条件 | §6；两份规格 §5-§7 | 通过 |
| T1.4 Python 轨道 | 每个代码题有 Python track；snake_case、asyncio、标准库；不逐行翻译，写运行时差异；`assert_eq`/`assert`，异步标 `async: true`；兼容 3.11+ 与 Pyodide 3.13 | §7；两份规格 §6 | 通过 |
| T1.5 事实登记 | 版本、默认值、价格、性能数字、协议行为必须登记；来源优先官方文档；无法确认写「取决于版本」；改事实更新日期 | §8；`docs/facts/registry.md` 新增网络与运行时两类事实 | 通过 |
| T1.6 边界矩阵 | 写进 `content-style.md`，至少覆盖 15 组高风险边界 | §11，15 行齐全 | 通过 |
| T1.7 批次与评审 | 核心 2 讲/批、附录 2-3 讲/批；先规格后正文；单讲即审；每批写评审；每模块 10 维评审；不通过不进入下一模块；跨讲改动先改矩阵 | §12；本报告 §3 | 通过 |

## 3. 内容评审（10 维预评分）

> 评分对象是「课时规格」，不是正文。规格阶段能证明设计与可验证性；M2 正文完成后必须按同一张表复评，正文评分才作为单讲质量门禁。

| 课时 | 范围纪律 | 问题先行 | 类比 | 事实 | 实现 | 坑 | 练习对齐 | Python | 深度 | 结构 | 总分 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s0-l1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20/20 | 通过 |
| s0-l2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20/20 | 通过 |

评分依据：

- **范围纪律**：s0-l1 明确排除 TCP 拥塞控制、证书签发、Nginx 与 CDN；s0-l2 明确排除 V8 GC、libuv 源码、完整 asyncio 与 worker_threads API。两讲都写了与相邻讲的分工。
- **问题先行**：s0-l1 从「只有部分用户证书失败」「切换 A 记录后部分用户失败」等真实现象切入；s0-l2 从 p0 并发探测与线上服务 P99 抖动切入。
- **前端类比**：s0-l1 用 DevTools 只看到 TTFB 与寄快递类比，指出连接复用处失效；s0-l2 用厨房主厨/配菜台类比，指出网络 I/O 不占线程池处失效。
- **事实准确**：两份规格均有事实清单并登记到 registry；TLS/HTTP/RFC、libuv 线程池 4、Node 15+ 未处理拒绝、GIL 与 asyncio 均标注来源和边界。评审中发现并修正了 s0-l1 用例 5 的算术错误。
- **最小实现**：s0-l1 的 `analyzeTimings` 与 s0-l2 的 `runWithLimit` 参考实现在评审时以临时脚本执行，Node/Python 均 6/6 通过；s0-l2 starter 至少失败 3 项检查。
- **坑与边界**：s0-l1 的「一切都塞进 200」、s0-l2 的「未处理拒绝与 process.exit」都包含现象、原因、发现方式、修复与预防；设计题要求写线上现象而不只写名词。
- **练习对齐**：s0-l1 O1→C1、O2→C3+EX1、O3→EX1 用例 2、O4→C2+EX2；s0-l2 O1→C2、O2→C1/C3+EX1、O3→EX1、O4→EX2+块 5/9/10；每题都有明确 objective。
- **Python 等价**：s0-l1 说明 `ValueError`、dict 返回与 Python 银行家舍入；s0-l2 使用 `asyncio.gather` + worker + 取消，不把线程池冒充异步。两讲都写了两轨测试的差异。
- **深度**：s0-l1 有冷启动 RTT、HTTP 版本与 DNS TTL 的深挖；s0-l2 有三块并发天花板、主线程/worker/cluster/队列取舍与面试延伸。
- **结构与可读性**：s0-l1 12 块、s0-l2 11 块，类比/流程/表/代码/坑/深挖搭配齐全，无单一类型堆砌。

附加项：两讲属于 L1，S6/S7/AI Coding 附加项不适用。

## 4. 浏览器检查

| 页面 | 视口 | 渲染 | 控制台 | 交互 | 截图 |
| --- | --- | --- | --- | --- | --- |
| 课时页 | 1440px | 不适用（M1 未改 `web/`） | G0 已验证 0 错误 | 不适用 | G0 已留证 |
| 课时页 | 390px | 不适用 | G0 已验证 0 错误 | 不适用 | G0 已留证 |
| 阶段页 | 1440px | 不适用 | G0 已验证 0 错误 | 不适用 | G0 已留证 |
| 项目页 | 1440px | 不适用 | G0 已验证 0 错误 | 不适用 | G0 已留证 |

说明：M1 只新增文档，站点仍渲染 M0 骨架；没有新的 UI 行为可测。M2 写入正文后必须重新做课时页与移动端检查。

## 5. 发现的问题

| # | 严重度 | 位置 | 问题 | 修复 | 复验 |
| --- | --- | --- | --- | --- | --- |
| 1 | 阻塞 | `docs/content-specs/s0-l1.md` §0、§9 | 项目里程碑编号写错：把分段耗时写成 `p0-m1`、慢段定位写成 `p0-m4`；实际 `p0-m2` 是分阶段耗时、`p0-m3` 是超时与错误、`p0-m4` 是机器可读输出 | 改为 `p0-m2` 与 `p0-m3`，并修正联动说明 | 已复读核对 `02-s0-s1.md` 的 p0 里程碑表 |
| 2 | 重要 | `docs/content-specs/s0-l1.md` §6 用例 5 | 舍入用例期望值算错：输入 `0.0001/0.0003` 时 `dns=0.1`、`tcp=0.2`，原稿写成 `0.2/0.3` | 修正期望值；Node/Python 参考实现 6/6 通过 | 已用临时脚本复算全部 6 条用例 |
| 3 | 重要 | `docs/content-specs/s0-l2.md` §6 用例 3 | 测试设计依赖沙箱不可观测的未处理拒绝，且原描述暗示使用 `process` 事件；站点 JS 沙箱不提供 `process`/`setImmediate` | 用例 3 改为只验证拒绝传播与挂起任务可清理；`content-style.md` §5.3 明确沙箱可用能力 | 已复读 runner 源码 `tools/lib/js-runner.mjs` |
| 4 | 次要 | `docs/content-specs/s0-l1.md` §5 C3 | IPv6 选项的解释依赖 Happy Eyeballs 与 IPv6-only 网络条件，规格未写明；正文若直接断言会过度简化 | 记录为 M2 正文写作注意事项：补一句「取决于客户端地址族选择与网络条件」 | 待 M2 正文复评 |
| 5 | 次要 | `docs/content-specs/s0-l1.md` §6 Python 差异 | 未说明 Python `round` 的银行家舍入可能与 JS `Math.round` 在正好 `.05` 时不同 | 已补差异说明；测试数据避开正好 `.05` 的边界 | 已用 Python 参考实现复跑 6/6 |

## 6. 残余风险

- 10 维评分目前是规格预评分。正文的段落长度、代码注释质量、坑块完整度只能在 M2 落稿后验证；M2 必须复评，不能引用本报告替代正文评审。
- `tools/check-facts.mjs` 只扫描 `web/scripts/content/`，不扫描 `docs/content-specs/`。M2 写正文时若引入新数字，必须同步更新 registry，否则正式审计才会暴露。
- JS 判题沙箱没有 `process` 与 `setImmediate`，s0-l2 中关于未处理拒绝的运行时结论只能通过正文代码与本地演示证明，不能写成沙箱断言。
- Python 参考实现只在本地 CPython 3.11.9 验证，尚未在浏览器 Pyodide 3.13 跑过；M2 必须用站点 Python 运行器复验。
- 边界矩阵目前覆盖规定的 15 组；后续模块新增跨讲概念时，必须先改矩阵再写正文，否则容易重复或越界。
- 站点仍为私有（`access_mode=private`、`lifecycle=active`），已发布版本仍是 M0 之前的旧内容；M1 没有发布动作，M2 也不应发布，直到发布门禁通过。

## 7. 门禁结论

- 是否允许进入下一模块：**是**。允许开始 M2 B2.1（s0-l1、s0-l2 规格已完成，可进入正文批次）；正文完成后必须按本报告 §3 复评，并补浏览器检查。
- 需要用户确认的事项：无。M1 范围内已按「全部课时保持 draft、不写正文、不新增课程、不改 functions、站点私有」执行。
- 备份位置：`backups/content-m0-20261109/`（M0 内容快照）；M1 只新增 `docs/` 文档，未改 `web/`、`tools/`、`functions/`。M2 写正文前建议再做一次 content 快照。
