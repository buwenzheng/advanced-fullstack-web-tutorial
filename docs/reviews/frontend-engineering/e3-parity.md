# E3 阶段报告：视图与交互迁移（G-E3）

日期：2026-11-10
阶段：E3（T-E3.0–T-E3.7）
标签：`e3-parity`
环境：Windows 10.0.22631 / Node v24.22.1（`.nvmrc` 要求 22.15.0，本机无法切换，全部门禁在该版本通过）/ Chromium（Playwright 1.65.0）/ Vite 7.3.8
入口：React `/index.next.html`；v2 `web/index.html` 仍为默认入口，未切换

## 0. 结论

G-E3 全部通过，无门禁失败项：

- 66/66 路由正文文本与 v2 严格相等；21/21 视觉基线与 v2 逐像素一致；
- 四类任务、实验台、报告与旧进度迁移的交互清单 15/15 通过，控制台错误 0；
- 阶段内容按阶段懒加载、搜索索引聚焦后按需加载，初次加载不请求阶段 chunk 与搜索索引；
- 内容快照与 E1 逐字节一致；未改课程内容、ID、hash 路由、localStorage 键与迁移、`functions/`、样式表与 v2 运行时；
- 仅加载态与 v2 不同（懒加载 chunk、搜索索引按需），属于本阶段设计目标；运行态无已知差异。

## 1. 命令与退出码

| # | 命令 | 结果 | 退出码 |
| --- | --- | --- | --- |
| 1 | `npm run lint` | 无错误/警告输出 | 0 |
| 2 | `npx tsc --noEmit -p tsconfig.json` | 无输出 | 0 |
| 3 | `npx tsc --noEmit -p tsconfig.node.json` | 无输出 | 0 |
| 4 | `grep -R "content/index" web/scripts/app web/scripts/main.tsx` | 无输出（未命中，grep 退出 1） | 1 |
| 5 | `grep -R "state/progress" web/scripts/app web/scripts/main.tsx` | 无输出（未命中，grep 退出 1） | 1 |
| 6 | `grep -R "from './search'" web/scripts/app/shell` | 无输出（未命中，grep 退出 1） | 1 |
| 7 | `npm run content:validate` | `content ok stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400` | 0 |
| 8 | `npx tsx tools/content-snapshot.ts` vs `docs/reviews/frontend-engineering/e1/content-before.txt` | `diff -u` 无输出（逐字节一致） | 0 |
| 9 | `npm run test` | `Test Files 25 passed (25)`，`Tests 270 passed (270)` | 0 |
| 10 | `npx vitest run --coverage`（E0 配置：engine/runner + state，阈值 85/85/70/85） | stmts 96.37 / branch 88.10 / funcs 98.79 / lines 99.13 | 0 |
| 11 | `npx vitest run --coverage --coverage.include="web/scripts/**/*.{ts,tsx}" --coverage.thresholds.lines=70 --coverage.thresholds.functions=70 --coverage.thresholds.statements=70 --coverage.thresholds.branches=60`（E3 §8 全局阈值，仅测量，未改配置） | stmts 87.72 / branch 76.74 / funcs 90.27 / lines 90.14 | 0 |
| 12 | `npm run build` | `content:validate` 通过；`content:build` 输出 `catalog bytes=73160 gzip=15282`、`search bytes=509581 gzip=199467`；`vite build` 成功；产出 `dist/index.html` 与 `dist/index.next.html` | 0 |
| 13 | `npx playwright test e2e/smoke.spec.ts --project=chromium` | `66 passed`（v2 默认入口不回退） | 0 |
| 14 | `npx playwright test e2e/shell.spec.ts --project=chromium` | `3 passed`（3 个用例循环覆盖 66 路由：唯一 h1、侧栏、导航） | 0 |
| 15 | `npx playwright test e2e/content.spec.ts --project=chromium` | `9 passed`（课时正文/双轨/MCQ、项目、实验台、懒加载、搜索、报告） | 0 |
| 16 | `npx playwright test e2e/parity.spec.ts --project=chromium` | `66 passed`（66/66 路由 `main.innerText` 严格相等） | 0 |
| 17 | `VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium` | `21 passed`（7 页 × 3 视口，对照 v2 基线） | 0 |
| 18 | `npx playwright test e2e/interactions.spec.ts --project=chromium` | `15 passed`（12 项交互 + 3 项旧数据夹具；Python 用例依赖 CDN） | 0 |
| 19 | `npx playwright test e2e/content.spec.ts --project=chromium -g "lazy\|search"` | `2 passed` | 0 |

