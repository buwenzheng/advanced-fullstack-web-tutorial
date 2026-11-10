# G0 基础评审：M0 内容底座

- 评审日期：2026-11-09
- 评审范围：M0（内容架构重组、45 讲骨架、校验工具链、UI 适配、进度迁移）
- 结论：**M0 通过，G0 底座门通过**。课程正文尚未开始，全部 45 讲按计划保持 `draft`。
- 发布状态：**未发布**。本轮没有执行任何部署或访问策略操作；线上站点仍为旧版本，访问范围 `private`。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 平台 | Windows 10 x64，Git Bash |
| Node | v22.15.0（nvm 切换后实际生效版本） |
| Python | 3.11.9 |
| 本地预览 | `python dev_server.py 8125 web` |
| 浏览器回归 | Chrome + browser-use MCP（桌面 853px、桌面 1280px iframe、移动 390px iframe） |

## 2. 交付物

| 路径 | 内容 |
| --- | --- |
| `web/scripts/content/` | 73 个文件：`index.js`、8 个核心阶段、`appendix`、`graduation.js`；每讲一个文件，阶段内聚 `project.js` / `python.js` |
| `docs/content-schema.md` | 内容模型 v2：阶段、课时、块、检查题、练习、项目、Python 映射 |
| `docs/content-manifest.json` | 45 讲数量与时长清单 |
| `docs/facts/registry.md` | 版本与课程总量事实登记（4 条，全部带日期） |
| `tools/` | 9 个零依赖脚本：审计、统计、JS/Python/SQL 运行器、链接、重复、事实、迁移测试、共享内容加载库 |
| `backups/web-v1-20261109/` | 改造前快照：32 个 `web/` 文件 + `curriculum-plan.md` |
| `backups/content-m0-20261109/` | M0 完成快照：109 个文件 + README（web、tools、清单、Schema、事实表） |
| `docs/reviews/g0-foundation.md` | 本报告 |

## 3. 逐项验收

### T0.1 备份当前站点

- `backups/web-v1-20261109/` 共 33 个文件：`web/` 32 个（改造前完整文件集）+ `curriculum-plan.md`。
- 改造前 `web/` 为 32 个文件；M0 将阶段内容拆成单讲文件后，当前 `web/` 为 95 个文件。文件数差异来自拆分，不是备份缺失。
- 备份可运行性已验证：用 `python dev_server.py 8126 backups/web-v1-20261109/web` 启动后，页面正常渲染旧标题、7 个阶段卡片、24 个课时链接。

### T0.2 按阶段拆分的内容架构

- 内容目录 73 个文件；每个课时文件只导出课时对象，阶段 `index.js` 只做组装，项目与 Python 映射独立。
- `tools/lib/content.mjs` 统一加载入口，审计与统计均从该入口读取。
- 旧 `python-blocks.js`、`python-tracks.js`、`stages/stage0.js` 已删除，无残留引用（`check-links` 与全量导入均通过）。

### T0.3 内容 Schema v2

- `docs/content-schema.md` 已冻结，字段与 `content/index.js` 的归一化逻辑一致。
- 新增块类型仅 `case`。浏览器实测：注入 `case` 块后渲染出 5 个字段行（背景、现象、根因、止损与修复、预防）与指标行。
- `status` 缺省视为 `ready`；M0 骨架 45 讲全部显式 `draft`。

### T0.4 45 讲骨架与内容清单

```text
s0: lessons=3 minutes=170
s1: lessons=4 minutes=320
s2: lessons=4 minutes=300
s3: lessons=4 minutes=340
s4: lessons=4 minutes=310
s5: lessons=4 minutes=340
s6: lessons=4 minutes=330
s7: lessons=5 minutes=400
appendix: lessons=13 minutes=890
lessons: 45 core: 32 2510 appendix: 13 890 total: 3400
```

- 清单与内容一致，`content-stats` 退出码 0。
- 45 个课时文件均含标题、副标题、时长、`status:'draft'`、3 条占位目标、空 `blocks/checks/exercises`。

### T0.5 校验工具链

```text
$ node tools/audit-content.mjs --drafts
audit mode=drafts lessons=45 draft=45 errors=0 warnings=0

$ node tools/check-links.mjs
links broken=0

$ node tools/check-duplication.mjs
duplication lessons=0 pairs=0 failing=0

$ node tools/check-facts.mjs
facts unregistered=0 total=4

$ node tools/run-js-exercises.mjs
js code exercises=0 failing=0 starterFailing=0

$ node tools/run-python-exercises.mjs
python exercises=0 failing=0 starterFailing=0

$ node tools/run-sql-exercises.mjs
sql exercises=0 failing=0
```

- 勾稽关系：骨架没有正文与练习，因此重复检查与三个运行器均为 0 条，退出码 0；M2 起会随内容增长产生真实数量。
- 正式审计（不带 `--drafts`）按预期失败：`audit mode=ready lessons=45 draft=45 errors=45 warnings=0`，45 条均为“仍为 draft”。这是 G0 前的预期状态，不是回归。

### T0.6 引擎与 UI 适配

