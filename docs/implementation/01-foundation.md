# M0-M1：工程底座与内容规范

> 目标：让 45 讲有一个稳定的内容容器、可执行的校验工具、统一的写作规范。M0/M1 不做课程正文；任何正文都要等 G0 通过后再写。

## 1. 模块范围

| 模块 | 任务 | 产出 |
| --- | --- | --- |
| M0 | 备份、内容架构、Schema、清单、工具链、UI 适配、进度迁移、45 讲骨架 | 可运行的空课程站 + 校验工具 |
| M1 | 风格指南、课时规格模板、题型规则、Python 规则、事实登记、边界矩阵 | 可复制的生产规范 |

**不做什么**：不写任何一讲的完整正文；不新增课程；不发布；不改 `functions/`。

## 2. M0 任务卡

### T0.1 备份当前站点

- 类型：engine
- 依赖：无
- 产出：`backups/web-v1-20261109/`（整个 `web/` 与 `docs/curriculum-plan.md`）
- 验收：
  - `find backups/web-v1-20261109 -type f | wc -l` 与 `find web -type f | wc -l` 数量一致（不含 docs）；
  - 备份内 `web/index.html` 可直接被本地服务器打开；
  - 在 `docs/reviews/g0-foundation.md` 记录备份路径与文件数。
- 回滚：删除本任务创建的备份目录即可；不影响现有站点。
- 停止条件：备份目录已存在且内容不同，先确认是否覆盖，不直接删除。

### T0.2 建立按阶段拆分的内容架构

- 类型：engine
- 依赖：T0.1
- 产出：

```text
web/scripts/content/
  index.js
  stages/s0/index.js
  stages/s0/s0-l1.js
  stages/s0/s0-l2.js
  stages/s0/s0-cli.js
  stages/s0/project.js
  stages/s0/python.js
  … s1 … s7 …
  stages/appendix/index.js
  stages/appendix/a1.js … a13.js
  stages/appendix/python.js
  graduation.js
```

- 约束：
  - 每讲一个文件，只导出课时对象；不写副作用；
  - 阶段 `index.js` 只做组装与阶段元数据；
  - 项目独立 `project.js`；
  - Python 映射按阶段放 `python.js`，导出 `PYTHON_BLOCKS` 与 `PYTHON_TRACKS`；
  - `content/index.js` 负责合并、补齐 `stageId`、注入 Python 映射、导出 `curriculum/allLessons/lessonById/stageById/findProject/graduationProject`。
- 验收：
  - `node -e "import('./web/scripts/content/index.js').then(m=>console.log(m.allLessons.length))"` 输出 45；
  - 每个阶段 `index.js` 可单独导入；
  - 不存在旧的 `python-blocks.js`/`python-tracks.js`/`stages/stage0.js` 引用（迁移完成后删除旧文件）。
- 回滚：恢复 `backups/web-v1-20261109/web/scripts/content/`。
- 停止条件：导入循环、阶段 ID 重复、课时 ID 重复。

### T0.3 冻结内容 Schema v2

- 类型：engine
- 依赖：T0.2
- 产出：`docs/content-schema.md` + `content/index.js` 的归一化函数
- Schema：

```js
// 阶段
{
  id: 's0', index: 0, title, subtitle, accent, duration,
  goal, outcome: [], keywords: [],
  lessons: [], project, appendix?: true
}

// 课时
{
  id: 's0-l1', title, subtitle, duration,
  status: 'draft' | 'ready',
  objectives: [], keywords: [],
  blocks: [], checks: [], exercises: []
}

// 项目
{
  id: 'p0', stageLabel, title, brief, goal, stack: [],
  steps: [], milestones: [{ id, title, desc, criteria }],
  deliverables: [], checklist: [], stretch: []
}
```

- 新增块类型仅一个：`case`。

```js
{
  type: 'case',
  title: '一次线上事故的完整复盘',
  context: '背景与时间线',
  symptom: '用户看到什么、监控看到什么',
  cause: '根因，不是表象',
  fix: '止损与修复',
  prevention: '如何防止再次发生',
  metric: '可观察的指标变化（可选）'
}
```