覆盖率补充说明：

- 命令 10 是 E0 冻结的 `vitest.config.ts` 自带配置与阈值，未改动；
- 命令 11 用 CLI 覆盖 `include` 与阈值（70/70/70/60），按 E3 §8 的全局口径实测，未写入配置文件；配置正式化留待 T-E4.5；
- 新增模块行覆盖（命令 11 的 JSON 汇总）：`app/lesson/**` 66/66 = 100.00%（13 文件）、`app/exercises/**` 180/182 = 98.90%（6 文件）、`app/report/**` 52/52 = 100.00%（1 文件）、`app/lab/mock-server.ts` 68/70 = 97.14%、`app/data/**` 129/129 = 100.00%（5 文件），均不低于 75%。

构建与初次加载（T-E3.5 证据复核）：初次进入 `#/` 仅请求 `next-*.js`、`harness-*.css/js`、`catalog-*.js`；阶段 chunk 在进入对应阶段课时时才加载，同阶段切讲不新增，跨阶段才 +1；搜索索引在聚焦搜索框后才下载（decoded≈507 kB）。详见 `docs/reviews/frontend-engineering/e3/t-e3.5-evidence.md`。

## 2. 逐页功能清单（G-E3 §7）

所有条目均由自动化用例或路由级 E2E 覆盖；用例名可在对应测试文件中检索。视觉项以 21 张基线为准，文本项以 66 路由逐字对等为准。

### 2.1 总览 `#/`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 唯一 `h1`，含 `<em>` 的标题结构一致 | 通过 | `parity.spec.ts` `#/`；`overview-page.test.tsx`；`visual.spec.ts` home |
| 4 个统计数字（8 + 1 / 45 / 214 / 已掌握） | 通过 | `overview-page.test.tsx`「渲染四个统计与九张阶段卡」 |
| CTA 文案随进度切换；下一讲链接正确 | 通过 | `overview-page.test.tsx`「CTA 文案与目标随进度变化」 |
| 课程运转三列 9 条 `<li>` 文案一致 | 通过 | `overview-page.test.tsx` + `parity.spec.ts` |
| 9 张阶段卡顺序、accent 色、百分比、草稿数量 | 通过 | `overview-page.test.tsx`「阶段卡展示进度与毕业面板」「草稿计数只在有草稿时出现」；home 视觉基线 |
| 毕业项目面板文案与按钮 | 通过 | `overview-page.test.tsx`「阶段卡展示进度与毕业面板」+ 文本对等 |
| 侧栏与总览的阶段百分比一致 | 通过 | 两侧共享 `useProgress`/`mastery-core`；`shell.spec.ts` 与总览用例 |

### 2.2 阶段 `#/stage/:id`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 无效 ID 空状态 | 通过 | `stage-page.test.tsx`「无效阶段显示空状态」 |
| 普通阶段 `STAGE XX`；附录 `APPENDIX` | 通过 | 「阶段 s0 的 hero 徽章序列与课时行」「附录阶段的编号、徽章与课时行」 |
| 时长/讲数/附录徽章/已完成/keywords 顺序 | 通过 | 同上；stage-s0 视觉基线 |
| 课时行序号（`1.1` 与 `A.1`）、时长、题数、草稿、已掌握徽章 | 通过 | 「阶段 s0…」「附录阶段…」「草稿课时显示草稿徽章而不是题数」「标记课时后显示已掌握与进度」 |
| 阶段目标、达成标准、阶段项目卡 | 通过 | 「空 outcome 不渲染达成标准卡」+ 文本对等 |
| 课时行点击进入正确课时 | 通过 | 同用例断言 `href`；`shell.spec.ts` 路由覆盖 |