- 概览：9 个阶段卡片（S0-S7 + 附录），文案不再出现“六个阶段”；侧栏 9 个阶段节点（pip 为 0-7 与 A）、45 个课时链接、毕业项目入口。
- 阶段页：S0 显示 3 讲与项目 `p0` 入口；附录显示 13 讲与“附录 · 性能、架构、工程与 AI 基础设施”标识。
- 草稿课时：显示“本讲内容建设中”横幅与“草稿”徽标；`已验证`、`本讲已掌握`、`标记为已掌握` 均为 `display:none`；练习区为空且不渲染空白区块。
- 报告页：9 条阶段掌握度（含附录），项目列表含 `p-graduation` 与 `p0`-`p7`。
- 搜索：输入“请求”命中阶段与课时；输入“LinkHub”命中阶段项目（含毕业项目相关内容）。
- `case` 块渲染：5 个字段行 + 指标行，使用既有 token，无新增颜色变量。

### T0.7 进度迁移

```text
$ node tools/test-progress-migration.mjs
progress migration ok: q/l/drafts mapped, graduation preserved, idempotent
```

覆盖：

- `s6-l1` … `s6-l6` → `a1` … `a6`；
- 题目键 `s6-l1-c1`/`s6-l1-e1` → `a1-c1`/`a1-e1`；
- Python 键 `s6-l1-e1@py` → `a1-e1@py`；
- 草稿键同步迁移；
- 旧毕业里程碑 `g1/g2` 保留，不映射到 `m1..m11`；
- `meta.version=2` 版本闸门，执行两次结果一致；
- 新旧键冲突时新键优先。

### T0.8 浏览器回归

桌面 853px：

| 页面 | 结果 |
| --- | --- |
| `#/` | 9 个阶段卡片；侧栏 9 节点 + 毕业项目；45 课时链接；无横向滚动 |
| `#/stage/s0` | 3 讲；`p0` 项目入口；无横向滚动 |
| `#/stage/appendix` | 13 讲；附录标识；无横向滚动 |
| `#/lesson/s0-l1` | 草稿横幅；状态按钮隐藏；0 个练习区块 |
| `#/report` | 9 条阶段条；含毕业项目与 p0-p7 |
| `#/lab` | 单列布局（527px）；发送请求返回 `200 OK` 与 JSON 响应 |

- 控制台：0 条消息（无错误、无警告）。
- 网络：189 条请求全部 `200`，0 条 404。
- 1280px：实验台恢复 250px + 636px 双列，发送请求正常。
- 390px：`#/`、`#/stage/s0`、`#/stage/appendix`、`#/lesson/s0-l1`、`#/report`、`#/project/p-graduation`、`#/lab` 均满足 `scrollWidth === clientWidth`，无横向滚动。
- 本轮修复：实验台请求行的固定 `min-width` 与不换行请求头导致 390px 溢出；已改为响应式类，在 ≤560px 时请求行纵向排列、请求头换行、面板操作区可换行。

### T0.9 内容快照

- `backups/content-m0-20261109/`：109 个文件 + `README.md`（恢复步骤与验证命令）。
- 快照独立运行验证（不依赖项目根目录）：

```text
$ node tools/audit-content.mjs --drafts
audit mode=drafts lessons=45 draft=45 errors=0 warnings=0

$ node tools/test-progress-migration.mjs
progress migration ok: q/l/drafts mapped, graduation preserved, idempotent

$ node tools/content-stats.mjs
lessons: 45 core: 32 2510 appendix: 13 890 total: 3400
```

## 4. G0 文档检查

| 项 | 状态 |
| --- | --- |
| `docs/content-schema.md` | 完成 |
| `docs/content-manifest.json` | 完成并与内容一致 |
| `docs/facts/registry.md` | 建立，4 条全部登记 |
| `docs/implementation/templates/` 三个模板 | `lesson-spec.md`、`batch-task.md`、`review-report.md` 可用 |
| `docs/reviews/g0-foundation.md` | 本报告 |
| `docs/content-style.md` | **属于 M1/T1.1，本模块不产出** |

说明：实施计划把 `content-style.md` 列在 G0 文档检查中，但其任务卡位于 M1。按 M0 的“不写正文、只建底座”范围，本项不阻塞 M0 验收，作为 M1 的首个交付；在 M1 完成前不开始任何课时正文。

## 5. 门禁结论与边界

- M0 的四条硬指标全部满足：45 讲 / 3400 分钟与清单一致、`audit --drafts` 0 错误、浏览器 0 控制台错误与 0 404、390px 无横向滚动。
- 内容状态：45 讲全部为 `draft`，符合“G0 通过前不写正文”的约束；正式审计失败是预期行为。
- 站点状态：线上旧版本保持私有（`access_mode: private`），M0 改动未发布。后续发布必须复用项目 `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2`，并按 G8 门禁执行，不在本轮授权范围内。
- 已知限制：骨架没有真实练习，三个运行器当前为 0 条；`case` 块只做了临时注入渲染验证，正式内容要等 M2 起写入。
- 下一步：进入 M1（内容生产规范），完成风格指南、课时规格、题型规则、Python 规则、事实登记与边界矩阵，产出 `docs/reviews/g1-standards.md` 后再开始 M2 的课时规格。