- 约束：
  - 除 `case` 外不新增块类型；需要新结构先用现有类型表达；
  - `status` 缺省视为 `ready`，但 M0 骨架必须显式写 `draft`；
  - 所有 ID 一旦写入清单不可改动；如需改动，先改大纲与清单并跑迁移。
- 验收：
  - `docs/content-schema.md` 与 `content/index.js` 字段一致；
  - `node tools/audit-content.mjs --drafts` 对骨架通过；
  - `case` 块在浏览器可渲染（T0.6 验证）。
- 回滚：恢复 `content/index.js` 与 `blocks.js`。
- 停止条件：Schema 与现有视图渲染冲突且无法用归一化函数解决。

### T0.4 生成 45 讲骨架与内容清单

- 类型：content
- 依赖：T0.3
- 产出：
  - 45 个课时文件（含 metadata、objectives 占位、空 blocks/checks/exercises、`status:'draft'`）；
  - 8 个阶段 `index.js` 与 8 个 `project.js`；
  - `graduation.js`（11 个里程碑占位，`status` 不需要，项目没有草稿态）；
  - `docs/content-manifest.json`。
- 清单格式：

```json
{
  "version": 2,
  "stages": [
    { "id": "s0", "index": 0, "title": "...", "duration": 170,
      "lessons": [{ "id": "s0-l1", "duration": 55 }] }
  ],
  "appendix": { "id": "appendix", "duration": 890, "lessons": ["a1", "..."] },
  "graduation": { "id": "p-graduation", "milestones": 11 },
  "totals": { "lessons": 45, "coreMinutes": 2510, "appendixMinutes": 890, "minutes": 3400 }
}
```

- 约束：
  - 课时 ID 与 `docs/curriculum-plan.md` 完全一致；
  - 阶段顺序 S0-S7，附录单独 `appendix`；
  - 骨架标题、时长、先修必须来自大纲，不自行改写；
  - 骨架正文为空，但 `objectives` 至少写 3 条占位文案（后续由规格替换）。
- 验收：
  - `node tools/content-stats.mjs` 输出 45 讲、核心 2510、附录 890、总计 3400；
  - `node tools/audit-content.mjs --drafts` 0 错误；
  - 清单与内容逐项一致。
- 回滚：删除新建的 `stages/` 与 `graduation.js`，恢复旧内容。
- 停止条件：大纲中存在 ID/时长歧义，先回到大纲修正，不在内容里猜。

### T0.5 实现校验工具链

- 类型：engine
- 依赖：T0.4
- 产出：`tools/` 下 8 个零依赖脚本。

#### `tools/audit-content.mjs`

规则：

1. 阶段：ID 唯一、index 0-7 连续、appendix 单独、时长与清单一致。
2. 课时：ID 唯一且匹配 `^s[0-7]-(l\d+|cli|schema|perf|resilience|data-scale)$` 或 `^a\d+$`；文件导出对象 ID 与文件名一致。
3. 课时结构：`status:'ready'` 时必须有 3-4 个 objectives、8-14 个 blocks、3 道 checks、至少 1 道可验证练习（代码/SQL/方案）；代码题必须双轨，方案题按课程表。
4. 块：至少 1 个 analogy、1 个 code、1 个 pitfall/tip、1 个 table/compare/flow/steps、1 个深挖 text；`case` 块字段齐全；不允许 `<script>`、外链图片、TODO/占位词。
5. 检查题：单选题恰好 1 个 correct，多选题 ≥2 个 correct；解析非空；ID 唯一。
6. 代码题：`starter/tests/solution` 齐全；≥4 条测试；测试名非空；solution 必须全过；starter 至少失败 1 条；每个 code exercise 必须有对应 Python track。
7. SQL 题：`tables/expected/solution` 齐全；solution 执行结果与 expected 一致。
8. 方案题：`checklist` ≥6 条；`reference` 非空。
9. 项目：steps ≥5、milestones ≥4、每个 milestone 有 criteria、deliverables/checklist ≥5。
10. Python 映射：键存在、代码块索引合法、无多余键、每个 code exercise 都有 track。
11. 统计：与 `content-manifest.json` 一致。
12. 重复：段落 shingle 相似度 > 0.40 报错；0.30-0.40 警告。
13. 事实：扫描版本/数字模式（Node/Python/HTTP/TLS/Redis/PostgreSQL/OpenTelemetry/k6 等），未登记则报错。