### 2.3 课时 `#/lesson/:id`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 无效 ID 空状态与返回 | 通过 | `lesson-page.test.tsx`「无效课时渲染空状态与返回总览」 |
| 阶段徽章文案与链接 | 通过 | `lesson-page.test.tsx`「s0-l1 渲染 meta、目标、12 类块区域、检查题与翻页」 |
| 时长、题数、草稿、已验证、已掌握徽章 | 通过 | 同上；草稿用例 |
| 草稿横幅；草稿不显示 objectives 与掌握按钮 | 通过 | 「草稿课时隐藏 objectives 与掌握按钮并展示横幅」 |
| objectives 勾选图标与文本 | 通过 | 「s0-l1 渲染 meta、目标…」 |
| 12 类 block 渲染 | 通过 | `blocks.test.tsx`（text/callout/list/steps/code/table/compare/flow/case/未知类型等）；`lesson-page.test.tsx` |
| 代码块双轨 tab、初始语言、hidden 面板 | 通过 | `blocks.test.tsx`「code 双轨…」；`content.spec.ts`「lesson 双轨切换」 |
| 概念检查/本讲练习两块标题与说明 | 通过 | `lesson-page.test.tsx`；文本对等 |
| 掌握按钮三种状态与写入 | 通过 | 「掌握按钮写入进度并展示已掌握徽标」 |
| 阶段项目链接 | 通过 | 文本对等 + 阶段项目路由覆盖 |
| prev/next/本阶段结束导航 | 通过 | 「s0-l1 渲染…翻页」；`content.spec.ts` 懒加载用例真实点击「下一讲」 |
| 语言切换后代码轨道重置、草稿保留 | 通过 | 「语言切换整页重挂载：代码轨道重置且已答状态保留」；`interactions.spec.ts`「语言轨道…」 |

### 2.4 任务组件

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| MCQ 单选/多选、未选择 toast、判定样式、重试、保存态 | 通过 | `tasks-mcq.test.tsx` 6 例；`interactions.spec.ts`「MCQ…」；`content.spec.ts` |
| 代码题 JS 运行、Python 运行、超时、结果、日志、提示、参考答案、重置 | 通过 | `tasks-code.test.tsx` 13 例（含 Python `@py` 记录、订阅清理、超时/异常不计分）；`interactions.spec.ts`「代码题…」「草稿…」 |
| SQL 题执行、正确/错误/非 SELECT/0 行、提示、参考答案 | 通过 | `tasks-sql.test.tsx` 9 例；`interactions.spec.ts`「SQL 题…」 |
| 方案题勾选、状态、笔记、参考要点 | 通过 | `tasks-design.test.tsx` 5 例；`interactions.spec.ts`「方案题…」 |
| 所有草稿刷新后保留 | 通过 | 代码/方案/项目笔记用例 + `interactions.spec.ts` 刷新断言；`drafts` 用例覆盖损坏 JSON 与写入异常 |
| 所有记录写入同一 `bff-lab-progress-v1`，v2 可读取 | 通过 | `state-*`/`mastery` 单测；`interactions.spec.ts` 旧数据夹具（迁移后 v2 可读同键） |

Python 代码题依赖 Pyodide CDN（见 §5）。JS/SQL 为必过用例。

### 2.5 项目 `#/project/:id`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 无效 ID 空状态 | 通过 | `project-page.test.tsx`「无效项目显示空状态」 |
| hero 阶段标签、标题、brief、里程碑进度、stack | 通过 | 「阶段项目渲染 hero、路线与里程碑清单」；`content.spec.ts` 毕业项目 hero |
| 目标/实施路线 | 通过 | 同用例；文本对等 |
| 里程碑勾选、进度实时变化、刷新保持 | 通过 | 「勾选里程碑更新进度徽章，再次点击撤销」；`interactions.spec.ts`「项目…」 |
| 验收/证据/复用/关联/一句话验收 | 通过 | 文本对等；阶段项目用例 |
| 毕业项目里程碑笔记 | 通过 | 「毕业里程碑笔记持久化并在重渲染后恢复」；`content.spec.ts` 11 个笔记框 |
| 交付物/验收自评/进阶挑战 | 通过 | 文本对等（`#/project/p-graduation`） |
| 项目笔记持久化 | 通过 | 同上 |
| 6 份模板、复制成功/失败、1600ms 恢复 | 通过 | 「模板复制成功…」「模板复制失败时显示复制失败」；`interactions.spec.ts`「模板…」 |

### 2.6 实验台 `#/lab`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 10 个场景按钮与请求填充 | 通过 | `lab.test.tsx`「左侧渲染 10 个场景并逐项填入请求」；`content.spec.ts` 10 个按钮 |
| 教学文案初始/模拟/真实/场景切换 | 通过 | 「模式切换更新教学文案」 |
| 请求头增删、请求体、方法切换 | 通过 | `lab.test.tsx` 场景填充用例；文本对等 |
| mock 路由：分页、201+Location、422 字段、409、401、403、429+Retry-After、304、幂等重放、慢响应 | 通过 | `lab.test.tsx`「runMock 路由」12 例；`content.spec.ts` 429/幂等；`interactions.spec.ts` 429/重置 |
| 响应状态徽章颜色、耗时、响应头表、响应体、空响应体 | 通过 | lab 单测 + 交互用例 + 视觉基线 |
| 历史最多 6 条 | 通过 | 「发送请求后渲染状态、响应头与历史，历史最多 6 条」 |
| curl 生成与复制 | 通过 | 「curl 生成包含方法、请求头与转义后的请求体」 |
| 重置恢复种子与初始文案 | 通过 | 「重置恢复默认请求、清空响应与历史并恢复教学文案」；`interactions.spec.ts`「实验台…重置」 |
| 真实端点失败提示（本地预览） | 环境限制 | 模式切换已覆盖；本地无对应后端，失败提示依赖不可达网络，记入 known-issues，不在 G-E3 断言 |

