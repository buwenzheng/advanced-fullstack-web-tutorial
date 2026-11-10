# E4 阶段报告：质量门禁（G-E4）

- 日期：2026-11-10
- 阶段文档：`docs/implementation/15-e4-quality-gates.md`
- 标签：`e4-qa`（本提交）
- 结论：**G-E4 通过**。66 路由、响应式、键盘、axe、双入口视觉、覆盖率、包体、懒加载强断言与 `npm run verify` 全部达标；CI 因未获推送授权未实际运行，记为残余风险。

## 0. 结论摘要

| 门禁 | 结果 |
| --- | --- |
| 静态与内容 | lint 0 error；typecheck 0 error；content 45/45；audit errors=0 warnings=0 |
| 单测与覆盖率 | 27 文件 / 287 测试通过；四目录阈值全部通过 |
| 构建与包体 | `dist/index.html` + `dist/index.next.html`；entry 147.8KB / lazy 85.1KB / search 194.7KB，3 PASS |
| React 66 路由 | 66/66；0 console.error、0 pageerror |
| 响应式 / 键盘 / axe | 25/25；7/7；14/14 扫描，0 serious/critical、0 moderate |
| 视觉双入口 | v2 21/21 + React 21/21，`maxDiffPixels: 0` |
| 对等与回归 | 正文对等 66/66；interactions 14/14（排除 @python）；v2 smoke 66/66；shell 2/2 |
| 一条命令复验 | `npm run verify` exit 0（269 passed / 55.9s） |

## 1. 环境

- OS：Windows 10.0.22631（x64）
- Node：v22.15.0（与 `.nvmrc` 一致，本阶段实测）
- 浏览器：Playwright Chromium（`playwright.config.ts` 另有 mobile project，本阶段门禁按任务卡使用 chromium）
- 入口：v2 `web/index.html` 仍为默认；React 入口 `/index.next.html`（视觉门禁通过 `VISUAL_ENTRY=index.next.html`）
- 服务：`npm run preview`（127.0.0.1:4173）

## 2. 命令与退出码（G-E4 §9 顺序）

| # | 命令 | 退出码 | 结果摘要 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | `npm run lint` | 0 | eslint 无 error | `tmp/ge4.log`（临时，gitignore） |
| 2 | `npm run typecheck` | 0 | 两个 tsconfig 均通过 | 同上 |
| 3 | `npm run content:validate` | 0 | stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400 | `e4/baseline.txt`、`e4/inventory.txt` |
| 4 | `npm run audit:content` | 0 | mode=ready lessons=45 draft=0 errors=0 warnings=0 | `e4/baseline.txt` |
| 5 | `npm run audit:exercises` | 0 | js 38 全过；sql 2 全过；starter 仍 38 失败（预期） | `e4/baseline.txt` |
| 6 | `npm run test:coverage` | 0 | 27 文件 / 287 测试；四目录阈值通过 | `e4/coverage.md`、`e4/coverage-after.txt` |
| 7 | `npm run build` | 0 | 产出 `dist/index.html`、`dist/index.next.html`、manifest 与 14 个 JS | `e4/bundle.json` |
| 8 | `npm run budget` | 0 | 3 PASS，见 §7 | `e4/bundle.txt` |
| 9 | `npx playwright test e2e/routes.spec.ts --project=chromium` | 0 | 66 passed (11.3s) | `e4/specs.txt`、`docs/reviews/frontend-engineering/e4/screenshots/` |
| 10 | `npx playwright test e2e/responsive.spec.ts --project=chromium` | 0 | 25 passed (6.2s) | 同上 |
| 11 | `npx playwright test e2e/keyboard.spec.ts --project=chromium` | 0 | 7 passed (3.6s) | 同上 |
| 12 | `npx playwright test e2e/a11y.spec.ts --project=chromium` | 0 | 14 passed (7.3s) | `e4/a11y-after.txt`、`e4/a11y-moderate.txt` |
| 13 | `npx playwright test e2e/visual.spec.ts --project=chromium` | 0 | 21 passed (8.0s)，v2 入口 | `e4/visual.md`、`e4/visual-v2-after.txt` |
| 14 | `VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium` | 0 | 21 passed (8.5s)，React 入口 | `e4/visual-react-after.txt` |
| 15 | `npx playwright test e2e/parity.spec.ts --project=chromium` | 0 | 66 passed (20.1s) | `e3/parity-report.md`、`e4/specs.txt` |
| 16 | `npx playwright test e2e/interactions.spec.ts --project=chromium --grep-invert "@python"` | 0 | 14 passed (7.3s) | `e3/screenshots/` |
| 17 | `npx playwright test e2e/smoke.spec.ts --project=chromium` | 0 | 66 passed (12.8s) | `e2/` 基线沿用 |
| 18 | `npx playwright test e2e/shell.spec.ts --project=chromium` | 0 | 2 passed (4.8s) | `e2/` 基线沿用 |
| 19 | `npm run verify` | 0 | 269 passed (55.9s)，构成见 `package.json` | `e4/verify.txt` |