命令：

```bash
node tools/audit-content.mjs            # 只允许 ready；draft 视为错误
node tools/audit-content.mjs --drafts   # 允许 draft，但仍校验骨架结构
```

#### `tools/run-js-exercises.mjs`

- 用 `node:vm` 依次执行每道 JS 题的 starter 与 solution；
- 提供 `assert`、`assert.equal/deepEqual/throws`、`console`、`setTimeout`；
- 单题超时 3s；异步测试必须 await；
- 断言：solution 全过；starter 至少 1 条失败；测试条数与声明一致；
- 输出 `js code exercises=N failing=0 starterFailing=N`，失败时退出码 1。

#### `tools/run-python-exercises.mjs`

- 从内容模块读取 Python track，生成临时 `.py` 测试文件；
- 用本机 `python`（3.11+）执行，单题超时 5s；
- 提供 `assert_eq`、`assert`，支持 `async` 测试（`asyncio.run`）；
- 断言与 JS 相同：solution 全过、starter 至少失败 1 条；
- 输出 `python exercises=N failing=0 starterFailing=N`。

#### `tools/run-sql-exercises.mjs`

- 导入 `web/scripts/engine/sql.js`；
- 对每道 SQL 题：建库 → 执行 solution → 与 expected 精确比对；
- 输出 `sql exercises=N failing=0`。

#### `tools/check-links.mjs`

- 扫描内容中的 `#/lesson/...`、`#/stage/...`、`#/project/...`；
- 扫描 `html` 字段里的内部 `href`；
- 校验目标存在；输出断链列表；退出码 1。

#### `tools/check-duplication.mjs`

- 把每讲正文按段落切成 5-gram shingle；
- 计算跨讲 Jaccard 相似度；
- 输出 Top 20 相似段落对；>0.40 失败，0.30-0.40 警告。

#### `tools/check-facts.mjs`

- 扫描 `Node \d+`、`Python \d+`、`HTTP/\d`、`TLS 1\.\d`、`Redis \d`、`PostgreSQL \d`、`OpenTelemetry`、`k6`、`pgvector`、`HNSW`、`Pyodide \d` 等模式；
- 检查 `docs/facts/registry.md` 是否有对应条目与日期；
- 输出未登记列表。

#### `tools/content-stats.mjs`

- 输出每个阶段的讲数、时长、检查数、代码题数、方案题数；
- 输出总计并与 `content-manifest.json` 比对；
- 输出 `lessons: 45 core: 32 2510 appendix: 13 890 total: 3400`。

- 验收：
  - 8 个脚本均可运行；
  - 对骨架运行 `--drafts` 通过；
  - 对骨架运行正式审计时，因 draft 失败是预期行为；
  - 在 `docs/reviews/g0-foundation.md` 贴命令输出。
- 回滚：删除 `tools/`；不影响站点。
- 停止条件：Node/Python 版本不满足；先记录环境，再决定是否用替代校验。

### T0.6 引擎与 UI 适配 8 阶段 + 附录 + 草稿态

- 类型：engine
- 依赖：T0.3
- 改动文件：
  - `web/scripts/content/index.js`：导入 8 阶段 + appendix + graduation；合并 Python 映射。
  - `web/scripts/views/blocks.js`：新增 `case` 渲染。
  - `web/styles/lesson.css`：新增 `case` 块的布局与字段标签样式，复用现有 token 与 callout 视觉，不新增颜色变量。
  - `web/scripts/views/lesson.js`：`status !== 'ready'` 时显示「本讲内容建设中」提示，并跳过空块；保留导航。
  - `web/scripts/views/overview.js`：文案从「六个阶段」改为「八个核心阶段 + 毕业项目 + 附录」；Hero 文案加入 AI 与全栈；统计从 `mainStages.length + 1` 改为实际阶段数；阶段卡片支持 8 个 + APPENDIX；毕业项目面板加入 AI。
  - `web/scripts/app.js`：侧栏渲染 8 个阶段 + 附录；附录 pip 显示 `A`；新增「毕业项目」rail 链接；搜索占位文案加入 AI。
  - `web/index.html`：title/description 更新为 AI 时代资深全栈。
  - `web/scripts/views/stage.js`：附录 badge 文案改为「附录 · 性能、架构、工程与 AI 基础设施」；阶段编号显示正确。
  - `web/scripts/views/report.js`：阶段条支持 appendix；项目列表含毕业项目；无需大改。