### 2.7 报告 `#/report`

| 清单项 | 结果 | 证据 |
| --- | --- | --- |
| 5 张统计卡数字与色调 | 通过 | `report.test.tsx`「空进度展示零统计…」；`content.spec.ts` 5 张卡 |
| 空进度全 0，无 NaN | 通过 | 同用例 |
| 代码双轨进度（Node/Python） | 通过 | 「设计题未完成计入错题，Python 轨道与里程碑分别汇总」 |
| 9 个阶段掌握度条与链接 | 通过 | 「空进度…9 条阶段进度」；`content.spec.ts` 断言 `.bar-row` 共 11 条（2 条代码轨道 + 9 个阶段） |
| 待攻克题目列表与空态 | 通过 | 「答错题目进入待攻克列表…」；`interactions.spec.ts`「报告…」 |
| 9 个项目进度条（8 阶段 + 毕业） | 通过 | report 单测 |
| 接下来学什么最多 3 条 | 通过 | report 单测 |
| 附录阶段标签正确 | 通过 | 「答错题目…附录阶段显示 A 标签」 |

## 3. 文本与视觉对等

### 3.1 文本（66/66）

`e2e/parity.spec.ts` 遍历 `e2e/routes.json` 的 66 条 hash 路由，分别打开 v2 `/index.html#<route>` 与 React `/index.next.html#<route>`，比较 `main.innerText` 严格相等；每个上下文独立收集 `console` error 与 `pageerror` 并断言为空。结果 66/66 相等，控制台错误 0。

首轮唯一差异为 `#/lab` 初始空态（React 立即输出「还没有请求记录。」，v2 在发送/重置后才渲染）。修复：`LabPage.tsx` 增加 `historyTouched`，占位仅在发送或重置后出现；`lab.test.tsx` 增加「初始不出现占位」回归断言。

### 3.2 视觉（21/21）

页面 × 视口：home、stage-s0、lesson-s0-l1、lesson-s7-l5、project-p-graduation、lab、report × 1440x900 / 768x1024 / 390x844。流程与基线冻结时一致（清空 localStorage、重载、等字体与 `networkidle`、关动画、`fullPage`），Playwright 默认逐像素阈值，无 mask、无 `maxDiffPixels` 放宽。基线仍为 T-E3.0（a3d455f）冻结的 v2 输出，`e2e/__screenshots__/` 零改动。

首轮 9 项失败，归因于两类可解释差异，修复后 21/21：

1. **侧栏折叠箭头**：v2 的 `ui.js` 用 `document.createElement` 创建 `svg`，得到 HTML 命名空间元素，`viewBox` 序列化为 `viewbox`、`<path>` 按 HTML 解析，基线中箭头从未绘制（`pathRect` 0×0）。React JSX 生成真 SVG，多出可见箭头。按不变量 v2 不改；`Sidebar.tsx` 改为同 class 的空 `<span className="stage-node__chevron">`，保留 14px 弹性槽位、标题/徽标位置不变且不产生像素。
2. **计数文本节点粒度**：v2 用单一模板字符串（`${d}/${n}`、`${n} + 1`），React 多表达式子节点在 Chrome 下产生亚像素抗锯齿差异（hero「0/45」10 px、「8 + 1」11 px、stage-s0「已完成 0/8」2 px）。将总览、阶段与侧栏的复合计数改为单一模板字符串，内容与样式未变。

详细像素坐标与根因见 `docs/reviews/frontend-engineering/e3/parity-report.md` §3。

## 4. 交互清单与截图

`e2e/interactions.spec.ts` 15/15：12 项交互（MCQ、代码题、SQL、方案题、草稿、语言轨道、项目里程碑/笔记、模板复制、实验台 429/幂等/重置、报告、搜索键盘、重置进度）+ 3 项旧数据夹具（s6→a 迁移、种子草稿、上次答错）。每例结束断言 console error 与 pageerror 为空（全部 `[]`）。