完整原始日志保存在 `tmp/ge4.log` 与 `tmp/*.log`（被 gitignore，不提交）。

## 3. 66 路由与控制台

- `e2e/routes.spec.ts`：66/66 通过；每条路由等待 `main h1`，断言可见且唯一；失败路由可按单条 title 过滤重跑。
- 控制台：routes 用例收集 `console.error` 与 `pageerror`，66 条路由均为 0。
- `e2e/smoke.spec.ts`：v2 默认入口 66/66，确认默认入口未受 E4 改动影响。
- shell/content 不再重复跑 66 循环：66 循环集中在 routes 与 smoke 两个 spec。

## 4. 响应式、键盘与 axe

- 响应式：25 项检查通过（`e2e/responsive.spec.ts`，覆盖 390/768/1280 等断点与抽屉、表格、代码块布局）。
- 键盘：7 项通过（Tab 顺序、抽屉 Escape、搜索 Esc/Enter、任务控件可获得焦点）。
- axe：14 次扫描（7 页 × 1440/390，tags `wcag2a/wcag2aa/wcag21a/wcag21aa`）通过；serious/critical 为 0，moderate/minor 也为 0（`NON_BLOCKING_COUNT=0`，KI-10）。
- 修复记录：可滚动容器 7 处 `tabIndex={0}` + 行级 eslint 豁免（KI-11）；未全局禁用 axe 规则，未缩小扫描页面集合。

## 5. 视觉回归（双入口）

- 基线：21 张（7 页 × 1440x900 / 390x844 等组合），快照模板 `e2e/__screenshots__/{arg}{ext}`。
- v2 默认入口：21/21 通过；React 入口（`VISUAL_ENTRY=index.next.html`）：21/21 通过。
- 配置：`animations: disabled`、`caret: hide`、`maxDiffPixels: 0`；未使用 mask、未放宽阈值、未更新基线。
- 差异：双入口同路由对比存在顶栏约 30 px 的亚阈值抗锯齿差异（逐通道差 >8，低于 pixelmatch 默认 0.2 判定），不影响 21/21 结论，记入 KI-12。
- 证据：`e4/visual.md`、`e4/visual-baseline-filelist.txt`、`e4/visual-baseline-diff.txt`、`e4/visual-resample-before.txt`、`e4/visual-v2-after.txt`、`e4/visual-react-after.txt`、`e4/resample-diff-s0-l1-1440x900.png`。

## 6. 覆盖率（四目录）

口径：`coverage/coverage-summary.json` 逐文件 `covered/total` 求和（与 Vitest 阈值判定同源）。

| 目录 | lines | functions | statements | branches | 阈值（L/F/S/B） | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| `web/scripts/app/**` | 92.46% | 89.66% | 90.51% | 77.40% | 60/60/60/55 | 通过 |
| `web/scripts/content/**` | 95.29% | 100.00% | 89.74% | 78.35% | 85/85/85/70 | 通过 |
| `web/scripts/engine/**` | 94.04% | 96.69% | 91.78% | 81.88% | 85/85/85/70 | 通过 |
| `web/scripts/state/**` | 100.00% | 100.00% | 99.31% | 92.71% | 85/85/85/75 | 通过 |

- 合计：91.28% statements / 79.66% branches / 93.53% functions / 93.92% lines（`coverage.md`）。
- 补测：content statements 82.64%→89.74%，engine statements 84.25%→91.78%；未下调阈值、未缩小 include。
- 证据：`e4/coverage.md`、`e4/coverage-before.txt`、`e4/coverage-after.txt`。

## 7. 包体预算与懒加载

三项预算（`tools/bundle-budget.ts`，gzip 口径，`npm run budget` exit 0）：

| 项 | 实测 | 上限 | 结果 |
| --- | --- | --- | --- |
| entry（index.next.html 闭包） | 151364B / 147.8KB | 184320B / 180KB | PASS |
| lazy 最大 chunk（appendix） | 87116B / 85.1KB | 153600B / 150KB | PASS |
| search index（独立计量） | 199335B / 194.7KB | 307200B / 300KB | PASS |