- 约束：
  - 不改变现有路由、判题引擎、样式 token；
  - 不新增页面；不引入框架；
  - `case` 块只加一个渲染分支，不重构块系统。
- 验收：
  - 本地预览 `#/`、每个阶段页、任意 3 个课时页、`#/report`、`#/lab` 可打开；
  - 侧栏 9 个阶段节点 + 毕业项目入口；
  - 0 控制台错误；
  - 移动端 390px 无横向滚动；
  - 草稿态课时显示建设中提示，不显示空白练习区。
- 回滚：恢复 `backups/web-v1-20261109/web/` 中对应文件。
- 停止条件：概览/侧栏布局在 8 阶段下溢出且无法用现有 CSS 解决。

### T0.7 进度迁移与夹具

- 类型：engine
- 依赖：T0.3
- 改动文件：`web/scripts/store.js`（读取时迁移）、`web/scripts/engine/exercise.js`（草稿键不受影响）。
- 迁移规则：

| 旧 | 新 |
| --- | --- |
| `s6-l1` … `s6-l6` | `a1` … `a6` |
| `s6-l1-c1` … | `a1-c1` … |
| `s6-l1-e1` … | `a1-e1` … |
| `s6-l1-e1@py` | `a1-e1@py` |
| 草稿 `s6-l1` / `s6-l1-e1` | `a1` / `a1-e1` |
| 旧毕业里程碑 `p-graduation.m.g1..g8` | 不映射到 `m1..m11`（语义不同），原键保留 |

- 实现要求：
  - `read()` 后执行 `migrate(state)`，只执行一次（`meta.version < 2`）；
  - 迁移同时处理 `state.q`、`state.l`、`state.p`、草稿键；
  - 未知旧键保留，不删除；
  - 迁移后写回 `bff-lab-progress-v1`。
- 验收：
  - 构造夹具：`state.l['s6-l1']={done:true}`、`state.q['s6-l1-e1']={solved:true}`、`state.q['s6-l1-e1@py']={solved:true}`；
  - 迁移后 `a1`、`a1-e1`、`a1-e1@py` 均为完成；
  - 报告页 a1 计入掌握；
  - 迁移执行两次结果不变。
- 回滚：恢复 `store.js`；用户数据未被清除。
- 停止条件：迁移导致旧键丢失或重复计数。

### T0.8 基线浏览器回归

- 类型：validation
- 依赖：T0.6、T0.7
- 步骤：
  1. `python dev_server.py` 启动本地服务；
  2. 浏览器打开 `#/`、`#/stage/s0`、`#/stage/appendix`、`#/lesson/s0-l1`（草稿态）、`#/report`、`#/lab`；
  3. 检查控制台、网络失败、布局、搜索；
  4. 记录截图与结论到 `docs/reviews/g0-foundation.md`。
- 验收：0 控制台错误；0 404；8 阶段卡片 + 附录 + 毕业项目入口可见；移动端无横向滚动。
- 停止条件：控制台错误来自引擎改动；先修引擎，不带着错误进 M1。

### T0.9 建立内容清单与阶段快照

- 类型：validation
- 依赖：T0.4
- 产出：`docs/content-manifest.json` 定稿；`backups/content-m0-20261109/`。
- 验收：`node tools/content-stats.mjs` 与清单一致；快照可恢复。
- 回滚：删除快照目录。

## 3. M1 内容规范

### T1.1 内容风格指南

