# T-E3.6 对等验证报告：正文、交互、视觉

日期：2026-11-10
环境：Windows 10.0.22631 / Node v24.22.1（.nvmrc 要求 22.15.0，本机无法切换，阶段报告注明）/ Chromium（Playwright 1.65.0）
入口：React `/index.next.html`（v2 `web/index.html` 保持默认，未改动）

## 1. 命令与退出码

| 命令 | 结果 | 退出码 |
| --- | --- | --- |
| `npm run build` | `content:validate` 通过；`tsc -p tsconfig.json && tsc -p tsconfig.node.json` 通过；`vite build` 成功（1.37s，chunk 列表与 T-E3.5 一致） | 0 |
| `npx playwright test e2e/parity.spec.ts --project=chromium` | `66 passed (18.5s)`（66/66 路由文本对等） | 0 |
| `VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium` | `21 passed (6.4s)`（7 页 × 3 视口，对照 T-E3.0 冻结的 v2 基线） | 0 |
| `npx playwright test e2e/interactions.spec.ts --project=chromium` | `15 passed (17.5s)`（12 交互清单 + 3 旧数据夹具） | 0 |
| `npx playwright test e2e/content.spec.ts --project=chromium` | `9 passed (4.6s)` | 0 |
| `npm run lint` | 无错误/警告输出 | 0 |
| `npm test` | `Test Files 25 passed (25)`，`Tests 270 passed (270)` | 0 |

首次执行时 interactions 为 14 passed / 1 failed、content 为 8 passed / 1 failed，均为用例定位器问题（见 §4），修正测试后全部通过；产品代码未因此变更。

基线未被修改：`git status` 中 `e2e/__screenshots__/` 无任何改动；21 张基线仍为 T-E3.0（a3d455f）冻结的 v2 输出。

## 2. 正文对等（66/66）

`e2e/parity.spec.ts` 读取 `e2e/routes.json` 的 66 条 hash 路由，分别以 v2（`/index.html#<route>`）与 React（`/index.next.html#<route>`）打开，逐路由比较 `main` 的 `innerText` 严格相等；每个上下文独立收集 `console` error 与 `pageerror` 并断言为空。结果：66/66 相等，控制台错误 0。

唯一一次文本差异出现在首轮 `#/lab`（65/66）：React 初始渲染即输出「还没有请求记录。」，v2 只在发送或重置之后渲染该占位。修复见 §4.1。

## 3. 视觉对等（21/21）

页面 × 视口：home、stage-s0、lesson-s0-l1、lesson-s7-l5、project-p-graduation、lab、report × 1440x900 / 768x1024 / 390x844。流程与基线冻结时一致：清空 localStorage、重载、等字体与 `networkidle`、关闭动画、`fullPage` 截图，Playwright 默认逐像素阈值（无 mask、无 `maxDiffPixels` 放宽）。

首轮 9 项失败（7 页 @1440 + home/stage-s0 @768），逐一定位后归因于两类可解释差异，修复后第二轮 21/21：

### 3.1 差异 A：侧栏折叠箭头（9 页 @1440 各 9 处）

- 现象：home @1440 差异 98 px，其中 9 个簇位于侧栏阶段节点右侧（x≈265–268，y≈135/209/282/356/430/504/578/652/737），每簇数像素；其余页 @1440 同型。
- 根因：v2 的 `web/scripts/ui.js:2` 用 `document.createElement(tag)` 创建元素，`h('svg', …)`（`app.js:64`）得到的是 HTML 命名空间的 unknown element，`viewBox` 被序列化为 `viewbox`，`innerHTML` 的 `<path>` 也按 HTML 解析；实测 v2 页面中该箭头 `pathRect` 为 0×0，**基线里从未绘制过箭头**。React JSX 是真正的 SVG，于是多出可见箭头。
- 处理：v2 不改（不变量）；让 React 渲染结果与 v2 已渲染像素一致——`Sidebar.tsx` 中把箭头 SVG 换成同 class 的空 `<span className="stage-node__chevron">`。该元素在 v2 中本就占 14px 弹性槽位但不绘制，空盒保持标题/徽标位置完全不变（`.stage-node__title { flex: 1 }`），且不产生任何像素。

### 3.2 差异 B：计数文本的文本节点粒度（亚像素抗锯齿）

- 现象：hero「0/45」在 1440 有 10 px 差异（x≈743/753，y≈436–448）；home @768 有 11 px（bbox [331,420]–[341,434]，即「8 + 1」）；stage-s0 @768 有 2 px（bbox [564,236]–[569,240]，即「已完成 0/8」）。
- 根因：v2 用单个模板字符串生成一个文本节点（`${done}/${total}`、`${n} + 1`），React JSX 的 `{a}/{b}`、`{n} + 1` 被拆成多个相邻文本节点，Chrome 对多节点文本的字形布局/抗锯齿产生亚像素级差异。
- 处理：将这些复合计数改为单一模板字符串——`OverviewPage.tsx` 的「N + 1」与「done/total」，`StagePage.tsx` 的「N 讲」「已完成 d/N」「N 题」，`Sidebar.tsx` 阶段徽标「d/N」。内容、ID、样式均未变。