- 入口闭包 2 个文件：`harness-BMG4catt.js`、`next-D6WjBgW_.js`；total js 14 文件 752.9KB，entry css 8.4KB（参考值）。
- `dist/.vite/manifest.json` 由 `build.manifest: true` 生成；manifest 键集合 15 条。
- 懒加载网络证据（`e4/lazy-network.txt`，6/6 断言）：
  1. 首页 JS 请求 ⊆ 入口闭包；
  2. 进入 `s0-l1` 出现 ≥1 个闭包外 JS（`s0-*.js`）；
  3. 进入 `s0-l2` 闭包外集合不新增（同阶段共享 chunk）；
  4. 进入 `s1-l1` 新增 1 个闭包外 JS（`s1-*.js`）；
  5. 首页无 `search-index-*.js` 请求；
  6. 聚焦搜索框后出现 `search-index-*.js` 请求且结果渲染。
- `e2e/content.spec.ts` 的 `lazy 入口闭包与阶段 chunk 强断言` 与 `search 索引在聚焦搜索框后才按需下载并可用` 两条用例在 verify 中通过（ok 21/22）。
- Vite 仍有 raw >500 kB 提示（`search-index` 507 kB），预算以 gzip 300KB 为门禁口径并已通过，见 KI-9。

## 8. CI 运行结果

- workflow：`.github/workflows/verify.yml` 仅执行 `npm ci` + `npx playwright install --with-deps chromium` + `npm run verify`，失败上传 `playwright-report/`、`coverage/`；无密钥、无 `continue-on-error`。
- 状态：**未运行**。执行规则 4 要求「不推送远程，除非用户明确要求」，本轮未获推送授权，因此未触发 Actions。
- 平台策略：`@visual` 在 CI 排除（截图跨平台字体差异）；`@python` 在 CI 排除（Pyodide CDN 依赖），发布前本地手跑。
- 待办：推送后确认 Actions 绿色；该验证记入残余风险与 E6 发布前检查。

## 9. 已知问题

完整列表见 `docs/reviews/frontend-engineering/known-issues.md`。与 E4 门禁相关的条目：

- **KI-2** Python 轨道依赖 Pyodide CDN：@python 用例在本地 verify 中排除，发布前手跑；CI 不跑。
- **KI-10** axe 非阻塞问题为零：moderate/minor 违规数 0，无需处理。
- **KI-11** 可滚动容器 `tabIndex` 与 lint 规则冲突：7 处行级豁免并附原因，未改全局配置。
- **KI-12** 双入口顶栏亚阈值渲染差异：不影响 21/21，E5 单入口后自然消失。
- **KI-9** 搜索 chunk raw >500 kB 提示：预算按 gzip 300KB 判定通过，接受该提示。
- **KI-13（新增）** CI 未运行：workflow 已提交但未经 Actions 验证；@visual/@python 在 CI 排除。

## 10. 残余风险

- CI 未实际运行：workflow 语法、缓存与 20 分钟超时未经平台验证。
- Python 用例未纳入 verify/CI：语言轨切换仅在发布前手跑，Pyodide 加载失败依赖运行时提示。
- entry 余量 32.2KB（147.8/180）：后续新增 eager 代码需重新过预算。
- 搜索首开成本 194.7KB gzip：仅聚焦搜索框后发生，低带宽下首次搜索有可感知延迟。
- 视觉基线平台绑定：CI 不跑视觉，跨平台漂移无法在 CI 发现，依赖本地 Windows 门禁。
- v2 默认入口仍保留：双入口并存，E5 才收敛；期间新增改动需同时通过两入口门禁。

## 11. 提交与标签

| 任务 | 提交 |
| --- | --- |
| T-E4.0 冻结门禁清单与现状测量 | `f0ddd9a` |
| T-E4.1 66 路由与控制台门禁 | `4d409b4` |
| T-E4.2 响应式与键盘门禁 | `833c7e4` |
| T-E4.3 axe 扫描与可访问性修复 | `3bceb74` |
| T-E4.4 视觉回归冻结与双入口验证 | `bfb2cb1` |
| T-E4.5 覆盖率阈值与补测 | `ec7ddcf` |
| T-E4.6 包体预算与懒加载强断言 | `d89d9d6` |
| T-E4.7 verify 与 CI 整合 | `fdebae1` |
| T-E4.8 G-E4 门禁、报告与标签 | 本提交（见 `git log`） |

标签：`e4-qa`。

## 12. 边界声明

- 未修改课程内容语义、课时/题目 ID、标题、时长、答案与测试。
- 未修改 hash URL、localStorage 键与迁移规则。
- 未修改 `functions/`；未新增运行时依赖。
- 未切换默认入口（v2 smoke 66/66 保持）；未发布。
- 门禁未使用 retries、fixme、全局 axe 豁免、视觉 mask 或放宽 `maxDiffPixels` 来变绿。