- 产出：`docs/content-style.md`
- 必须覆盖：

1. **语气**：对读者说「你」，问题先行，不写营销话术，不写「众所周知」。
2. **段落**：单个 `html` 块不超过 900 字符；超过就拆成两个块或改用 list/steps。
3. **HTML**：只用 `<code>`、`<strong>`、`<em>`、`<br>`、`<ul>/<ol>/<li>`、`<pre>`；禁止内联样式、`<script>`、外链图片、iframe。
4. **代码**：20-60 行；零第三方依赖；可运行；关键行有注释；不写伪代码冒充可运行代码。
5. **表格**：4-6 列、4-8 行；每列有明确语义；不把长段落塞进单元格。
6. **坑块**：必须包含现象、原因、发现方式、修复、预防五要素中的至少四要素。
7. **深挖块**：讲机制、数字、边界与失败模式，不重复正文。
8. **面试延伸**：每讲最后 1-2 个问题，给参考要点，不给标准答案。
9. **AI 内容**：不写模型名与价格作为事实；必须写机制、可替换接口、评估与降级；版本/价格标注日期。
10. **AI Coding**：按五层模型（任务/上下文/执行/验证/系统）组织；不写提示词大全与工具评测。

### T1.2 课时规格模板

- 产出：`docs/implementation/templates/lesson-spec.md`（已存在）
- 使用规则：
  - 每讲先写规格，放在 `docs/content-specs/<lesson-id>.md`；
  - 规格必须包含 8-14 个块大纲、3 道检查、代码题或方案题（按课程表）、事实清单、边界；
  - 规格自检通过后才写正文；
  - 规格与正文不一致时，以规格为准，先改正文；如果规格本身有问题，先改规格并记录原因。

### T1.3 题型与测试规则

- 概念检查：
  - 3 道/讲；至少 1 道多选；
  - 单选题恰好 1 个正确项；多选题 ≥2 个正确项；
  - 解析必须解释错误选项；
  - 不考名词复述，考决策、边界、故障判断。
- 代码题：
  - 代码讲 1 道/讲；SQL 讲以 SQL 题验收；方案讲不强行加代码题；允许代码 + 方案双练习；
  - 所有代码题 Node/Python 双轨；SQL 题不强制 Python 轨；
  - ≥4 条测试，覆盖正常、边界、失败；
  - 测试必须确定性：不依赖网络、真实时间、随机数、文件系统；
  - starter 至少失败 1 条；solution 全过；
  - 测试名用中文，能直接看出失败含义。
- SQL 题：
  - 使用迷你 SQL 引擎支持的语法；
  - 数据量小但能区分正确/错误查询；
  - expected 必须与 solution 精确一致。
- 方案题：
  - 每个阶段至少 1 道；架构型课时额外加；
  - 自检清单 6-8 条；
  - 参考要点必须包含约束、备选、代价、反悔条件；
  - 不接受「只列好处」的答案。

### T1.4 Python 轨道规则

- 每个 code exercise 必须有 Python track；
- Python 用习惯命名（snake_case）、`asyncio`、标准库；
- 不逐行翻译；必须写 `pythonNote` 解释运行时差异：
  - 事件循环/GIL；
  - 异步 vs 线程；
  - 数据结构差异；
  - 异常模型；
  - 标准库选择。
- 测试使用 `assert_eq`/`assert`，异步测试标 `async: true`；
- 兼容 Python 3.11+（本地校验）与 Pyodide 3.13（浏览器）；
- 不使用第三方包、网络、文件系统。

### T1.5 事实登记

- 产出：`docs/facts/registry.md`
- 格式：

| 声明 | 值 | 来源 | 版本/日期 | 状态 |
| --- | --- | --- | --- | --- |
| Node 未处理 Promise 拒绝默认退出 | Node 15+ | Node 官方文档 | 2026-11 | 已核对 |

- 规则：
  - 版本、默认值、价格、性能数字、协议行为必须登记；
  - 来源优先官方文档；无法确认写「取决于版本」；
  - AI 相关的模型名、上下文长度、价格不写死；写机制与可替换接口；
  - 每次改事实，更新日期。