上述修复后 21/21 通过，且 `e2e/__screenshots__/` 零改动。

## 4. 交互清单（15/15）与截图

`e2e/interactions.spec.ts` 在 React 入口执行 12 项交互清单 + 3 项旧数据夹具，逐项断言 DOM/状态并截图；每个用例结束断言 `console error` 与 `pageerror` 为空（全部为 `[]`）：

| 用例 | 断言要点 | 截图 |
| --- | --- | --- |
| 课程目录与阶段展开 | 阶段节点展开/收起、aria-expanded、链接可见 | — |
| 搜索：输入与跳转 | 聚焦后按需加载索引，`LinkHub` 出现 option，点击跳转课时 | `screenshots/search-results.png` |
| 语言轨道切换 | Node/Python 切换、`bff-lab-lang-v1` 持久化、刷新保持 | `screenshots/lang-python.png` |
| 检查题作答 | 错误选项反馈 `is-wrong` +「再试一次」 | `screenshots/mcq-wrong.png` |
| 代码题判分 | 运行通过、`solved` 落盘 | `screenshots/code-task-pass.png` |
| SQL 题判分 | 结果集匹配、通过态 | `screenshots/sql-task-correct.png` |
| 方案题自检 | 勾满清单完成、刷新保持 | `screenshots/design-complete.png` |
| 项目里程碑 | 勾选 `1/11`、刷新保持 | `screenshots/project-persist.png` |
| 模板复制 | 剪贴板内容非空、「已复制」态与 toast | `screenshots/template-copied.png` |
| 实验台 429 连发 | 三次 429、`retry-after: 3`、幂等重放 `true`、重置清空 | `screenshots/lab-429-idempotent.png`、`screenshots/lab-reset.png` |
| 报告页统计 | 预置进度后统计与错题行正确 | `screenshots/report-stats.png` |
| 旧进度迁移 | `meta.version < 2` 的 s6-lN 迁移为 aN、已掌握与错题展示 | `screenshots/legacy-mastered.png`、`screenshots/legacy-wrong-answer.png` |

截图目录：`docs/reviews/frontend-engineering/e3/screenshots/`（13 张）。

### 4.1 用例定位器修复（非产品缺陷）

1. `interactions.spec.ts:237`：重置后断言占位文本，`page.locator('.list-stack')` 命中 4 个容器触发 strict mode。改为 `page.getByText('还没有请求记录。')`，断言目标不变。
2. `content.spec.ts:37`：课时页现有两个 tablist（代码块「语言实现」与练习区「练习语言」），`getByRole('tab', { name: 'Python' })` 命中 2 个。改为在「语言实现」tablist 内定位，断言语义不变。

## 5. 问题与修复汇总（产品代码）

1. **实验台初始空态对等**：`LabPage.tsx` 新增 `historyTouched` 状态，仅在发送或重置之后渲染「还没有请求记录。」，与 v2 的懒渲染一致；`lab.test.tsx` 增加回归断言「初始不出现占位」。修复后 `#/lab` 文本对等通过（66/66）。
2. **侧栏箭头像素对等**：见 §3.1。
3. **计数文本节点对等**：见 §3.2。

未改动：v2 运行时代码、课程内容与 ID、hash 路由、localStorage 键与迁移、`functions/`、样式表、21 张视觉基线。

## 6. 残余风险

- **Node 版本**：实机 v24.22.1 与 .nvmrc 22.15.0 不一致；全部命令在该版本通过，阶段报告注明。
- **v2 潜在 SVG 缺陷**：v2 侧栏 rail 图标（lab/report/graduation）同样因命名空间问题从未绘制，React 版本可见。该区域不在 21 张基线捕获范围内（固定在视口底部、滚动侧栏才可见），不在本任务门禁内；E4 视觉冻结/E5 单入口时以 React 为准复核。
- **字体渲染依赖**：文本节点粒度已对齐，但亚像素对等依赖本机字体栈；基线在本机生成，跨机器重跑可能产生细微 AA 差异。
- **Pyodide CDN**：Python 轨道交互依赖 `cdn.jsdelivr.net` 的 Pyodide（语言切换用例耗时 13.4s），离线环境下该用例会失败。
- **视觉门禁覆盖面**：像素基线仅覆盖 7 页 × 3 视口；全 66 路由的视觉一致性依靠文本对等 + 交互用例，不逐路由像素断言。

## 7. 提交

`T-E3.6: 对等验证（正文、交互、视觉）`（哈希见 `e3-parity.md` 阶段报告）。