截图目录：`docs/reviews/frontend-engineering/e3/screenshots/`（13 张）：`mcq-wrong.png`、`code-task-pass.png`、`sql-task-correct.png`、`design-complete.png`、`project-persist.png`、`template-copied.png`、`lab-429-idempotent.png`、`lab-reset.png`、`report-stats.png`、`search-results.png`、`lang-python.png`、`legacy-mastered.png`、`legacy-wrong-answer.png`。

期间修复的两处用例定位器问题（非产品缺陷）：`interactions.spec.ts` 重置断言 `.list-stack` 命中 4 个容器（改 `getByText`）；`content.spec.ts` Python tab 命中两个 tablist（限定「语言实现」tablist）。

## 5. 已知差异与残余风险

**已知差异**：运行态无。加载态差异为设计目标：阶段内容按阶段 chunk 懒加载、搜索索引聚焦后下载；首屏不再包含全部课程正文。

残余风险：

1. **搜索索引 chunk 体积**：507.07 kB（gzip 199.34 kB），Vite 提示超过 500 kB；仅聚焦搜索后加载，预算门禁留待 T-E4.6。
2. **首屏 catalog**：52.03 kB（gzip 14.49 kB），侧栏与总览依赖，未做分级骨架。
3. **附录 chunk**：283.17 kB（gzip 87.23 kB），含该阶段 Python 代码块与轨道。
4. **Python 依赖 CDN**：Pyodide 0.29.5 从 `cdn.jsdelivr.net` 加载；交互套件中语言切换用例耗时 13.4–22.0 s，门禁期间出现一次瞬时失败、重跑通过，记为环境依赖而非产品回归（KI-2）。
5. **v2 SVG 缺陷复刻**：侧栏折叠箭头按 v2 实际像素以空盒复刻；v2 侧栏 rail 图标同样未绘制，React 版本可见，该区域不在 21 张基线内，E4/E5 复核（KI-5）。
6. **真实端点**：实验台 live 模式依赖外部后端，本地预览不可达，仅验证模式切换；失败提示未纳入 G-E3（KI-7）。
7. **字体依赖**：视觉基线在本机字体栈生成，跨机器可能产生细微 AA 差异。
8. **Node 版本**：实机 v24.22.1 与 `.nvmrc` 22.15.0 不一致；全部命令在该版本通过（KI-8）。
9. **内联样式的可维护性**：E3 以对等为先，组件内联样式大量重复；E4 质量阶段评估抽取，且须视觉零差异（KI-6）。

## 6. 提交与标签

| 任务 | 提交 |
| --- | --- |
| T-E3.0 契约、inventory、基线 | `a3d455f` |
| T-E3.1 数据门面、总览页与阶段页 | `452fcec` |
| T-E3.2 课时页、12 类内容块与检查题 | `c6c0b79` |
| T-E3.3 代码题、SQL 题、方案题与草稿 | `3c84877` |
| T-E3.4 项目页、实验台与报告页 | `950730c` |
| T-E3.5 阶段内容懒加载与搜索索引按需加载 | `b931e95` |
| T-E3.6 对等验证（正文、交互、视觉） | `7183336` |
| T-E3.7 G-E3 门禁与交付 | 本提交（见 `git log`） |

标签：`e3-parity`。

## 7. 边界声明

- 未修改课程内容、课时/题目 ID、标题、时长、答案与测试；内容快照与 E1 逐字节一致（§1 命令 8）。
- 未修改 hash URL、localStorage 键与迁移规则；旧进度夹具 15/15 中 3 例验证。
- 未修改 `web/styles/`；未修改 v2 运行时代码；未修改 `functions/`。
- 未新增运行时依赖（E3 仅新增构建脚本 `content:build` 并接入 `build`/`dev:next`）。
- 未切换默认入口（v2 smoke 66/66 保持）；未发布。

## 8. 交给 E4 的输入

- `e3-parity` 标签存在，工作区干净；
- 66 路由正文、21 张视觉基线与 v2 完全对等；四类任务、实验台、报告行为清单通过；
- 懒加载生效：初次加载无阶段 chunk、搜索索引按需；
- known-issues 已包含：Python CDN、真实端点本地不可用、内联样式待评估、搜索索引体积、Node 版本差异；
- E4 第一条命令：`git checkout e3-parity && npm ci && npm run verify`。