### T1.6 边界矩阵

写进 `docs/content-style.md`，至少覆盖以下高风险边界：

| A | B | 边界 |
| --- | --- | --- |
| s2-l4 | s3-l3 | s2-l4 只定义限流契约（429/Retry-After/配额），s3-l3 实现令牌桶与过载保护 |
| s2-l4 | s3-resilience | s2-l4 定义幂等键契约；s3-resilience 实现幂等键与重试预算 |
| s3-l1 | s6-l4 | s3-l1 讲应用缓存；s6-l4 只讲边缘缓存与 SWR |
| s4-l1 | s6-l4 | s4-l1 讲后端可观测性；s6-l4 讲 RUM 与前后端 trace 串联 |
| s4-perf | a7 | s4-perf 讲压测与定位；a7 讲建模与容量估算 |
| s5-l1 | a10 | s5-l1 讲模块边界；a10 讲 ADR 写法与评审 |
| s5-l2 | s5-l3 | s5-l2 讲 Outbox/Saga/最终一致；s5-l3 讲部分失败、锁与超时预算 |
| s5-data-scale | a3 | s5-data-scale 讲复制/分片取舍；a3 讲 B+tree/LSM 内部结构 |
| s6-l2 | s6-l4 | s6-l2 讲渲染与 CWV；s6-l4 讲边缘、开关与 RUM |
| s7-l1 | a13 | s7-l1 讲应用集成；a13 讲推理、KV cache、向量索引与成本底座 |
| s7-l3 | a13 | s7-l3 讲评估/注入/成本控制；a13 讲基础设施层的容量与部署 |
| s7-l4 | s7-l5 | s7-l4 讲任务/上下文/验证五层模型；s7-l5 讲 Agent 工作流与团队落地 |
| s1-l2 | a3 | s1-l2 讲索引使用与 EXPLAIN；a3 讲索引数据结构 |
| s4-l3 | a8 | s4-l3 讲容器与配置；a8 讲 Linux/IO/反向代理 |
| s4-l4 | a11 | s4-l4 讲流水线与发布；a11 讲测试策略与工程质量 |

### T1.7 批次与评审协议

- 批次大小 2 讲（核心）/2-3 讲（附录）；
- 每批先写规格，再逐讲写正文；
- 每讲完成即跑单讲审计，不积压；
- 每批结束写 `docs/reviews/<module>/<batch>.md`；
- 每模块结束按 10 维评分表做独立评审；
- 评审不通过，不进入下一模块；
- 任何跨讲改动先改边界矩阵，再改内容。

## 4. G0 评审门

### 4.1 自动检查

```bash
node tools/content-stats.mjs
node tools/audit-content.mjs --drafts
node tools/check-links.mjs
node tools/check-facts.mjs
```

预期：

- `lessons: 45 core: 32 2510 appendix: 13 890 total: 3400`
- 审计 0 错误；
- 断链 0；
- 未登记事实 0（骨架没有事实声明，应为 0）。

### 4.2 浏览器检查

| 页面 | 检查 |
| --- | --- |
| `#/` | 8 阶段 + 附录 + 毕业项目入口；文案不再写「六个阶段」；统计正确 |
| `#/stage/s0` | 3 讲；项目 p0 入口 |
| `#/stage/appendix` | 13 讲；APPENDIX 标识 |
| `#/lesson/s0-l1` | 草稿提示；无空白练习区；无控制台错误 |
| `#/report` | 阶段条含附录；项目列表含毕业项目 |
| `#/lab` | 原有实验台可用 |

### 4.3 文档检查

- [ ] `docs/content-style.md` 完成；
- [ ] `docs/content-schema.md` 完成；
- [ ] `docs/content-manifest.json` 与大纲一致；
- [ ] `docs/facts/registry.md` 建立；
- [ ] `docs/implementation/templates/` 三个模板可用；
- [ ] `docs/reviews/g0-foundation.md` 完成。

### 4.4 门禁结论

G0 通过后，才允许开始 M2 的第一份课时规格。G0 不通过，优先修底座，不写正文。
